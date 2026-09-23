import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GET as getMissionSummaryResponse } from '@/app/api/energy/tasks/[taskId]/summary/route';
import { energyAiJobResults, energyAiJobs } from '@/db/schema';
import { db } from '@/lib/db';
import { getMissionAiConfig } from '@/lib/mission-ai';
import { executeMissionAi, getMissionAiRuntime, type MissionSummary } from '@/server/ai/mission-ai';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  queryType: z.string().trim().min(1).max(100),
  horizon: z.coerce.number().int().min(3).max(24).default(6),
  confidence: z.coerce.number().int().refine((value) => [80, 90, 95].includes(value), 'Mức tin cậy phải là 80, 90 hoặc 95.'),
  scenario: z.enum(['baseline', 'growth', 'efficiency']).default('baseline'),
  prompt: z.string().trim().min(10).max(2_000),
});

type Context = { params: Promise<{ taskId: string }> };

function hashInput(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function publicRuntime(taskId: number) {
  const runtime = getMissionAiRuntime(taskId);
  return { enabled: runtime.enabled, mock: runtime.mock || !runtime.externalCompatible, endpointConfigured: Boolean(runtime.endpoint) };
}

async function loadMissionSummary(taskId: string) {
  const response = await getMissionSummaryResponse(
    new Request(`http://internal/api/energy/tasks/${taskId}/summary`),
    { params: Promise.resolve({ taskId }) },
  );
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? 'Không thể truy vấn dữ liệu nhiệm vụ.'));
  return payload;
}

export async function GET(request: Request, context: Context) {
  const { taskId: taskIdRaw } = await context.params;
  const taskId = Number(taskIdRaw);
  const config = getMissionAiConfig(taskId);
  if (!config) return NextResponse.json({ message: 'Nhiệm vụ không tồn tại.' }, { status: 404 });

  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');
    if (jobId) {
      if (!z.string().uuid().safeParse(jobId).success) return NextResponse.json({ message: 'Mã lần chạy AI không hợp lệ.' }, { status: 400 });
      const [jobRows, resultRows] = await Promise.all([
        db.select().from(energyAiJobs).where(and(eq(energyAiJobs.id, jobId), eq(energyAiJobs.missionCode, config.missionCode))).limit(1),
        db.select().from(energyAiJobResults).where(eq(energyAiJobResults.jobId, jobId)).limit(1),
      ]);
      if (!jobRows[0]) return NextResponse.json({ message: 'Không tìm thấy lần chạy AI.' }, { status: 404 });
      return NextResponse.json({ job: jobRows[0], result: resultRows[0] ?? null, config, runtime: publicRuntime(taskId) });
    }

    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') ?? 20)));
    const items = await db.select().from(energyAiJobs)
      .where(eq(energyAiJobs.missionCode, config.missionCode))
      .orderBy(desc(energyAiJobs.createdAt))
      .limit(limit);
    return NextResponse.json({ items, config, runtime: publicRuntime(taskId) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải lịch sử AI.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  const startedAtMs = Date.now();
  const requestId = request.headers.get('x-request-id')?.trim() || randomUUID();
  const { taskId: taskIdRaw } = await context.params;
  const taskId = Number(taskIdRaw);
  const config = getMissionAiConfig(taskId);
  if (!config) return NextResponse.json({ message: 'Nhiệm vụ không tồn tại.' }, { status: 404 });
  let jobId: string | null = null;

  try {
    const input = requestSchema.parse(await request.json());
    if (!config.queryTypes.some((item) => item.value === input.queryType)) {
      return NextResponse.json({ message: 'Loại truy vấn không thuộc nhiệm vụ này.' }, { status: 400 });
    }
    const runtime = getMissionAiRuntime(taskId);
    const snapshot = { ...input, taskId, missionCode: config.missionCode };
    const now = new Date();
    const [job] = await db.insert(energyAiJobs).values({
      missionCode: config.missionCode,
      status: 'PENDING',
      entityType: config.entityType,
      requestedBy: request.headers.get('x-user-id')?.trim() || 'energy-app-v2-ui',
      requestId,
      inputSnapshot: snapshot,
      inputHash: hashInput(snapshot),
      isMock: runtime.mock || !runtime.externalCompatible,
      createdAt: now,
      updatedAt: now,
    }).returning();
    jobId = job.id;

    await db.update(energyAiJobs).set({
      status: 'PROCESSING', startedAt: new Date(), progressPct: 20,
      progressStep: 'PREPARING_MISSION_DATA', updatedAt: new Date(),
    }).where(eq(energyAiJobs.id, job.id));

    const summary = await loadMissionSummary(taskIdRaw);
    await db.update(energyAiJobs).set({ progressPct: 55, progressStep: runtime.mock || !runtime.externalCompatible ? 'LOCAL_ANALYTICS' : 'CALLING_AI_SERVICE', updatedAt: new Date() }).where(eq(energyAiJobs.id, job.id));
    const execution = await executeMissionAi(config, summary as unknown as MissionSummary, input, requestId);
    const result = execution.result;
    const latencyMs = Date.now() - startedAtMs;

    await db.transaction(async (tx) => {
      await tx.insert(energyAiJobResults).values({
        jobId: job.id,
        generatedAt: new Date(result.generatedAt),
        dataCutoff: new Date(result.dataCutoff),
        horizonValue: result.horizon,
        horizonUnit: 'PERIOD',
        confidenceValue: String(result.confidence),
        confidenceScale: 'PERCENT',
        summary: result.summary,
        series: result.series,
        alerts: result.alerts,
        tableData: { recommendations: result.recommendations },
        metadata: {
          mode: result.mode,
          metricTitle: result.metricTitle,
          unit: result.unit,
          provenance: result.provenance,
          queryType: input.queryType,
          scenario: input.scenario,
        },
        rawResponse: execution.rawResponse,
      });
      await tx.update(energyAiJobs).set({
        status: 'SUCCESS', externalRequestId: result.requestId,
        modelName: result.model.name, modelVersion: result.model.version,
        progressPct: 100, progressStep: 'COMPLETED', latencyMs,
        completedAt: new Date(), updatedAt: new Date(),
      }).where(eq(energyAiJobs.id, job.id));
    });

    return NextResponse.json({ jobId: job.id, status: 'SUCCESS', result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể thực hiện phân tích AI.';
    if (jobId) {
      await db.update(energyAiJobs).set({
        status: 'FAILED', errorCode: error instanceof z.ZodError ? 'AI_INVALID_REQUEST' : 'AI_EXECUTION_FAILED',
        errorMessage: message, latencyMs: Date.now() - startedAtMs,
        completedAt: new Date(), updatedAt: new Date(),
      }).where(eq(energyAiJobs.id, jobId)).catch(() => undefined);
    }
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Dữ liệu yêu cầu AI không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message, requestId }, { status: 502 });
  }
}
