import { useEffect, useState } from 'react';
import { Form, Input, Modal, Space, Switch, TreeSelect, message } from 'antd';
import type { Note } from '../../types/note';
import type { Visibility } from '../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import { createNote, updateNote } from '../../api/notes';

/** 父笔记选择用的树形节点数据（由页面基于全部笔记构建并传入） */
export interface NoteTreeSelectData {
  value: string;
  title: string;
  children: NoteTreeSelectData[];
  /** 编辑时需排除自身节点（不可作为自己的父笔记） */
  selectable: boolean;
}

interface NoteModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingNote?: Note | null;
  /** 父笔记选择的树形数据（编辑时已由页面排除自身节点） */
  treeData: NoteTreeSelectData[];
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

/**
 * 笔记 新建/编辑 共用弹窗
 *
 * 供「笔记知识库」页（NoteManagement）复用，表单与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 */
export default function NoteModal({
  open,
  editingNote = null,
  treeData,
  onClose,
  onSaved,
}: NoteModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [formPinned, setFormPinned] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingNote) {
      setFormTitle(editingNote.title);
      setFormContent(editingNote.content || '');
      setFormCategory(editingNote.category || '');
      setFormParentId(editingNote.parent_id);
      setFormPinned(editingNote.is_pinned);
      setVisibility((editingNote.visibility as Visibility) || 'private');
      setRestrictedUsers(editingNote.restricted_users || []);
    } else {
      setFormTitle('');
      setFormContent('');
      setFormCategory('');
      setFormParentId(null);
      setFormPinned(false);
      setVisibility('private');
      setRestrictedUsers([]);
    }
  }, [open, editingNote, form]);

  const handleSubmit = async () => {
    if (!formTitle.trim()) { message.warning('请输入笔记标题'); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: formTitle,
        content: formContent || undefined,
        category: formCategory || undefined,
        parent_id: formParentId,
        is_pinned: formPinned,
        visibility,
        ...(visibility === 'restricted' && restrictedUsers.length > 0 ? { restricted_users: restrictedUsers } : {}),
      };
      if (editingNote) {
        const res = await updateNote(editingNote.id, payload);
        if (res.code === 0) {
          message.success('笔记已更新');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const res = await createNote(payload);
        if (res.code === 0) {
          message.success('笔记已创建');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '创建失败');
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
      title={editingNote ? '编辑笔记' : '新建笔记'}
      open={open}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      confirmLoading={submitting}
      okText={editingNote ? '保存' : '创建'}
      cancelText="取消"
      width={560}
      destroyOnClose
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="笔记标题" required>
          <Input placeholder="请输入笔记标题" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} variant="filled" size="large" />
        </Form.Item>
        <Space style={{ width: '100%' }} size="middle">
          <Form.Item label="分类">
            <Input placeholder="请输入分类" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} variant="filled" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item label="父笔记">
            <TreeSelect
              placeholder="选择父笔记（可选）"
              style={{ width: 200 }}
              value={formParentId}
              onChange={setFormParentId}
              treeData={treeData}
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
        </Space>
        <Form.Item label="置顶">
          <Switch checked={formPinned} onChange={setFormPinned} checkedChildren="置顶" unCheckedChildren="普通" size="small" />
        </Form.Item>
        <Form.Item label="笔记内容">
          <Input.TextArea placeholder="请输入笔记内容" value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={8} variant="filled" style={{ fontSize: 'var(--text-caption-size)', lineHeight: 1.6 }} />
        </Form.Item>
        <Form.Item label="可见性">
          <VisibilitySetting
            value={visibility}
            restrictedUsers={restrictedUsers}
            onChange={setVisibility}
            onRestrictedUsersChange={setRestrictedUsers}
            showRestrictedTags={false}
            label=""
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
