import { Building2, Globe, MapPin, Phone, Tag, Users } from "lucide-react";
import { DetailDrawer } from "@/components/common/DetailDrawer";
import { StatusBadge } from "@/components/common/StatusBadge";
import { FACTORY_STATUS_LABEL } from "@/lib/constants";
import type { Cluster, Factory } from "@/lib/types";

const MISSING = "—";

function v(value: string | number | null | undefined): string {
  return value == null || value === "" ? MISSING : String(value);
}

export function CompanyProfileDrawer({
  open,
  onOpenChange,
  company,
  cluster,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  company: Factory | null;
  cluster: Cluster | null;
}) {
  const f = company;

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={f ? f.name : "Hồ sơ doanh nghiệp"}
      description={f ? `Mã doanh nghiệp: ${f.id}` : undefined}
      widthClass="sm:max-w-[520px]"
    >
      {f ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                background:
                  f.status === "active"
                    ? "var(--success)"
                    : f.status === "expanding"
                      ? "var(--warning)"
                      : "var(--border)",
              }}
            />
            <span className="text-sm font-medium text-navy">{FACTORY_STATUS_LABEL[f.status]}</span>
            <span className="ml-auto">
              <StatusBadge
                status={
                  f.status === "active"
                    ? "approved"
                    : f.status === "expanding"
                      ? "pending"
                      : "checking"
                }
              />
            </span>
          </div>

          <ProfileSection icon={Building2} title="Tổng quan">
            <Field label="Tên doanh nghiệp" value={f.name} />
            <Field label="Mã số thuế" value={v(f.taxCode)} />
            <Field label="Mã doanh nghiệp" value={f.id} />
            <Field label="Ngày thành lập" value={v(f.establishedAt)} />
            <Field label="Loại hình" value={v(f.legalType)} />
            <Field label="Trạng thái" value={FACTORY_STATUS_LABEL[f.status]} />
          </ProfileSection>

          <ProfileSection icon={MapPin} title="Địa điểm">
            <Field label="Khu/Cụm công nghiệp" value={cluster?.name ?? MISSING} />
            <Field label="Địa chỉ" value={f.address} />
            <Field label="Xã/Phường" value={v(f.ward)} />
            <Field label="Tỉnh/Thành" value={cluster ? `${cluster.ward} – Tây Ninh` : "Tây Ninh"} />
          </ProfileSection>

          <ProfileSection icon={Tag} title="Ngành nghề">
            <Field label="Ngành chính" value={f.sector} />
            <Field label="Ngành phụ" value={v(f.sectorSecondary)} />
            <Field label="Sản phẩm chính" value={f.products} />
          </ProfileSection>

          <ProfileSection icon={Users} title="Quy mô">
            <Field
              label="Vốn đầu tư"
              value={f.investment != null ? `${f.investment} tỷ đồng` : MISSING}
            />
            <Field label="Diện tích sử dụng" value={`${f.area} ha`} />
            <Field label="Số lao động" value={`${f.employees} người`} />
            <Field label="Doanh thu" value={`${f.revenue} tỷ đồng`} />
          </ProfileSection>

          <ProfileSection icon={Phone} title="Liên hệ">
            <Field label="Người đại diện" value={f.representative} />
            <Field label="Điện thoại" value={v(f.phone)} />
            <Field label="Email" value={v(f.email)} />
            <Field
              label="Website"
              value={
                f.website ? (
                  <a
                    href={f.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-gov underline-offset-2 hover:underline"
                  >
                    <Globe className="size-3.5" /> {f.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  MISSING
                )
              }
            />
          </ProfileSection>
        </div>
      ) : null}
    </DetailDrawer>
  );
}

function ProfileSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Building2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-navy text-navy-foreground">
          <Icon className="size-3.5" />
        </div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-navy">{title}</h3>
      </header>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 p-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-[13px] font-medium text-navy">{value}</p>
    </div>
  );
}
