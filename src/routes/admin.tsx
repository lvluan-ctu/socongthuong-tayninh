import { useState } from "react";
import { createFileRoute } from "@/lib/router-compat";
import {
  KeyRound,
  Lock,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Unlock,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USERS } from "@/data/mock";
import { usePersistentState } from "@/lib/persist";
import { NAV_GROUPS, NAV_ITEMS, ROLES, type RoleId } from "@/lib/nav";
import type { UserRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Quản trị hệ thống | Nền tảng ngành Công Thương" },
      {
        name: "description",
        content: "Người dùng, vai trò, phân quyền và nhật ký kiểm toán hệ thống.",
      },
      { property: "og:title", content: "Quản trị hệ thống" },
      {
        property: "og:description",
        content: "Người dùng, vai trò, phân quyền và nhật ký kiểm toán hệ thống.",
      },
    ],
  }),
  component: Page,
});

type Row = UserRow & { permissions: string[] };

const ROLE_NAME_TO_ID: Record<string, RoleId> = {
  // Tên ngắn đang dùng trong mock USERS
  "Lãnh đạo Sở": "leader",
  "Lãnh đạo phòng": "dept",
  // Tên chuẩn trong ROLES (nav.ts) — hỗ trợ cả hai để không mất quyền
  "Lãnh đạo UBND/Sở": "leader",
  "Lãnh đạo phòng/đơn vị": "dept",
  "Chuyên viên": "specialist",
  "Cán bộ GIS": "gis",
  "Cán bộ điều tra": "surveyor",
  "Doanh nghiệp": "enterprise",
  "Nhà đầu tư": "investor",
  "Quản trị hệ thống": "admin",
};

function groupsForRole(roleId: RoleId): string[] {
  return NAV_GROUPS.filter((g) => NAV_ITEMS.some((i) => i.group === g && i.roles.includes(roleId)));
}

function defaultPermissions(roleName: string): string[] {
  const roleId = ROLE_NAME_TO_ID[roleName];
  return roleId ? groupsForRole(roleId) : [];
}

const INITIAL: Row[] = USERS.map((u) => ({ ...u, permissions: defaultPermissions(u.role) }));

interface FormState {
  name: string;
  account: string;
  unit: string;
  role: string;
  status: "active" | "locked";
  permissions: string[];
}

const EMPTY_FORM: FormState = {
  name: "",
  account: "",
  unit: "",
  role: "Chuyên viên",
  status: "active",
  permissions: [],
};

const GROUP_LABEL: Record<string, string> = {
  "ĐIỀU HÀNH": "Điều hành & khai thác",
  "DỮ LIỆU": "Quản trị dữ liệu",
  "DỮ LIỆU GIS": "Dữ liệu GIS",
  "BÁO CÁO": "Báo cáo & BI",
  "HỆ THỐNG": "Quản trị hệ thống",
};

function Page() {
  const [rows, setRows, resetRows] = usePersistentState<Row[]>("admin.users", INITIAL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      account: row.account,
      unit: row.unit,
      role: row.role,
      status: row.status,
      permissions: row.permissions,
    });
    setDialogOpen(true);
  };

  const onRoleChange = (role: string) => {
    setForm((f) => ({ ...f, role, permissions: defaultPermissions(role) }));
  };

  const togglePermission = (group: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(group)
        ? f.permissions.filter((g) => g !== group)
        : [...f.permissions, group],
    }));
  };

  const save = () => {
    if (!form.name.trim() || !form.account.trim()) {
      toast.error("Vui lòng nhập họ tên và tài khoản.");
      return;
    }
    if (editingId) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? { ...r, ...form, name: form.name.trim(), account: form.account.trim() }
            : r,
        ),
      );
      toast.success(`Đã cập nhật người dùng "${form.name.trim()}".`);
    } else {
      const seq = String(rows.length + 1).padStart(2, "0");
      const row: Row = {
        id: `U-${seq}`,
        name: form.name.trim(),
        account: form.account.trim(),
        unit: form.unit.trim() || "Chưa phân công",
        role: form.role,
        lastLogin: "Chưa đăng nhập",
        status: form.status,
        permissions: form.permissions,
      };
      setRows((prev) => [...prev, row]);
      toast.success(`Đã thêm người dùng "${row.name}".`);
    }
    setDialogOpen(false);
  };

  const toggleLock = (row: Row) => {
    const next = row.status === "active" ? "locked" : "active";
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    toast.info(next === "active" ? `Đã mở khóa "${row.name}".` : `Đã khóa "${row.name}".`);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    toast.success(`Đã xóa "${deleteTarget.name}".`);
    setDeleteTarget(null);
  };

  const columns: Column<Row>[] = [
    { key: "name", header: "Họ tên", sortable: true },
    {
      key: "account",
      header: "Tài khoản",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-gov">
          <KeyRound className="size-3.5" />
          {r.account}
        </span>
      ),
    },
    { key: "unit", header: "Đơn vị", sortable: true },
    {
      key: "role",
      header: "Vai trò",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-muted-foreground" />
          {r.role}
        </span>
      ),
    },
    {
      key: "permissions",
      header: "Quyền truy cập",
      className: "hidden lg:table-cell",
      render: (r) => (
        <div className="flex max-w-64 flex-wrap gap-1">
          {r.permissions.length ? (
            r.permissions.map((p) => (
              <Badge
                key={p}
                variant="outline"
                className="rounded-md border-gov/25 bg-gov/5 px-1.5 py-0 text-[10px] font-medium text-gov"
              >
                {GROUP_LABEL[p] ?? p}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Không có quyền</span>
          )}
        </div>
      ),
    },
    {
      key: "lastLogin",
      header: "Đăng nhập gần nhất",
      sortable: true,
      className: "hidden sm:table-cell",
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (r) =>
        r.status === "active" ? (
          <Badge
            variant="outline"
            className="rounded-md border-success/30 bg-success/10 px-2 py-0 font-medium text-success"
          >
            Hoạt động
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="rounded-md border-destructive/30 bg-destructive/10 px-2 py-0 font-medium text-destructive"
          >
            Đã khóa
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "Thao tác",
      className: "w-40",
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs text-gov hover:bg-gov/5"
            onClick={() => openEdit(r)}
          >
            <Pencil className="size-3.5" />
            Sửa
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1 px-2 text-xs",
              r.status === "active"
                ? "text-warning hover:bg-warning/5"
                : "text-success hover:bg-success/5",
            )}
            onClick={() => toggleLock(r)}
          >
            {r.status === "active" ? (
              <Lock className="size-3.5" />
            ) : (
              <Unlock className="size-3.5" />
            )}
            {r.status === "active" ? "Khóa" : "Mở"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs text-destructive hover:bg-destructive/5"
            onClick={() => setDeleteTarget(r)}
          >
            <Trash2 className="size-3.5" />
            Xóa
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quản trị hệ thống"
        description="Người dùng, vai trò, phân quyền và nhật ký kiểm toán hệ thống."
        crumbs={[{ label: "Nghiệp vụ" }, { label: "Quản trị hệ thống" }]}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="gov-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tổng người dùng
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-navy">{rows.length}</p>
          </div>
          <div className="gov-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Đang hoạt động
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-success">
              {rows.filter((r) => r.status === "active").length}
            </p>
          </div>
          <div className="gov-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Đã khóa
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">
              {rows.filter((r) => r.status === "locked").length}
            </p>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          searchPlaceholder="Tìm kiếm người dùng theo tên, tài khoản, đơn vị, vai trò..."
          toolbar={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetRows();
                  toast.info("Đã khôi phục danh sách người dùng về mặc định.");
                }}
              >
                <RotateCcw className="size-4" />
                Khôi phục
              </Button>
              <Button onClick={openAdd} className="bg-gov text-white hover:bg-gov/90">
                <UserPlus className="size-4" />
                Thêm người dùng
              </Button>
            </div>
          }
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Chỉnh sửa người dùng" : "Thêm người dùng mới"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Cập nhật thông tin và phân quyền truy cập cho tài khoản."
                : "Nhập thông tin tài khoản và chọn vai trò, quyền truy cập phân hệ."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="f-name">Họ tên *</Label>
                <Input
                  id="f-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Trần Thị Mai"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-account">Tài khoản *</Label>
                <Input
                  id="f-account"
                  value={form.account}
                  onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
                  placeholder="VD: tranthimai"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-unit">Đơn vị / Phòng ban</Label>
              <Input
                id="f-unit"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="VD: Phòng QLCN"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vai trò</Label>
                <Select value={form.role} onValueChange={onRoleChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Chọn vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.id} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Trạng thái</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as FormState["status"] }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Chọn trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Hoạt động</SelectItem>
                    <SelectItem value="locked">Đã khóa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border bg-surface p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Phân quyền truy cập phân hệ</p>
                <Badge
                  variant="outline"
                  className="rounded-md border-gov/25 bg-gov/5 text-[10px] font-medium text-gov"
                >
                  {form.permissions.length}/{NAV_GROUPS.length} nhóm
                </Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {NAV_GROUPS.map((g) => {
                  const checked = form.permissions.includes(g);
                  return (
                    <label
                      key={g}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                        checked ? "border-gov/40 bg-gov/5" : "border-border bg-card",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePermission(g)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-medium leading-tight">
                          {GROUP_LABEL[g] ?? g}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {NAV_ITEMS.filter((i) => i.group === g).length} phân hệ
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={save} className="bg-gov text-white hover:bg-gov/90">
              {editingId ? "Lưu thay đổi" : "Thêm người dùng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa người dùng?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sắp xóa "{deleteTarget?.name}" ({deleteTarget?.account}). Thao tác này không thể
              hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
