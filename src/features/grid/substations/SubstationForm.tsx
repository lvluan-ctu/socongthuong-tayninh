"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { substationFormSchema, type SubstationFormValues } from "./substation.schema";

type AdminArea = { code: string; name: string; level: string; parentCode: string | null };
type ApiIssue = { path?: Array<string | number>; message?: string };

const defaultValues: SubstationFormValues = {
  code: "",
  name: "",
  status: "ACTIVE",
  voltageLevelKv: 110,
  substationType: "AIS",
  designedCapacityMva: 63,
  installedCapacityMva: 63,
  currentLoadMva: 0,
  operator: "Công ty Điện lực",
  commissionedAt: "",
  siteCode: "",
  address: "",
  adminAreaCode: "",
  latitude: 11.3,
  longitude: 106.1,
};

export function SubstationForm({
  assetId,
  onSaved,
  onCancel,
}: {
  assetId?: string;
  onSaved?: () => void;
  onCancel?: () => void;
} = {}) {
  const router = useRouter();
  const [adminAreas, setAdminAreas] = useState<AdminArea[]>([]);
  const [loadingRecord, setLoadingRecord] = useState(Boolean(assetId));
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubstationFormValues>({
    resolver: zodResolver(substationFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  useEffect(() => {
    void fetch("/api/core/admin-areas", { cache: "no-store" })
      .then((response) =>
        response.ok ? (response.json() as Promise<{ items: AdminArea[] }>) : null,
      )
      .then((payload) => setAdminAreas(payload?.items ?? []));
  }, []);

  useEffect(() => {
    if (!assetId) return;
    const controller = new AbortController();
    setLoadingRecord(true);
    void fetch(`/api/grid/substations/${assetId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as Partial<SubstationFormValues> & {
          message?: string;
        };
        if (!response.ok) throw new Error(payload.message ?? "Không thể tải hồ sơ trạm.");
        reset({
          ...defaultValues,
          ...payload,
          siteCode: payload.siteCode ?? defaultValues.siteCode,
          address: payload.address ?? "",
          adminAreaCode: payload.adminAreaCode ?? "",
          latitude: payload.latitude ?? defaultValues.latitude,
          longitude: payload.longitude ?? defaultValues.longitude,
          commissionedAt: payload.commissionedAt ? String(payload.commissionedAt).slice(0, 10) : "",
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        notifications.show({
          color: "red",
          title: "Không thể tải hồ sơ trạm",
          message: error instanceof Error ? error.message : "Lỗi không xác định.",
        });
      })
      .finally(() => setLoadingRecord(false));
    return () => controller.abort();
  }, [assetId, reset]);

  const onSubmit = handleSubmit(
    async (values) => {
      const response = await fetch(
        assetId ? `/api/grid/substations/${assetId}` : "/api/grid/substations",
        {
          method: assetId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const payload = (await response.json()) as {
        message?: string;
        issues?: ApiIssue[];
        errors?: { fieldErrors?: Record<string, string[]> };
      };
      if (!response.ok) {
        for (const issue of payload.issues ?? []) {
          const field = issue.path?.[0];
          if (typeof field === "string" && field in defaultValues) {
            setError(field as keyof SubstationFormValues, {
              type: "server",
              message: issue.message ?? "Dữ liệu không hợp lệ",
            });
          }
        }
        for (const [field, messages] of Object.entries(payload.errors?.fieldErrors ?? {})) {
          if (field in defaultValues && messages?.[0])
            setError(field as keyof SubstationFormValues, { type: "server", message: messages[0] });
        }
        notifications.show({
          color: "red",
          title: "Không thể lưu trạm",
          message: payload.message ?? "Vui lòng kiểm tra lại dữ liệu.",
        });
        return;
      }
      notifications.show({
        color: "green",
        title: assetId ? "Đã cập nhật trạm biến áp" : "Đã tạo trạm biến áp",
        message: `${values.code} — ${values.name}`,
      });
      if (onSaved) onSaved();
      else {
        router.push("/energy/nhiem-vu-1/quan-ly");
        router.refresh();
      }
    },
    () =>
      notifications.show({
        color: "red",
        title: "Thông tin chưa hợp lệ",
        message: "Kiểm tra các trường được đánh dấu đỏ trước khi lưu.",
      }),
  );

  return (
    <Paper radius="xl" p="lg" withBorder className="energy-glass">
      <form onSubmit={onSubmit} noValidate>
        <Stack gap="lg">
          {Object.keys(errors).length ? (
            <Alert color="red" title="Cần kiểm tra lại dữ liệu">
              Có {Object.keys(errors).length} trường chưa hợp lệ. Chi tiết hiển thị ngay dưới từng ô
              nhập.
            </Alert>
          ) : null}
          {loadingRecord ? <Text c="dimmed">Đang tải hồ sơ trạm…</Text> : null}

          <Title order={3}>Thông tin định danh</Title>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Mã trạm"
              withAsterisk
              placeholder="TBA-110-TN-001"
              disabled={Boolean(assetId)}
              error={errors.code?.message}
              {...register("code")}
            />
            <TextInput
              label="Tên trạm"
              withAsterisk
              placeholder="Trạm 110kV Tây Ninh"
              error={errors.name?.message}
              {...register("name")}
            />
            <Controller
              control={control}
              name="voltageLevelKv"
              render={({ field }) => (
                <NumberInput
                  label="Cấp điện áp (kV)"
                  withAsterisk
                  min={0}
                  decimalScale={3}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.voltageLevelKv?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="substationType"
              render={({ field }) => (
                <Select
                  label="Kiểu trạm"
                  withAsterisk
                  data={[
                    ["AIS", "AIS"],
                    ["GIS", "GIS"],
                    ["COMPACT", "Compact"],
                    ["DISTRIBUTION", "Phân phối"],
                    ["OTHER", "Khác"],
                  ].map(([value, label]) => ({ value, label }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.substationType?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  label="Trạng thái tài sản"
                  withAsterisk
                  data={[
                    { value: "ACTIVE", label: "Đang vận hành" },
                    { value: "PLANNED", label: "Quy hoạch" },
                    { value: "MAINTENANCE", label: "Bảo trì" },
                    { value: "INACTIVE", label: "Tạm ngừng" },
                    { value: "DECOMMISSIONED", label: "Ngừng khai thác" },
                  ]}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "ACTIVE")}
                  error={errors.status?.message}
                />
              )}
            />
          </SimpleGrid>

          <Title order={3}>Công suất & vận hành</Title>
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Controller
              control={control}
              name="designedCapacityMva"
              render={({ field }) => (
                <NumberInput
                  label="Công suất thiết kế (MVA)"
                  withAsterisk
                  min={0}
                  decimalScale={3}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.designedCapacityMva?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="installedCapacityMva"
              render={({ field }) => (
                <NumberInput
                  label="Công suất lắp đặt (MVA)"
                  withAsterisk
                  min={0}
                  decimalScale={3}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.installedCapacityMva?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="currentLoadMva"
              render={({ field }) => (
                <NumberInput
                  label="Tải hiện tại (MVA)"
                  withAsterisk
                  min={0}
                  decimalScale={3}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.currentLoadMva?.message}
                />
              )}
            />
            <TextInput
              label="Đơn vị vận hành"
              withAsterisk
              error={errors.operator?.message}
              {...register("operator")}
            />
            <TextInput
              label="Ngày đưa vào sử dụng"
              withAsterisk
              type="date"
              error={errors.commissionedAt?.message}
              {...register("commissionedAt")}
            />
          </SimpleGrid>

          <Title order={3}>Vị trí GIS & địa bàn</Title>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Mã địa điểm / site"
              withAsterisk
              placeholder="SITE-TBA-110-TN-001"
              disabled={Boolean(assetId)}
              error={errors.siteCode?.message}
              {...register("siteCode")}
            />
            <TextInput
              label="Địa chỉ"
              withAsterisk
              error={errors.address?.message}
              {...register("address")}
            />
            <Controller
              control={control}
              name="adminAreaCode"
              render={({ field }) => (
                <Select
                  searchable
                  clearable
                  label="Khu vực hành chính"
                  withAsterisk
                  placeholder="Chọn xã/phường/huyện"
                  data={adminAreas.map((area) => ({
                    value: area.code,
                    label: `${area.name} • ${area.level}`,
                  }))}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.adminAreaCode?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="latitude"
              render={({ field }) => (
                <NumberInput
                  label="Latitude"
                  withAsterisk
                  decimalScale={7}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.latitude?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="longitude"
              render={({ field }) => (
                <NumberInput
                  label="Longitude"
                  withAsterisk
                  decimalScale={7}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.longitude?.message}
                />
              )}
            />
          </SimpleGrid>

          <Alert color="blue" title="Các chỉ số hệ thống tự tính">
            Hệ số tải, công suất khả dụng và mức cảnh báo quá tải được tính lại từ công suất lắp đặt
            và tải hiện tại sau mỗi lần lưu.
          </Alert>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => (onCancel ? onCancel() : router.back())}>
              Hủy
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={loadingRecord}>
              {assetId ? "Lưu thay đổi" : "Lưu trạm biến áp"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
