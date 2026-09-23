import { Link } from "@/lib/router-compat";
import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";

export function TaskPlaceholder({ taskId, icon }: { taskId: number; icon: LucideIcon }) {
  return (
    <>
      <PageHeader
        title={`Nhiệm vụ ${taskId}`}
        description="Kế hoạch triển khai thực hiện bài toán lớn về Chương trình thúc đẩy phát triển năng lượng mặt trời và các nguồn năng lượng tái tạo trên địa bàn tỉnh Tây Ninh giai đoạn 2026-2030."
        crumbs={[
          { label: "Nguồn năng lượng tái tạo", to: "/energy" },
          { label: `Nhiệm vụ ${taskId}` },
        ]}
        variant="panel"
        icon={icon}
      />
      <div className="p-6">
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center shadow-panel">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gov/10 text-gov">
            <Construction className="size-7" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-navy">Trang chưa phát triển</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Chức năng của Nhiệm vụ {taskId} sẽ được triển khai trong giai đoạn sau. Vui lòng quay
            lại sau.
          </p>
          <Link to="/energy">
            <Button variant="outline" size="sm">
              Về tổng quan Năng lượng
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
