import { desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { energySolarAssessments, energySolarDesigns, energySolarDesignVersions } from '@/db/schema';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const schema = z.object({
  assessmentId: z.string().uuid(),
  name: z.string().trim().max(250).nullable().optional(),
  createdBy: z.string().trim().max(150).nullable().optional(),
  sceneState: z.record(z.string(), z.unknown()).default({}),
  engineeringState: z.record(z.string(), z.unknown()).default({}),
  totalCapacityKwp: z.number().nonnegative(),
  annualYieldKwh: z.number().nonnegative().nullable().optional(),
  capex: z.number().nonnegative().nullable().optional(),
  paybackYears: z.number().nonnegative().nullable().optional(),
  avoidedCo2eKgYear: z.number().nonnegative().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const assessmentId = new URL(request.url).searchParams.get('assessmentId');
    if (!assessmentId) return NextResponse.json({ message: 'Thiếu assessmentId.' }, { status: 400 });

    const designs = await db.select().from(energySolarDesigns)
      .where(eq(energySolarDesigns.assessmentId, assessmentId))
      .orderBy(desc(energySolarDesigns.createdAt));
    if (!designs.length) return NextResponse.json({ items: [] });

    const versions = await db.select().from(energySolarDesignVersions)
      .where(eq(energySolarDesignVersions.designId, designs[0].id))
      .orderBy(desc(energySolarDesignVersions.versionNo));

    return NextResponse.json({
      items: designs,
      currentDesign: designs[0],
      versions: versions.map((row) => ({
        ...row,
        totalCapacityKwp: Number(row.totalCapacityKwp),
        annualYieldKwh: row.annualYieldKwh == null ? null : Number(row.annualYieldKwh),
        capex: row.capex == null ? null : Number(row.capex),
        paybackYears: row.paybackYears == null ? null : Number(row.paybackYears),
        avoidedCo2eKgYear: row.avoidedCo2eKgYear == null ? null : Number(row.avoidedCo2eKgYear),
      })),
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể tải design history.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const [assessment] = await db.select().from(energySolarAssessments)
      .where(eq(energySolarAssessments.id, payload.assessmentId)).limit(1);
    if (!assessment) return NextResponse.json({ message: 'Không tìm thấy Solar assessment.' }, { status: 404 });

    const result = await db.transaction(async (tx) => {
      let [design] = await tx.select().from(energySolarDesigns)
        .where(eq(energySolarDesigns.assessmentId, payload.assessmentId))
        .orderBy(desc(energySolarDesigns.createdAt)).limit(1);

      if (!design) {
        const code = `SD-${payload.assessmentId.slice(0, 8).toUpperCase()}`;
        [design] = await tx.insert(energySolarDesigns).values({
          assessmentId: payload.assessmentId,
          buildingAssetId: assessment.buildingAssetId,
          code,
          name: payload.name || `Thiết kế Solar ${code}`,
          status: 'DRAFT',
          currentVersion: 0,
          createdBy: payload.createdBy ?? 'energy-user',
        }).returning();
      }

      const [maxRow] = await tx.select({ maxVersion: sql<number>`COALESCE(MAX(${energySolarDesignVersions.versionNo}), 0)` })
        .from(energySolarDesignVersions)
        .where(eq(energySolarDesignVersions.designId, design.id));
      const nextVersion = Number(maxRow?.maxVersion ?? 0) + 1;

      const [version] = await tx.insert(energySolarDesignVersions).values({
        designId: design.id,
        versionNo: nextVersion,
        status: 'DRAFT',
        sceneState: payload.sceneState,
        engineeringState: payload.engineeringState,
        totalCapacityKwp: String(payload.totalCapacityKwp),
        annualYieldKwh: payload.annualYieldKwh == null ? null : String(payload.annualYieldKwh),
        capex: payload.capex == null ? null : String(payload.capex),
        paybackYears: payload.paybackYears == null ? null : String(payload.paybackYears),
        avoidedCo2eKgYear: payload.avoidedCo2eKgYear == null ? null : String(payload.avoidedCo2eKgYear),
      }).returning();

      const [updatedDesign] = await tx.update(energySolarDesigns)
        .set({ currentVersion: nextVersion })
        .where(eq(energySolarDesigns.id, design.id))
        .returning();

      return { design: updatedDesign, version };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Trạng thái thiết kế không hợp lệ.', issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Không thể lưu design version.' }, { status: 400 });
  }
}
