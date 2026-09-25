import { readFile, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { z } from "zod";
import path from "node:path";

export const dynamic = "force-dynamic";

const FILTER_FILE = path.resolve(process.cwd(), "src/data/market-filter.json");

const ALL_FIELDS = [
  "xang_dau",
  "gas",
  "phan_bon",
  "hoa_chat",
  "thuc_pham",
  "thuong_mai",
  "xay_dung",
  "dich_vu",
  "khac",
] as const;

type FilterData = { selectedFields: string[] };

const filterSchema = z.object({
  selectedFields: z.array(z.enum(ALL_FIELDS)).min(1, "Chọn ít nhất 1 lĩnh vực"),
});

async function readFilter(): Promise<FilterData> {
  try {
    const raw = await readFile(FILTER_FILE, "utf-8");
    const parsed = JSON.parse(raw) as FilterData;
    if (Array.isArray(parsed.selectedFields)) {
      const cleaned = parsed.selectedFields.filter((f: string) =>
        (ALL_FIELDS as readonly string[]).includes(f),
      );
      if (cleaned.length > 0) return { selectedFields: cleaned };
    }
  } catch (error) {
    console.error("[market/filter] Không đọc được filter:", error);
  }
  return { selectedFields: [...ALL_FIELDS] };
}

export async function GET() {
  try {
    const data = await readFilter();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể đọc filter." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const parsed = filterSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Dữ liệu filter không hợp lệ.",
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 400 },
      );
    }
    const data: FilterData = { selectedFields: [...parsed.data.selectedFields] };
    await writeFile(FILTER_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể lưu filter." },
      { status: 500 },
    );
  }
}
