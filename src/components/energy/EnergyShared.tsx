import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BatteryCharging,
  Cable,
  Cloud,
  FileText,
  Leaf,
  Map as MapIcon,
  RefreshCw,
  Search,
  ShieldAlert,
  SolarPanel,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DetailDrawer } from "@/components/common/DetailDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const ENERGY_PERIODS = ["Quý II/2026", "Quý I/2026", "Tháng 6/2026", "Năm 2026"];
export const ENERGY_DISTRICTS = [
  "Toàn tỉnh",
  "TP. Tây Ninh",
  "Trảng Bàng",
  "Gò Dầu",
  "Bến Cầu",
  "Châu Thành",
  "Tân Biên",
];

export const ENERGY_MODULES: {
  label: string;
  to: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    label: "Tổng quan năng lượng",
    to: "/energy",
    icon: BarChart3,
    description: "Dashboard tổng quan, KPI, biểu đồ, xu hướng.",
  },
  {
    label: "GIS Năng lượng",
    to: "/energy/gis",
    icon: MapIcon,
    description: "Hiển thị không gian: trạm, tuyến, dự án, sự cố, trạm sạc.",
  },
  {
    label: "Lưới điện & Trạm biến áp",
    to: "/energy/grid",
    icon: Cable,
    description: "Quản lý trạm, đường dây, trụ điện, quy hoạch, khả năng mang tải.",
  },
  {
    label: "Dự án nguồn điện",
    to: "/energy/projects",
    icon: Zap,
    description: "Quản lý dự án điện mặt trời, gió, sinh khối, thủy điện, LNG.",
  },
  {
    label: "Điện mặt trời mái nhà",
    to: "/energy/rooftop-solar",
    icon: SolarPanel,
    description: "Hồ sơ hệ thống ĐMT mái nhà, đấu nối, sản lượng.",
  },
  {
    label: "Sử dụng & Tiết kiệm điện",
    to: "/energy/consumption",
    icon: Leaf,
    description: "Theo dõi tiêu thụ, phân tích, cơ sở tiêu thụ trọng điểm.",
  },
  {
    label: "An toàn lưới điện & Sự cố",
    to: "/energy/grid-safety",
    icon: ShieldAlert,
    description: "Quản lý hành lang, vi phạm, sự cố, tiến độ xử lý.",
  },
  {
    label: "Phát thải Carbon",
    to: "/energy/carbon",
    icon: Cloud,
    description: "Quản lý nguồn phát thải, tính toán CO2e, tín chỉ carbon.",
  },
  {
    label: "Trạm sạc điện",
    to: "/energy/charging-stations",
    icon: BatteryCharging,
    description: "Quản lý trạm sạc, công suất, số cổng, trạng thái hoạt động.",
  },
];

export function EnergyFilterBar({
  period,
  district,
  onPeriodChange,
  onDistrictChange,
  onRefresh,
}: {
  period: string;
  district: string;
  onPeriodChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Select value={period} onValueChange={onPeriodChange}>
        <SelectTrigger className="h-8 w-full min-w-[136px] bg-card sm:w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ENERGY_PERIODS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={district} onValueChange={onDistrictChange}>
        <SelectTrigger className="h-8 w-full min-w-[132px] bg-card sm:w-[138px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ENERGY_DISTRICTS.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => {
          onRefresh();
          toast.info("Đã làm mới dữ liệu năng lượng.");
        }}
      >
        <RefreshCw className="size-4" /> Làm mới
      </Button>
    </div>
  );
}

export function EnergyLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export function EnergyError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="p-6">
      <div className="gov-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-navy">Không tải được dữ liệu năng lượng</p>
            <p className="text-sm text-muted-foreground">Vui lòng thử tải lại dữ liệu.</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            onRetry();
            toast.info("Đang thử tải lại dữ liệu năng lượng...");
          }}
        >
          <RefreshCw className="size-4" /> Retry
        </Button>
      </div>
    </div>
  );
}

export function EnergyEmpty({
  title = "Dữ liệu đang được cập nhật",
  description = "Module đã có route và layout, backend dữ liệu chi tiết sẽ được kết nối ở bước tiếp theo.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="gov-card flex min-h-56 flex-col items-center justify-center p-6 text-center">
      <FileText className="size-10 text-gov" strokeWidth={1.6} />
      <p className="mt-3 font-semibold text-navy">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function EnergyStatusBadge({ status }: { status?: string }) {
  const value = status ?? "Đang cập nhật";
  const tone =
    value.includes("Quá tải") || value.includes("nghiêm trọng")
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : value.includes("Bảo trì") ||
          value.includes("Đang đầu tư") ||
          value.includes("Đang xử lý") ||
          value.includes("Cảnh báo")
        ? "border-warning/40 bg-warning/15 text-warning"
        : value.includes("Quy hoạch") || value.includes("Lập")
          ? "border-gov/30 bg-gov/10 text-gov"
          : "border-success/30 bg-success/10 text-success";
  return (
    <Badge variant="outline" className={cn("rounded-md font-medium", tone)}>
      {value}
    </Badge>
  );
}

export function FieldGrid({ items }: { items: { label: string; value?: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-border bg-surface px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm font-medium text-navy">{item.value ?? "Đang cập nhật"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EntityDetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string | undefined;
  children: ReactNode;
}) {
  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      widthClass="sm:max-w-[500px]"
    >
      {children}
    </DetailDrawer>
  );
}

export function ModulePreviewGrid() {
  return (
    <section>
      <h2 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-navy">
        Một số màn hình chi tiết
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ENERGY_MODULES.slice(1).map((item) => {
          const detail = MODULE_VIEW_DETAILS[item.to] ?? {
            scope: item.description,
            output: "Màn hình dữ liệu chi tiết theo lớp nghiệp vụ.",
          };
          return (
            <Link
              key={item.to}
              to={item.to as never}
              preload="intent"
              className="gov-card group flex min-h-44 flex-col gap-2 p-3 transition-colors hover:border-gov/50 hover:bg-surface"
            >
              <span className="flex size-9 items-center justify-center rounded-md bg-gov/10 text-gov">
                <item.icon className="size-4.5" />
              </span>
              <span className="text-sm font-semibold leading-snug text-navy">{item.label}</span>
              <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                {detail.scope}
              </span>
              <span className="mt-auto rounded-md bg-surface px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                {detail.output}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-gov">
                Mở màn hình
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

const MODULE_VIEW_DETAILS: Record<string, { scope: string; output: string }> = {
  "/energy/gis": {
    scope: "Bản đồ lớp lưới, trạm, nguồn điện, ĐMT mái nhà, phụ tải, sự cố, carbon và trạm sạc.",
    output: "Đã có dashboard GIS và hồ sơ đối tượng.",
  },
  "/energy/grid": {
    scope: "Trạm 500/220/110/22kV, tuyến điện, trụ điện, quy hoạch, khả năng mang tải.",
    output: "Đã có danh sách trạm, KPI và drawer hồ sơ.",
  },
  "/energy/projects": {
    scope: "Dự án mặt trời, gió, sinh khối, thủy điện, điện rác, LNG hiện hữu và quy hoạch.",
    output: "Đã có danh sách dự án, công suất, đấu nối.",
  },
  "/energy/rooftop-solar": {
    scope: "Hệ thống ĐMT mái nhà, điểm đấu nối, tự tiêu thụ, hòa lưới và khả năng tiếp nhận.",
    output: "Đã có danh sách hệ thống và hồ sơ kỹ thuật.",
  },
  "/energy/consumption": {
    scope: "Phụ tải, điện năng theo kỳ, cơ sở sử dụng năng lượng trọng điểm và tiết kiệm điện.",
    output: "Đã có danh sách tiêu thụ và KPI phụ tải.",
  },
  "/energy/grid-safety": {
    scope: "Sự cố lưới điện, hành lang an toàn, phạm vi ảnh hưởng và tiến độ khôi phục.",
    output: "Đã có danh sách sự cố và hồ sơ xử lý.",
  },
  "/energy/carbon": {
    scope: "Nguồn phát thải, CO2e, cường độ carbon, dự án giảm phát thải và tín chỉ carbon.",
    output: "Đã có danh sách nguồn phát thải và KPI carbon.",
  },
  "/energy/charging-stations": {
    scope: "Trạm sạc điện thông minh, công suất, chuẩn sạc, cổng trống và vùng cấp điện.",
    output: "Đã có danh sách trạm sạc và hồ sơ kỹ thuật.",
  },
};

export function SearchShell({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-64 flex-1">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-input bg-surface px-3 pl-8 text-sm outline-none ring-offset-background focus:ring-1 focus:ring-ring"
        />
      </div>
      {children}
    </div>
  );
}
