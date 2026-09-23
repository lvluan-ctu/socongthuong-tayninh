import { NextResponse } from "next/server";
import { readApplications, writeApplications } from "@/lib/co/co-store";
import { coUpdateSchema } from "@/lib/co/co-schemas";
import { isProvinceIssuableForm } from "@/lib/co/co-regulation";
import type { CoApplication } from "@/lib/co/co-types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const apps = await readApplications();
    const app = apps.find((a) => a.id === id);
    if (!app) return NextResponse.json({ message: "Không tìm thấy hồ sơ C/O." }, { status: 404 });
    return NextResponse.json(app);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể tải hồ sơ C/O." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const parsed = coUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Dữ liệu cập nhật không hợp lệ.",
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 400 },
      );
    }

    const apps = await readApplications();
    const index = apps.findIndex((a) => a.id === id);
    if (index < 0) return NextResponse.json({ message: "Không tìm thấy hồ sơ C/O." }, { status: 404 });

    const current = apps[index];
    const { status, reviewerNote, coNumber, coIssuedDate, approvedBy, ...rest } = parsed.data;

    if (rest.formCode && !isProvinceIssuableForm(rest.formCode)) {
      return NextResponse.json(
        { message: `Mẫu C/O "${rest.formCode}" không thuộc danh mục được phân cấp (Phụ lục II TT 40/2025).` },
        { status: 409 },
      );
    }

    // Chuyển trạng thái qua luồng hợp lệ — dùng endpoint transition.
    if (status && status !== current.status) {
      return NextResponse.json(
        { message: "Không thể đổi trạng thái trực tiếp — hãy dùng POST .../transition." },
        { status: 409 },
      );
    }

    const next: CoApplication = {
      ...current,
      ...(rest.formCode ? { formCode: rest.formCode } : {}),
      ...(rest.ftaCode ? { ftaCode: rest.ftaCode } : {}),
      ...(rest.certificateType ? { certificateType: rest.certificateType } : {}),
      ...(rest.exporter ? { exporter: rest.exporter } : {}),
      ...(rest.consignee ? { consignee: rest.consignee } : {}),
      ...(rest.transport ? { transport: rest.transport } : {}),
      ...(rest.items ? { items: rest.items } : {}),
      ...(rest.declaration ? { declaration: rest.declaration } : {}),
      ...(rest.dataSource ? { dataSource: rest.dataSource } : {}),
      ...(rest.metadata ? { metadata: rest.metadata } : {}),
      ...(reviewerNote !== undefined ? { reviewerNote } : {}),
      ...(coNumber !== undefined ? { coNumber } : {}),
      ...(coIssuedDate !== undefined ? { coIssuedDate } : {}),
      ...(approvedBy !== undefined ? { approvedBy } : {}),
      updatedAt: new Date().toISOString(),
    };

    apps[index] = next;
    await writeApplications(apps);
    return NextResponse.json(next);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể cập nhật hồ sơ C/O." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const apps = await readApplications();
    const app = apps.find((a) => a.id === id);
    if (!app) return NextResponse.json({ message: "Không tìm thấy hồ sơ C/O." }, { status: 404 });

    if (app.status !== "DRAFT") {
      return NextResponse.json(
        { message: "Chỉ được xóa hồ sơ ở trạng thái Nháp. Hãy hủy/thu hồi thay vì xóa." },
        { status: 409 },
      );
    }

    await writeApplications(apps.filter((a) => a.id !== id));
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể xóa hồ sơ C/O." },
      { status: 500 },
    );
  }
}
