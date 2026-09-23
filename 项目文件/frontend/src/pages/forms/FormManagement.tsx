import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Typography,
  Modal,
  message,
  Space,
  Input,
  Tag,
  Switch,
  Tooltip,
  Form,
  Dropdown,
  Select,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  FormOutlined,
  BarChartOutlined,
  ShareAltOutlined,
  QrcodeOutlined,
  CopyOutlined,
  QuestionCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EditOutlined,
  ExportOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { QRCodeSVG } from 'qrcode.react';
import {
  listForms,
  createForm,
  updateForm,
  deleteForm,
  exportFormFile,
} from '../../api/forms';
import type { FormField, FormItem, FormUpdate } from '../../types/form';
import type { Visibility } from '../../utils/visibility';
import { getVisibilityConfig } from '../../utils/visibility';
import VisibilitySetting from '@/components/VisibilitySetting/VisibilitySetting';
import styles from './FormManagement.module.css';

const { Title, Paragraph, Text } = Typography;

const FIELD_TYPES: { value: string; label: string }[] = [
  { value: 'text', label: '文本' },
  { value: 'textarea', label: '段落' },
  { value: 'number', label: '数字' },
  { value: 'select', label: '下拉' },
  { value: 'radio', label: '单选' },
  { value: 'checkbox', label: '多选' },
];

const OPTION_TYPES = ['select', 'radio', 'checkbox'];
const PLACEHOLDER_TYPES = ['text', 'textarea', 'number'];
const MAX_FIELD_COUNT = 50;

function newFieldKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function createEmptyField(): FormField {
  return { key: newFieldKey(), type: 'text', label: '', required: false };
}

function fieldTypeLabel(type: string): string {
  return FIELD_TYPES.find((t) => t.value === type)?.label ?? type;
}

function showDetail(error: unknown, fallback: string): void {
  message.error(error instanceof Error && error.message ? error.message : fallback);
}

/** 表单字段编辑器：卡片化布局，支持类型选择、必填、提示、选项编辑与上下移动 */
function FieldEditor({
  fields,
  onChange,
}: {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}) {
  const patchField = (index: number, patch: Partial<FormField>): void => {
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  };

  const removeField = (index: number): void => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, offset: number): void => {
    const target = index + offset;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    const current = next[index];
    const neighbor = next[target];
    if (!current || !neighbor) return;
    next[index] = neighbor;
    next[target] = current;
    onChange(next);
  };

  const addOption = (index: number): void => {
    const field = fields[index];
    if (!field) return;
    patchField(index, { options: [...(field.options ?? []), ''] });
  };

  const patchOption = (index: number, optionIndex: number, value: string): void => {
    const field = fields[index];
    if (!field) return;
    const options = (field.options ?? []).map((opt, i) => (i === optionIndex ? value : opt));
    patchField(index, { options });
  };

  const removeOption = (index: number, optionIndex: number): void => {
    const field = fields[index];
    if (!field) return;
    patchField(index, { options: (field.options ?? []).filter((_, i) => i !== optionIndex) });
  };

  return (
    <div className={styles.fieldsSection ?? ''}>
      <div className={styles.sectionTitleRow ?? ''}>
        <span className={styles.sectionTitle ?? ''}>表单字段</span>
        <Text type="secondary" className={styles.sectionHint ?? ''}>
          字段创建后不可修改，请仔细核对
        </Text>
        <Text type="secondary" className={styles.sectionHint ?? ''}>
          已添加 {fields.length} / {MAX_FIELD_COUNT}
        </Text>
      </div>
      <div className={styles.fieldsList ?? ''}>
        {fields.map((field, index) => (
          <div key={field.key} className={styles.fieldCard ?? ''}>
            <div className={styles.fieldCardHeader ?? ''}>
              <span className={styles.fieldIndex ?? ''}>{index + 1}</span>
              <Select
                className={styles.fieldType ?? ''}
                value={field.type}
                options={FIELD_TYPES}
                onChange={(value) => patchField(index, { type: value })}
              />
              <Input
                className={styles.fieldLabel ?? ''}
                placeholder="字段标签，如：姓名"
                value={field.label}
                onChange={(e) => patchField(index, { label: e.target.value })}
                maxLength={50}
              />
              <Switch
                checked={field.required ?? false}
                onChange={(value) => patchField(index, { required: value })}
                checkedChildren="必填"
                unCheckedChildren="可选"
              />
              <div className={styles.fieldActions ?? ''}>
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={index === 0}
                  onClick={() => moveField(index, -1)}
                  aria-label="上移"
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={index === fields.length - 1}
                  onClick={() => moveField(index, 1)}
                  aria-label="下移"
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeField(index)}
                  aria-label="删除字段"
                />
              </div>
            </div>
            {PLACEHOLDER_TYPES.includes(field.type) && (
              <div className={styles.fieldSub ?? ''}>
                <span className={styles.fieldSubLabel ?? ''}>输入提示</span>
                <Input
                  placeholder="请输入..."
                  value={field.placeholder ?? ''}
                  onChange={(e) => patchField(index, { placeholder: e.target.value })}
                  maxLength={50}
                />
              </div>
            )}
            {OPTION_TYPES.includes(field.type) && (
              <div className={styles.fieldSub ?? ''}>
                <span className={styles.fieldSubLabel ?? ''}>选项（至少 2 个）</span>
                <div className={styles.optionsRow ?? ''}>
                  {(field.options ?? []).map((option, optionIndex) => (
                    <span key={optionIndex} className={styles.optionItem ?? ''}>
                      <Input
                        className={styles.optionInput ?? ''}
                        size="small"
                        value={option}
                        onChange={(e) => patchOption(index, optionIndex, e.target.value)}
                        maxLength={30}
                      />
                      <CloseOutlined
                        role="button"
                        aria-label="删除选项"
                        style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}
                        onClick={() => removeOption(index, optionIndex)}
                      />
                    </span>
                  ))}
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => addOption(index)}
                  >
                    添加选项
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <Button
        className={styles.addFieldButton ?? ''}
        type="dashed"
        block
        icon={<PlusOutlined />}
        disabled={fields.length >= MAX_FIELD_COUNT}
        onClick={() => onChange([...fields, createEmptyField()])}
      >
        添加字段
      </Button>
    </div>
  );
}

export default function FormManagement() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<FormItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([createEmptyField()]);
  const [visibility, setVisibility] = useState<Visibility>('restricted');
  const [restrictedUsers, setRestrictedUsers] = useState<string[]>([]);
  const [restrictedTags, setRestrictedTags] = useState<string[]>([]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrForm, setQrForm] = useState<FormItem | null>(null);
  const [permissionVisible, setPermissionVisible] = useState(false);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listForms({ page, page_size: pageSize });
      if (res.code === 0 && res.data) {
        setForms(res.data.items);
        setTotal(res.data.total);
      }
    } catch {
      message.error('获取表单列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void fetchForms();
  }, [fetchForms]);

  const openCreate = (): void => {
    form.resetFields();
    setFormFields([createEmptyField()]);
    setVisibility('restricted');
    setRestrictedUsers([]);
    setRestrictedTags([]);
    setEditing(null);
    setModalVisible(true);
  };

  /** 可见性变更：未登录访问只在「公开」下可选，切走时同步收起开关 */
  const handleVisibilityChange = (value: Visibility): void => {
    setVisibility(value);
    if (value !== 'public') {
      form.setFieldValue('allow_visitor', false);
    }
  };

  const openEdit = (target: FormItem): void => {
    form.setFieldsValue({
      title: target.title,
      description: target.description ?? '',
      allow_visitor: target.allow_visitor,
      is_active: target.is_active,
    });
    setFormFields(target.fields);
    setVisibility(target.visibility);
    setRestrictedUsers(target.restricted_users ?? []);
    setRestrictedTags(target.restricted_tags ?? []);
    setEditing(target);
    setModalVisible(true);
  };

  const closeModal = (): void => {
    setModalVisible(false);
    setEditing(null);
  };

  const handleSubmit = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editing) {
        const payload: FormUpdate = {
          title: values.title,
          description: values.description ?? null,
          allow_visitor: values.allow_visitor ?? false,
          is_active: values.is_active ?? true,
          visibility,
          restricted_users: visibility === 'restricted' ? restrictedUsers : null,
          restricted_tags: visibility === 'restricted' ? restrictedTags : null,
        };
        const res = await updateForm(editing.id, payload);
        if (res.code === 0) {
          message.success('表单已更新');
          closeModal();
          void fetchForms();
        } else {
          message.error(res.msg || '更新失败');
        }
      } else {
        const payload = {
          title: values.title,
          description: values.description ?? '',
          fields: formFields,
          visibility,
          allow_visitor: values.allow_visitor ?? false,
        };
        const res = await createForm(
          visibility === 'restricted'
            ? { ...payload, restricted_users: restrictedUsers, restricted_tags: restrictedTags }
            : payload,
        );
        if (res.code === 0) {
          message.success('表单已创建');
          closeModal();
          void fetchForms();
        } else {
          message.error(res.msg || '创建失败');
        }
      }
    } catch (error) {
      showDetail(error, '保存失败，请检查表单内容');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (target: FormItem): void => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除表单「' + target.title + '」吗？已提交的回复会一并删除，且无法恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteForm(target.id);
          if (res.code === 0) {
            message.success('表单已删除');
            void fetchForms();
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch (error) {
          showDetail(error, '删除失败');
        }
      },
    });
  };

  const handleExport = async (target: FormItem, fmt: 'xlsx' | 'csv'): Promise<void> => {
    try {
      await exportFormFile(target.id, fmt);
      message.success(fmt === 'xlsx' ? '已导出 Excel' : '已导出 CSV');
    } catch (error) {
      showDetail(error, '导出失败');
    }
  };

  const shareable = (record: FormItem): boolean =>
    record.is_active && record.visibility !== 'private';

  const fillUrl = (id: string): string => window.location.origin + '/forms/' + id + '/fill';

  const columns: ColumnsType<FormItem> = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: '可见性',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 96,
      render: (v: Visibility) => {
        const config = getVisibilityConfig(v);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    { title: '字段数', key: 'fields', width: 80, render: (_: unknown, r) => r.fields.length },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '关闭'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (d: string) => new Date(d).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 300,
      render: (_: unknown, record: FormItem) => (
        <Space size="small" wrap>
          {shareable(record) && (
            <Tooltip title="填写表单">
              <Button
                type="link"
                size="small"
                icon={<FormOutlined />}
                onClick={() => window.open(fillUrl(record.id), '_blank')}
              >
                填写
              </Button>
            </Tooltip>
          )}
          <Tooltip title="查看统计与回复">
            <Button
              type="link"
              size="small"
              icon={<BarChartOutlined />}
              onClick={() => navigate('/forms/' + record.id + '/responses')}
            >
              统计 {record.response_count || 0}
            </Button>
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'edit',
                  label: '编辑',
                  icon: <EditOutlined />,
                  onClick: () => openEdit(record),
                },
                {
                  key: 'export-xlsx',
                  label: '导出 Excel',
                  icon: <ExportOutlined />,
                  onClick: () => void handleExport(record, 'xlsx'),
                },
                {
                  key: 'export-csv',
                  label: '导出 CSV',
                  icon: <ExportOutlined />,
                  onClick: () => void handleExport(record, 'csv'),
                },
              ],
            }}
          >
            <Button type="link" size="small" icon={<EditOutlined />}>
              更多
            </Button>
          </Dropdown>
          {shareable(record) && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'copy',
                    label: '复制链接',
                    icon: <CopyOutlined />,
                    onClick: () => {
                      void navigator.clipboard.writeText(fillUrl(record.id));
                      message.success('链接已复制');
                    },
                  },
                  {
                    key: 'qr',
                    label: '二维码',
                    icon: <QrcodeOutlined />,
                    onClick: () => {
                      setQrForm(record);
                      setShowQrModal(true);
                    },
                  },
                ],
              }}
            >
              <Button type="link" size="small" icon={<ShareAltOutlined />}>
                分享
              </Button>
            </Dropdown>
          )}
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="删除"
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          表单收集
        </Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建表单
          </Button>
          <Tooltip title="权限说明">
            <Button
              type="text"
              size="small"
              icon={<QuestionCircleOutlined />}
              onClick={() => setPermissionVisible(true)}
            />
          </Tooltip>
        </Space>
      </div>
      <Table<FormItem>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={forms}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => '共 ' + t + ' 条',
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
      <Modal
        title={editing ? '编辑表单' : '新建表单'}
        open={modalVisible}
        onOk={() => void handleSubmit()}
        onCancel={closeModal}
        confirmLoading={submitting}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        width={640}
        destroyOnClose
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={form} layout="vertical" initialValues={{ is_active: true }}>
          <Form.Item
            name="title"
            label="表单标题"
            rules={[{ required: true, message: '请输入表单标题' }]}
          >
            <Input placeholder="请输入表单标题" maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述（可选）" rows={2} maxLength={500} />
          </Form.Item>
          {editing ? (
            <div className={styles.fieldsSection ?? ''}>
              <div className={styles.sectionTitleRow ?? ''}>
                <span className={styles.sectionTitle ?? ''}>表单字段</span>
                <Text type="secondary" className={styles.sectionHint ?? ''}>
                  字段创建后不可修改
                </Text>
              </div>
              <div className={styles.readonlyFields ?? ''}>
                {formFields.map((field, index) => (
                  <div key={field.key} className={styles.readonlyFieldItem ?? ''}>
                    <span>{index + 1}</span>
                    <Tag>{fieldTypeLabel(field.type)}</Tag>
                    <span>{field.label}</span>
                    {field.required ? <Tag color="orange">必填</Tag> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <FieldEditor fields={formFields} onChange={setFormFields} />
          )}
          <div className={styles.settingsBlock ?? ''}>
            <VisibilitySetting
              value={visibility}
              restrictedUsers={restrictedUsers}
              restrictedTags={restrictedTags}
              onChange={handleVisibilityChange}
              onRestrictedUsersChange={setRestrictedUsers}
              onRestrictedTagsChange={setRestrictedTags}
              hidePrivate
              tagValueMode="name"
            />
            <Form.Item
              name="allow_visitor"
              label="允许未登录填写"
              valuePropName="checked"
              extra={
                visibility === 'public'
                  ? '开启后未登录访客也可通过链接填写，提交者记为「访客」；关闭后仅登录用户可填写'
                  : '仅「公开」可见性可开启；受限 / 私有表单只有工作台内授权人员可填'
              }
            >
              <Switch disabled={visibility !== 'public'} />
            </Form.Item>
            <Form.Item name="is_active" label="启用状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="已关闭" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
      <Modal
        title="分享表单"
        open={showQrModal}
        onCancel={() => setShowQrModal(false)}
        footer={null}
        width={420}
        destroyOnClose
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        {qrForm && (
          <div style={{ textAlign: 'center' }}>
            <QRCodeSVG value={fillUrl(qrForm.id)} size={200} />
            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              <Text copyable>{fillUrl(qrForm.id)}</Text>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
      >
        <div className={styles.permissionContent ?? ''}>
          <Title level={5}>创建者权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            创建者拥有表单的完整管理权限，可以编辑表单内容、查看回复和删除表单。
          </Paragraph>
          <Title level={5}>成员/指定用户权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            可见范围内的成员可以填写表单并查看自己的回复；被指定的用户只能填写被授权给自己的表单。
          </Paragraph>
          <Title level={5}>可见范围</Title>
          <ul className={styles.permissionList ?? ''}>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                公开：所有登录成员都可以填写该表单
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                受限：仅被指定的用户，或拥有被指定标签的成员，可以填写该表单
              </Text>
            </li>
          </ul>
          <Title level={5}>管理员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            系统管理员可以查看和管理所有表单。
          </Paragraph>
          <Title level={5}>创建权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            所有成员都可以创建表单，创建时需设定可见范围。
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
}
