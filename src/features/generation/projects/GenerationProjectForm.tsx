'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuildingFactory2,
  IconInfoCircle,
  IconMapPin,
  IconPlugConnected,
  IconUserCog,
} from '@tabler/icons-react';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import {
  generationProjectApiPayload,
  generationProjectFormSchema,
  type GenerationProjectFormInput,
  type GenerationProjectFormValues,
} from './generation-project.schema';
import { FormValidationAlert } from '@/components/forms/FormValidationAlert';

const defaultValues: GenerationProjectFormValues = {
  code: '',
  name: '',
  sourceType: 'SOLAR',
  designedCapacityMw: '',
  actualCapacityMw: '',
  operationStatus: 'PLANNED',
  commissionedAt: '',
  investorCode: '',
  investorName: '',
  operatorCode: '',
  operatorName: '',
  siteCode: '',
  siteName: '',
  address: '',
  adminAreaCode: '',
  latitude: '',
  longitude: '',
  gridConnectionAssetId: '',
  technology: '',
  unitCount: '',
  notes: '',
};

export function GenerationProjectForm() {
  const router = useRouter();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GenerationProjectFormInput, unknown, GenerationProjectFormValues>({ resolver: zodResolver(generationProjectFormSchema), defaultValues });

  const submit = handleSubmit(async (values) => {
    try {
      const response = await fetch('/api/generation/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(generationProjectApiPayload(values)),
      });
      const data = await response.json() as { asset?: { id?: string }; message?: string; issues?: Array<{ path?: Array<string | number>; message?: string }> };
      if (!response.ok) {
        for (const issue of data.issues ?? []) {
          const field = issue.path?.[0];
          if (typeof field === 'string') setError(field as keyof GenerationProjectFormValues, { type: 'server', message: issue.message ?? 'Dữ liệu không hợp lệ' });
        }
        if (data.message?.includes('đã tồn tại')) setError('code', { type: 'server', message: data.message });
        throw new Error(data.message || 'Không thể tạo dự án nguồn.');
      }
      notifications.show({ title: 'Đã tạo dự án nguồn điện', message: 'Hồ sơ đã được lưu vào Asset Registry và Generation Project.', color: 'green' });
      router.push('/energy/nhiem-vu-2/quan-ly');
      router.refresh();
    } catch (error) {
      notifications.show({ title: 'Lưu dự án thất bại', message: error instanceof Error ? error.message : 'Lỗi không xác định.', color: 'red' });
    }
  }, () => notifications.show({ title: 'Dữ liệu chưa hợp lệ', message: 'Kiểm tra các trường được đánh dấu đỏ trước khi lưu.', color: 'red' }));

  return (
    <form onSubmit={submit}>
      <Stack gap="lg">
        <FormValidationAlert errors={errors as Record<string, unknown>} />
        <Alert color="blue" variant="light" radius="xl" icon={<IconInfoCircle size={18} />}>
          Dự án nguồn là asset gốc. Chủ đầu tư, đơn vị vận hành, địa điểm, điểm đấu nối, tổ máy, dữ liệu vận hành, nhiên liệu và hồ sơ quy hoạch sẽ liên kết vào cùng Project 360 thay vì lưu tên rời rạc ở nhiều màn hình.
        </Alert>

        <Paper radius="xl" p="lg" withBorder className="energy-glass">
          <Group gap="sm" mb="md"><ThemeIcon radius="lg" variant="light" color="blue"><IconBuildingFactory2 size={20} /></ThemeIcon><div><Title order={3}>Thông tin dự án</Title><Text size="sm" c="dimmed">Thông tin nhận diện, loại nguồn, công suất và trạng thái.</Text></div></Group>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <TextInput label="Mã dự án" withAsterisk placeholder="GEN-BIOMASS-001" error={errors.code?.message} {...register('code')} />
            <TextInput label="Tên dự án" withAsterisk placeholder="Nhà máy điện sinh khối ..." error={errors.name?.message} {...register('name')} />
            <Controller name="sourceType" control={control} render={({ field }) => <Select label="Loại hình nguồn" withAsterisk data={[{ value: 'SOLAR', label: 'Điện mặt trời' }, { value: 'WIND', label: 'Điện gió' }, { value: 'HYDRO', label: 'Thủy điện' }, { value: 'BIOMASS', label: 'Sinh khối' }, { value: 'WASTE_TO_ENERGY', label: 'Điện rác' }, { value: 'LNG', label: 'LNG' }, { value: 'OTHER', label: 'Khác' }]} value={field.value} onChange={(value) => field.onChange(value ?? 'SOLAR')} error={errors.sourceType?.message} />} />
            <Controller name="operationStatus" control={control} render={({ field }) => <Select label="Trạng thái" withAsterisk data={[{ value: 'PLANNED', label: 'Quy hoạch' }, { value: 'PREPARING_INVESTMENT', label: 'Chuẩn bị đầu tư' }, { value: 'CONSTRUCTION', label: 'Thi công' }, { value: 'OPERATING', label: 'Đang vận hành' }, { value: 'SUSPENDED', label: 'Tạm dừng' }, { value: 'DECOMMISSIONED', label: 'Ngừng vận hành' }]} value={field.value} onChange={(value) => field.onChange(value ?? 'PLANNED')} error={errors.operationStatus?.message} />} />
            <Controller name="designedCapacityMw" control={control} render={({ field }) => <NumberInput label="Công suất thiết kế (MW)" withAsterisk min={0} decimalScale={3} value={field.value === '' ? '' : Number(field.value)} onChange={(value) => field.onChange(String(value ?? ''))} error={errors.designedCapacityMw?.message} />} />
            <Controller name="actualCapacityMw" control={control} render={({ field }) => <NumberInput label="Công suất thực tế/khả dụng (MW)" min={0} decimalScale={3} value={field.value === '' ? '' : Number(field.value)} onChange={(value) => field.onChange(String(value ?? ''))} error={errors.actualCapacityMw?.message} />} />
            <TextInput type="date" label="Ngày vận hành" error={errors.commissionedAt?.message} {...register('commissionedAt')} />
            <TextInput label="Công nghệ chính" placeholder="Lò hơi tầng sôi, PV fixed tilt, CCGT..." error={errors.technology?.message} {...register('technology')} />
            <Controller name="unitCount" control={control} render={({ field }) => <NumberInput label="Số tổ máy / unit" min={0} allowDecimal={false} value={field.value === '' ? '' : Number(field.value)} onChange={(value) => field.onChange(String(value ?? ''))} error={errors.unitCount?.message} />} />
            <TextInput label="Asset ID điểm đấu nối (nếu đã có)" placeholder="UUID TBA/ngăn lộ/feeder" error={errors.gridConnectionAssetId?.message} {...register('gridConnectionAssetId')} />
          </SimpleGrid>
        </Paper>

        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
          <Paper radius="xl" p="lg" withBorder className="energy-glass">
            <Group gap="sm" mb="md"><ThemeIcon radius="lg" variant="light" color="violet"><IconUserCog size={20} /></ThemeIcon><div><Title order={3}>Chủ đầu tư & vận hành</Title><Text size="sm" c="dimmed">Party Registry dùng chung xuyên 7 nhiệm vụ.</Text></div></Group>
            <Stack gap="md">
              <SimpleGrid cols={2}><TextInput label="Mã chủ đầu tư" withAsterisk error={errors.investorCode?.message} {...register('investorCode')} /><TextInput label="Tên chủ đầu tư" withAsterisk error={errors.investorName?.message} {...register('investorName')} /></SimpleGrid>
              <Divider label="Đơn vị vận hành (nếu khác)" labelPosition="center" />
              <SimpleGrid cols={2}><TextInput label="Mã đơn vị vận hành" error={errors.operatorCode?.message} {...register('operatorCode')} /><TextInput label="Tên đơn vị vận hành" error={errors.operatorName?.message} {...register('operatorName')} /></SimpleGrid>
            </Stack>
          </Paper>

          <Paper radius="xl" p="lg" withBorder className="energy-glass">
            <Group gap="sm" mb="md"><ThemeIcon radius="lg" variant="light" color="green"><IconMapPin size={20} /></ThemeIcon><div><Title order={3}>Địa điểm & GIS</Title><Text size="sm" c="dimmed">Neo dự án trên bản đồ và phục vụ phân tích khu vực.</Text></div></Group>
            <Stack gap="md">
              <SimpleGrid cols={2}><TextInput label="Mã địa điểm" withAsterisk error={errors.siteCode?.message} {...register('siteCode')} /><TextInput label="Tên địa điểm" withAsterisk error={errors.siteName?.message} {...register('siteName')} /></SimpleGrid>
              <TextInput label="Địa chỉ" withAsterisk error={errors.address?.message} {...register('address')} />
              <TextInput label="Mã khu vực hành chính" withAsterisk placeholder="Mã xã/phường/huyện theo master data" error={errors.adminAreaCode?.message} {...register('adminAreaCode')} />
              <SimpleGrid cols={2}>
                <Controller name="latitude" control={control} render={({ field }) => <NumberInput label="Latitude" withAsterisk decimalScale={7} value={field.value === '' ? '' : Number(field.value)} onChange={(value) => field.onChange(String(value ?? ''))} error={errors.latitude?.message} />} />
                <Controller name="longitude" control={control} render={({ field }) => <NumberInput label="Longitude" withAsterisk decimalScale={7} value={field.value === '' ? '' : Number(field.value)} onChange={(value) => field.onChange(String(value ?? ''))} error={errors.longitude?.message} />} />
              </SimpleGrid>
            </Stack>
          </Paper>
        </SimpleGrid>

        <Paper radius="xl" p="lg" withBorder className="energy-glass">
          <Group gap="sm" mb="md"><ThemeIcon radius="lg" variant="light" color="cyan"><IconPlugConnected size={20} /></ThemeIcon><Title order={3}>Ghi chú kỹ thuật / nghiệp vụ</Title></Group>
          <Textarea minRows={4} placeholder="Thông tin công nghệ, nguồn số liệu, lưu ý vận hành, căn cứ hồ sơ..." error={errors.notes?.message} {...register('notes')} />
        </Paper>

        <Group justify="flex-end"><Button type="submit" size="md" radius="xl" loading={isSubmitting}>Lưu hồ sơ dự án nguồn</Button></Group>
      </Stack>
    </form>
  );
}
