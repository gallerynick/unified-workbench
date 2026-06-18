import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Form, Input, Select, Button, Switch, message } from 'antd';
import { PlusOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createTemplate, updateTemplate } from '../../api/templates';
import type { Template, TemplateField, TemplateCreate, TemplateUpdate } from '../../types/template';
import styles from './TemplateEditor.module.css';

interface TemplateEditorProps {
  visible: boolean;
  mode: 'create' | 'edit';
  template: Template | null;
  onClose: () => void;
  onSuccess: () => void;
}

const FIELD_TYPE_OPTIONS: { value: TemplateField['type']; label: string }[] = [
  { value: 'text', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'richtext', label: '富文本' },
  { value: 'number', label: '数字' },
  { value: 'datetime', label: '日期时间' },
  { value: 'select', label: '单选' },
  { value: 'multiselect', label: '多选' },
  { value: 'boolean', label: '布尔' },
  { value: 'file', label: '文件' },
  { value: 'image', label: '图片' },
  { value: 'divider', label: '分割线' },
];

const CATEGORY_OPTIONS = [
  { value: '项目管理', label: '项目管理' },
  { value: '文档模板', label: '文档模板' },
  { value: '表单模板', label: '表单模板' },
  { value: '报告模板', label: '报告模板' },
  { value: '其他', label: '其他' },
];

export default function TemplateEditor({
  visible,
  mode,
  template,
  onClose,
  onSuccess,
}: TemplateEditorProps) {
  const [form] = Form.useForm();
  const [fields, setFields] = useState<TemplateField[]>([]);
  const fieldCounter = useRef(0);

  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && template) {
        form.setFieldsValue({
          name: template.name,
          category: template.category,
        });
        setFields([...template.schema]);
        fieldCounter.current = template.schema.length;
      } else {
        form.resetFields();
        setFields([]);
        fieldCounter.current = 0;
      }
    }
  }, [visible, mode, template, form]);

  const handleAddField = useCallback(
    (type: TemplateField['type']) => {
      fieldCounter.current += 1;
      const newField: TemplateField = {
        key: `field-${fieldCounter.current}`,
        type,
        label: `字段 ${fieldCounter.current}`,
        required: false,
        default_value: null,
        sort_order: fields.length,
      };
      setFields((prev) => [...prev, newField]);
    },
    [fields.length],
  );

  const handleRemoveField = useCallback((key: string) => {
    setFields((prev) => prev.filter((f) => f.key !== key));
  }, []);

  const handleFieldChange = useCallback(
    (key: string, updates: Partial<TemplateField>) => {
      setFields((prev) =>
        prev.map((f) => {
          if (f.key !== key) return f;
          const merged = { ...f, ...updates };
          // 切换到非 select/multiselect 时清除 options
          if (
            updates.type !== undefined &&
            updates.type !== 'select' &&
            updates.type !== 'multiselect'
          ) {
            const { options: _options, ...rest } = merged;
            void _options;
            return rest;
          }
          return merged;
        }),
      );
    },
    [],
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((prev) => {
        const oldIndex = prev.findIndex((f) => f.key === active.id);
        const newIndex = prev.findIndex((f) => f.key === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (fields.length === 0) {
        message.error('请至少添加一个字段');
        return;
      }

      const schema = fields.map((f, i) => ({ ...f, sort_order: i }));

      if (mode === 'create') {
        const payload: TemplateCreate = {
          name: values.name as string,
          category: values.category as string,
          schema,
        };
        const res = await createTemplate(payload);
        if (res.code === 0) {
          message.success('模板创建成功');
          onSuccess();
        } else {
          message.error(res.msg || '创建失败');
        }
      } else if (template) {
        const payload: TemplateUpdate = {
          name: values.name as string,
          category: values.category as string,
          schema,
        };
        const res = await updateTemplate(template.id, payload);
        if (res.code === 0) {
          message.success('模板更新成功');
          onSuccess();
        } else {
          message.error(res.msg || '更新失败');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    }
  };

  return (
    <Modal
      title={mode === 'create' ? '新建模板' : '编辑模板'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnClose
      width={800}
      okText="保存"
      cancelText="取消"
      className={styles.modal ?? ''}
    >
      <Form form={form} layout="vertical" className={styles.form ?? ''}>
        <div className={styles.templateHeader ?? ''}>
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
            className={styles.nameField ?? ''}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
            className={styles.categoryField ?? ''}
          >
            <Select placeholder="请选择分类" options={CATEGORY_OPTIONS} />
          </Form.Item>
        </div>

        <div className={styles.fieldSection ?? ''}>
          <div className={styles.fieldSectionHeader ?? ''}>
            <span className={styles.fieldSectionTitle ?? ''}>字段配置</span>
            <Select
              placeholder="添加字段"
              options={FIELD_TYPE_OPTIONS}
              onChange={(value: TemplateField['type']) => handleAddField(value)}
              className={styles.addFieldSelect ?? ''}
              value={null}
            />
          </div>

          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={fields.map((f) => f.key)}
              strategy={verticalListSortingStrategy}
            >
              <div className={styles.fieldList ?? ''}>
                {fields.map((field) => (
                  <SortableFieldCard
                    key={field.key}
                    field={field}
                    onChange={handleFieldChange}
                    onRemove={handleRemoveField}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {fields.length === 0 && (
            <div className={styles.emptyFields ?? ''}>
              暂无字段，请通过上方下拉菜单添加字段
            </div>
          )}
        </div>
      </Form>
    </Modal>
  );
}

/* ── 可排序字段卡片 ── */

interface SortableFieldCardProps {
  field: TemplateField;
  onChange: (key: string, updates: Partial<TemplateField>) => void;
  onRemove: (key: string) => void;
}

function SortableFieldCard({ field, onChange, onRemove }: SortableFieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.key,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform) ?? undefined,
    transition: transition ?? undefined,
  };

  const needsOptions = field.type === 'select' || field.type === 'multiselect';

  return (
    <div ref={setNodeRef} style={style} className={styles.fieldCard ?? ''}>
      <div className={styles.fieldCardHeader ?? ''}>
        <div className={styles.dragHandle ?? ''} {...attributes} {...listeners}>
          <HolderOutlined />
        </div>

        <Input
          value={field.label}
          onChange={(e) => onChange(field.key, { label: e.target.value })}
          placeholder="字段标签"
          className={styles.fieldLabelInput ?? ''}
        />

        <Select
          value={field.type}
          onChange={(value: TemplateField['type']) => onChange(field.key, { type: value })}
          options={FIELD_TYPE_OPTIONS}
          className={styles.fieldTypeSelect ?? ''}
        />

        <div className={styles.fieldRequired ?? ''}>
          <span className={styles.fieldRequiredLabel ?? ''}>必填</span>
          <Switch
            size="small"
            checked={field.required}
            onChange={(checked) => onChange(field.key, { required: checked })}
          />
        </div>

        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onRemove(field.key)}
          className={styles.fieldDeleteButton ?? ''}
        />
      </div>

      {needsOptions && (
        <div className={styles.fieldCardBody ?? ''}>
          <OptionsEditor
            options={field.options ?? []}
            onChange={(options) => onChange(field.key, { options })}
          />
        </div>
      )}
    </div>
  );
}

/* ── 选项编辑器 ── */

interface OptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
}

function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const handleAdd = () => {
    onChange([...options, `选项 ${options.length + 1}`]);
  };

  const handleRemove = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, value: string) => {
    onChange(options.map((opt, i) => (i === index ? value : opt)));
  };

  return (
    <div className={styles.optionsEditor ?? ''}>
      <div className={styles.optionsLabel ?? ''}>选项配置</div>
      {options.map((opt, index) => (
        <div key={index} className={styles.optionRow ?? ''}>
          <Input
            value={opt}
            onChange={(e) => handleChange(index, e.target.value)}
            placeholder={`选项 ${index + 1}`}
            size="small"
            className={styles.optionInput ?? ''}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemove(index)}
          />
        </div>
      ))}
      <Button
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        className={styles.addOptionButton ?? ''}
      >
        添加选项
      </Button>
    </div>
  );
}
