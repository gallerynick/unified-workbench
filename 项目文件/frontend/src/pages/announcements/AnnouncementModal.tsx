import { useEffect, useState } from 'react';
import { Form, Input, Modal, Switch, message } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import type { Announcement } from '../../types/announcement';
import { createAnnouncement, updateAnnouncement } from '../../api/announcements';

interface AnnouncementModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingAnnouncement?: Announcement | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

interface AnnouncementFormValues {
  title: string;
  content: string;
}

/**
 * 公告 新建/编辑 共用弹窗
 *
 * 供「公告通知」页（AnnouncementManagement）复用，表单与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 */
export default function AnnouncementModal({
  open,
  editingAnnouncement = null,
  onClose,
  onSaved,
}: AnnouncementModalProps) {
  const [form] = Form.useForm<AnnouncementFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingAnnouncement) {
      form.setFieldsValue({
        title: editingAnnouncement.title,
        content: editingAnnouncement.content,
      });
      setPinned(editingAnnouncement.is_pinned);
      setPublished(editingAnnouncement.is_published);
    } else {
      setPinned(false);
      setPublished(true);
    }
  }, [open, editingAnnouncement, form]);

  const handleSubmit = async () => {
    let values: AnnouncementFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验未通过，Modal 会显示错误
    }
    setSubmitting(true);
    try {
      if (editingAnnouncement) {
        const res = await updateAnnouncement(editingAnnouncement.id, {
          title: values.title,
          content: values.content,
          is_pinned: pinned,
          is_published: published,
        });
        if (res.code === 0) {
          message.success('公告已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const res = await createAnnouncement({
          title: values.title,
          content: values.content,
          is_pinned: pinned,
        });
        if (res.code === 0) {
          message.success('公告已发布');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '发布失败');
        }
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editingAnnouncement ? '编辑公告' : '发布公告'}
      open={open}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      confirmLoading={submitting}
      okText={editingAnnouncement ? '保存' : '发布'}
      cancelText="取消"
      destroyOnClose
      width={560}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="公告标题"
          rules={[{ required: true, message: '请输入公告标题' }]}
        >
          <Input placeholder="请输入公告标题" />
        </Form.Item>
        <Form.Item
          name="content"
          label="公告内容"
          rules={[{ required: true, message: '请输入公告内容' }]}
        >
          <Input.TextArea placeholder="请输入公告内容" rows={5} />
        </Form.Item>
        <Form.Item label="置顶">
          <Switch
            checked={pinned}
            onChange={setPinned}
            checkedChildren="置顶"
            unCheckedChildren="普通"
          />
        </Form.Item>
        {editingAnnouncement && (
          <Form.Item label="发布状态">
            <Switch
              checked={published}
              onChange={setPublished}
              checkedChildren={<><EyeOutlined /> 已发布</>}
              unCheckedChildren={<><EyeInvisibleOutlined /> 草稿</>}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
