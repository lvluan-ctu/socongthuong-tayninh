"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Group, Paper, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { IconAlertTriangle, IconArrowLeft, IconDatabase, IconEdit, IconGasStation, IconShieldCheck } from "@tabler/icons-react";
import { MissionDataCatalog } from "@/components/energy/MissionDataCatalog";

 type OilSummary = {
  kpis: Array<{ label: string; value: number }>;
  intelligence?: { alerts: Array<{ id: string; title: string; severity: string; message: string; status: string }> } | null;
};

function format(value: number) {
  return value.toLocaleString("vi-VN");
}

export function OilOperationsWorkspace() {
  const [summary, setSummary] = useState<OilSummary | null>(null);
  const [activeResource, setActiveResource] = useState<"energy_oil_facilities" | "energy_oil_alerts" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/energy/tasks/8/summary", { cache: "no-store" })
      .then((response) => response.json() as Promise<OilSummary>)
      .then((payload) => {
        if (!cancelled) setSummary(payload);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (activeResource) {
    return (
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={3}>{activeResource === "energy_oil_facilities" ? "Cơ sở, trạm và kho xăng dầu" : "Sự cố và cảnh báo dầu khí"}</Title>
            <Text c="dimmed" size="sm">Thêm, sửa, xóa và cập nhật trực tiếp dữ liệu nghiệp vụ nhiệm vụ 8.</Text>
          </div>
          <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={() => setActiveResource(null)}>Về nghiệp vụ chính</Button>
        </Group>
        <MissionDataCatalog taskId={8} initialTable={activeResource} />
      </Stack>
    );
  }

  const alerts = summary?.intelligence?.alerts ?? [];
  const kpi = (index: number) => summary?.kpis[index]?.value ?? 0;

  return (
    <Stack gap="lg">
      <Paper withBorder radius="lg" p="lg" bg="var(--mantine-color-gray-0)">
        <Group justify="space-between" align="flex-start">
          <div>
            <Badge color="teal" variant="light" leftSection={<IconShieldCheck size={14} />}>ĐIỀU HÀNH DẦU KHÍ</Badge>
            <Title order={2} mt="xs">Nghiệp vụ cơ sở và an toàn vận hành</Title>
            <Text c="dimmed" mt={4}>Theo dõi nhanh trạm xăng, kho chứa, tuyến ống và các việc cần xử lý trong kỳ.</Text>
          </div>
          <IconGasStation size={42} color="#0f766e" stroke={1.5} />
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        {["Cơ sở dầu khí", "Kho xăng dầu", "Tuyến ống", "Sự cố / cảnh báo"].map((label, index) => (
          <Paper key={label} withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" fw={700}>{label}</Text>
            <Text size="xl" fw={800} mt={4}>{format(index === 3 ? alerts.length : kpi(index))}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Paper withBorder radius="lg" p="lg">
          <Group justify="space-between" mb="md">
            <div>
              <Title order={3}>Danh mục vận hành</Title>
              <Text size="sm" c="dimmed">Quản lý hồ sơ và thông số trạm, kho xăng dầu.</Text>
            </div>
            <IconDatabase size={22} color="#0f766e" />
          </Group>
          <Stack gap="sm">
            <Button justify="space-between" variant="light" color="teal" leftSection={<IconGasStation size={16} />} rightSection={<IconEdit size={16} />} onClick={() => setActiveResource("energy_oil_facilities")}>Quản lý trạm và kho xăng dầu</Button>
            <Text size="xs" c="dimmed">Có thể thêm mới, chỉnh sửa hoặc xóa bản ghi theo quyền quản trị dữ liệu.</Text>
          </Stack>
        </Paper>

        <Paper withBorder radius="lg" p="lg">
          <Group justify="space-between" mb="md">
            <div>
              <Title order={3}>Sự cố và cảnh báo</Title>
              <Text size="sm" c="dimmed">Danh sách ưu tiên cần theo dõi và xử lý.</Text>
            </div>
            <IconAlertTriangle size={22} color="#b45309" />
          </Group>
          {alerts.length ? (
            <Table.ScrollContainer minWidth={420} maxHeight={230}>
              <Table striped highlightOnHover withTableBorder={false} fz="sm">
                <Table.Thead><Table.Tr><Table.Th>Hồ sơ</Table.Th><Table.Th>Mức độ</Table.Th><Table.Th>Trạng thái</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>{alerts.map((alert) => <Table.Tr key={alert.id}><Table.Td>{alert.title}</Table.Td><Table.Td><Badge color={alert.severity === "danger" ? "red" : "yellow"}>{alert.severity === "danger" ? "Sự cố" : "Cảnh báo"}</Badge></Table.Td><Table.Td>{alert.status}</Table.Td></Table.Tr>)}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : <Alert color="teal">Chưa có sự cố hoặc cảnh báo đang mở.</Alert>}
          <Button mt="md" variant="light" color="orange" leftSection={<IconAlertTriangle size={16} />} onClick={() => setActiveResource("energy_oil_alerts")}>Quản lý sự cố và cảnh báo</Button>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
