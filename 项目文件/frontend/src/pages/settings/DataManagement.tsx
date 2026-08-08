import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Progress,
  Space,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  ExportOutlined,
  ImportOutlined,
  InboxOutlined,
  LockOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { RcFile, UploadProps } from 'antd/es/upload';
import { request } from '../../utils/request';
import { getToken } from '../../utils/auth';
import { verifyPassword } from '../../api/secrets';
import styles from './DataManagement.module.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const BASE = '/api/v1/transfer';

type TaskStatus = 'idle' | 'running' | 'completed' | 'failed';

interface ExportStatus {
  status: 'running' | 'completed' | 'failed';
  completed_tables: number;
  total_tables: number;
  current_table: string;
  error: string | null;
}

interface ImportStats {
  imported_tables: number;
  imported_rows: number;
  total_tables: number;
  file_count: number;
  errors: string[];
}

interface ImportStatusData {
  status: 'running' | 'completed' | 'failed';
  stats: ImportStats | null;
  error: string | null;
}

type RollbackStatus = 'none' | 'ok' | 'failed';

interface ImportResultModal {
  type: 'success' | 'error';
  tables: number;
  rows: number;
  message: string;
  rollback: RollbackStatus;
}

export default function DataManagement() {
  // ── 导出状态 ──
  const [exportPassword, setExportPassword] = useState('');
  const [exportStatus, setExportStatus] = useState<TaskStatus>('idle');
  const [exportProgress, setExportProgress] = useState({
    completed: 0,
    total: 0,
    current: '',
  });
  const [exportSalt, setExportSalt] = useState('');
  const [exportUrl, setExportUrl] = useState('');
  const [exportFileName, setExportFileName] = useState('export.zip');
  const exportTimerRef = useRef<number | null>(null);

  // ── 导入状态 ──
  const [importPassword, setImportPassword] = useState('');
  const [importSalt, setImportSalt] = useState('');
  const [importFile, setImportFile] = useState<RcFile | null>(null);
  const [importStatus, setImportStatus] = useState<TaskStatus>('idle');
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [importError, setImportError] = useState('');
  const [importProgress, setImportProgress] = useState({ imported: 0, total: 0 });
  const importTimerRef = useRef<number | null>(null);

  // ── 导入预览 ──
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    zip_version: string;
    current_version: string;
    can_import: boolean;
    version_note: string;
    exported_at: string;
    total_tables: number;
    total_rows: number;
    app_id: string;
  } | null>(null);

  // ── 导入二次验证（管理员密码）与结果弹窗 ──
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyPasswordValue, setVerifyPasswordValue] = useState('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [resultModal, setResultModal] = useState<ImportResultModal | null>(null);

  // 卸载时清理定时器与对象 URL
  useEffect(() => {
    return () => {
      if (exportTimerRef.current !== null) window.clearInterval(exportTimerRef.current);
      if (importTimerRef.current !== null) window.clearInterval(importTimerRef.current);
      if (exportUrl) window.URL.revokeObjectURL(exportUrl);
    };
  }, [exportUrl]);

  // ═══════════════════ 导出流程 ═══════════════════

  const handleExport = async () => {
    if (!exportPassword) {
      message.warning('请输入导出密码');
      return;
    }
    setExportStatus('running');
    setExportProgress({ completed: 0, total: 0, current: '' });
    setExportSalt('');
    setExportUrl('');

    const formData = new FormData();
    formData.append('password', exportPassword);

    try {
      const token = getToken();
      const resp = await fetch(`${BASE}/export`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        const detail = json && (json.detail || json.msg);
        throw new Error(typeof detail === 'string' ? detail : `HTTP ${resp.status}`);
      }
      if (!json || json.code !== 0) {
        throw new Error((json && json.msg) || '启动导出失败');
      }
      const exportId = json.data?.export_id as string | undefined;
      if (!exportId) throw new Error('导出任务 ID 无效');
      startExportPolling(exportId);
    } catch (err: unknown) {
      setExportStatus('failed');
      const msg = err instanceof Error ? err.message : '启动导出失败';
      message.error(msg);
    }
  };

  const startExportPolling = (exportId: string) => {
    if (exportTimerRef.current !== null) window.clearInterval(exportTimerRef.current);
    exportTimerRef.current = window.setInterval(async () => {
      try {
        const res = await request<ExportStatus>(`/transfer/export/${exportId}/status`);
        if (res.code === 0 && res.data) {
          const st = res.data;
          setExportProgress({
            completed: st.completed_tables,
            total: st.total_tables,
            current: st.current_table,
          });
          if (st.status === 'completed') {
            if (exportTimerRef.current !== null) window.clearInterval(exportTimerRef.current);
            exportTimerRef.current = null;
            await handleExportDownload(exportId);
          } else if (st.status === 'failed') {
            if (exportTimerRef.current !== null) window.clearInterval(exportTimerRef.current);
            exportTimerRef.current = null;
            setExportStatus('failed');
            message.error(st.error || '导出失败');
          }
        } else {
          if (exportTimerRef.current !== null) window.clearInterval(exportTimerRef.current);
          exportTimerRef.current = null;
          setExportStatus('failed');
          message.error(res.msg || '导出状态查询失败');
        }
      } catch {
        // 网络瞬时错误，保持轮询等待恢复
      }
    }, 1000);
  };

  const handleExportDownload = async (exportId: string) => {
    try {
      const token = getToken();
      const resp = await fetch(`${BASE}/export/${exportId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) {
        const json = await resp.json().catch(() => null);
        const detail = json && (json.detail || json.msg);
        throw new Error(typeof detail === 'string' ? detail : `HTTP ${resp.status}`);
      }
      const salt = resp.headers.get('X-Export-Salt') || '';
      const blob = await resp.blob();
      const fileName = `export_${exportId}.zip`;
      const url = window.URL.createObjectURL(blob);
      setExportStatus('completed');
      setExportSalt(salt);
      setExportUrl(url);
      setExportFileName(fileName);
      // 自动触发下载
      const a = window.document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      message.success('导出完成，请妥善保存 Salt 密钥');
    } catch (err: unknown) {
      setExportStatus('failed');
      const msg = err instanceof Error ? err.message : '下载导出文件失败';
      message.error(msg);
    }
  };

  const handleCopySalt = async () => {
    if (!exportSalt) return;
    try {
      await navigator.clipboard.writeText(exportSalt);
      message.success('Salt 已复制');
    } catch {
      message.error('复制失败，请手动选择复制');
    }
  };

  const handleDownloadAgain = () => {
    if (!exportUrl) return;
    const a = window.document.createElement('a');
    a.href = exportUrl;
    a.download = exportFileName;
    a.click();
  };

  const exportPercent =
    exportProgress.total > 0
      ? Math.round((exportProgress.completed / exportProgress.total) * 100)
      : 0;

  // ═══════════════════ 导入流程 ═══════════════════

  const uploadProps: UploadProps = {
    accept: '.zip',
    maxCount: 1,
    beforeUpload: (file: RcFile) => {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        message.error('仅支持 .zip 文件');
        return Upload.LIST_IGNORE;
      }
      setImportFile(file);
      return false;
    },
    onRemove: () => {
      setImportFile(null);
      return true;
    },
    fileList: importFile
      ? [
          {
            uid: '-1',
            name: importFile.name,
            status: 'done',
          },
        ]
      : [],
  };

  const handleImportClick = async () => {
    if (!importFile) {
      message.warning('请先选择 ZIP 文件');
      return;
    }
    if (!importPassword) {
      message.warning('请输入导入密码');
      return;
    }
    if (!importSalt.trim()) {
      message.warning('请输入 Salt 密钥');
      return;
    }

    setPreviewLoading(true);
    const formData = new FormData();
    formData.append('password', importPassword);
    formData.append('salt', importSalt.trim());
    formData.append('file', importFile);

    let preview: typeof previewData = null;
    try {
      const token = getToken();
      const resp = await fetch(`${BASE}/import/preview`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json || json.code !== 0) {
        throw new Error((json?.msg || json?.detail) ?? `HTTP ${resp.status}`);
      }
      preview = json.data ?? null;
    } catch (err: unknown) {
      setPreviewLoading(false);
      const msg = err instanceof Error ? err.message : '预览失败';
      message.error(msg);
      return;
    }
    setPreviewLoading(false);
    setPreviewData(preview);

    if (!preview?.can_import) {
      message.error(preview?.version_note ?? '该数据包无法导入');
      return;
    }

    const dt = preview?.exported_at
      ? new Date(preview.exported_at).toLocaleString('zh-CN')
      : '未知';
    const content = (
      <div>
        <p style={{ marginBottom: 8 }}>
          <strong>数据版本：</strong>{preview?.zip_version ?? '未知'}
          {preview?.zip_version !== preview?.current_version
            ? <span style={{ color: '#1677ff' }}> → {preview?.current_version}（将自动迁移）</span>
            : <span style={{ color: '#52c41a' }}>（与当前版本一致）</span>}
        </p>
        <p style={{ marginBottom: 8 }}>
          <strong>导出版本：</strong>{preview?.zip_version ?? '未知'} ｜
          <strong>当前版本：</strong>{preview?.current_version ?? '-'}
        </p>
        <p style={{ marginBottom: 8 }}>
          <strong>导出时间：</strong>{dt}
        </p>
        <p style={{ marginBottom: 8 }}>
          <strong>数据表：</strong>{preview?.total_tables ?? 0} 张 ｜
          <strong>数据行：</strong>{preview?.total_rows ?? 0} 行
        </p>
        <p style={{ marginTop: 16, color: '#ff4d4f' }}>
          ⚠ 导入将完全覆盖现有数据，且此操作不可撤销！请确认已备份当前数据。
        </p>
      </div>
    );

    Modal.confirm({
      title: '确认导入',
      icon: null,
      width: 520,
      content,
      okText: '确认导入',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setVerifyPasswordValue('');
        setVerifyModalOpen(true);
      },
    });
  };

  const handleVerifyPassword = async () => {
    if (!verifyPasswordValue) {
      message.warning('请输入管理员密码');
      return;
    }
    setVerifySubmitting(true);
    try {
      const res = await verifyPassword(verifyPasswordValue);
      const valid = res.code === 0 && res.data?.valid === true;
      if (!valid) {
        setVerifySubmitting(false);
        message.error(res.msg || '管理员密码验证失败');
        return;
      }
      setVerifyModalOpen(false);
      setVerifyPasswordValue('');
      setVerifySubmitting(false);
      await doImport();
    } catch (err: unknown) {
      setVerifySubmitting(false);
      const msg = err instanceof Error ? err.message : '管理员密码验证失败';
      message.error(msg);
    }
  };

  const detectRollback = (statusData: ImportStatusData | null): RollbackStatus => {
    if (!statusData) return 'none';
    const data = statusData as ImportStatusData & Record<string, unknown>;
    const rollbackField = data.rollback ?? data.rollback_status ?? data.rolled_back;
    if (typeof rollbackField === 'string') {
      const v = rollbackField.toLowerCase();
      if (v === 'failed' || v === 'error') return 'failed';
      if (v === 'ok' || v === 'success' || v === 'true') return 'ok';
    }
    if (typeof rollbackField === 'boolean') return rollbackField ? 'ok' : 'none';
    const errorText = `${statusData.error ?? ''} ${(statusData.stats?.errors ?? []).join(' ')}`;
    if (/回退失败|回滚失败|rollback\s*failed/i.test(errorText)) return 'failed';
    if (/已回退|回退成功|回滚成功|rollback\s*(ok|success)/i.test(errorText)) return 'ok';
    return 'none';
  };

  const handleRefreshWorkbench = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const doImport = async () => {
    if (!importFile) return;
    setImportStatus('running');
    setImportStats(null);
    setImportError('');
    setImportProgress({ imported: 0, total: 0 });
    setResultModal(null);

    const formData = new FormData();
    formData.append('password', importPassword);
    formData.append('salt', importSalt.trim());
    formData.append('file', importFile);

    try {
      const token = getToken();
      const resp = await fetch(`${BASE}/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        const detail = json && (json.detail || json.msg);
        throw new Error(typeof detail === 'string' ? detail : `HTTP ${resp.status}`);
      }
      if (!json || json.code !== 0) {
        throw new Error((json && json.msg) || '启动导入失败');
      }
      const importId =
        (json.data?.import_id as string | undefined) ??
        (json.data?.task_id as string | undefined);
      if (!importId) throw new Error('导入任务 ID 无效');
      startImportPolling(importId);
    } catch (err: unknown) {
      setImportStatus('failed');
      const msg = err instanceof Error ? err.message : '启动导入失败';
      setImportError(msg);
      setResultModal({ type: 'error', tables: 0, rows: 0, message: msg, rollback: 'none' });
    }
  };

  const startImportPolling = (taskId: string) => {
    if (importTimerRef.current !== null) window.clearInterval(importTimerRef.current);
    importTimerRef.current = window.setInterval(async () => {
      try {
        const res = await request<ImportStatusData>(`/transfer/import/${taskId}/status`);
        if (res.code === 0 && res.data) {
          const st = res.data;
          if (st.stats) {
            setImportProgress({
              imported: st.stats.imported_tables,
              total: st.stats.total_tables,
            });
          }
          if (st.status === 'completed') {
            if (importTimerRef.current !== null) window.clearInterval(importTimerRef.current);
            importTimerRef.current = null;
            setImportStatus('completed');
            setImportStats(st.stats);
            if (st.stats && st.stats.errors.length > 0) {
              message.warning(`导入完成，但有 ${st.stats.errors.length} 项错误`);
            } else {
              message.success('数据导入完成');
            }
            setResultModal({
              type: 'success',
              tables: st.stats?.imported_tables ?? 0,
              rows: st.stats?.imported_rows ?? 0,
              message: '',
              rollback: 'none',
            });
          } else if (st.status === 'failed') {
            if (importTimerRef.current !== null) window.clearInterval(importTimerRef.current);
            importTimerRef.current = null;
            setImportStatus('failed');
            const msg = st.error || '导入失败';
            setImportError(msg);
            message.error(msg);
            setResultModal({
              type: 'error',
              tables: 0,
              rows: 0,
              message: msg,
              rollback: detectRollback(st),
            });
          }
        } else {
          if (importTimerRef.current !== null) window.clearInterval(importTimerRef.current);
          importTimerRef.current = null;
          setImportStatus('failed');
          const msg = res.msg || '导入状态查询失败';
          setImportError(msg);
          message.error(msg);
          setResultModal({ type: 'error', tables: 0, rows: 0, message: msg, rollback: 'none' });
        }
      } catch {
        // 网络瞬时错误，保持轮询等待恢复
      }
    }, 2000);
  };

  const importPercent =
    importProgress.total > 0
      ? Math.round((importProgress.imported / importProgress.total) * 100)
      : 0;

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          数据迁转
        </Title>
      </div>

      <div className={styles.sections ?? ''}>
        {/* ── 导出 ── */}
        <Card
          className={styles.section ?? ''}
          title={
            <Space>
              <ExportOutlined />
              导出数据
            </Space>
          }
        >
          <div className={styles.formBlock ?? ''}>
            <div>
              <span className={styles.fieldLabel ?? ''}>导出密码</span>
              <Input.Password
                className={styles.passwordInput ?? ''}
                placeholder="输入本次导出使用的密码"
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                autoComplete="new-password"
                disabled={exportStatus === 'running'}
              />
            </div>

            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleExport}
              loading={exportStatus === 'running'}
              disabled={exportStatus === 'completed'}
            >
              导出数据
            </Button>

            {exportStatus !== 'idle' && (
              <div className={styles.progressBlock ?? ''}>
                <Progress
                  percent={exportPercent}
                  status={
                    exportStatus === 'failed'
                      ? 'exception'
                      : exportStatus === 'completed'
                        ? 'success'
                        : 'active'
                  }
                />
                {exportStatus === 'running' && exportProgress.current && (
                  <Text type="secondary" className={styles.progressHint ?? ''}>
                    正在导出：{exportProgress.current}
                  </Text>
                )}
                {exportStatus === 'failed' && (
                  <Text type="danger" className={styles.progressHint ?? ''}>
                    导出失败，请重试
                  </Text>
                )}
              </div>
            )}

            {exportStatus === 'completed' && exportSalt && (
              <div className={styles.saltBlock ?? ''}>
                <Text type="secondary" className={styles.saltTip ?? ''}>
                  导入数据时需要同时提供此 Salt 与导出密码，请妥善保存
                </Text>
                <div className={styles.saltRow ?? ''}>
                  <Input
                    readOnly
                    value={exportSalt}
                    className={styles.saltInput ?? ''}
                    onClick={handleCopySalt}
                  />
                  <Button icon={<CopyOutlined />} onClick={handleCopySalt}>
                    复制
                  </Button>
                </div>
                {exportUrl && (
                  <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownloadAgain}>
                    下载导出文件
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* ── 导入 ── */}
        <Card
          className={styles.section ?? ''}
          title={
            <Space>
              <ImportOutlined />
              导入数据
            </Space>
          }
        >
          <div className={styles.formBlock ?? ''}>
            <Dragger
              {...uploadProps}
              className={styles.uploadArea ?? ''}
              disabled={importStatus === 'running'}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽 ZIP 文件到此区域</p>
              <p className="ant-upload-hint">仅支持 .zip 加密导出文件</p>
            </Dragger>

            <div>
              <span className={styles.fieldLabel ?? ''}>导入密码</span>
              <Input.Password
                className={styles.passwordInput ?? ''}
                placeholder="导出时使用的密码"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                autoComplete="new-password"
                disabled={importStatus === 'running'}
              />
            </div>

            <div>
              <span className={styles.fieldLabel ?? ''}>Salt 密钥</span>
              <Input
                className={styles.passwordInput ?? ''}
                placeholder="导出时显示的 Salt 密钥"
                value={importSalt}
                onChange={(e) => setImportSalt(e.target.value)}
                disabled={importStatus === 'running'}
              />
            </div>

            <Button
              danger
              type="primary"
              icon={<UploadOutlined />}
              onClick={handleImportClick}
              loading={importStatus === 'running' || previewLoading}
              disabled={importStatus === 'completed'}
            >
              {previewLoading ? '正在分析数据包...' : '导入数据'}
            </Button>

            {importStatus === 'running' && (
              <div className={styles.progressBlock ?? ''}>
                <Progress percent={importPercent} status="active" />
                <Text type="secondary" className={styles.progressHint ?? ''}>
                  {importProgress.total > 0
                    ? `${importProgress.imported}/${importProgress.total} 张表`
                    : '正在准备导入...'}
                </Text>
                <Text type="secondary" className={styles.progressHint ?? ''}>
                  正在导入数据，请勿关闭页面...
                </Text>
              </div>
            )}

            {importStatus === 'completed' && importStats && (
              <div className={styles.resultBlock ?? ''}>
                <div className={styles.resultLine ?? ''}>
                  <span className={styles.resultKey ?? ''}>导入表</span>
                  <span className={styles.resultValue ?? ''}>
                    {importStats.imported_tables} / {importStats.total_tables}
                  </span>
                </div>
                <div className={styles.resultLine ?? ''}>
                  <span className={styles.resultKey ?? ''}>导入行数</span>
                  <span className={styles.resultValue ?? ''}>{importStats.imported_rows}</span>
                </div>
                <div className={styles.resultLine ?? ''}>
                  <span className={styles.resultKey ?? ''}>导入文件</span>
                  <span className={styles.resultValue ?? ''}>{importStats.file_count}</span>
                </div>
                {importStats.errors.length > 0 && (
                  <div className={styles.errorList ?? ''}>
                    {importStats.errors.map((err) => (
                      <div key={err} className={styles.errorItem ?? ''}>
                        {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {importStatus === 'failed' && importError && (
              <div className={styles.resultBlock ?? ''}>
                <Text type="danger" className={styles.errorItem ?? ''}>
                  {importError}
                </Text>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── 管理员密码验证弹窗 ── */}
      <Modal
        title={
          <Space>
            <LockOutlined />
            管理员密码验证
          </Space>
        }
        open={verifyModalOpen}
        onOk={handleVerifyPassword}
        onCancel={() => {
          setVerifyModalOpen(false);
          setVerifyPasswordValue('');
        }}
        okText="确认"
        cancelText="取消"
        confirmLoading={verifySubmitting}
        maskClosable={false}
      >
        <div className={styles.formBlock ?? ''}>
          <Text type="secondary" className={styles.progressHint ?? ''}>
            此操作将完全覆盖现有数据，请输入管理员密码以确认操作
          </Text>
          <Input.Password
            className={styles.passwordInput ?? ''}
            placeholder="请输入管理员密码"
            value={verifyPasswordValue}
            onChange={(e) => setVerifyPasswordValue(e.target.value)}
            onPressEnter={handleVerifyPassword}
            autoComplete="current-password"
          />
        </div>
      </Modal>

      {/* ── 导入成功弹窗 ── */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined />
            导入完成
          </Space>
        }
        open={resultModal?.type === 'success'}
        closable={false}
        maskClosable={false}
        footer={[
          <Button key="refresh" type="primary" icon={<ReloadOutlined />} onClick={handleRefreshWorkbench}>
            刷新工作台
          </Button>,
        ]}
      >
        <div className={styles.formBlock ?? ''}>
          <Text>
            数据导入完成！{resultModal?.type === 'success' ? resultModal.tables : 0} 张表导入成功，
            {resultModal?.type === 'success' ? resultModal.rows : 0} 行数据
          </Text>
        </div>
      </Modal>

      {/* ── 导入失败弹窗 ── */}
      <Modal
        title={
          <Space>
            <CloseCircleOutlined />
            导入失败
          </Space>
        }
        open={resultModal?.type === 'error'}
        onCancel={() => setResultModal(null)}
        footer={[
          <Button key="close" onClick={() => setResultModal(null)}>
            关闭
          </Button>,
        ]}
      >
        <div className={styles.formBlock ?? ''}>
          {resultModal?.type === 'error' && resultModal.rollback === 'failed' ? (
            <Text type="danger">导入失败，且数据回退失败！请手动恢复数据</Text>
          ) : (
            <>
              <Text type="danger">
                导入失败：{resultModal?.type === 'error' ? resultModal.message : ''}
              </Text>
              {resultModal?.type === 'error' && resultModal.rollback === 'ok' && (
                <Text type="secondary">已自动回退到导入前的数据</Text>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
