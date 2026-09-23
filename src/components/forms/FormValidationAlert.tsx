import { Alert, List, Text } from '@mantine/core';

type ErrorNode = {
  message?: unknown;
  [key: string]: unknown;
};

function collectMessages(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as ErrorNode;
  const own = typeof node.message === 'string' ? [prefix ? `${prefix}: ${node.message}` : node.message] : [];
  return [
    ...own,
    ...Object.entries(node)
      .filter(([key]) => key !== 'message' && key !== 'type' && key !== 'ref')
      .flatMap(([key, child]) => collectMessages(child, prefix ? `${prefix}.${key}` : key)),
  ];
}

export function FormValidationAlert({
  errors,
  title = 'Dữ liệu chưa hợp lệ',
}: {
  errors: Record<string, unknown>;
  title?: string;
}) {
  const messages = collectMessages(errors);
  if (!messages.length) return null;
  return (
    <Alert color="red" title={title}>
      <Text size="sm" mb={messages.length > 1 ? 4 : 0}>Kiểm tra các trường được đánh dấu trước khi lưu.</Text>
      {messages.length > 1 ? <List size="xs" spacing={2}>{messages.slice(0, 8).map((message) => <List.Item key={message}>{message}</List.Item>)}</List> : null}
    </Alert>
  );
}
