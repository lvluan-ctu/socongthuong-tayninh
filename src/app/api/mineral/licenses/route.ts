import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getLicenses,
  getLicense,
  createLicense,
  updateLicense,
  deleteLicense,
  computeKpis,
} from "@/lib/mineral/mineral-store";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["HIEU_LUC", "NGUNG_HOAT_DONG", "HET_HAN", "CHUA_CAP"]).optional(),
  mineralCategory: z
    .enum(["CAT_XD", "DAT_SAN_LAP", "THAN_BUN", "DA_VOI_DA_SET", "SET_GACH_NGOI", "KHAC"])
    .optional(),
  district: z.string().trim().min(1).max(200).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

const createSchema = z.object({
  licenseNumber: z.string().trim().min(2).max(100),
  organizationName: z.string().trim().min(2).max(300),
  mineralType: z.string().trim().min(1).max(200),
  mineralCategory: z.enum(["CAT_XD", "DAT_SAN_LAP", "THAN_BUN", "DA_VOI_DA_SET", "SET_GACH_NGOI", "KHAC"]),
  totalReserve: z.coerce.number().min(0).optional().default(0),
  capacity: z.coerce.number().min(0).optional().default(0),
  area: z.coerce.number().min(0).optional().default(0),
  durationYears: z.coerce.number().min(0).max(100).optional().default(0),
  issueDate: z.string().trim().min(4).max(30).optional().default(""),
  expiryDate: z.string().trim().min(4).max(30).optional().default(""),
  geometry: z.string().max(20000).optional().default(""),
  status: z.enum(["HIEU_LUC", "NGUNG_HOAT_DONG", "HET_HAN", "CHUA_CAP"]).optional().default("HIEU_LUC"),
  notes: z.string().max(2000).optional(),
});

const updateSchema = createSchema.partial();

// GET /api/mineral/licenses - List with filter & pagination
export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({
      status: searchParams.get("status") || undefined,
      mineralCategory: searchParams.get("mineralCategory") || undefined,
      district: searchParams.get("district") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Tham số truy vấn không hợp lệ.",
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 400 },
      );
    }
    const result = await getLicenses({
      status: parsed.data.status as never,
      mineralCategory: parsed.data.mineralCategory as never,
      district: parsed.data.district,
      search: parsed.data.search,
      page: parsed.data.page ?? 1,
      pageSize: parsed.data.pageSize ?? 25,
    });
    const kpis = computeKpis(result.items);
    return NextResponse.json({ ...result, kpis });
  } catch (error) {
    console.error("Error fetching licenses:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to fetch licenses" },
      { status: 500 },
    );
  }
}

// POST /api/mineral/licenses - Create one license
export async function POST(request: Request) {
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Dữ liệu giấy phép không hợp lệ.",
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 400 },
      );
    }
    const created = await createLicense({
      stt: 0,
      extensions: [],
      location: { commune: "", district: parsed.data.mineralCategory ? "" : "", province: "Tây Ninh" },
      ...parsed.data,
    } as never);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /đã tồn tại/.test(error.message)) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error("Error creating license:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create license" },
      { status: 500 },
    );
  }
}

// PATCH /api/mineral/licenses?id=... - Update one license
export async function PATCH(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ message: "Thiếu tham số id." }, { status: 400 });
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Dữ liệu cập nhật không hợp lệ.",
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 400 },
      );
    }
    const updated = await updateLicense(id, parsed.data as never);
    if (!updated) return NextResponse.json({ message: "Không tìm thấy giấy phép." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating license:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update license" },
      { status: 500 },
    );
  }
}

// DELETE /api/mineral/licenses?id=... - Delete one license
export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ message: "Thiếu tham số id." }, { status: 400 });
    const license = await getLicense(id);
    if (!license) return NextResponse.json({ message: "Không tìm thấy giấy phép." }, { status: 404 });
    await deleteLicense(id);
    return NextResponse.json({ id, message: "Đã xóa giấy phép." });
  } catch (error) {
    console.error("Error deleting license:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete license" },
      { status: 500 },
    );
  }
}
