import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { KpiMiniCard } from "@/components/dashboard/DashboardModule";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/router-compat";
import type { MineralLicense } from "@/lib/mineral/mineral-types";

// Mock data import for demo fallback
import mockLicenses from "@/data/mineral-licenses.json";

type LicenseRow = MineralLicense & {
  expiryDate?: string;
  capacity?: number;
};

async function fetchLicenses(): Promise<LicenseRow[]> {
  try {
    const res = await fetch("/api/mineral/licenses?page=1&pageSize=200");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data?.items) && data.items.length > 0) return data.items as LicenseRow[];
    return mockLicenses as unknown as LicenseRow[];
  } catch {
    return mockLicenses as unknown as LicenseRow[];
  }
}

async function createLicenseApi(payload: Partial<LicenseRow>): Promise<LicenseRow> {
  const res = await fetch("/api/mineral/licenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Không tạo được GP");
  }
  return (await res.json()) as LicenseRow;
}

async function updateLicenseApi(id: string, payload: Partial<LicenseRow>): Promise<LicenseRow> {
  const res = await fetch(`/api/mineral/licenses?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Không cập nhật được GP");
  }
  return (await res.json()) as LicenseRow;
}

async function deleteLicenseApi(id: string): Promise<void> {
  const res = await fetch(`/api/mineral/licenses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Không xóa được GP");
  }
}

const EMPTY_FORM: Partial<LicenseRow> = {
  licenseNumber: "",
  organizationName: "",
  mineralType: "",
  capacity: 0,
  status: "HIEU_LUC" as LicenseRow["status"],
};

export function LicenseTable({ onRefresh }: { onRefresh: () => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<"create" | "edit">("create");
  const [currentLicense, setCurrentLicense] = useState<LicenseRow | null>(null);
  const [formData, setFormData] = useState<Partial<LicenseRow>>(EMPTY_FORM);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Query licenses from API with mock fallback
  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["mineralLicenses"],
    queryFn: fetchLicenses,
    initialData: mockLicenses as unknown as LicenseRow[],
    staleTime: 1000 * 60 * 5,
  });

  const { mutateAsync: createMutate, isPending: isCreating } = useMutation({
    mutationFn: createLicenseApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mineralLicenses"] }),
  });
  const { mutateAsync: updateMutate, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<LicenseRow> }) =>
      updateLicenseApi(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mineralLicenses"] }),
  });
  const { mutateAsync: deleteMutate, isPending: isDeleting } = useMutation({
    mutationFn: deleteLicenseApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mineralLicenses"] }),
  });

  const handleCreate = () => {
    setFormOpen(true);
    setFormType("create");
    setCurrentLicense(null);
    setFormData(EMPTY_FORM);
  };

  const handleEdit = (license: LicenseRow) => {
    setFormOpen(true);
    setFormType("edit");
    setCurrentLicense(license);
    setFormData({
      licenseNumber: license.licenseNumber,
      organizationName: license.organizationName,
      mineralType: license.mineralType,
      capacity: license.capacity ?? 0,
      status: license.status,
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa GP này?")) {
      try {
        await deleteMutate(id);
        onRefresh();
        toast.success("Đã xóa GP thành công");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không xóa được GP");
      }
    }
  };

  const handleSave = async () => {
    try {
      if (formType === "create") {
        await createMutate({
          ...formData,
          mineralCategory: (formData as { mineralCategory?: string }).mineralCategory ?? "KHAC",
        } as Partial<LicenseRow>);
      } else if (formType === "edit" && currentLicense) {
        await updateMutate({ id: currentLicense.id, payload: formData });
      }
      setFormOpen(false);
      onRefresh();
      toast.success(formType === "create" ? "Đã tạo GP mới" : "Đã cập nhật GP");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được GP");
    }
  };

  const setField = <K extends keyof LicenseRow>(key: K, value: LicenseRow[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiMiniCard
          label="Tổng GP"
          value={isLoading ? "Đang tải" : String(licenses.length)}
        />
        <KpiMiniCard
          label="Hiệu lực"
          value={isLoading
            ? "Đang tải"
            : licenses.filter((l) => l.status === "HIEU_LUC").length + "/" + licenses.length}
        />
        <KpiMiniCard
          label="Ngưng hoạt động"
          value={isLoading
            ? "Đang tải"
            : String(licenses.filter((l) => l.status === "NGUNG_HOAT_DONG").length)}
        />
        <KpiMiniCard
          label="Hết hạn trong 30 ngày"
          value={isLoading
            ? "Đang tải"
            : String(licenses
                .filter((l) => l.expiryDate)
                .filter((l) => {
                  const expiry = new Date(l.expiryDate as string);
                  const now = new Date();
                  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return diffDays > 0 && diffDays <= 30;
                }).length)}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreate}
          className="bg-gov text-white hover:bg-gov/90"
        >
          <Plus className="size-4 mr-1" /> Tạo GP mới
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={isCreating || isUpdating || isDeleting}
          onClick={() => navigate({ to: "/data-management" })}
        >
          {isCreating ? "Đang tạo..." : isUpdating ? "Đang sửa..." : isDeleting ? "Đang xóa..." : "Quản trị dữ liệu"}
        </Button>
      </div>

      {/* Licenses Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm text-muted-foreground">
          <thead>
            <tr>
              <th className="border border-border p-3 text-left">STT</th>
              <th className="border border-border p-3 text-left">Số GP</th>
              <th className="border border-border p-3 text-left">Đơn vị</th>
              <th className="border border-border p-3 text-left">Loại khoáng sản</th>
              <th className="border border-border p-3 text-left">Công suất (m³/năm)</th>
              <th className="border border-border p-3 text-left">Trạng thái</th>
              <th className="border border-border p-3 text-left">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-4">Đang tải dữ liệu...</td>
              </tr>
            ) : (
              licenses.map((license) => (
                <tr key={license.id} className="border-b border-border/50 hover:bg-surface/50">
                  <td className="border border-border/50 p-3">{license.stt}</td>
                  <td className="border border-border/50 p-3 font-medium">
                    {license.licenseNumber}
                  </td>
                  <td className="border border-border/50 p-3">
                    {license.organizationName}
                  </td>
                  <td className="border border-border/50 p-3">
                    {license.mineralType}
                  </td>
                  <td className="border border-border/50 p-3">
                    {license.capacity || 0} m³/năm
                  </td>
                  <td className="border border-border/50 p-3">
                    <span
                      className={
                        license.status === "HIEU_LUC"
                          ? "bg-green-100 text-green-800 text-xs font-medium rounded px-2 py-1"
                          : license.status === "NGUNG_HOAT_DONG"
                          ? "bg-yellow-100 text-yellow-800 text-xs font-medium rounded px-2 py-1"
                          : "bg-red-100 text-red-800 text-xs font-medium rounded px-2 py-1"
                      }
                    >
                      {license.status}
                    </span>
                  </td>
                  <td className="border border-border/50 p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-gov text-sm"
                      onClick={() => handleEdit(license)}
                    >
                      Xem
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-red-600 hover:bg-red-100"
                      onClick={() => handleDelete(license.id)}
                    >
                      Xóa
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* License Form Drawer */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-2xl">
            <h3 className="text-xl font-semibold mb-4">
              {formType === "create" ? "Tạo GP mới" : "Sửa GP"}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSave();
              }}
            >
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Số giấy phép</label>
                  <input
                    type="text"
                    required
                    value={formData.licenseNumber || ""}
                    onChange={(e) => setField("licenseNumber", e.target.value)}
                    className="shadow-sm rounded-md border border-gray-300 w-full py-2 px-3 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Đơn vị khai thác</label>
                  <input
                    type="text"
                    value={formData.organizationName || ""}
                    onChange={(e) => setField("organizationName", e.target.value)}
                    className="shadow-sm rounded-md border border-gray-300 w-full py-2 px-3 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Loại khoáng sản</label>
                  <select
                    value={formData.mineralType || ""}
                    onChange={(e) => setField("mineralType", e.target.value)}
                    className="shadow-sm rounded-md border border-gray-300 w-full py-2 px-3 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Chọn loại</option>
                    <option value="CAT_XD">Cát xây dựng</option>
                    <option value="DAT_SAN_LAP">Đất san lấp</option>
                    <option value="THAN_BUN">Than bùn</option>
                    <option value="DA_VOI_DA_SET">Đá vội, đá sét</option>
                    <option value="SET_GACH_NGOI">Sét gạch ngói</option>
                    <option value="KHAC">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Công suất (m³/năm)</label>
                  <input
                    type="number"
                    value={formData.capacity ?? ""}
                    onChange={(e) => setField("capacity", Number(e.target.value) || 0)}
                    className="shadow-sm rounded-md border border-gray-300 w-full py-2 px-3 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Trạng thái</label>
                <select
                  value={formData.status || "HIEU_LUC"}
                  onChange={(e) => setField("status", e.target.value as LicenseRow["status"])}
                  className="shadow-sm rounded-md border border-gray-300 w-full py-2 px-3 focus:ring-primary focus:border-primary"
                >
                  <option value="HIEU_LUC">Còn hiệu lực</option>
                  <option value="NGUNG_HOAT_DONG">Đang ngưng hoạt động</option>
                  <option value="HET_HAN">Hết hạn</option>
                  <option value="CHUA_CAP">Chưa cấp</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-gov text-white hover:bg-gov/90 py-2 rounded-md"
                >
                  {formType === "create" ? "Tạo GP" : "Cập nhật GP"}
                </button>
                <button
                  type="button"
                  className="flex-1 bg-surface py-2 rounded-md"
                  onClick={() => setFormOpen(false)}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
