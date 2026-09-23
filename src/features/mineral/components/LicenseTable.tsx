import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KpiMiniCard } from '@/components/dashboard/DashboardModule';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { MineralLicense } from '@/lib/mineral/mineral-types';
import { useCreateLicenseMutation, useUpdateLicenseMutation, useDeleteLicenseMutation } from '@/lib/mineral/mineral-service';

// Mock data import for demo
import mockLicenses from '@/data/mineral-licenses.json';

export function LicenseTable({ onRefresh }: { onRefresh: () => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<'create' | 'edit'>('create');
  const [currentLicense, setCurrentLicense] = useState<MineralLicense | null>(null);
  const navigate = useNavigate();

  // Query licenses from API/mock
  const { data: licenses = mockLicenses, isLoading } = useQuery({
    queryKey: ['mineralLicenses'],
    staleTime: 1000 * 60 * 5,
  });

  // Create mutation
  const { mutate: createMutate, isPending: isCreating } = useCreateLicenseMutation();
  const { mutate: updateMutate, isPending: isUpdating } = useUpdateLicenseMutation();
  const { mutate: deleteMutate, isPending: isDeleting } = useDeleteLicenseMutation();

  const handleCreate = () => {
    setFormOpen(true);
    setFormType('create');
    setCurrentLicense(null);
  };

  const handleEdit = (license: MineralLicense) => {
    setFormOpen(true);
    setFormType('edit');
    setCurrentLicense(license);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa GP này?')) {
      await deleteMutate(id);
      onRefresh();
      toast.success('Đã xóa GP thành công');
    }
  };

  const handleSave = async (licenseData: MineralLicense) => {
    if (formType === 'create') {
      await createMutate(licenseData);
    } else if (formType === 'edit' && currentLicense) {
      await updateMutate(currentLicense.id, licenseData);
    }
    setFormOpen(false);
    onRefresh();
    toast.success(formType === 'create' ? 'Đã tạo GP mới' : 'Đã cập nhật GP');
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiMiniCard
          label="Tổng GP"
          value={isLoading ? 'Đang tải' : String(licenses.length)}
        />
        <KpiMiniCard
          label="Hiệu lực"
          value={isLoading
            ? 'Đang tải'
            : licenses.filter((l) => l.status === 'HIEU_LUC').length + '/' + licenses.length}
        />
        <KpiMiniCard
          label="Còn hiệu lực"
          value={isLoading
            ? 'Đang tải'
            : licenses.filter((l) => l.status === 'NGUNG_HOAT_DONG').length}
        />
        <KpiMiniCard
          label="Hết hạn trong 30 ngày"
          value={isLoading
            ? 'Đang tải'
            : licenses
                .filter((l) => l.expiryDate)
                .filter((l) => {
                  const expiry = new Date(l.expiryDate);
                  const now = new Date();
                  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return diffDays > 0 && diffDays <= 30;
                }).length}
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
          <Minimal className="size-4 mr-1" /> Tạo GP mới
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={isCreating || isUpdating || isDeleting}
        >
          {isCreating ? 'Đang tạo...' : isUpdating ? 'Đang sửa...' : isDeleting ? 'Đang xóa...' : 'Thêm GP'}
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
                        license.status === 'HIEU_LUC'
                          ? 'bg-green-100 text-green-800 text-xs font-medium rounded px-2 py-1'
                          : license.status === 'NGUNG_HOAT_DONG'
                          ? 'bg-yellow-100 text-yellow-800 text-xs font-medium rounded px-2 py-1'
                          : 'bg-red-100 text-red-800 text-xs font-medium rounded px-2 py-1'
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-zsm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-2xl">
            <h3 className="text-xl font-semibold mb-4">
              {formType === 'create' ? 'Tạo GP mới' : 'Sửa GP'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (currentLicense) {
                  handleSave(currentLicense);
                } else {
                  handleSave({
                    ...licenseData,
                    id: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  } as any);
                }
              }}
            >
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Số giấy phép</label>
                  <input
                    type="text"
                    required
                    value={currentLicense?.licenseNumber || ''}
                    onChange={(e) => /* set form state */}
                    className="shadow-sm rounded-md border border-gray-300 w-full py-2 px-3 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Đơn vị khai thác</label>
                  <input
                    type="text"
                    value={currentLicense?.organizationName || ''}
                    onChange={(e) => /* set form state */}
                    className="shadow-sm rounded-md border border-gray-300 w-full py-2 px-3 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Loại khoáng sản</label>
                  <select
                    value={currentLicense?.mineralType || ''}
                    onChange={(e) => /* set form state */}
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
                    value={currentLicense?.capacity || ''}
                    onChange={(e) => /* set form state */}
                    className="shadow-sm rounded-md border border-gray-300 w-full py-2 px-3 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Trạng thái</label>
                <select
                  value={currentLicense?.status || 'HIEU_LUC'}
                  onChange={(e) => /* set form state */}
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
                  {formType === 'create' ? 'Tạo GP' : 'Cập nhật GP'}
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