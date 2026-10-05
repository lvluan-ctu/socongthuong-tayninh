// Store C/O demo — đọc/ghi file JSON như backend thật.
// Chỉ import từ API route (server) — không import từ client.
import "server-only";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CoApplication, CoSelfAssessment, CoStatusEvent, CoWorkflowAction } from "./co-types";
import { findTransition, PROVINCE_RECEIVING_AGENCY, TT40_CONDITIONS } from "./co-regulation";
import {
  coSelfAssessmentSchema,
  coTransitionSchema,
  type CoCreateInput,
} from "./co-schemas";
import type { z } from "zod";

export const CO_APPLICATIONS_FILE = path.resolve(
  process.cwd(),
  "src/data/co-applications.json",
);
export const CO_SELF_ASSESSMENT_FILE = path.resolve(
  process.cwd(),
  "src/data/co-self-assessment.json",
);

export type { CoCreateInput };

// ---------------------------------------------------------------------------
// Store helpers
// ---------------------------------------------------------------------------

export async function readApplications(): Promise<CoApplication[]> {
  try {
    const raw = await readFile(CO_APPLICATIONS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoApplication[]) : [];
  } catch {
    return [];
  }
}

export async function writeApplications(apps: CoApplication[]): Promise<void> {
  await writeFile(CO_APPLICATIONS_FILE, JSON.stringify(apps, null, 2) + "\n", "utf-8");
}

export function nextApplicationNo(apps: CoApplication[]): string {
  const year = new Date().getFullYear();
  const prefix = `TN/CO/${year}/`;
  const seq =
    apps
      .filter((a) => a.applicationNo.startsWith(prefix))
      .map((a) => Number(a.applicationNo.slice(prefix.length)))
      .filter((n) => Number.isFinite(n))
      .reduce((max, n) => Math.max(max, n), 0) + 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

export function nextCoNumber(apps: CoApplication[]): string {
  const year = new Date().getFullYear();
  const prefix = `CO/TN/${year}/`;
  const seq =
    apps
      .filter((a) => a.coNumber?.startsWith(prefix))
      .map((a) => Number((a.coNumber ?? "").slice(prefix.length)))
      .filter((n) => Number.isFinite(n))
      .reduce((max, n) => Math.max(max, n), 0) + 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

export function buildCreateEvent(
  app: Pick<CoApplication, "exporter">,
  at: string,
): CoStatusEvent {
  return {
    from: null,
    to: "DRAFT",
    action: "CREATE",
    by: app.exporter.name,
    at,
  };
}

export function applyTransition(
  app: CoApplication,
  input: { action: CoWorkflowAction; by: string; note?: string; approvedBy?: string; signerName?: string },
  allApps: CoApplication[] = [app],
): { ok: true; app: CoApplication } | { ok: false; message: string } {
  const transition = findTransition(app.status, input.action);
  if (!transition) {
    return {
      ok: false,
      message: `Không hợp lệ: không thể thực hiện "${input.action}" từ trạng thái "${app.status}".`,
    };
  }
  if (transition.requireNote && !input.note?.trim()) {
    return { ok: false, message: "Thao tác này bắt buộc nhập ghi chú/lý do." };
  }

  const now = new Date().toISOString();
  const next: CoApplication = {
    ...app,
    status: transition.target,
    reviewerNote: input.note?.trim() ? input.note.trim() : app.reviewerNote,
    updatedAt: now,
    statusHistory: [
      ...app.statusHistory,
      {
        from: app.status,
        to: transition.target,
        action: input.action,
        by: input.by,
        at: now,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      },
    ],
  };

  if (input.action === "ISSUE") {
    next.coNumber = app.coNumber ?? nextCoNumber(allApps);
    next.coIssuedDate = now.slice(0, 10);
    next.approvedBy = input.approvedBy ?? input.by;
    if (input.signerName?.trim()) {
      next.declaration = { ...next.declaration, signerName: input.signerName.trim() };
      next.declaration.signDate = next.declaration.signDate || now.slice(0, 10);
    }
  }

  return { ok: true, app: next };
}

export function validateSelfAssessment(
  input: z.input<typeof coSelfAssessmentSchema>,
): { ok: true; data: CoSelfAssessment } | { ok: false; message: string } {
  const parsed = coSelfAssessmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Dữ liệu tự đánh giá không hợp lệ." };
  }
  const known = new Set(TT40_CONDITIONS.map((c) => c.id));
  const unknown = parsed.data.items.filter((i) => !known.has(i.id));
  if (unknown.length > 0) {
    return { ok: false, message: `Điều kiện không hợp lệ: ${unknown.map((i) => i.id).join(", ")}` };
  }
  return { ok: true, data: parsed.data };
}

export async function readSelfAssessment(): Promise<CoSelfAssessment> {
  try {
    const raw = await readFile(CO_SELF_ASSESSMENT_FILE, "utf-8");
    return JSON.parse(raw) as CoSelfAssessment;
  } catch {
    return {
      items: TT40_CONDITIONS.map((c) => ({ id: c.id, met: false, note: "" })),
      assessedBy: "",
      assessedAt: "",
    };
  }
}

export async function writeSelfAssessment(data: CoSelfAssessment): Promise<void> {
  await writeFile(CO_SELF_ASSESSMENT_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export { PROVINCE_RECEIVING_AGENCY };
export type { CoApplication };
export type CoTransitionInput = z.input<typeof coTransitionSchema>;
