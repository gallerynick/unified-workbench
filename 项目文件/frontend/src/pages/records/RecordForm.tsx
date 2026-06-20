import { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  DatePicker,
  Upload,
  Button,
  Divider,
  message,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import { createRecord, updateRecord } from '../../api/records';
import type { WorkRecord, RecordCreate, RecordUpdate } from '../../types/record';
import type { TemplateField } from '../../types/template';
import ContentEditor from '../content/ContentEditor';
import VisibilitySetting from '../files/VisibilitySetting';
import type { Visibility } from '../../utils/visibility';
import styles from './RecordForm.module.css';

interface RecordFormProps {
  visible: boolean;
  mode: 'create' | 'edit';
  record: WorkRecord | null;
  templateSnapshot: TemplateField[];
  recordType: 'project' | 'record';
  templateId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecordForm({
  visible,
  mode,
  record,
  templateSnapshot,
  recordType,
  templateId,
  onClose,
  onSuccess,
}: RecordFormProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [richtextValues, setRichtextValues] = useState<Record<string, Record<string, unknown>>>({});
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [restrictedTags, setRestrictedTags] = useState<string[]>([]);
  const [fileLists, setFileLists] = useState<Record<string, UploadFile[]>>({});

  // 初始化表单数据
  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && record) {
        form.setFieldsValue({
          title: record.title,
          ...buildFormInitialValues(record.data, templateSnapshot),
        });
        // 初始化 richtext 值
        const rtValues: Record<string, Record<string, unknown>> = {};
        templateSnapshot.forEach((field) => {
          if (field.type === 'richtext' && record.data[field.key]) {
            rtValues[field.key] = record.data[field.key] as Record<string, unknown>;
          }
        });
        setRichtextValues(rtValues);
        // 初始化可见性
        setVisibility((record.visibility as Visibility) || 'public');
        setRestrictedUsers(record.restricted_users || []);
        setRestrictedTags(record.restricted_tags || []);
        // 初始化文件列表
        const fl: Record<string, UploadFile[]> = {};
        templateSnapshot.forEach((field) => {
          if ((field.type === 'file' || field.type === 'image') && record.data[field.key]) {
            const val = record.data[field.key];
            if (Array.isArray(val)) {
              fl[field.key] = val.map((v, i) => {
                const file: UploadFile = {
                  uid: String(i),
                  name: typeof v === 'string' ? v : `file-${i}`,
                  status: 'done',
                };
                if (typeof v === 'string') file.url = v;
                return file;
              });
            }
          }
        });
        setFileLists(fl);
      } else {
        form.resetFields();
        setRichtextValues({});
        setVisibility('public');
        setRestrictedUsers([]);
        setRestrictedTags([]);
        setFileLists({});
      }
    }
  }, [visible, mode, record, templateSnapshot, form]);

  const buildFormInitialValues = useCallback(
    (data: Record<string, unknown>, fields: TemplateField[]) => {
      const values: Record<string, unknown> = {};
      fields.forEach((field) => {
        const val = data[field.key];
        if (val === undefined || val === null) {
          values[field.key] = field.default_value ?? undefined;
        } else if (field.type === 'datetime' && typeof val === 'string') {
          values[field.key] = dayjs(val);
        } else {
          values[field.key] = val;
        }
      });
      return values;
    },
    [],
  );

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 构建 data 对象
      const data: Record<string, unknown> = {};
      templateSnapshot.forEach((field) => {
        if (field.type === 'divider') return;
        if (field.type === 'richtext') {
          data[field.key] = richtextValues[field.key] ?? null;
        } else if (field.type === 'datetime') {
          const val = values[field.key];
          data[field.key] = val ? (val as dayjs.Dayjs).toISOString() : null;
        } else if (field.type === 'file' || field.type === 'image') {
          const fileList = fileLists[field.key] || [];
          data[field.key] = fileList
            .filter((f) => f.status === 'done')
            .map((f) => f.url || f.name);
        } else {
          data[field.key] = values[field.key] ?? null;
        }
      });

      setSubmitting(true);

      if (mode === 'create') {
        const payload: RecordCreate = {
          template_id: templateId,
          title: values.title as string,
          data,
          type: recordType,
          visibility,
        };
        if (visibility === 'restricted') {
          if (restrictedUsers.length > 0) payload.restricted_users = restrictedUsers;
          if (restrictedTags.length > 0) payload.restricted_tags = restrictedTags;
        }
        const res = await createRecord(payload);
        if (res.code === 0) {
          message.success('记录创建成功');
          onSuccess();
        } else {
          message.error(res.msg || '创建失败');
        }
      } else if (record) {
        const payload: RecordUpdate = {
          title: values.title as string,
          data,
          visibility,
        };
        if (visibility === 'restricted') {
          if (restrictedUsers.length > 0) payload.restricted_users = restrictedUsers;
          if (restrictedTags.length > 0) payload.restricted_tags = restrictedTags;
        }
        const res = await updateRecord(record.id, payload);
        if (res.code === 0) {
          message.success('记录更新成功');
          onSuccess();
        } else {
          message.error(res.msg || '更新失败');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRichtextChange = useCallback((key: string, value: Record<string, unknown>) => {
    setRichtextValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleFileChange = useCallback((key: string, fileList: UploadFile[]) => {
    setFileLists((prev) => ({ ...prev, [key]: fileList }));
  }, []);

  // 渲染动态字段
  const renderField = (field: TemplateField) => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            placeholder={field.placeholder ?? `请输入${field.label}`}
            maxLength={500}
          />
        );

      case 'textarea':
        return (
          <Input.TextArea
            placeholder={field.placeholder ?? `请输入${field.label}`}
            rows={4}
            maxLength={5000}
            showCount
          />
        );

      case 'richtext':
        return (
          <ContentEditor
            value={richtextValues[field.key] ?? null}
            onChange={(val) => handleRichtextChange(field.key, val)}
            placeholder={field.placeholder ?? `请输入${field.label}...`}
            minHeight={200}
          />
        );

      case 'number':
        return (
          <InputNumber
            placeholder={field.placeholder ?? `请输入${field.label}`}
            style={{ width: '100%' }}
          />
        );

      case 'datetime':
        return (
          <DatePicker
            showTime
            placeholder={field.placeholder ?? `请选择${field.label}`}
            style={{ width: '100%' }}
          />
        );

      case 'select':
        return (
          <Select
            placeholder={field.placeholder ?? `请选择${field.label}`}
            options={(field.options ?? []).map((opt) => ({ value: opt, label: opt }))}
            allowClear
          />
        );

      case 'multiselect':
        return (
          <Select
            mode="multiple"
            placeholder={field.placeholder ?? `请选择${field.label}`}
            options={(field.options ?? []).map((opt) => ({ value: opt, label: opt }))}
            allowClear
          />
        );

      case 'boolean':
        return <Switch />;

      case 'file':
      case 'image':
        return (
          <Upload
            fileList={fileLists[field.key] || []}
            onChange={({ fileList }) => handleFileChange(field.key, fileList)}
            beforeUpload={() => false}
            multiple
          >
            <Button icon={<UploadOutlined />}>
              {field.type === 'image' ? '上传图片' : '上传文件'}
            </Button>
          </Upload>
        );

      case 'divider':
        return <Divider />;

      default:
        return <Input placeholder={field.label} />;
    }
  };

  // 判断是否需要 Form.Item 包裹（divider 不需要）
  const renderFormField = (field: TemplateField) => {
    if (field.type === 'divider') {
      return (
        <div key={field.key} className={styles.dividerField ?? ''}>
          <Divider />
        </div>
      );
    }

    const isRequired = field.required && field.type !== 'richtext' && field.type !== 'file' && field.type !== 'image';

    return (
      <Form.Item
        key={field.key}
        name={field.key}
        label={field.label}
        required={isRequired}
        rules={isRequired ? [{ required: true, message: `请${field.type === 'datetime' ? '选择' : '输入'}${field.label}` }] : []}
        valuePropName={field.type === 'boolean' ? 'checked' : 'value'}
        className={field.type === 'richtext' ? (styles.editorField ?? '') : ''}
      >
        {renderField(field)}
      </Form.Item>
    );
  };

  return (
    <Modal
      title={mode === 'create' ? '新建记录' : '编辑记录'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={submitting}
      destroyOnClose
      width={800}
      className={styles.modal ?? ''}
    >
      <Form
        form={form}
        layout="vertical"
        className={styles.form ?? ''}
      >
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入标题' }]}
        >
          <Input placeholder="请输入记录标题" maxLength={200} showCount />
        </Form.Item>

        {templateSnapshot
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(renderFormField)}

        <div className={styles.visibilitySection ?? ''}>
          <VisibilitySetting
            value={visibility}
            restrictedUsers={restrictedUsers}
            restrictedTags={restrictedTags}
            onChange={setVisibility}
            onRestrictedUsersChange={setRestrictedUsers}
            onRestrictedTagsChange={setRestrictedTags}
          />
        </div>
      </Form>
    </Modal>
  );
}
