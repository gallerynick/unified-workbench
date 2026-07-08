import {
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  DatePicker,
  Divider,
  Upload,
  Button,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { TemplateField } from '../../types/template';

interface TemplatePreviewProps {
  schema: TemplateField[];
}

const FIELD_TYPE_LABELS: Record<TemplateField['type'], string> = {
  text: '单行文本',
  textarea: '多行文本',
  richtext: '富文本',
  number: '数字',
  datetime: '日期时间',
  select: '单选',
  multiselect: '多选',
  boolean: '布尔',
  file: '文件',
  image: '图片',
  divider: '分割线',
};

export default function TemplatePreview({ schema }: TemplatePreviewProps) {
  const sorted = [...schema].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Form layout="vertical" disabled>
      {sorted.map((field) => (
        <PreviewField key={field.key} field={field} />
      ))}
    </Form>
  );
}

function PreviewField({ field }: { field: TemplateField }) {
  if (field.type === 'divider') {
    return <Divider>{field.label}</Divider>;
  }

  const label = (
    <span>
      {field.label}
      {field.required && <span style={{ color: 'var(--color-error)', marginLeft: "var(--spacing-xxs)" }}>*</span>}
      <span style={{ color: 'var(--text-secondary)', marginLeft: "var(--spacing-xs)", fontSize: 'var(--text-body-xs-size)' }}>
        [{FIELD_TYPE_LABELS[field.type]}]
      </span>
    </span>
  );

  return <Form.Item label={label}>{renderField(field)}</Form.Item>;
}

function renderField(field: TemplateField) {
  switch (field.type) {
    case 'text':
      return <Input placeholder={field.placeholder ?? ''} />;
    case 'textarea':
      return <Input.TextArea placeholder={field.placeholder ?? ''} />;
    case 'richtext':
      return (
        <div
          style={{
            border: 'var(--border-width-thin) solid var(--border-primary)',
            borderRadius: 'var(--rounded-xs)',
            padding: "var(--spacing-card-gap)",
            minHeight: 100,
            background: 'var(--bg-secondary)',
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>富文本预览区域</span>
        </div>
      );
    case 'number':
      return <InputNumber style={{ width: '100%' }} placeholder={field.placeholder ?? ''} />;
    case 'datetime':
      return <DatePicker showTime style={{ width: '100%' }} />;
    case 'select':
      return (
        <Select
          placeholder={field.placeholder ?? ''}
          options={(field.options ?? []).map((opt) => ({ value: opt, label: opt }))}
        />
      );
    case 'multiselect':
      return (
        <Select
          mode="multiple"
          placeholder={field.placeholder ?? ''}
          options={(field.options ?? []).map((opt) => ({ value: opt, label: opt }))}
        />
      );
    case 'boolean':
      return <Switch />;
    case 'file':
      return (
        <Upload disabled>
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      );
    case 'image':
      return (
        <Upload disabled listType="picture-card">
          <div>
            <UploadOutlined />
            <div style={{ marginTop: "var(--spacing-xs)" }}>上传图片</div>
          </div>
        </Upload>
      );
    default:
      return <Input />;
  }
}
