import { Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';

export function KpiCard({ label, value, note, icon, color = 'blue' }: { label: string; value: string; note?: string; icon?: ReactNode; color?: string }) {
  return (
    <Paper radius="xl" p="lg" withBorder className="energy-glass">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={3}>
          <Text size="xs" fw={800} tt="uppercase" c="dimmed">{label}</Text>
          <Text fz={30} fw={900} className="energy-kpi-value">{value}</Text>
          {note ? <Text size="xs" c="dimmed">{note}</Text> : null}
        </Stack>
        {icon ? <ThemeIcon size={42} radius="lg" variant="light" color={color}>{icon}</ThemeIcon> : null}
      </Group>
    </Paper>
  );
}
