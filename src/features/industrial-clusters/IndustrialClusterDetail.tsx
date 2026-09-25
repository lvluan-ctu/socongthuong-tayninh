"use client";

import { useMemo } from "react";
import { X, Edit, FileText, MapPin, Building2, TrendingUp, Gauge, Download, Upload, Eye, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DetailDrawer } from "@/components/common/DetailDrawer";
import { ClusterStatusBadge } from "@/components/industry/ClusterStatusBadge";
import { ProgressMilestone } from "@/components/industry/ProgressMilestone";
import { DocumentAttachmentItem } from "@/components/industry/DocumentAttachmentItem";
import { formatNumber } from "@/lib/report-service";
import type { ClusterDossier } from "@/lib/industrial-clusters/industrial-cluster-types";
import { CLUSTER_STATUS_LABELS } from "@/lib/industrial-clusters/industrial-cluster-types";

interface IndustrialClusterDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: ClusterDossier | null;
  onEdit?: (cluster: ClusterDossier) => void;
}

export function IndustrialClusterDetail({
  open,
  onOpenChange,
  cluster,
  onEdit,
}: IndustrialClusterDetailProps) {
  if (!cluster) return null;

  const statusLabel = CLUSTER_STATUS_LABELS[cluster.status];

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={cluster.name}
      widthClass="lg:max-w-4xl"
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="outline" className={`rounded-full text-[11px] ${CLUSTER_STATUS_LABELS[cluster.status].bgColor} ${CLUSTER_STATUS_LABELS[cluster.status].color}`}>
              {CLUSTER_STATUS_LABELS[cluster.status].label}
            </Badge>
            <Badge variant="outline" className="ml-2 rounded-full text-[11px] border-gov/30 bg-gov/10 text-gov">
              {cluster.dossierCode}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit?.(cluster)}>
                <Edit className="size-3.5 mr-1.5" /> Chỉnh sửa
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">Thông tin chung</TabsTrigger>
            <TabsTrigger value="progress">Tiến độ</TabsTrigger>
            <TabsTrigger value="documents">Tài liệu</TabsTrigger>
            <TabsTrigger value="reports">Báo cáo</TabsTrigger>
          </TabsList>

          {/* Tab 1: Thông tin chung */}
          <TabsContent value="info" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <InfoCard title="Thông tin cơ bản" icon={FileText}>
                <InfoRow label="Mã hồ sơ" value={cluster.dossierCode} />
                <InfoRow label="Tên CCN" value={cluster.name} />
                <InfoRow label="Quyết định thành lập" value={cluster.decisionEstablish ?? "—"} />
                <InfoRow label="Ngày QĐ" value={cluster.decisionDate ?? "—"} />
                <InfoRow label="Văn bản quy hoạch" value={cluster.planningDoc ?? "—"} />
                <InfoRow label="GCN đất" value={cluster.landUseCert ?? "—"} />
                <InfoRow label="Đánh giá MT" value={cluster.envImpactAssessment ?? "—"} />
              </InfoCard>

              <InfoCard title="Địa bàn & Vị trí" icon={MapPin}>
                <InfoRow label="Tỉnh" value="Tây Ninh" />
                <InfoRow label="Huyện/Thị xã (cũ)" value={cluster.district} />
                <InfoRow label="Xã/Phường (mới)" value={cluster.ward} />
                <InfoRow label="Tọa độ" value={`${cluster.lat.toFixed(4)}, ${cluster.lng.toFixed(4)}`} />
              </InfoCard>

              <InfoCard title="Chỉ tiêu quy hoạch" icon={Building2}>
                <InfoRow label="Tổng diện tích" value={`${cluster.area.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`} />
                <InfoRow label="Đất CN" value={`${cluster.landFund.industrialLand.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`} />
                <InfoRow label="Đất dịch vụ" value={`${cluster.landFund.serviceLand.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`} />
                <InfoRow label="Đất xanh" value={`${cluster.landFund.greenLand.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`} />
                <InfoRow label="Đất giao thông" value={`${cluster.landFund.trafficLand.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`} />
                <InfoRow label="Đất trống" value={`${cluster.landFund.vacantLand.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`} className="text-destructive" />
              </InfoCard>

              <InfoCard title="Hiệu quả sử dụng" icon={TrendingUp}>
                <InfoRow label="Đã cho thuê" value={`${cluster.leased.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`} />
                <InfoRow label="Chưa cho thuê" value={`${cluster.landFund.unleasedLand.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`} className="text-warning" />
                <InfoRow label="Tỷ lệ lấp đầy" value={`${cluster.occupancy}%`} className="font-bold text-success" />
                <InfoRow label="Số DN" value={cluster.enterprises.toString()} />
              </InfoCard>

              <InfoCard title="Chủ đầu tư hạ tầng" icon={Building2}>
                <InfoRow label="Tên chủ đầu tư" value={cluster.investor ?? "—"} />
                <InfoRow label="Mã số thuế" value={cluster.investorTaxCode ?? "—"} />
                <InfoRow label="Địa chỉ" value={cluster.investorAddress ?? "—"} />
                <InfoRow label="Vốn đầu tư" value={cluster.investmentCapital ? `${formatNumber(cluster.investmentCapital)} tỷ đồng` : "—"} />
                <InfoRow label="Hình thức" value={cluster.investmentForm ? "BT/BOT/PPP/Other" : "—"} />
              </InfoCard>

              <InfoCard title="Hạ tầng kỹ thuật" icon={Gauge}>
                {cluster.infrastructure.map((infra) => (
                  <InfraProgressRow key={infra.name} {...infra} />
                ))}
              </InfoCard>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <h4 className="font-medium text-navy mb-3">Ngành nghề khuyến khích</h4>
              <div className="flex flex-wrap gap-2">
                {cluster.sectors.split(/[–\-/]/).map((s) => s.trim()).filter(Boolean).map((sector) => (
                  <Badge key={sector} variant="outline" className="rounded-full border-gov/30 bg-gov/10 text-gov">
                    {sector}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Tiến độ */}
          <TabsContent value="progress" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-navy">Mốc thời gian đầu tư</h4>
                <span className="text-sm text-muted-foreground">
                  Tổng tiến độ: <span className="font-bold text-gov">{cluster.overallProgress}%</span>
                </span>
              </div>
              <Progress value={cluster.overallProgress} className="h-3" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-xs text-muted-foreground">Giải phóng mặt bằng</p>
                  <p className="font-bold text-success">{cluster.landCompensationProgress}%</p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-xs text-muted-foreground">Xây dựng hạ tầng</p>
                  <p className="font-bold text-gov">{cluster.infraConstructionProgress}%</p>
                </div>
              </div>

              <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="timeline">Dạng timeline</TabsTrigger>
                  <TabsTrigger value="table">Dạng bảng</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-4">
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {cluster.milestones.map((ms) => (
                      <ProgressMilestone
                        key={ms.id}
                        milestone={ms}
                        onUpdate={(data) => {}}
                        readOnly
                      />
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="table" className="mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
                          <th className="px-3 py-2">Mã</th>
                          <th className="px-3 py-2">Mốc thời gian</th>
                          <th className="px-3 py-2">Kế hoạch</th>
                          <th className="px-3 py-2">Thực tế</th>
                          <th className="px-3 py-2">Tiến độ</th>
                          <th className="px-3 py-2">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {cluster.milestones.map((ms) => (
                          <tr key={ms.id} className="hover:bg-surface/50">
                            <td className="px-3 py-2 font-mono text-gov">{ms.code}</td>
                            <td className="px-3 py-2">{ms.name}</td>
                            <td className="px-3 py-2">{ms.plannedDate}</td>
                            <td className="px-3 py-2">{ms.actualDate ?? "—"}</td>
                            <td className="px-3 py-2">{ms.progressPercent}%</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className={`rounded-full text-[10px] ${
                                ms.status === "COMPLETED" ? "border-success/30 bg-success/10 text-success" :
                                ms.status === "IN_PROGRESS" ? "border-gov/30 bg-gov/10 text-gov" :
                                ms.status === "DELAYED" ? "border-destructive/30 bg-destructive/10 text-destructive" :
                                "border-muted bg-muted/10 text-muted-foreground"
                              }`}>
                                {ms.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* Tab 3: Tài liệu */}
          <TabsContent value="documents" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-navy">Tài liệu đính kèm ({cluster.documents.length})</h4>
              <Button variant="outline" size="sm" className="gap-1.5" disabled>
                <Upload className="size-3.5" /> Tải lên
              </Button>
            </div>
            <div className="space-y-2">
              {cluster.documents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Chưa có tài liệu</p>
              ) : (
                cluster.documents.map((doc) => (
                  <DocumentAttachmentItem key={doc.id} document={doc} readOnly />
                ))
              )}
            </div>
          </TabsContent>

          {/* Tab 4: Báo cáo */}
          <TabsContent value="reports" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-navy">Báo cáo định kỳ (TT 14/2024/TT-BCT)</h4>
                <Button variant="outline" size="sm" className="gap-1.5" disabled>
                  <FileText className="size-3.5" /> Tạo báo cáo
                </Button>
              </div>
              {cluster.reports.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Chưa có báo cáo</p>
              ) : (
                <div className="space-y-2">
                  {cluster.reports.map((rpt) => (
                    <div key={rpt.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`rounded-full text-[10px] ${
                          rpt.status === "APPROVED" ? "border-success/30 bg-success/10 text-success" :
                          rpt.status === "SUBMITTED" ? "border-gov/30 bg-gov/10 text-gov" :
                          rpt.status === "REJECTED" ? "border-destructive/30 bg-destructive/10 text-destructive" :
                          "border-muted bg-muted/10 text-muted-foreground"
                        }`}>
                          {rpt.status}
                        </Badge>
                        <div>
                          <p className="font-medium text-navy">{rpt.reportType}</p>
                          <p className="text-xs text-muted-foreground">Kỳ: {rpt.period} · Đơn vị: {rpt.reportingEntity}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {rpt.fileUrl && (
                          <Button variant="ghost" size="sm" className="gap-1.5">
                            <Download className="size-3.5" /> Tải
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="gap-1.5">
                          <Eye className="size-3.5" /> Xem
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DetailDrawer>
  );
}

function InfoCard({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-navy">
          <Icon className="size-4 text-gov" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function InfoRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium text-navy ${className ?? ""} text-right max-w-[60%] truncate`}>{value}</span>
    </div>
  );
}

function InfraProgressRow({ name, level, note }: { name: string; level: number; note: string }) {
  const color = level >= 80 ? "success" : level >= 60 ? "gov" : level >= 40 ? "warning" : "destructive";
  return (
    <div className="py-1.5 border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-navy">{name}</span>
        <span className="text-muted-foreground">{level}%</span>
      </div>
      <Progress value={level} className={`h-1.5 [&>div]:bg-${color}`} />
      {note && <p className="text-[10px] text-muted-foreground mt-0.5">{note}</p>}
    </div>
  );
}