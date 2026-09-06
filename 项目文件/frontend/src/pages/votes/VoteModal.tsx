import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, message } from 'antd';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import { createVote } from '../../api/votes';

interface VoteModalProps {
  open: boolean;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface VoteFormValues {
  title: string;
  description?: string;
}

/**
 * 投票 新建弹窗
 *
 * 供「投票决策」页（VoteManagement）复用，表单与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 */
export default function VoteModal({
  open,
  onClose,
  onSaved,
}: VoteModalProps) {
  const [form] = Form.useForm<VoteFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [formOptions, setFormOptions] = useState(['', '']);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [restrictedTags, setRestrictedTags] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setFormOptions(['', '']);
    setVisibility('private');
    setRestrictedUsers([]);
    setRestrictedTags([]);
  }, [open, form]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      const opts = formOptions.filter((o) => o.trim());
      if (opts.length < 2) {
        message.warning('至少需要2个选项');
        return;
      }
      const res = await createVote({
        title: values.title,
        description: values.description ?? '',
        options: opts,
        visibility,
        ...(visibility === 'restricted'
          ? { restricted_users: restrictedUsers, restricted_tags: restrictedTags }
          : {}),
      });
      if (res.code === 0) {
        message.success('投票已创建');
        onClose();
        onSaved();
      }
    } catch {
      message.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="新建投票"
      open={open}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      confirmLoading={submitting}
      okText="创建"
      cancelText="取消"
      destroyOnClose
      width={560}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="投票标题"
          rules={[{ required: true, message: '请输入投票标题' }]}
        >
          <Input placeholder="请输入投票标题" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea placeholder="请输入描述（可选）" rows={2} />
        </Form.Item>
        {formOptions.map((opt, i) => (
          <Form.Item key={i} label={`选项 ${i + 1}`}>
            <Input
              placeholder={`请输入选项 ${i + 1}`}
              value={opt}
              onChange={(e) => {
                const next = [...formOptions];
                next[i] = e.target.value;
                setFormOptions(next);
              }}
            />
          </Form.Item>
        ))}
        <Button type="dashed" onClick={() => setFormOptions([...formOptions, ''])} block>
          添加选项
        </Button>
        <div style={{ marginTop: 'var(--spacing-card-gap)' }}>
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
