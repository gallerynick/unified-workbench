import { useEffect, useState } from 'react';
import { Form, Input, Modal, message } from 'antd';
import type { Template, TemplateField } from '../../types/template';
import type { Visibility } from '../../utils/visibility';
import ContentEditor from '@/components/ContentEditor/ContentEditor';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import { createTemplate, updateTemplate } from '../../api/templates';

/**
 * 构建模板 schema 中的内容字段（富文本类型）
 *
 * 将 ContentEditor 编辑的内容（JSON 结构）写入模板 schema 的 content 字段，
 * 供新建/编辑文档时统一组装模板 schema 使用。
 */
function buildContentField(content: Record<string, unknown> | null): TemplateField {
  return {
    key: 'content',
    type: 'richtext',
    label: '内容',
    required: false,
    default_value: null,
    sort_order: 0,
    config: content ?? {},
  };
}

interface TemplateDocModalProps {
  open: boolean;
  /** 非空表示编辑模式；null 表示新建 */
  editingDoc?: Template | null;
  onClose: () => void;
  /** 保存成功回调（父组件刷新列表） */
  onSaved: () => void;
}

/**
 * 项目文档 新建/编辑 共用弹窗
 *
 * 供「模板库 - 项目文档」Tab（ProjectDocsTab）复用，表单状态、校验与提交逻辑内聚于此，
 * 页面只负责打开/关闭/刷新，一处修改、多处以一。
 */
export default function TemplateDocModal({
  open,
  editingDoc = null,
  onClose,
  onSaved,
}: TemplateDocModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState('');
  const [docContent, setDocContent] = useState<Record<string, unknown> | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editingDoc) {
      setDocName(editingDoc.name);
      setDocCategory(editingDoc.category);
      setVisibility((editingDoc.visibility as Visibility) || 'private');
      setRestrictedUsers(editingDoc.restricted_users || []);
      const richtextField = editingDoc.schema.find((f) => f.type === 'richtext');
      setDocContent(richtextField?.config ?? null);
    } else {
      setDocName('');
      setDocCategory('');
      setDocContent(null);
      setVisibility('private');
      setRestrictedUsers([]);
    }
  }, [open, editingDoc]);

  const handleSubmit = async () => {
    if (!docName.trim()) {
      message.error('请输入文档名称');
      return;
    }

    const schema = [buildContentField(docContent)];

    setSubmitting(true);
    try {
      if (editingDoc) {
        const res = await updateTemplate(editingDoc.id, {
          name: docName.trim(),
          category: docCategory.trim() || '未分类',
          location: 'global',
          schema,
          visibility,
          ...(visibility === 'restricted' && restrictedUsers.length > 0 ? { restricted_users: restrictedUsers } : {}),
        });
        if (res.code === 0) {
          message.success('文档更新成功');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const res = await createTemplate({
          name: docName.trim(),
          category: docCategory.trim() || '未分类',
          location: 'global',
          schema,
          visibility,
          ...(visibility === 'restricted' && restrictedUsers.length > 0 ? { restricted_users: restrictedUsers } : {}),
        });
        if (res.code === 0) {
          message.success('文档创建成功');
          onClose();
          onSaved();
        } else {
          message.error(res.msg || '创建失败');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editingDoc ? '编辑文档' : '新建文档'}
      open={open}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      confirmLoading={submitting}
      destroyOnClose
      width={800}
      okText="保存"
      cancelText="取消"
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form layout="vertical">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-card-gap)' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-card-gap)' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="doc-name" style={{ display: 'block', marginBottom: 'var(--spacing-xxs)', fontWeight: 600 }}>
                文档名称                 <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <Input
                id="doc-name"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="请输入文档名称"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="doc-category" style={{ display: 'block', marginBottom: 'var(--spacing-xxs)', fontWeight: 600 }}>
                分类
              </label>
              <Input
                id="doc-category"
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                placeholder="请输入分类（可选）"
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'block', marginBottom: 'var(--spacing-xxs)', fontWeight: 600 }}>
              内容
            </div>
            <ContentEditor
              value={docContent}
              onChange={(val) => setDocContent(val)}
              placeholder="请输入文档内容..."
              minHeight={300}
            />
          </div>

          <Form.Item label="可见性" style={{ marginBottom: 0 }}>
            <VisibilitySetting
              value={visibility}
              restrictedUsers={restrictedUsers}
              onChange={setVisibility}
              onRestrictedUsersChange={setRestrictedUsers}
              showRestrictedTags={false}
              label=""
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
