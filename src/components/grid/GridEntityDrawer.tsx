import { ExternalLink } from "lucide-react";
import { WorkflowStatusBadge } from "@/components/grid/GridShared";
import { EnergyStatusBadge, FieldGrid } from "@/components/energy/EnergyShared";
import { EntityDetailDrawer } from "@/components/energy/EnergyShared";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import type { GridEntity } from "@/components/grid/GridMap";
import { corridorWidthM } from "@/lib/grid-geo";
import {
  OPERATION_LOG_TYPE_LABEL,
  OPERATION_STATUS_LABEL,
  PLAN_PHASE_LABEL,
  operationLogTone,
  operationStatusTone,
  planPhaseTone,
  type OperationLog,
} from "@/lib/grid-types";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/router-compat";

type TransformerRow = {
  id: string;
  no: string;
  type: string;
  capacityMva: number;
  voltageRatio: string;
  loadFactorPct: number;
};
const TRANSFORMER_COLUMNS: Column<TransformerRow>[] = [
  { key: "no", header: "Tổ máy", sortable: true, className: "font-medium text-navy" },
  { key: "type", header: "Loại", sortable: true },
  {
    key: "capacityMva",
    header: "Công suất",
    sortable: true,
    value: (row) => row.capacityMva,
    render: (row) => `${row.capacityMva} MVA`,
  },
  { key: "voltageRatio", header: "Tỷ số điện áp", sortable: true },
  {
    key: "loadFactorPct",
    header: "Tải",
    sortable: true,
    value: (row) => row.loadFactorPct,
    render: (row) => (
      <span
        className={cn(
          "font-semibold tabular-nums",
          row.loadFactorPct >= 100 ? "text-destructive" : "text-success",
        )}
      >
        {row.loadFactorPct}%
      </span>
    ),
  },
];

type PlanningPoleRow = {
  id: string;
  code: string;
  type: string;
  planning?: { structureType?: string; spacingKm?: number; clearanceStatus?: string };
};
const PLANNING_POLE_COLUMNS: Column<PlanningPoleRow>[] = [
  { key: "code", header: "Mã trụ", sortable: true, className: "font-medium text-navy" },
  {
    key: "structure",
    header: "Kết cấu",
    sortable: true,
    value: (row) => row.planning?.structureType ?? row.type,
  },
  {
    key: "spacing",
    header: "Khoảng cột",
    sortable: true,
    value: (row) => row.planning?.spacingKm ?? 0,
    render: (row) => (row.planning?.spacingKm ? `${row.planning.spacingKm} km` : "—"),
  },
  {
    key: "clearance",
    header: "Giải phóng mặt bằng",
    sortable: true,
    value: (row) => row.planning?.clearanceStatus ?? "—",
  },
];

function TransformerDataTable({ rows }: { rows: TransformerRow[] }) {
  return <DataTable columns={TRANSFORMER_COLUMNS} rows={rows} searchable={false} pageSize={8} />;
}

function PlanningPoleDataTable({ rows }: { rows: PlanningPoleRow[] }) {
  return <DataTable columns={PLANNING_POLE_COLUMNS} rows={rows} searchable={false} pageSize={8} />;
}

export function GridEntityDrawer({
  entity,
  onOpenChange,
}: {
  entity: GridEntity | null;
  onOpenChange: (value: boolean) => void;
}) {
  if (!entity) return null;
  const drawerContent = content(entity);
  return (
    <EntityDetailDrawer
      open
      onOpenChange={onOpenChange}
      title={drawerContent.title}
      description={drawerContent.description}
    >
      {drawerContent.children}
      <div className="mt-5 border-t border-border pt-4">
        <Button asChild className="w-full">
          <Link to="/energy/nhiem-vu-1/quan-ly">
            Đến trang quản lý dữ liệu
            <ExternalLink className="size-4" />
          </Link>
        </Button>
      </div>
    </EntityDetailDrawer>
  );
}

function OperationLogTimeline({ logs }: { logs: OperationLog[] }) {
  if (!logs.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Lịch sử vận hành
      </h3>
      <ol className="space-y-2 border-l-2 border-border pl-3">
        {logs.map((log) => (
          <li key={log.id} className="relative">
            <span
              className={cn(
                "absolute -left-[19px] top-1 size-2.5 rounded-full border-2 border-card",
                log.type === "energize"
                  ? "bg-success"
                  : log.type === "deenergize"
                    ? "bg-destructive"
                    : log.type === "incident"
                      ? "bg-warning"
                      : "bg-gov",
              )}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  operationLogTone(log.type),
                )}
              >
                {OPERATION_LOG_TYPE_LABEL[log.type]}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{log.time}</span>
            </div>
            <p className="mt-0.5 text-xs text-navy">{log.reason}</p>
            <p className="text-[11px] text-muted-foreground">
              {log.affected} · {log.actor}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function content(entity: GridEntity) {
  if (entity.kind === "substation") {
    const s = entity.item;
    return {
      title: s.name,
      description: `${s.voltageLevel} · ${s.district}`,
      children: (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <EnergyStatusBadge status={s.status} />
            {s.workflowStatus ? <WorkflowStatusBadge status={s.workflowStatus} /> : null}
            {s.switchingState ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  operationStatusTone(s.switchingState),
                )}
              >
                {OPERATION_STATUS_LABEL[s.switchingState]}
              </span>
            ) : null}
          </div>
          <FieldGrid
            items={[
              { label: "Mã trạm", value: s.code },
              { label: "Loại trạm", value: s.type },
              { label: "Cấp điện áp", value: s.voltageLevel },
              { label: "Địa chỉ", value: s.address },
              { label: "Đơn vị quản lý", value: s.operator },
              { label: "Công suất thiết kế", value: `${s.designCapacity ?? 0} MVA` },
              { label: "Công suất vận hành", value: `${s.operatingCapacity ?? 0} MVA` },
              { label: "Khả năng tiếp nhận", value: `${s.availableCapacity ?? 0} MVA` },
              { label: "Hệ số tải", value: `${s.loadFactor ?? 0}%` },
              {
                label: "Bán kính cấp điện",
                value: s.supplyRadiusKm ? `${s.supplyRadiusKm} km` : undefined,
              },
              { label: "Vùng cấp điện", value: s.supplyArea },
            ]}
          />
          {s.planned ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Quy hoạch
              </h3>
              <FieldGrid
                items={[
                  { label: "Vị trí dự kiến", value: s.planned.location },
                  { label: "Chủ đầu tư", value: s.planned.investor },
                  { label: "Tiến độ", value: s.planned.progress },
                  {
                    label: "Năm vận hành dự kiến",
                    value: s.planned.year ? String(s.planned.year) : undefined,
                  },
                ]}
              />
              {s.planned.phase ? (
                <span
                  className={cn(
                    "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    planPhaseTone(s.planned.phase),
                  )}
                >
                  {PLAN_PHASE_LABEL[s.planned.phase]}
                </span>
              ) : null}
            </section>
          ) : null}
          {s.transformers?.length ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Máy biến áp
              </h3>
              <TransformerDataTable
                rows={s.transformers.map((transformer) => ({ ...transformer, id: transformer.no }))}
              />
            </section>
          ) : null}
          {s.connectionPoints?.length ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Điểm đấu nối
              </h3>
              <div className="space-y-1.5">
                {s.connectionPoints.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-navy">{p.name}</p>
                      <p className="text-muted-foreground">{p.type}</p>
                    </div>
                    <EnergyStatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {s.operationLogs ? <OperationLogTimeline logs={s.operationLogs} /> : null}
        </div>
      ),
    };
  }

  if (entity.kind === "line") {
    const l = entity.item;
    return {
      title: l.name,
      description: `${l.voltageLevel} · ${l.lengthKm} km`,
      children: (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <EnergyStatusBadge status={l.status} />
            {l.workflowStatus ? <WorkflowStatusBadge status={l.workflowStatus} /> : null}
            {l.switchingState ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  operationStatusTone(l.switchingState),
                )}
              >
                {OPERATION_STATUS_LABEL[l.switchingState]}
              </span>
            ) : null}
          </div>
          <FieldGrid
            items={[
              { label: "Mã tuyến", value: l.code },
              { label: "Cấp điện áp", value: l.voltageLevel },
              { label: "Điểm đầu", value: l.fromPoint },
              { label: "Điểm cuối", value: l.toPoint },
              { label: "Chiều dài", value: `${l.lengthKm} km` },
              { label: "Khả năng tải", value: `${l.capacityMw ?? 0} MW` },
              { label: "Tải thực tế", value: `${l.actualLoadMw ?? 0} MW` },
              { label: "Tổn thất", value: `${l.lossPct ?? 0}%` },
              { label: "Hành lang an toàn", value: l.corridorStatus },
              {
                label: "Bề rộng hành lang (NĐ 14/2014)",
                value: `${corridorWidthM(l.voltageLevel)} m`,
              },
              { label: "Đơn vị quản lý", value: l.operator },
            ]}
          />
          {l.technical ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Thông số kỹ thuật
              </h3>
              <FieldGrid
                items={[
                  { label: "Dây dẫn", value: l.technical.conductorType },
                  { label: "Tiết diện", value: l.technical.crossSectionMm2 },
                  { label: "Số mạch", value: String(l.technical.lineCount) },
                  { label: "Độ cao trung bình", value: `${l.technical.avgHeightM} m` },
                  { label: "Cách điện", value: l.technical.insulation },
                  { label: "Chống sét", value: l.technical.groundingMethod },
                ]}
              />
            </section>
          ) : null}
          {l.operation ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Vận hành
              </h3>
              <FieldGrid
                items={[
                  { label: "Dòng tải", value: `${l.operation.currentLoadA} A` },
                  { label: "Lệch điện áp", value: `${l.operation.voltageDeviationPct}%` },
                  { label: "Điểm nóng", value: l.operation.hotSpot },
                  { label: "Tổn thất", value: `${l.operation.lossPct}%` },
                  { label: "Số lần quá tải", value: String(l.operation.overloadCount) },
                  { label: "Suất sự cố", value: `${l.operation.faultRatePerYear} lần/năm` },
                ]}
              />
            </section>
          ) : null}
          {l.planning ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Kế hoạch đầu tư
              </h3>
              <FieldGrid
                items={[
                  { label: "Vị trí", value: l.planning.location },
                  { label: "Nhà đầu tư", value: l.planning.investor },
                  { label: "Tiến độ", value: l.planning.progress },
                  {
                    label: "Năm dự kiến",
                    value: l.planning.year ? String(l.planning.year) : undefined,
                  },
                  { label: "Tổng mức đầu tư", value: l.planning.investment },
                  {
                    label: "Hành lang dự kiến",
                    value: l.planning.corridorWidthM ? `${l.planning.corridorWidthM} m` : undefined,
                  },
                ]}
              />
              {l.planning.phase ? (
                <span
                  className={cn(
                    "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    planPhaseTone(l.planning.phase),
                  )}
                >
                  {PLAN_PHASE_LABEL[l.planning.phase]}
                </span>
              ) : null}
            </section>
          ) : null}
          {l.planningPoles?.length ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Trụ điện quy hoạch
              </h3>
              <PlanningPoleDataTable rows={l.planningPoles} />
            </section>
          ) : null}
          {l.incidentRecords?.length ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Sự cố tuyến
              </h3>
              <div className="space-y-1.5">
                {l.incidentRecords.map((inc) => (
                  <div
                    key={inc.id}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          inc.severity === "high"
                            ? "bg-destructive/10 text-destructive"
                            : inc.severity === "medium"
                              ? "bg-warning/10 text-warning"
                              : "bg-success/10 text-success",
                        )}
                      >
                        {inc.code}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {inc.time}
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-navy">{inc.type}</p>
                    <p className="text-muted-foreground">{inc.location}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {inc.customersAffected ?? 0} khách hàng mất điện · {inc.lostLoadMw ?? 0} MW ·{" "}
                      {inc.outageDuration === "—" ? "chưa gián đoạn" : inc.outageDuration}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      Xử lý: {inc.handler} · {inc.progress}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {l.operationLogs ? <OperationLogTimeline logs={l.operationLogs} /> : null}
        </div>
      ),
    };
  }

  if (entity.kind === "pole") {
    const p = entity.item;
    return {
      title: p.code,
      description: `Trụ ${p.number} · ${p.lineCode}`,
      children: (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <EnergyStatusBadge status={p.foundationStatus} />
          </div>
          <FieldGrid
            items={[
              { label: "Mã trụ", value: p.code },
              { label: "Số trụ", value: p.number },
              { label: "Tuyến", value: p.lineCode },
              { label: "Loại trụ", value: p.type },
              { label: "Chiều cao", value: `${p.height} m` },
              { label: "Năm xây dựng", value: String(p.yearBuilt) },
              { label: "Nền móng", value: p.foundationStatus },
              { label: "Trạng thái kỹ thuật", value: p.technicalStatus },
              { label: "Hành lang an toàn", value: p.safetyCorridor },
              {
                label: "Tọa độ",
                value: p.latitude && p.longitude ? `${p.latitude}, ${p.longitude}` : undefined,
              },
            ]}
          />
          {p.images?.length ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Hình ảnh hiện trạng
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {p.images.map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt={`Ảnh hiện trạng trụ ${p.code}`}
                    loading="lazy"
                    className="aspect-video w-full rounded-md border border-border object-cover"
                  />
                ))}
              </div>
            </section>
          ) : null}
          {p.planning ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Kế hoạch xây dựng
              </h3>
              <FieldGrid
                items={[
                  { label: "Vị trí dự kiến", value: p.planning.location },
                  { label: "Khoảng cột", value: `${p.planning.spacingKm} km` },
                  { label: "Kết cấu dự kiến", value: p.planning.structureType },
                  { label: "Giải phóng mặt bằng", value: p.planning.clearanceStatus },
                  { label: "Hồ sơ kỹ thuật", value: p.planning.techDocs },
                  { label: "Hồ sơ môi trường", value: p.planning.envDocs },
                ]}
              />
            </section>
          ) : null}
        </div>
      ),
    };
  }

  const a = entity.item;
  return {
    title: a.name,
    description: `${a.code} · ${a.voltageLevel}`,
    children: (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {a.phase ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                planPhaseTone(a.phase),
              )}
            >
              {PLAN_PHASE_LABEL[a.phase]}
            </span>
          ) : null}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {a.progress}
          </span>
        </div>
        <FieldGrid
          items={[
            { label: "Mã", value: a.code },
            {
              label: "Loại",
              value:
                a.type === "substation"
                  ? "Trạm biến áp"
                  : a.type === "line"
                    ? "Đường dây"
                    : "Trụ điện",
            },
            { label: "Cấp điện áp", value: a.voltageLevel },
            { label: "Địa bàn", value: a.district },
            { label: "Vị trí", value: a.location },
            { label: "Nhà đầu tư", value: a.investor },
            { label: "Năm hoàn thành dự kiến", value: String(a.year) },
          ]}
        />
        {a.description ? (
          <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-navy">
            {a.description}
          </p>
        ) : null}
      </div>
    ),
  };
}
