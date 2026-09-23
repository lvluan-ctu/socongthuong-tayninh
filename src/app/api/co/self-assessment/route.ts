import { NextResponse } from "next/server";
import { TT40_CONDITIONS, TT40_REF } from "@/lib/co/co-regulation";
import {
  readSelfAssessment,
  validateSelfAssessment,
  writeSelfAssessment,
} from "@/lib/co/co-store";

export const dynamic = "force-dynamic";

/** GET /api/co/self-assessment — bản tự đánh giá điều kiện cấp (Phụ lục III TT 40/2025). */
export async function GET() {
  try {
    const data = await readSelfAssessment();
    return NextResponse.json({
      regulation: TT40_REF,
      conditions: TT40_CONDITIONS,
      assessment: data,
      allMet: TT40_CONDITIONS.every((c) => data.items.find((i) => i.id === c.id)?.met === true),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể đọc bản tự đánh giá." },
      { status: 500 },
    );
  }
}

/** PUT /api/co/self-assessment — cập nhật bản tự đánh giá. */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const result = validateSelfAssessment(body);
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }
    await writeSelfAssessment(result.data);
    return NextResponse.json({
      regulation: TT40_REF,
      conditions: TT40_CONDITIONS,
      assessment: result.data,
      allMet: TT40_CONDITIONS.every((c) => result.data.items.find((i) => i.id === c.id)?.met === true),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể lưu bản tự đánh giá." },
      { status: 500 },
    );
  }
}
