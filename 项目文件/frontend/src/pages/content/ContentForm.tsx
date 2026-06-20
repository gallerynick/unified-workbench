import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { createContent, updateContent } from '../../api/contents';
import type { Content, ContentCreateRequest, ContentUpdateRequest } from '../../types/content';
import ContentEditor from './ContentEditor';
import VisibilitySetting from '../files/VisibilitySetting';
import type { Visibility } from '../../utils/visibility';
import styles from './ContentForm.module.css';

interface ContentFormProps {
  visible: boolean;
  mode: 'create' | 'edit';
  content: Content | null;
  onClose: () => void;
  onSuccess: () => void;
}

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
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [restrictedTags, setRestrictedTags] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && content) {
        form.setFieldsValue({
          title: content.title,
          tags: content.tags || [],
        });
        setVisibility((content.visibility as Visibility) || 'public');
        setRestrictedUsers(content.restricted_users || []);
        setRestrictedTags(content.restricted_tags || []);
        setEditorValue(content.body);
      } else {
        form.resetFields();
        setVisibility('public');
        setRestrictedUsers([]);
        setRestrictedTags([]);
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
          visibility,
          tags: values.tags,
        };
        if (visibility === 'restricted') {
          if (restrictedUsers.length > 0) payload.restricted_users = restrictedUsers;
          if (restrictedTags.length > 0) payload.restricted_tags = restrictedTags;
        }
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
          visibility,
          tags: values.tags,
        };
        if (visibility === 'restricted') {
          if (restrictedUsers.length > 0) payload.restricted_users = restrictedUsers;
          if (restrictedTags.length > 0) payload.restricted_tags = restrictedTags;
        }
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

        <Form.Item label="可见性">
          <VisibilitySetting
            value={visibility}
            restrictedUsers={restrictedUsers}
            restrictedTags={restrictedTags}
            onChange={setVisibility}
            onRestrictedUsersChange={setRestrictedUsers}
            onRestrictedTagsChange={setRestrictedTags}
            showDescription
            layout="vertical"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
