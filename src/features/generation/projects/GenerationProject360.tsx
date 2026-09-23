"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBolt,
  IconArchive,
  IconBuildingFactory2,
  IconEdit,
  IconFileAnalytics,
  IconGasStation,
  IconMapPin,
  IconSettingsAutomation,
  IconUserShield,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { GenerationFuelContractsManager } from "./GenerationFuelContractsManager";
import { GenerationPlanningManager } from "./GenerationPlanningManager";
import { GenerationUnitOperationsManager } from "./GenerationUnitOperationsManager";
import { FormValidationAlert } from "@/components/forms/FormValidationAlert";

type ProjectDetail = {
  assetId: string;
  code: string;
  name: string;
  assetStatus: string;
  commissionedAt: string | null;
  siteId: string | null;
  siteCode: string | null;
  siteName: string | null;
  address: string | null;
  adminAreaCode: string | null;
  sourceType: string;
  designedCapacityMw: number;
  actualCapacityMw: number | null;
  operationStatus: string;
  investorPartyId: string | null;
  operatorPartyId: string | null;
  gridConnectionAssetId: string | null;
  latitude: number | null;
  longitude: number | null;
  technicalSpecs: Record<string, unknown>;
  investor: { id: string; code: string; name: string } | null;
  operator: { id: string; code: string; name: string } | null;
};

const editSchema = z
  .object({
    name: z.string().trim().min(3, "Tên dự án tối thiểu 3 ký tự"),
    operationStatus: z.enum([
      "PLANNED",
      "PREPARING_INVESTMENT",
      "CONSTRUCTION",
      "OPERATING",
      "ACTIVE",
      "SUSPENDED",
      "DECOMMISSIONED",
    ]),
    designedCapacityMw: z.number().positive(),
    actualCapacityMw: z.number().min(0).nullable(),
    commissionedAt: z.string(),
    address: z.string().max(500),
    adminAreaCode: z.string().max(50),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    gridConnectionAssetId: z
      .string()
      .uuid("Asset ID điểm đấu nối không hợp lệ")
      .or(z.literal(""))
      .nullable(),
    technology: z.string().max(250),
    unitCount: z.number().int().min(0).nullable(),
    notes: z.string().max(4000),
  })
  .superRefine((value, context) => {
    if ((value.latitude == null) !== (value.longitude == null))
      context.addIssue({
        code: "custom",
        path: [value.latitude == null ? "latitude" : "longitude"],
        message: "Phải nhập đủ latitude và longitude.",
      });
    if (value.operationStatus === "OPERATING" && !value.commissionedAt)
      context.addIssue({
        code: "custom",
        path: ["commissionedAt"],
        message: "Dự án đang vận hành phải có ngày vận hành.",
      });
    if (value.operationStatus === "OPERATING" && value.actualCapacityMw == null)
      context.addIssue({
        code: "custom",
        path: ["actualCapacityMw"],
        message: "Nhập công suất thực tế của dự án đang vận hành.",
      });
  });

type EditForm = z.infer<typeof editSchema>;

function sourceLabel(value: string) {
  return (
    (
      {
        SOLAR: "Điện mặt trời",
        WIND: "Điện gió",
        HYDRO: "Thủy điện",
        BIOMASS: "Sinh khối",
        WASTE_TO_ENERGY: "Điện rác",
        LNG: "LNG",
        OTHER: "Nguồn khác",
      } as Record<string, string>
    )[value] ?? value
  );
}

function statusColor(status: string) {
  if (status === "OPERATING" || status === "ACTIVE") return "green";
  if (status === "CONSTRUCTION") return "blue";
  if (status === "PREPARING_INVESTMENT") return "cyan";
  if (status === "PLANNED") return "yellow";
  if (status === "SUSPENDED") return "orange";
  return "gray";
}

function fmtDate(value: string | null) {
  if (!value) return "Chưa khai báo";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(date);
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" fw={800}>
        {label}
      </Text>
      <Text fw={700} mt={3}>
        {value || "—"}
      </Text>
    </div>
  );
}

export function GenerationProject360({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpened, setEditOpened] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/generation/projects/${assetId}`, { cache: "no-store" });
      if (!response.ok) {
        setProject(null);
        return;
      }
      const data = (await response.json()) as ProjectDetail;
      setProject(data);
      const specs = data.technicalSpecs ?? {};
      form.reset({
        name: data.name,
        operationStatus: data.operationStatus as EditForm["operationStatus"],
        designedCapacityMw: data.designedCapacityMw,
        actualCapacityMw: data.actualCapacityMw,
        commissionedAt: data.commissionedAt
          ? new Date(data.commissionedAt).toISOString().slice(0, 10)
          : "",
        address: data.address ?? "",
        adminAreaCode: data.adminAreaCode ?? "",
        latitude: data.latitude,
        longitude: data.longitude,
        gridConnectionAssetId: data.gridConnectionAssetId,
        technology: typeof specs.technology === "string" ? specs.technology : "",
        unitCount: typeof specs.unitCount === "number" ? specs.unitCount : null,
        notes: typeof specs.notes === "string" ? specs.notes : "",
      });
    } finally {
      setLoading(false);
    }
  }, [assetId, form]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const utilization = useMemo(() => {
    if (!project?.actualCapacityMw || project.designedCapacityMw <= 0) return null;
    return Math.min(100, (project.actualCapacityMw / project.designedCapacityMw) * 100);
  }, [project]);

  const fuelEnabled = ["BIOMASS", "WASTE_TO_ENERGY", "LNG", "OTHER"].includes(
    project?.sourceType ?? "",
  );

  const submitEdit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/generation/projects/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          commissionedAt: values.commissionedAt || null,
          address: values.address || null,
          adminAreaCode: values.adminAreaCode || null,
          gridConnectionAssetId: values.gridConnectionAssetId || null,
          technology: values.technology || null,
          notes: values.notes || null,
        }),
      });
      const data = (await response.json()) as ProjectDetail & { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể cập nhật dự án.");
      notifications.show({
        title: "Đã cập nhật Project 360",
        message: "Thông tin dự án và site đã được lưu vào cơ sở dữ liệu.",
        color: "green",
      });
      setEditOpened(false);
      await load();
    } catch (error) {
      notifications.show({
        title: "Không thể cập nhật",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  });

  async function archiveProject() {
    if (
      !project ||
      !window.confirm(
        `Ngừng khai thác dự án ${project.code}? Dữ liệu vận hành và hồ sơ liên quan vẫn được bảo toàn.`,
      )
    )
      return;
    setSaving(true);
    try {
      const response = await fetch(`/api/generation/projects/${assetId}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Không thể ngừng khai thác dự án.");
      notifications.show({
        title: "Đã ngừng khai thác dự án",
        message: "Dự án chuyển sang DECOMMISSIONED; lịch sử vẫn được giữ.",
        color: "green",
      });
      router.push("/energy/nhiem-vu-2/quan-ly");
      router.refresh();
    } catch (error) {
      notifications.show({
        title: "Không thể ngừng khai thác",
        message: error instanceof Error ? error.message : "Lỗi không xác định.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <Paper radius="xl" p="xl" withBorder>
        <Text>Đang tải Project 360...</Text>
      </Paper>
    );
  if (!project)
    return (
      <Alert color="red" radius="xl">
        Không tìm thấy dự án nguồn điện.
      </Alert>
    );

  return (
    <Stack gap="lg">
      <Paper radius="xl" p="lg" withBorder className="energy-glass">
        <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
          <Group align="flex-start" gap="md">
            <ThemeIcon
              size={54}
              radius="xl"
              variant="light"
              color={
                project.sourceType === "SOLAR"
                  ? "yellow"
                  : project.sourceType === "BIOMASS"
                    ? "green"
                    : "blue"
              }
            >
              <IconBuildingFactory2 size={28} />
            </ThemeIcon>
            <div>
              <Group gap="xs" wrap="wrap">
                <Title order={2}>{project.name}</Title>
                <Badge color={statusColor(project.operationStatus)} variant="light">
                  {project.operationStatus}
                </Badge>
                <Badge variant="outline">{sourceLabel(project.sourceType)}</Badge>
              </Group>
              <Text c="dimmed" mt={4}>
                {project.code} • {project.siteName ?? "Chưa khai báo site"} •{" "}
                {project.adminAreaCode ?? "Chưa gắn địa bàn"}
              </Text>
              <Group gap="xs" mt="sm" wrap="wrap">
                <Badge color="gray" variant="light">
                  {project.designedCapacityMw.toLocaleString("vi-VN")} MW thiết kế
                </Badge>
                {project.actualCapacityMw != null ? (
                  <Badge color="cyan" variant="light">
                    {project.actualCapacityMw.toLocaleString("vi-VN")} MW thực tế
                  </Badge>
                ) : null}
                {project.gridConnectionAssetId ? (
                  <Badge color="green" variant="dot">
                    Đã liên kết lưới
                  </Badge>
                ) : (
                  <Badge color="orange" variant="dot">
                    Chưa liên kết lưới
                  </Badge>
                )}
              </Group>
            </div>
          </Group>
          <Group>
            <Button
              leftSection={<IconEdit size={16} />}
              variant="light"
              onClick={() => setEditOpened(true)}
            >
              Cập nhật hồ sơ
            </Button>
            <Button
              leftSection={<IconArchive size={16} />}
              variant="light"
              color="orange"
              loading={saving}
              onClick={() => void archiveProject()}
            >
              Ngừng khai thác
            </Button>
          </Group>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            CÔNG SUẤT THIẾT KẾ
          </Text>
          <Text fz={28} fw={900}>
            {project.designedCapacityMw.toLocaleString("vi-VN")} MW
          </Text>
        </Paper>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            CÔNG SUẤT THỰC TẾ
          </Text>
          <Text fz={28} fw={900}>
            {project.actualCapacityMw == null
              ? "—"
              : `${project.actualCapacityMw.toLocaleString("vi-VN")} MW`}
          </Text>
        </Paper>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            TỶ LỆ SO VỚI THIẾT KẾ
          </Text>
          <Text fz={28} fw={900}>
            {utilization == null
              ? "—"
              : `${utilization.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`}
          </Text>
          {utilization != null ? (
            <Progress value={utilization} color={utilization > 90 ? "green" : "cyan"} mt={6} />
          ) : null}
        </Paper>
        <Paper radius="xl" p="md" withBorder>
          <Text size="xs" c="dimmed" fw={800}>
            VẬN HÀNH TỪ
          </Text>
          <Text fz={20} fw={900}>
            {fmtDate(project.commissionedAt)}
          </Text>
        </Paper>
      </SimpleGrid>

      <Tabs defaultValue="overview" variant="outline" radius="lg">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconBuildingFactory2 size={16} />}>
            Tổng quan
          </Tabs.Tab>
          <Tabs.Tab value="operations" leftSection={<IconSettingsAutomation size={16} />}>
            Tổ máy & vận hành
          </Tabs.Tab>
          <Tabs.Tab value="planning" leftSection={<IconFileAnalytics size={16} />}>
            Quy hoạch & hồ sơ
          </Tabs.Tab>
          <Tabs.Tab value="fuel" leftSection={<IconGasStation size={16} />}>
            Nhiên liệu & hợp đồng
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="lg">
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Paper radius="xl" p="lg" withBorder className="energy-glass">
              <Group gap="sm" mb="md">
                <IconUserShield size={21} />
                <Title order={3}>Chủ thể & vận hành</Title>
              </Group>
              <Stack gap="md">
                <Field
                  label="Chủ đầu tư"
                  value={
                    project.investor
                      ? `${project.investor.name} (${project.investor.code})`
                      : "Chưa khai báo"
                  }
                />
                <Field
                  label="Đơn vị vận hành"
                  value={
                    project.operator
                      ? `${project.operator.name} (${project.operator.code})`
                      : "Chưa khai báo"
                  }
                />
                <Field
                  label="Trạng thái dự án"
                  value={
                    <Badge color={statusColor(project.operationStatus)} variant="light">
                      {project.operationStatus}
                    </Badge>
                  }
                />
              </Stack>
            </Paper>
            <Paper radius="xl" p="lg" withBorder className="energy-glass">
              <Group gap="sm" mb="md">
                <IconMapPin size={21} />
                <Title order={3}>Địa điểm & đấu nối</Title>
              </Group>
              <Stack gap="md">
                <Field
                  label="Site"
                  value={
                    project.siteCode
                      ? `${project.siteCode} • ${project.siteName ?? ""}`
                      : project.siteName
                  }
                />
                <Field label="Địa chỉ" value={project.address} />
                <Field label="Địa bàn" value={project.adminAreaCode} />
                <Field
                  label="Tọa độ GIS"
                  value={
                    project.latitude != null && project.longitude != null
                      ? `${project.latitude.toFixed(7)}, ${project.longitude.toFixed(7)}`
                      : "Chưa khai báo"
                  }
                />
                <Field
                  label="Điểm đấu nối"
                  value={
                    project.gridConnectionAssetId
                      ? `Asset ${project.gridConnectionAssetId}`
                      : "Chưa liên kết với Grid Asset"
                  }
                />
              </Stack>
            </Paper>
            <Paper radius="xl" p="lg" withBorder className="energy-glass">
              <Group gap="sm" mb="md">
                <IconBolt size={21} />
                <Title order={3}>Thông số kỹ thuật mở rộng</Title>
              </Group>
              <Stack gap="md">
                <Field
                  label="Công nghệ"
                  value={
                    typeof project.technicalSpecs?.technology === "string"
                      ? project.technicalSpecs.technology
                      : "—"
                  }
                />
                <Field
                  label="Số tổ máy dự kiến/khai báo"
                  value={
                    typeof project.technicalSpecs?.unitCount === "number"
                      ? project.technicalSpecs.unitCount
                      : "—"
                  }
                />
                <Divider />
                <Text size="sm" c="dimmed">
                  Thông số đặc thù Solar/Wind/Hydro/Biomass/LNG có thể tiếp tục mở rộng trong
                  technicalSpecs, nhưng các chỉ số cần thống kê thường xuyên phải được chuẩn hóa
                  thành trường riêng.
                </Text>
              </Stack>
            </Paper>
            <Paper radius="xl" p="lg" withBorder className="energy-glass">
              <Title order={3} mb="md">
                Ghi chú nghiệp vụ
              </Title>
              <Text style={{ whiteSpace: "pre-wrap" }}>
                {typeof project.technicalSpecs?.notes === "string" && project.technicalSpecs.notes
                  ? project.technicalSpecs.notes
                  : "Chưa có ghi chú."}
              </Text>
            </Paper>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="operations" pt="lg">
          <GenerationUnitOperationsManager projectAssetId={assetId} />
        </Tabs.Panel>
        <Tabs.Panel value="planning" pt="lg">
          <GenerationPlanningManager projectAssetId={assetId} />
        </Tabs.Panel>
        <Tabs.Panel value="fuel" pt="lg">
          <GenerationFuelContractsManager projectAssetId={assetId} enabled={fuelEnabled} />
        </Tabs.Panel>
      </Tabs>

      <Drawer
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title="Cập nhật hồ sơ dự án nguồn"
        position="right"
        size="lg"
      >
        <form onSubmit={submitEdit} noValidate>
          <Stack>
            <FormValidationAlert errors={form.formState.errors as Record<string, unknown>} />
            <TextInput
              label="Tên dự án"
              withAsterisk
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
            <SimpleGrid cols={2}>
              <Controller
                control={form.control}
                name="operationStatus"
                render={({ field, fieldState }) => (
                  <Select
                    label="Trạng thái"
                    withAsterisk
                    data={[
                      "PLANNED",
                      "PREPARING_INVESTMENT",
                      "CONSTRUCTION",
                      "OPERATING",
                      "ACTIVE",
                      "SUSPENDED",
                      "DECOMMISSIONED",
                    ]}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "PLANNED")}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <TextInput
                type="date"
                label="Ngày vận hành"
                error={form.formState.errors.commissionedAt?.message}
                {...form.register("commissionedAt")}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <Controller
                control={form.control}
                name="designedCapacityMw"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Công suất thiết kế (MW)"
                    withAsterisk
                    min={0}
                    decimalScale={3}
                    value={field.value}
                    onChange={(v) => field.onChange(Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="actualCapacityMw"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Công suất thực tế (MW)"
                    min={0}
                    decimalScale={3}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <TextInput
                label="Mã địa bàn"
                error={form.formState.errors.adminAreaCode?.message}
                {...form.register("adminAreaCode")}
              />
              <Controller
                control={form.control}
                name="unitCount"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Số tổ máy"
                    min={0}
                    allowDecimal={false}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <TextInput
              label="Địa chỉ"
              error={form.formState.errors.address?.message}
              {...form.register("address")}
            />
            <SimpleGrid cols={2}>
              <Controller
                control={form.control}
                name="latitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Latitude"
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="longitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Longitude"
                    decimalScale={7}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? null : Number(v))}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <TextInput
              label="Asset ID điểm đấu nối"
              placeholder="UUID TBA/ngăn lộ/feeder"
              error={form.formState.errors.gridConnectionAssetId?.message}
              {...form.register("gridConnectionAssetId")}
            />
            <TextInput
              label="Công nghệ"
              error={form.formState.errors.technology?.message}
              {...form.register("technology")}
            />
            <Textarea
              label="Ghi chú"
              minRows={5}
              error={form.formState.errors.notes?.message}
              {...form.register("notes")}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditOpened(false)}>
                Hủy
              </Button>
              <Button type="submit" loading={saving}>
                Lưu thay đổi
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </Stack>
  );
}
