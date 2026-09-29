import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AutoComplete,
  Button,
  Card,
  DatePicker,
  Divider,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Steps,
  Tag,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  deleteProjectChange,
  getProjectChange,
  updateProjectChange,
} from '../../api/project-changes';
import { getProject } from '../../api/projects';
import {
  CHANGE_CATEGORY_MAJOR,
  CHANGE_CATEGORY_MINOR_MAP,
} from '../../constants/project';
import { useUser } from '../../contexts/UserContext';
import { getUserId, isAdmin } from '../../utils/auth';
import type { Project } from '../../types/project';
import type { ProjectChange, ProjectChangeUpdate } from '../../types/project-change';
import styles from './ChangeDetailPage.module.css';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

/** 修改记录状态选项 */
const STATUS_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已采纳' },
  { value: 'rejected', label: '已拒绝' },
] as const;

const STATUS_COLOR: Record<string, string> = {
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
};

function getMajorLabel(value: string): string {
  return CHANGE_CATEGORY_MAJOR.find((c) => c.value === value)?.label ?? value;
}

function getMinorLabel(major: string, minor: string | null): string {
  if (!minor) return '';
  const options = CHANGE_CATEGORY_MINOR_MAP[major];
  return options?.find((o) => o.value === minor)?.label ?? minor;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 项目修改记录详情页
 *
 * 展示范式沿用交流详情页：状态流转 Steps + 定义列表 + 段落区块 + 分区编辑。
 * 修改记录无关联提案/待办，故不做「关联内容」Tab。
 */
export default function ChangeDetailPage() {
  const { id: projectId, changeId } = useParams<{ id: string; changeId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();

  const [change, setChange] = useState<ProjectChange | null>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);

  // ── 分区编辑状态 ──
  const [editBasicVisible, setEditBasicVisible] = useState(false);
  const [editContentVisible, setEditContentVisible] = useState(false);
  const [basicForm] = Form.useForm();
  const [editContentBody, setEditContentBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [minorValue, setMinorValue] = useState<string | undefined>(undefined);

  // ── 权限 ──
  const currentUserId = getUserId();
  const isAdminUser = isAdmin();
  const isOwner = !!currentUserId && currentUserId === project?.owner_id;
  const changesPermission = project?.member_permissions?.[user?.id ?? '']?.['changes'] ?? '';
  const changesApprover = !!user && project?.member_permissions?.[user?.id ?? '']?.changes_approver === true;
  const isProjectOwner = !!user && project?.owner_id === user?.id;
  const canManageChange = isAdminUser || isOwner || changesPermission === 'create';
  const canApproveChange = isAdminUser || isProjectOwner || changesApprover;

  const fetchChange = useCallback(async () => {
    if (!projectId || !changeId) return;
    setLoading(true);
    try {
      const [changeRes, projectRes] = await Promise.all([
        getProjectChange(changeId),
        getProject(projectId),
      ]);
      if (changeRes.code === 0) {
        setChange(changeRes.data);
      } else {
        message.error(changeRes.msg || '获取修改记录失败');
        navigate(`/projects/${projectId}`);
      }
      if (projectRes.code === 0) setProject(projectRes.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取修改记录失败';
      message.error(msg);
      navigate(`/projects/${projectId}`);
    } finally {
      setLoading(false);
    }
  }, [projectId, changeId, navigate]);

  useEffect(() => {
    void fetchChange();
  }, [fetchChange]);

  const handleBack = () => {
    if (projectId) navigate(`/projects/${projectId}`);
  };

  const handleDelete = useCallback(() => {
    if (!change) return;
    Modal.confirm({
      title: '确认删除修改记录',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除修改记录「${change.number}」吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteProjectChange(change.id);
          if (res.code === 0) {
            message.success('修改记录已删除');
            if (projectId) navigate(`/projects/${projectId}`);
          } else {
            message.error(res.msg || '删除失败');
          }
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  }, [change, projectId, navigate]);

  // ── 分区编辑：打开基础信息弹窗 ──
  const openEditBasic = useCallback(() => {
    if (!change) return;
    basicForm.setFieldsValue({
      title: change.title,
      date: change.date ? dayjs(change.date) : undefined,
      category_major: change.category_major,
      category_minor: change.category_minor,
      category_detail: change.category_detail ?? '',
      status: change.status,
    });
    setMinorValue(change.category_major);
    setEditBasicVisible(true);
  }, [change, basicForm]);

  const handleSaveBasic = useCallback(async () => {
    if (!change) return;
    let values;
    try {
      values = await basicForm.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const status = values.status ?? 'pending';
      if ((status === 'approved' || status === 'rejected') && !canApproveChange) {
        message.error('您没有权限将修改记录标记为已采纳或已拒绝');
        return;
      }
      const payload: ProjectChangeUpdate = {
        title: values.title?.trim() ?? '',
        date: values.date?.format('YYYY-MM-DDTHH:mm:ss') ?? new Date().toISOString(),
        category_major: values.category_major,
        status,
      };
      if (values.category_minor) payload.category_minor = values.category_minor;
      if (values.category_detail) payload.category_detail = values.category_detail;
      const res = await updateProjectChange(change.id, payload);
      if (res.code === 0) {
        message.success('基础信息已更新');
        setChange(res.data);
        setEditBasicVisible(false);
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSaving(false);
    }
  }, [change, basicForm, canApproveChange]);

  // ── 分区编辑：打开变更内容弹窗 ──
  const openEditContent = useCallback(() => {
    if (!change) return;
    setEditContentBody(change.content ?? '');
    setEditContentVisible(true);
  }, [change]);

  const handleSaveContent = useCallback(async () => {
    if (!change) return;
    setSaving(true);
    try {
      const res = await updateProjectChange(change.id, { content: editContentBody.trim() });
      if (res.code === 0) {
        message.success('变更内容已更新');
        setChange(res.data);
        setEditContentVisible(false);
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSaving(false);
    }
  }, [change, editContentBody]);

  // ── 状态变更 ──
  const handleStatusChange = useCallback(
    (targetStatus: string) => {
      if (!change) return;
      if ((targetStatus === 'approved' || targetStatus === 'rejected') && !canApproveChange) {
        message.error('您没有权限审批修改记录');
        return;
      }
      const doChange = async () => {
        try {
          const res = await updateProjectChange(change.id, { status: targetStatus });
          if (res.code === 0) {
            message.success('状态已更新');
            setChange(res.data);
          } else {
            message.error(res.msg || '更新失败');
          }
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : '更新失败');
        }
      };
      void doChange();
    },
    [change, canApproveChange],
  );

  if (!change && !loading) return null;

  const statusColor = STATUS_COLOR[change?.status ?? ''] ?? 'default';
  const statusLabel = STATUS_OPTIONS.find((s) => s.value === change?.status)?.label ?? change?.status ?? '-';
  const majorLabel = change ? getMajorLabel(change.category_major) : '';
  const minorLabel = change ? getMinorLabel(change.category_major, change.category_minor) : '';

  // 状态流程步骤（pending → approved/rejected）
  const statusStepIndex: Record<string, number> = {
    pending: 0,
    approved: 1,
    rejected: 1,
  };
  const currentStep = statusStepIndex[change?.status ?? ''] ?? 0;
  const statusSteps = [
    { title: '待审核' },
    { title: '审批结果' },
  ];

  const renderDefItem = (label: string, value: React.ReactNode) => (
    <div className={styles.defItem ?? ''}>
      <span className={styles.defLabel ?? ''}>{label}</span>
      <span className={styles.defValue ?? ''}>{value}</span>
    </div>
  );

  const sectionHeader = (title: string, onEdit: () => void) => (
    <div className={styles.sectionHeader ?? ''}>
      <span className={styles.sectionTitle ?? ''}>{title}</span>
      {canManageChange && (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={onEdit}>
          编辑
        </Button>
      )}
    </div>
  );

  const minorOptions = CHANGE_CATEGORY_MINOR_MAP[minorValue ?? ''] ?? [];

  const tabItems = [
    {
      key: 'detail',
      label: '修改详情',
      children: (
        <div className={styles.tabContent ?? ''}>
          {/* 状态流转 */}
          <Steps
            size="small"
            current={currentStep}
            items={statusSteps}
            style={{ marginBottom: 'var(--spacing-card-gap)' }}
          />

          {/* 基础信息 */}
          <div className={styles.textBlock ?? ''}>
            {sectionHeader('基础信息', openEditBasic)}
            <div className={styles.definitionList ?? ''}>
              {renderDefItem('编号', change?.number ?? '-')}
              {renderDefItem('标题', change?.title ?? '-')}
              {renderDefItem('日期', change?.date ? formatDateOnly(change.date) : '-')}
              {renderDefItem('大类', <Tag color="geekblue">{majorLabel}</Tag>)}
              {renderDefItem('小类', minorLabel ? <Tag>{minorLabel}</Tag> : '-')}
              {renderDefItem('详情', change?.category_detail || '-')}
              {renderDefItem(
                '状态',
                <Tag color={statusColor} style={{ margin: 0 }}>{statusLabel}</Tag>,
              )}
              {renderDefItem('创建时间', change ? formatDate(change.created_at) : '-')}
              {renderDefItem('更新时间', change ? formatDate(change.updated_at) : '-')}
            </div>
          </div>

          {/* 变更内容 */}
          <div className={styles.textBlock ?? ''}>
            {sectionHeader('变更内容', openEditContent)}
            {change?.content ? (
              <div className={styles.textBody ?? ''}>{change.content}</div>
            ) : (
              <Text type="secondary" style={{ fontSize: 'var(--text-body-sm-size)' }}>
                暂无变更内容
              </Text>
            )}
          </div>
        </div>
      ),
    },
    ...(canManageChange
      ? [
          {
            key: 'actions',
            label: '修改操作',
            children: (
              <div>
                <Title level={5} style={{ marginBottom: 16 }}>
                  审批操作
                </Title>
                <div style={{ marginBottom: 24 }}>
                  <Text strong style={{ marginRight: 16 }}>
                    当前状态：
                  </Text>
                  <Tag color={statusColor}>{statusLabel}</Tag>
                </div>

                {canApproveChange && (
                  <>
                    <div style={{ marginBottom: 24 }}>
                      <Text strong style={{ marginRight: 16 }}>
                        审批：
                      </Text>
                      <Space>
                        {change?.status !== 'approved' && (
                          <Button type="primary" onClick={() => handleStatusChange('approved')}>
                            采纳
                          </Button>
                        )}
                        {change?.status !== 'rejected' && (
                          <Button danger onClick={() => handleStatusChange('rejected')}>
                            拒绝
                          </Button>
                        )}
                        {change?.status !== 'pending' && (
                          <Button onClick={() => handleStatusChange('pending')}>
                            退回待审核
                          </Button>
                        )}
                      </Space>
                    </div>
                    <Divider />
                  </>
                )}

                <div>
                  <Title level={5} style={{ marginBottom: 16 }}>
                    其他操作
                  </Title>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text strong>编辑基础信息</Text>
                        <Paragraph type="secondary" style={{ marginBottom: 0, marginLeft: 12 }}>
                          修改标题、日期、分类和状态
                        </Paragraph>
                      </div>
                      <Button icon={<EditOutlined />} onClick={openEditBasic}>
                        编辑
                      </Button>
                    </Space>
                    <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text strong>编辑变更内容</Text>
                        <Paragraph type="secondary" style={{ marginBottom: 0, marginLeft: 12 }}>
                          修改变更内容的详细描述
                        </Paragraph>
                      </div>
                      <Button icon={<EditOutlined />} onClick={openEditContent}>
                        编辑
                      </Button>
                    </Space>
                    <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text strong>删除修改记录</Text>
                        <Paragraph type="secondary" style={{ marginBottom: 0, marginLeft: 12 }}>
                          删除此修改记录，此操作不可恢复
                        </Paragraph>
                      </div>
                      <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                        删除
                      </Button>
                    </Space>
                  </Space>
                </div>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Spin spinning={loading}>
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <Tooltip title={change?.number + ' ' + (change?.title ?? '')}>
            <Title level={4} className={styles.title ?? ''}>
              {change?.number} {change?.title ?? ''}
            </Title>
          </Tooltip>
          <Tag color={statusColor}>{statusLabel}</Tag>
        </Space>
        <Space>
          {canManageChange ? (
            <Tooltip title="删除">
              <Button danger icon={<DeleteOutlined />} onClick={handleDelete} />
            </Tooltip>
          ) : (
            <Tooltip title="只读权限，无法删除">
              <Button danger icon={<DeleteOutlined />} disabled />
            </Tooltip>
          )}
        </Space>
      </div>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* ── 基础信息编辑弹窗 ── */}
      <Modal
        title="编辑基础信息"
        open={editBasicVisible}
        onOk={() => void handleSaveBasic()}
        onCancel={() => setEditBasicVisible(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        width={520}
        styles={{ body: { paddingBottom: 8 } }}
      >
        <Form form={basicForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入标题" maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true }]}>
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="category_major" label="大类" rules={[{ required: true }]}>
            <AutoComplete
              placeholder="请选择或输入大类"
              options={CHANGE_CATEGORY_MAJOR.map((c) => ({ value: c.value, label: c.label }))}
              onChange={(value) => {
                setMinorValue(value);
                basicForm.setFieldValue('category_minor', undefined);
                if (value === 'other') basicForm.setFieldValue('category_detail', undefined);
              }}
            />
          </Form.Item>
          <Form.Item
            name="category_minor"
            label={minorValue === 'other' ? '小类（自定义）' : '小类'}
            rules={[{ required: true, message: minorValue === 'other' ? '请输入小类' : '请选择小类' }]}
          >
            {minorValue === 'other' ? (
              <Input placeholder="请输入小类" maxLength={50} showCount />
            ) : (
              <AutoComplete
                placeholder="请选择或输入小类"
                options={minorOptions}
                allowClear
              />
            )}
          </Form.Item>
          <Form.Item
            name="category_detail"
            label="详情"
            {...(minorValue === 'other' ? { rules: [{ required: true, message: '请输入详情' }] } : {})}
          >
            <Input
              placeholder={minorValue === 'other' ? '请输入详情' : '选填：具体文件/模块名'}
              maxLength={200}
              showCount
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              placeholder="请选择状态"
              options={STATUS_OPTIONS.map((s) => ({
                value: s.value,
                label: s.label,
                disabled: (!canApproveChange && (s.value === 'approved' || s.value === 'rejected')),
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── 变更内容编辑弹窗 ── */}
      <Modal
        title="编辑变更内容"
        open={editContentVisible}
        onOk={() => void handleSaveContent()}
        onCancel={() => setEditContentVisible(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        width={560}
        styles={{ body: { paddingBottom: 8 } }}
      >
        <TextArea
          rows={10}
          value={editContentBody}
          onChange={(e) => setEditContentBody(e.target.value)}
          placeholder="请输入变更内容描述"
          maxLength={5000}
          showCount
        />
      </Modal>
    </div>
    </Spin>
  );
}
