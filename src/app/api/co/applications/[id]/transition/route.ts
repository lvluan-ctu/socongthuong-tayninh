import { NextResponse } from "next/server";
import { applyTransition, readApplications, writeApplications } from "@/lib/co/co-store";
import { coTransitionSchema } from "@/lib/co/co-schemas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/co/applications/[id]/transition
 * Chuyển trạng thái hồ sơ theo luồng TT 40/2025:
 * DRAFT → SUBMITTED → PROCESSING → APPROVED → ISSUED (+ RETURNED/REJECTED/CANCELLED).
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const parsed = coTransitionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Thao tác không hợp lệ.",
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 400 },
      );
    }

    const apps = await readApplications();
    const index = apps.findIndex((a) => a.id === id);
    if (index < 0) return NextResponse.json({ message: "Không tìm thấy hồ sơ C/O." }, { status: 404 });

    const result = applyTransition(apps[index], parsed.data, apps);
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: 409 });
    }

    apps[index] = result.app;
    await writeApplications(apps);
    return NextResponse.json(result.app);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể chuyển trạng thái hồ sơ." },
      { status: 500 },
    );
  }
}
