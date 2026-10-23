import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, ClockCircleOutlined, CheckCircleOutlined, PlayCircleOutlined, PauseCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Modal, Form, Tag, Tooltip, Space, Empty, message, Spin, Typography, Upload, Pagination } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { listMeetingRecords, createMeetingRecord, importMeetingAudio } from '../../api/meeting-records';
import type { MeetingRecord, MeetingRecordCreate, MeetingStatus } from '../../types/meeting-record';
import VisibilitySetting from '../../components/VisibilitySetting/VisibilitySetting';
import { getVisibilityConfig } from '../../utils/visibility';
import styles from './MeetingList.module.css';

const { Title, Text, Paragraph } = Typography;

/** antd Form 校验失败时抛出带 errorFields 的对象 */
function isFormValidationError(err: unknown): err is { errorFields: unknown[] } {
  return typeof err === 'object' && err !== null && 'errorFields' in err;
}


const statusMap: Record<MeetingStatus, { label: string; color: string; icon: React.ElementType }> = {
  not_started: { label: '未开始', color: 'default', icon: ClockCircleOutlined },
  recording: { label: '转录中', color: 'processing', icon: PlayCircleOutlined },
  paused: { label: '已暂停', color: 'warning', icon: PauseCircleOutlined },
  processing: { label: '处理中', color: 'blue', icon: ClockCircleOutlined },
  completed: { label: '已完成', color: 'success', icon: CheckCircleOutlined },
};

export default function MeetingList() {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [permissionVisible, setPermissionVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  // M9：分页——原实现固定拉第一页 100 条，第 101 场会议起静默不可见
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;
  const navigate = useNavigate();

  const fetchMeetings = useCallback(async (targetPage: number = page) => {
    setLoading(true);
    try {
      const res = await listMeetingRecords({ page: targetPage, page_size: PAGE_SIZE });
      if (res.code === 0 && res.data) {
        setMeetings(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (error) {
      console.error('获取会议列表失败:', error);
      message.error('获取会议列表失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      const data: MeetingRecordCreate = {
        title: values.title,
        visibility: values.visibility || 'private',
        restricted_users: [],
        restricted_tags: [],
        expected_speakers: values.expected_speakers ?? null,
      };
      const res = await createMeetingRecord(data);
      if (res.code === 0) {
        const newId = res.data.id;
        // 若选择导入录音：创建后上传并自动触发识别
        if (newId && audioFile) {
          try {
            const imp = await importMeetingAudio(newId, audioFile);
            if (imp.code === 0) {
              message.success('会议已创建，录音识别已开始');
            } else {
              message.warning('会议已创建，但录音导入失败：' + (imp.msg || '未知错误'));
            }
          } catch {
            message.warning('会议已创建，但录音导入失败，请稍后重试');
          }
        } else {
          message.success('会议已创建');
        }
        setCreateModalOpen(false);
        createForm.resetFields();
        setAudioFile(null);
        setPage(1);  // 新会议排在最前，回到第一页能看到
        fetchMeetings(1);
      } else {
        message.error(res.msg || '创建失败');
      }
    } catch (error: unknown) {
      if (isFormValidationError(error)) {
        return; // 表单验证错误
      }
      console.error('创建会议失败:', error);
      message.error('创建会议失败');
    } finally {
      setCreating(false);
    }
  };

  const handleViewMeeting = (id: string) => {
    navigate('/meetings/' + id);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4} className={styles.title ?? ''}>
          会议记录
        </Title>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            新建会议
          </Button>
          <Tooltip title="权限说明">
            <Button
              type="text"
              icon={<QuestionCircleOutlined />}
              onClick={() => setPermissionVisible(true)}
            />
          </Tooltip>
        </Space>
      </div>

      <Spin spinning={loading}>
        {meetings.length === 0 ? (
          <div className={styles.empty}>
            <Empty description="暂无会议，点击右上角「新建会议」开始记录" />
          </div>
        ) : (
          <div className={styles.grid}>
          {meetings.map((meeting) => {
            const statusInfo = statusMap[meeting.status] || statusMap.not_started;
            const StatusIcon = statusInfo.icon;
            const visibilityCfg = getVisibilityConfig(meeting.visibility);
            return (
              <div
                key={meeting.id}
                className={styles.card}
                onClick={() => handleViewMeeting(meeting.id)}
              >
                <div className={styles.cardHead}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Tag color={visibilityCfg.color} style={{ margin: 0 }}>
                      {visibilityCfg.text}
                    </Tag>
                    <Tag color={statusInfo.color} style={{ margin: 0 }}>
                      <StatusIcon style={{ marginRight: 4 }} />
                      {statusInfo.label}
                    </Tag>
                  </div>
                </div>
                <h3 className={styles.cardTitle}>{meeting.title}</h3>
                <div className={styles.meta}>
                  <span className={styles.metaItem}>
                    <ClockCircleOutlined />
                    {formatDuration(meeting.duration_seconds)}
                  </span>
                </div>
              </div>
            );
          })}
          </div>
        )}
        {/* M9：分页器——后端本就支持分页，前端此前固定拉 100 条 */}
        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <Pagination
              current={page}
              total={total}
              pageSize={PAGE_SIZE}
              showSizeChanger={false}
              showTotal={(t) => `共 ${t} 场会议`}
              onChange={(p) => setPage(p)}
            />
          </div>
        )}
      </Spin>

      <Modal
        title="新建会议"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ visibility: 'private' }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="title"
            label="会议标题"
            rules={[{ required: true, message: '请输入会议标题' }]}
          >
            <Input placeholder="请输入会议标题" />
          </Form.Item>
          <Form.Item
            name="visibility"
            label="可见性"
            // 此前缺 name 导致 validateFields() 取不到该字段，选「公开」被回退成「私有」
          >
            <VisibilitySetting label="" />
          </Form.Item>
          <Form.Item
            name="expected_speakers"
            label="讲话人人数"
            tooltip="填写预期讲话人数，会后说话人分离将按此人数聚类、区分更准；留空则不指定、自动判断"
          >
            <InputNumber min={2} max={20} placeholder="留空自动判断" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="导入录音（可选）"
            tooltip="上传已有录音（wav/mp3/flac），创建后自动识别：转录区、纪要、录音区均以上传音频为准"
          >
            <Upload
              accept=".wav,.mp3,.flac,.m4a"
              maxCount={1}
              beforeUpload={(file) => {
                setAudioFile(file);
                return false; // 阻止自动上传，创建会议时统一提交
              }}
              onRemove={() => setAudioFile(null)}
            >
              <Button icon={<UploadOutlined />}>选择录音文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="权限说明"
        open={permissionVisible}
        width={560}
        footer={null}
        onCancel={() => setPermissionVisible(false)}
      >
        <div style={{ lineHeight: '24px' }}>
          <Title level={5}>创建者权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            创建者拥有该会议的完整管理权限：编辑内容、设置可见范围、删除会议。
          </Paragraph>
          <Title level={5}>其他成员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            非创建者只能查看自己可见范围内的会议，不能编辑或删除。
          </Paragraph>
          <Title level={5}>可见范围</Title>
          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                公开：所有登录成员都可以查看该会议
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                私有：仅创建者可以查看
              </Text>
            </li>
            <li>
              <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)' }}>
                受限：仅创建者和被指定的用户/标签用户可见
              </Text>
            </li>
          </ul>
          <Title level={5}>管理员</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            系统管理员不享有额外权限：只能管理自己创建的会议；对公开或指定给自己的会议同样只读。
          </Paragraph>
          <Title level={5}>创建权限</Title>
          <Paragraph style={{ fontSize: 'var(--text-body-sm-size)' }}>
            所有成员都可以创建会议，创建时可设定可见范围，默认为私有。
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
}
