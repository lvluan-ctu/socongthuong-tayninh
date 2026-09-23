import { NextResponse } from "next/server";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { isProvinceIssuableForm, PROVINCE_RECEIVING_AGENCY } from "@/lib/co/co-regulation";
import { coCreateSchema } from "@/lib/co/co-schemas";
import {
  buildCreateEvent,
  nextApplicationNo,
  readApplications,
  writeApplications,
} from "@/lib/co/co-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const pagination = parsePagination(query);
    const search = query.get("search")?.trim().toLowerCase();
    const status = query.get("status")?.trim();
    const ftaCode = query.get("ftaCode")?.trim();
    const formCode = query.get("formCode")?.trim();
    const dateFrom = query.get("dateFrom")?.trim();
    const dateTo = query.get("dateTo")?.trim();
    const wantsPagination =
      query.get("options") !== "true" && (query.has("page") || query.has("pageSize"));

    let items = await readApplications();

    if (search) {
      items = items.filter(
        (a) =>
          a.applicationNo.toLowerCase().includes(search) ||
          a.exporter.name.toLowerCase().includes(search) ||
          a.consignee.name.toLowerCase().includes(search) ||
          (a.coNumber ?? "").toLowerCase().includes(search),
      );
    }
    if (status && status !== "ALL") items = items.filter((a) => a.status === status);
    if (ftaCode) items = items.filter((a) => a.ftaCode === ftaCode);
    if (formCode) items = items.filter((a) => a.formCode === formCode);
    if (dateFrom) items = items.filter((a) => a.createdAt >= dateFrom);
    if (dateTo) items = items.filter((a) => a.createdAt <= dateTo + "T23:59:59Z");

    items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (!wantsPagination) return NextResponse.json({ items });
    return paginatedResponse(
      items.slice(pagination.offset, pagination.offset + pagination.pageSize),
      pagination,
      items.length,
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể tải danh sách hồ sơ C/O." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const parsed = coCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Dữ liệu hồ sơ không hợp lệ.",
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 400 },
      );
    }

    if (!isProvinceIssuableForm(parsed.data.formCode)) {
      return NextResponse.json(
        {
          message: `Mẫu C/O "${parsed.data.formCode}" không thuộc danh mục 20 mẫu được cấp theo Phụ lục II TT 40/2025/TT-BCT.`,
        },
        { status: 409 },
      );
    }

    const apps = await readApplications();
    const now = new Date().toISOString();
    const id = `CO-${Date.now()}`;
    const created = {
      ...parsed.data,
      id,
      applicationNo: nextApplicationNo(apps),
      receivingAgency: PROVINCE_RECEIVING_AGENCY,
      status: "DRAFT" as const,
      coNumber: null,
      coIssuedDate: null,
      approvedBy: null,
      reviewerNote: null,
      statusHistory: [buildCreateEvent({ exporter: parsed.data.exporter }, now)],
      createdAt: now,
      updatedAt: now,
    };

    apps.push(created);
    await writeApplications(apps);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể tạo hồ sơ C/O." },
      { status: 500 },
    );
  }
}
