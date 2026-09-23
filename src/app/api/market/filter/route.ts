import { readFile, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
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

async function readFilter(): Promise<FilterData> {
  try {
    const raw = await readFile(FILTER_FILE, "utf-8");
    const parsed = JSON.parse(raw) as FilterData;
    if (Array.isArray(parsed.selectedFields)) {
      parsed.selectedFields = parsed.selectedFields.filter((f: string) =>
        (ALL_FIELDS as readonly string[]).includes(f),
      );
      return parsed;
    }
  } catch {}
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
    const body = (await request.json()) as FilterData;
    const fields = Array.isArray(body.selectedFields)
      ? body.selectedFields.filter((f: string) => (ALL_FIELDS as readonly string[]).includes(f))
      : [...ALL_FIELDS];
    const data: FilterData = { selectedFields: fields };
    await writeFile(FILTER_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Không thể lưu filter." },
      { status: 500 },
    );
  }
}
