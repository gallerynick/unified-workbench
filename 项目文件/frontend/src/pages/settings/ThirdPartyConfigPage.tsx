import { useState, useEffect } from 'react';
import { SaveOutlined, ReloadOutlined, DownloadOutlined, DeleteOutlined, CheckCircleOutlined, LoadingOutlined, ThunderboltOutlined, PauseCircleOutlined, PlayCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, InputNumber, Select, Radio, message, Spin, Space, Alert, Typography, Tag, Modal, Progress } from 'antd';
import { getThirdPartyConfig, updateThirdPartyConfig, testAIConnection, testASRService, reloadASRModel, deleteASRModel, getASRModelStatus } from '../../api/third-party-config';
import { getOllamaModelStatus, deleteOllamaModel, getOllamaHealth, startModelDownload, getDownloadStatus, pauseDownload, resumeDownload, cancelDownload, getCurrentDownload } from '../../api/ollama';
import type { ThirdPartyConfig } from '../../types/third-party-config';
import { isAdmin } from '../../utils/auth';
import styles from './ThirdPartyConfigPage.module.css';

const { Title, Text, Paragraph } = Typography;

const DEFAULT_CONFIG: ThirdPartyConfig = {
  ai_provider: {
    mode: 'local',
    local: {
      base_url: 'http://ollama:11434/v1',
      model: 'qwen3.5:4b',
    },
    online: {
      base_url: '',
      model: 'gpt-4o',
      api_key: null,
    },
    parameters: {
      temperature: 0.7,
      max_tokens: 2000,
      response_format: 'json',
    },
  },
  asr_config: {
    mode: 'local',
    local: {
      model: 'paraformer-zh',
      punc_model: 'ct-punc',
      spk_model: 'campplus',
    },
    online: {
      provider: 'openai',
      model: 'whisper-1',
      api_key: null,
      base_url: '',
    },
    parameters: {
      sample_rate: 16000,
      hpf_cutoff: 80,
      noise_reduction: 0.8,
      vad_threshold: 0.006,
      silence_timeout: 1.5,
    },
  },
};

// 预置模型信息
const PRESET_AI_MODEL = {
  name: 'Qwen3.5-4B Q4',
  ollamaName: 'qwen3.5:4b',
  size: '约 2.5 GB',
  description: '阿里云通义千问 3.5 系列 4B 参数模型，Q4 量化版本，支持 32K 上下文',
};

const PRESET_ASR_MODELS = {
  main: { name: 'Paraformer-zh', description: '中文语音识别模型' },
  punc: { name: 'ct-punc', description: '标点恢复模型' },
  spk: { name: 'CAM++', description: '说话人分离模型' },
};

/** 把秒数格式化成中文时长，用于展示下载已运行时间 */
function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0秒';
  }
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  if (h > 0) {
    return `${h}时${m}分`;
  }
  if (m > 0) {
    return `${m}分${s}秒`;
  }
  return `${s}秒`;
}


/** 从未知异常中取出可展示的信息，避免对 unknown 做断言 */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

/** antd Form 校验失败时抛出带 errorFields 的对象 */
function isFormValidationError(err: unknown): err is { errorFields: unknown[] } {
  return typeof err === 'object' && err !== null && 'errorFields' in err;
}
export default function ThirdPartyConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<{ ai: boolean; asr: boolean }>({ ai: false, asr: false });
  const [speedTesting, setSpeedTesting] = useState(false);
  const [speedResult, setSpeedResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 模型下载状态
  const [aiModelStatus, setAiModelStatus] = useState<'not_downloaded' | 'downloading' | 'downloaded' | 'error'>('not_downloaded');
  const [asrModelStatus, setAsrModelStatus] = useState<'not_downloaded' | 'downloading' | 'downloaded' | 'error'>('not_downloaded');
  const [ollamaHealth, setOllamaHealth] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [checkingDownload, setCheckingDownload] = useState(true);
  
  // 下载任务状态
  const [downloadTaskId, setDownloadTaskId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState<'pending' | 'downloading' | 'paused' | 'cancelled' | 'completed' | 'error'>('pending');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [downloadDownloaded, setDownloadDownloaded] = useState(0);
  // Ollama 当前阶段（下载中/校验中/写入中…），用于区分「缓慢」与「卡死」
  const [downloadPhase, setDownloadPhase] = useState('');
  // 任务开始时间（Unix 秒），用于展示已运行时长
  const [downloadStartedAt, setDownloadStartedAt] = useState<number | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // 检查 Ollama 健康状态和模型状态
  const checkOllamaStatus = async () => {
    try {
      const healthRes = await getOllamaHealth();
      if (healthRes.code === 0 && healthRes.data?.status === 'ok') {
        setOllamaHealth('ok');
        
        // 检查模型是否已下载
        const modelRes = await getOllamaModelStatus(PRESET_AI_MODEL.ollamaName);
        if (modelRes.code === 0 && modelRes.data?.downloaded) {
          setAiModelStatus('downloaded');
        } else if (!downloadTaskId) {
          // 只有在没有正在进行的下载任务时，才设置为 'not_downloaded'
          setAiModelStatus('not_downloaded');
        }
      } else {
        setOllamaHealth('error');
        // 只有在没有正在进行的下载任务时，才设置为 'not_downloaded'
        if (!downloadTaskId) {
          setAiModelStatus('not_downloaded');
        }
      }
    } catch (err) {
      console.error('检查 Ollama 状态失败:', err);
      setOllamaHealth('error');
      // 只有在没有正在进行的下载任务时，才设置为 'not_downloaded'
      if (!downloadTaskId) {
        setAiModelStatus('not_downloaded');
      }
    }
  };

  // 检查 ASR 模型状态
  const checkASRStatus = async () => {
    try {
      const res = await getASRModelStatus();
      if (res.code === 0 && res.data) {
        const status = res.data.status;
        if (status === 'downloaded') {
          setAsrModelStatus('downloaded');
        } else if (status === 'partial') {
          setAsrModelStatus('not_downloaded');
        } else {
          setAsrModelStatus('not_downloaded');
        }
      }
    } catch (err) {
      console.error('检查 ASR 模型状态失败:', err);
      setAsrModelStatus('not_downloaded');
    }
  };

  const fetchConfig = async (skipOllamaCheck = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getThirdPartyConfig();
      if (res.code === 0 && res.data) {
        form.setFieldsValue(res.data);
      } else {
        form.setFieldsValue(DEFAULT_CONFIG);
      }
    } catch (err: unknown) {
      console.error('获取配置失败:', err);
      form.setFieldsValue(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
    
    // 异步检查 Ollama 状态，不阻塞页面显示
    // 如果有正在进行的下载任务，跳过 Ollama 状态检查，避免覆盖下载状态
    if (!skipOllamaCheck) {
      checkOllamaStatus();
    }
  };

  // 检查是否有正在进行的下载任务（页面刷新后恢复状态）
  const checkExistingDownload = async (): Promise<boolean> => {
    try {
      const res = await getCurrentDownload();
      if (res.code === 0 && res.data && res.data.status !== 'none') {
        const taskId = res.data.task_id;
        const status = res.data.status;
        const progress = res.data.progress || 0;
        const speed = res.data.speed || 0;
        const total = res.data.total || 0;
        const downloaded = res.data.downloaded || 0;
        
        // 恢复下载状态
        setDownloadTaskId(taskId);
        setDownloadProgress(progress);
        setDownloadStatus(status);
        setDownloadError(res.data.error || null);
        setDownloadSpeed(speed);
        setDownloadTotal(total);
        setDownloadDownloaded(downloaded);
        setDownloadPhase(res.data.phase || '');
        setDownloadStartedAt(typeof res.data.started_at === 'number' ? res.data.started_at : null);
        setAiModelStatus(
          status === 'completed' ? 'downloaded' : status === 'error' ? 'error' : 'downloading',
        );
        
        // 如果任务还在进行中，继续轮询
        if (status === 'downloading' || status === 'paused' || status === 'pending') {
          startPolling(taskId);
        }
        
        return true;
      }
    } catch (err) {
      console.error('检查现有下载任务失败:', err);
    }
    return false;
  };

  useEffect(() => {
    // 先检查是否有正在进行的下载任务，避免竞态条件
    checkExistingDownload().then((hasActiveDownload) => {
      // 检查完成，设置 checkingDownload=false
      setCheckingDownload(false);
      // 如果有正在进行的下载任务，跳过 Ollama 状态检查，避免覆盖下载状态
      fetchConfig(hasActiveDownload);
    });
    checkASRStatus();
    
    // 清理轮询
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await updateThirdPartyConfig(values);
      if (res.code === 0) {
        message.success('配置已保存');
      } else {
        message.error(res.msg || '保存失败');
      }
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        return;
      }
      console.error('保存失败:', err);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAI = async () => {
    setTesting((prev) => ({ ...prev, ai: true }));
    try {
      // 获取当前表单配置，传递给后端测试
      const values = form.getFieldsValue();
      const res = await testAIConnection({ ai_provider: values.ai_provider });
      if (res.code === 0) {
        if (res.data?.success) {
          message.success(res.data.message);
        } else {
          message.error(res.data.message);
        }
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '测试失败'));
    } finally {
      setTesting((prev) => ({ ...prev, ai: false }));
    }
  };

  const handleTestASR = async () => {
    setTesting((prev) => ({ ...prev, asr: true }));
    try {
      // 获取当前表单配置，传递给后端测试
      const values = form.getFieldsValue();
      const res = await testASRService({ asr_config: values.asr_config });
      if (res.code === 0) {
        if (res.data?.success) {
          message.success(res.data.message);
        } else {
          message.error(res.data.message);
        }
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '测试失败'));
    } finally {
      setTesting((prev) => ({ ...prev, asr: false }));
    }
  };

  const handleReloadASR = async () => {
    try {
      const res = await reloadASRModel();
      if (res.code === 0) {
        message.success(res.data?.message || '已重载');
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '重载失败'));
    }
  };

  const handleDeleteASRModel = async () => {
    Modal.confirm({
      title: '删除模型',
      content: '删除后将需要重新下载，确定要删除吗？',
      onOk: async () => {
        try {
          const res = await deleteASRModel();
          if (res.code === 0) {
            message.success(res.data?.message || '模型已删除');
            setAsrModelStatus('not_downloaded');
          }
        } catch (err: unknown) {
          message.error(errorMessage(err, '删除失败'));
        }
      },
    });
  };

  // 测速功能 - 测量模型生成速度 (tokens/s)
  const handleSpeedTest = async () => {
    setSpeedTesting(true);
    setSpeedResult(null);
    
    try {
      // 发送一个生成请求来测量 tokens/s
      const values = form.getFieldsValue();
      const res = await testAIConnection({ 
        ai_provider: values.ai_provider,
        test_prompt: '请生成一段测试文本，用于测量生成速度。',
        measure_speed: true
      });
      
      if (res.code === 0 && res.data?.success) {
        const tokensPerSecond = res.data?.tokens_per_second || 0;
        const totalTokens = res.data?.total_tokens || 0;
        const totalLatency = res.data?.total_latency_ms || 0;
        
        setSpeedResult(tokensPerSecond);
        message.success(`测速完成：${tokensPerSecond.toFixed(1)} tokens/s (${totalTokens} tokens, ${totalLatency}ms)`);
      } else {
        message.error(res.data?.message || '测速失败');
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '测速失败'));
    } finally {
      setSpeedTesting(false);
    }
  };

  // 模型下载相关
  const handleDownloadAIModel = async () => {
    try {
      // 先停止旧的轮询，防止多个轮询同时运行
      stopPolling();
      
      const res = await startModelDownload(PRESET_AI_MODEL.ollamaName);
      if (res.code === 0 && res.data?.task_id) {
        const taskId = res.data.task_id;
        // 重置所有下载状态
        setDownloadTaskId(taskId);
        setDownloadProgress(0);
        setDownloadSpeed(0);
        setDownloadTotal(0);
        setDownloadDownloaded(0);
        setDownloadStatus('downloading');
        setDownloadError(null);
        setDownloadPhase('连接中');
        setDownloadStartedAt(Date.now() / 1000);
        setAiModelStatus('downloading');
        
        // 开始轮询下载进度
        startPolling(taskId);
      } else {
        message.error(res.msg || '启动下载失败');
        setDownloadError(res.msg || '启动下载失败');
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '启动下载失败'));
      setDownloadError(errorMessage(err, '启动下载失败'));
    }
  };
  
  // 轮询下载进度
  const startPolling = (taskId: string) => {
    // 先停止旧的轮询，防止多个轮询同时运行
    stopPolling();
    
    let lastErrorShown = false;
    
    const poll = async () => {
      try {
        const res = await getDownloadStatus(taskId);
        if (res.code === 0 && res.data) {
          const data = res.data;
          setDownloadProgress(data.progress || 0);
          setDownloadStatus(data.status);
          setDownloadSpeed(data.speed || 0);
          setDownloadTotal(data.total || 0);
          setDownloadDownloaded(data.downloaded || 0);
          if (data.phase) {
            setDownloadPhase(data.phase);
          }
          if (typeof data.started_at === 'number') {
            setDownloadStartedAt(data.started_at);
          }
          
          if (data.status === 'completed') {
            setAiModelStatus('downloaded');
            message.success('模型下载完成');
            stopPolling();
          } else if (data.status === 'error') {
            setAiModelStatus('error');
            setDownloadError(data.error || '下载出错');
            
            // 只在第一次出错时显示消息
            if (!lastErrorShown) {
              message.error('下载出错');
              lastErrorShown = true;
            }
            
            stopPolling();
          } else if (data.status === 'cancelled') {
            setAiModelStatus('not_downloaded');
            message.info('下载已取消');
            stopPolling();
          }
        }
      } catch (err) {
        console.error('获取下载进度失败:', err);
      }
    };
    
    poll();
    const interval = setInterval(poll, 1000);
    setPollingInterval(interval);
  };
  
  // 重试下载
  const handleRetryDownload = () => {
    setDownloadError(null);
    setDownloadProgress(0);
    setDownloadStatus('downloading');
    setAiModelStatus('downloading');
    handleDownloadAIModel();
  };
  
  // 停止轮询
  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };
  
  // 暂停下载
  const handlePauseDownload = async () => {
    if (!downloadTaskId) return;
    try {
      const res = await pauseDownload(downloadTaskId);
      if (res.code === 0) {
        setDownloadStatus('paused');
        message.success('已暂停');
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '暂停失败'));
    }
  };
  
  // 恢复下载
  const handleResumeDownload = async () => {
    if (!downloadTaskId) return;
    try {
      const res = await resumeDownload(downloadTaskId);
      if (res.code === 0) {
        setDownloadStatus('downloading');
        message.success('已恢复');
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '恢复失败'));
    }
  };
  
  // 取消下载
  const handleCancelDownload = async () => {
    if (!downloadTaskId) return;
    try {
      const res = await cancelDownload(downloadTaskId);
      if (res.code === 0) {
        setDownloadStatus('cancelled');
        setAiModelStatus('not_downloaded');
        setDownloadTaskId(null);
        stopPolling();
        message.success('已取消下载');
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '取消失败'));
    }
  };

  const handleDeleteAIModel = async () => {
    Modal.confirm({
      title: '删除模型',
      content: '删除后将需要重新下载，确定要删除吗？',
      onOk: async () => {
        try {
          const res = await deleteOllamaModel(PRESET_AI_MODEL.ollamaName);
          if (res.code === 0) {
            setAiModelStatus('not_downloaded');
            message.success('模型已删除');
          }
        } catch (err: unknown) {
          message.error(errorMessage(err, '删除失败'));
        }
      },
    });
  };

  if (!isAdmin()) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="warning"
          message="权限不足"
          description="只有管理员可以访问第三方服务配置"
          showIcon
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          第三方服务配置
        </Title>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setError(null)}
        />
      )}

      <Form form={form} layout="vertical">
        {/* AI 模型配置 */}
        <Card 
          title="AI 模型配置" 
          style={{ marginBottom: "var(--spacing-lg)" }}
          extra={
            <Space>
              <Button 
                size="small" 
                icon={<ThunderboltOutlined />} 
                onClick={handleSpeedTest} 
                loading={speedTesting}
              >
                测速
              </Button>
              {speedResult !== null && (
                <Tag color="blue">{speedResult.toFixed(1)} tokens/s</Tag>
              )}
            </Space>
          }
        >
          <Form.Item name={['ai_provider', 'mode']} label="模式">
            <Radio.Group>
              <Radio value="local">本地（Ollama）</Radio>
              <Radio value="online">在线（OpenAI 兼容）</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.ai_provider?.mode !== cur.ai_provider?.mode}>
            {({ getFieldValue }) => {
              const mode = getFieldValue(['ai_provider', 'mode']);
              
              if (mode === 'local') {
                return (
                  <Card 
                    title="本地模型管理" 
                    size="small"
                    style={{ background: 'var(--fill-tertiary)', marginBottom: "var(--spacing-md)" }}
                  >
                    {/* Ollama 状态提示 */}
                    <Alert
                      type={ollamaHealth === 'ok' ? 'success' : ollamaHealth === 'error' ? 'error' : 'info'}
                      message={
                        ollamaHealth === 'ok' ? 'Ollama 服务正常' : 
                        ollamaHealth === 'error' ? 'Ollama 服务不可用' : '正在检查 Ollama 状态...'
                      }
                      description={
                        ollamaHealth === 'error' ? '请确保 Ollama 容器已启动' : undefined
                      }
                      showIcon
                      style={{ marginBottom: 16 }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <Text strong style={{ fontSize: 14 }}>
                          {PRESET_AI_MODEL.name}
                        </Text>
                        <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 12 }}>
                          {PRESET_AI_MODEL.description}
                        </Paragraph>
                      </div>
                      <Space>
                        {!checkingDownload && aiModelStatus === 'not_downloaded' && (
                          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownloadAIModel}>
                            下载模型
                          </Button>
                        )}
                        {aiModelStatus === 'downloading' && (
                          <Tag color="processing">
                            <LoadingOutlined />
                            下载中
                          </Tag>
                        )}
                        {aiModelStatus === 'downloaded' && (
                          <Tag color="success">
                            <CheckCircleOutlined />
                            已就绪
                          </Tag>
                        )}
                        {aiModelStatus === 'error' && (
                          <Tag color="error">错误</Tag>
                        )}
                        {checkingDownload && (
                          <Tag color="default">
                            <LoadingOutlined />
                            检查中...
                          </Tag>
                        )}
                      </Space>
                    </div>

                    {/* 下载进度条 */}
                    {aiModelStatus === 'downloading' && downloadTaskId && (
                      <div style={{ marginTop: 12 }}>
                        <Progress
                          percent={downloadProgress}
                          status={downloadStatus === 'paused' ? 'normal' : downloadStatus === 'error' ? 'exception' : 'active'}
                          format={(percent) => <span>{percent?.toFixed(1)}%</span>}
                        />
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                          {downloadPhase && <span>{downloadPhase}</span>}
                          <span style={{ marginLeft: 16 }}>速度: {(downloadSpeed / 1024 / 1024).toFixed(2)} MB/s</span>
                          <span style={{ marginLeft: 16 }}>已下载: {(downloadDownloaded / 1024 / 1024).toFixed(1)} MB</span>
                          <span style={{ marginLeft: 16 }}>总计: {(downloadTotal / 1024 / 1024).toFixed(1)} MB</span>
                          {downloadStartedAt && (
                            <span style={{ marginLeft: 16 }}>用时: {formatDuration(Date.now() / 1000 - downloadStartedAt)}</span>
                          )}
                        </div>
                        <Space style={{ marginTop: 8 }}>
                          {downloadStatus === 'downloading' && (
                            <Button size="small" icon={<PauseCircleOutlined />} onClick={handlePauseDownload}>
                              暂停
                            </Button>
                          )}
                          {downloadStatus === 'paused' && (
                            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={handleResumeDownload}>
                              恢复
                            </Button>
                          )}
                          <Button size="small" danger icon={<CloseCircleOutlined />} onClick={handleCancelDownload}>
                            取消
                          </Button>
                        </Space>
                      </div>
                    )}

                    {aiModelStatus === 'downloaded' && (
                      <div style={{ marginTop: 12 }}>
                        <Space>
                          <Button onClick={handleTestAI} loading={testing.ai}>
                            测试连接
                          </Button>
                          <Button 
                            type="primary" 
                            icon={<ThunderboltOutlined />} 
                            onClick={handleSpeedTest} 
                            loading={speedTesting}
                          >
                            测速
                          </Button>
                          <Button danger icon={<DeleteOutlined />} onClick={handleDeleteAIModel}>
                            删除模型
                          </Button>
                        </Space>
                        {speedResult !== null && (
                          <div style={{ marginTop: 12 }}>
                            <Progress 
                              percent={Math.min(100, Math.round(speedResult / 2))} 
                              status="success"
                              format={() => `${speedResult.toFixed(1)} tokens/s`}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {aiModelStatus === 'error' && (
                      <Alert
                        type="error"
                        message="下载出错"
                        description={downloadError || '请稍后重试'}
                        style={{ marginTop: 12 }}
                        showIcon
                        action={
                          <Button size="small" type="primary" onClick={handleRetryDownload}>
                            重试
                          </Button>
                        }
                      />
                    )}
                  </Card>
                );
              }

              return (
                <Card 
                  title="在线模型配置" 
                  size="small"
                  style={{ background: 'var(--fill-tertiary)', marginBottom: "var(--spacing-md)" }}
                >
                  <Form.Item name={['ai_provider', 'online', 'base_url']} label="API 地址">
                    <Input placeholder="https://api.openai.com/v1" />
                  </Form.Item>

                  <Form.Item name={['ai_provider', 'online', 'model']} label="模型">
                    <Input placeholder="请输入模型名称" />
                  </Form.Item>

                  <Form.Item name={['ai_provider', 'online', 'api_key']} label="API Key">
                    <Input.Password placeholder="sk-..." />
                  </Form.Item>

                  <Button type="primary" onClick={handleTestAI} loading={testing.ai}>
                    测试连接
                  </Button>
                </Card>
              );
            }}
          </Form.Item>

          {/* AI 模型参数配置 */}
          <div style={{ marginTop: "var(--spacing-md)", padding: "var(--spacing-md)", background: 'var(--fill-tertiary)', borderRadius: "var(--border-radius)" }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>参数配置</Text>
            
            <Form.Item 
              name={['ai_provider', 'parameters', 'temperature']} 
              label="Temperature"
              tooltip="控制生成文本的随机性。范围 0-2，值越低越保守（更确定），值越高越发散（更有创造性）。建议范围 0.1-0.7"
            >
              <InputNumber min={0} max={2} step={0.1} />
            </Form.Item>

            <Form.Item 
              name={['ai_provider', 'parameters', 'max_tokens']} 
              label="Max Tokens"
              tooltip="生成内容最大长度（输出 token 数）。范围 100-8000，建议值 2000-4000"
            >
              <InputNumber min={100} max={8000} step={100} />
            </Form.Item>

            <Form.Item 
              name={['ai_provider', 'parameters', 'response_format']} 
              label="响应格式"
              tooltip="控制返回内容的格式。json 格式便于程序解析"
            >
              <Select>
                <Select.Option value="json">JSON（推荐）</Select.Option>
                <Select.Option value="text">Text</Select.Option>
              </Select>
            </Form.Item>
          </div>
        </Card>

        {/* 语音识别配置 */}
        <Card 
          title="语音识别配置" 
          style={{ marginBottom: "var(--spacing-lg)" }}
        >
          <Form.Item name={['asr_config', 'mode']} label="模式">
            <Radio.Group>
              <Radio value="local">本地（FunASR）</Radio>
              <Radio value="online">在线（OpenAI/阿里云）</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.asr_config?.mode !== cur.asr_config?.mode}>
            {({ getFieldValue }) => {
              const mode = getFieldValue(['asr_config', 'mode']);
              
              if (mode === 'local') {
                return (
                  <Card 
                    title="本地模型管理" 
                    size="small"
                    style={{ background: 'var(--fill-tertiary)', marginBottom: "var(--spacing-md)" }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <Text strong style={{ fontSize: 14 }}>
                          本地语音识别模型
                        </Text>
                        <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 12 }}>
                          {PRESET_ASR_MODELS.main.name} + {PRESET_ASR_MODELS.punc.name} + {PRESET_ASR_MODELS.spk.name}
                        </Paragraph>
                      </div>
                      <Space>
                        {asrModelStatus === 'not_downloaded' && (
                          <Button type="primary" icon={<DownloadOutlined />} disabled>
                            下载模型
                          </Button>
                        )}
                        {asrModelStatus === 'downloading' && (
                          <Tag color="processing">
                            <LoadingOutlined />
                            下载中
                          </Tag>
                        )}
                        {asrModelStatus === 'downloaded' && (
                          <Tag color="success">
                            <CheckCircleOutlined />
                            已就绪
                          </Tag>
                        )}
                      </Space>
                    </div>

                    {asrModelStatus === 'downloaded' && (
                      <Space style={{ marginTop: 12 }}>
                        <Button onClick={handleTestASR} loading={testing.asr}>
                          测试识别
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={handleReloadASR}>
                          重载模型
                        </Button>
                        <Button danger icon={<DeleteOutlined />} onClick={handleDeleteASRModel}>
                          删除模型
                        </Button>
                      </Space>
                    )}
                  </Card>
                );
              }

              return (
                <Card 
                  title="在线模型配置" 
                  size="small"
                  style={{ background: 'var(--fill-tertiary)', marginBottom: "var(--spacing-md)" }}
                >
                  <Form.Item name={['asr_config', 'online', 'provider']} label="提供商">
                    <Select>
                      <Select.Option value="openai">OpenAI</Select.Option>
                      <Select.Option value="aliyun">阿里云</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item name={['asr_config', 'online', 'model']} label="模型">
                    <Input placeholder="请输入模型名称" />
                  </Form.Item>

                  <Form.Item name={['asr_config', 'online', 'api_key']} label="API Key">
                    <Input.Password placeholder="sk-..." />
                  </Form.Item>

                  <Form.Item name={['asr_config', 'online', 'base_url']} label="API 地址">
                    <Input placeholder="https://api.openai.com/v1" />
                  </Form.Item>

                  <Button type="primary" onClick={handleTestASR} loading={testing.asr}>
                    测试识别
                  </Button>
                </Card>
              );
            }}
          </Form.Item>

          {/* 语音识别参数配置 */}
          <div style={{ marginTop: "var(--spacing-md)", padding: "var(--spacing-md)", background: 'var(--fill-tertiary)', borderRadius: "var(--border-radius)" }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>参数配置</Text>
            
            <Form.Item 
              name={['asr_config', 'parameters', 'noise_reduction']}
              label="降噪强度"
              tooltip="音频降噪强度，范围 0-1。值越高降噪越强，但可能损失部分语音细节"
            >
              <InputNumber min={0} max={1} step={0.1} />
            </Form.Item>

            <Form.Item 
              name={['asr_config', 'parameters', 'vad_threshold']}
              label="VAD 阈值"
              tooltip="语音活动检测阈值，范围 0-0.1。值越低越敏感，可能误判静音为语音"
            >
              <InputNumber min={0} max={0.1} step={0.001} />
            </Form.Item>

            <Form.Item 
              name={['asr_config', 'parameters', 'silence_timeout']}
              label="静音超时 (秒)"
              tooltip="静音超时时间，范围 0.5-10 秒。超过此时间无语音则结束当前语句"
            >
              <InputNumber min={0.5} max={10} step={0.1} />
            </Form.Item>

            <Form.Item 
              name={['asr_config', 'parameters', 'sample_rate']}
              label="采样率 (Hz)"
              tooltip="音频采样率，固定为 16000 Hz"
            >
              <InputNumber min={16000} max={16000} step={1000} disabled />
            </Form.Item>
          </div>
        </Card>
      </Form>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
          保存配置
        </Button>
      </div>
    </div>
  );
}