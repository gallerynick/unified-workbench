import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Radio, message } from 'antd';
import { createContent, updateContent } from '../../api/contents';
import type { Content, ContentCreateRequest, ContentUpdateRequest } from '../../types/content';
import ContentEditor from './ContentEditor';
import styles from './ContentForm.module.css';

interface ContentFormProps {
  visible: boolean;
  mode: 'create' | 'edit';
  content: Content | null;
  onClose: () => void;
  onSuccess: () => void;
}

// 可见性选项
const VISIBILITY_OPTIONS = [
  { value: 'public', label: '公开', description: '所有人可见' },
  { value: 'private', label: '私有', description: '仅自己可见' },
  { value: 'restricted', label: '受限', description: '指定用户/标签可见' },
];

// 预设标签选项（后续可从 API 获取）
const TAG_OPTIONS = [
  { value: 'notice', label: '通知' },
  { value: 'document', label: '文档' },
  { value: 'meeting', label: '会议' },
  { value: 'report', label: '报告' },
  { value: 'spec', label: '规格' },
];

export default function ContentForm({
  visible,
  mode,
  content,
  onClose,
  onSuccess,
}: ContentFormProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [editorValue, setEditorValue] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && content) {
        form.setFieldsValue({
          title: content.title,
          visibility: content.visibility,
          tags: content.tags || [],
          restricted_users: content.restricted_users || [],
        });
        setEditorValue(content.body);
      } else {
        form.resetFields();
        setEditorValue(null);
      }
    }
  }, [visible, mode, content, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (!editorValue || Object.keys(editorValue).length === 0) {
        message.warning('请输入内容');
        return;
      }

      setSubmitting(true);

      if (mode === 'create') {
        const payload: ContentCreateRequest = {
          title: values.title,
          body: editorValue,
          visibility: values.visibility,
          tags: values.tags,
          restricted_users: values.visibility === 'restricted' ? values.restricted_users : undefined,
        };
        const res = await createContent(payload);
        if (res.code === 0) {
          message.success('内容创建成功');
          onSuccess();
        } else {
          message.error(res.msg || '创建失败');
        }
      } else if (content) {
        const payload: ContentUpdateRequest = {
          title: values.title,
          body: editorValue,
          visibility: values.visibility,
          tags: values.tags,
          restricted_users: values.visibility === 'restricted' ? values.restricted_users : undefined,
        };
        const res = await updateContent(content.id, payload);
        if (res.code === 0) {
          message.success('内容更新成功');
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

  const visibility = Form.useWatch('visibility', form);

  return (
    <Modal
      title={mode === 'create' ? '新建内容' : '编辑内容'}
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
        initialValues={{ visibility: 'public' }}
      >
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入标题' }]}
        >
          <Input placeholder="请输入内容标题" maxLength={200} showCount />
        </Form.Item>

        <Form.Item
          label="内容"
          required
          className={styles.editorField ?? ''}
        >
          <ContentEditor
            value={editorValue}
            onChange={setEditorValue}
            placeholder="请输入内容..."
            minHeight={250}
          />
        </Form.Item>

        <Form.Item
          name="tags"
          label="标签"
        >
          <Select
            mode="multiple"
            placeholder="请选择或输入标签"
            options={TAG_OPTIONS}
            allowClear
          />
        </Form.Item>

        <Form.Item
          name="visibility"
          label="可见性"
        >
          <Radio.Group>
            <div className={styles.visibilitySection ?? ''}>
              {VISIBILITY_OPTIONS.map((opt) => (
                <Radio key={opt.value} value={opt.value}>
                  <div>
                    <div className={styles.visibilityOptionTitle ?? ''}>{opt.label}</div>
                    <div className={styles.visibilityOptionDesc ?? ''}>{opt.description}</div>
                  </div>
                </Radio>
              ))}
            </div>
          </Radio.Group>
        </Form.Item>

        {visibility === 'restricted' && (
          <Form.Item
            name="restricted_users"
            label="受限用户"
            tooltip="指定可以查看此内容的用户ID"
          >
            <Select
              mode="multiple"
              placeholder="请输入用户ID"
              allowClear
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
