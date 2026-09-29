import { useState, useEffect, useRef, useCallback } from 'react';
import { SaveOutlined, ReloadOutlined, DownloadOutlined, DeleteOutlined, CheckCircleOutlined, LoadingOutlined, ThunderboltOutlined, PauseCircleOutlined, PlayCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, InputNumber, Select, Radio, message, Space, Alert, Typography, Tag, Modal, Progress, Statistic, Row, Col, Switch } from 'antd';
import { getThirdPartyConfig, updateThirdPartyConfig, testAIConnection, testASRService, reloadASRModel, deleteASRModel, getASRModelStatus, preloadASRModels, getMemoryInfo, unloadASRModel, unloadAIModel } from '../../api/third-party-config';
import { getOllamaModelStatus, getOllamaModels, deleteOllamaModel, getOllamaHealth, startModelDownload, getDownloadStatus, pauseDownload, resumeDownload, cancelDownload, getCurrentDownload } from '../../api/ollama';
import type { ThirdPartyConfig, TestConnectionResponse, MemoryInfo } from '../../types/third-party-config';
import { isAdmin } from '../../utils/auth';
import styles from './ThirdPartyConfigPage.module.css';

const { Title, Text, Paragraph } = Typography;

const DEFAULT_CONFIG: ThirdPartyConfig = {
  warmup: {
    auto_start: false,
  },
  ai_provider: {
    mode: 'local',
    local: {
      base_url: 'http://ollama:11434/v1',
      model: '',
    },
    online: {
      base_url: '',
      model: 'gpt-4o',
      api_key: null,
    },
    parameters: {
      temperature: 0.2,
      max_tokens: 3000,
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
  name: 'Qwen2.5-3B Q4',
  ollamaName: 'qwen2.5:3b',
  size: '约 2.2 GB',
  description: '阿里云通义千问 2.5 系列 3B 参数模型，Q4 量化版本，支持 32K 上下文，适合会议摘要',
};

/** 已知模型的描述信息，用于选择器下方展示 */
const MODEL_INFO: Record<string, { name: string; description: string }> = {
  'qwen3:1.7b': {
    name: 'Qwen3-1.7B Q4',
    description: '阿里云通义千问 3 系列 1.7B 参数模型，Q4 量化版本，思考型模型，支持 32K 上下文，低负载高速（约 1.2 GB），中文质量优于 Qwen2.5-1.5B',
  },
  'qwen2.5:1.5b': {
    name: 'Qwen2.5-1.5B Q4',
    description: '阿里云通义千问 2.5 系列 1.5B 参数模型，Q4 量化版本，支持 32K 上下文，速度最快（约 1 GB），适合轻量摘要',
  },
  'qwen2.5:3b': {
    name: 'Qwen2.5-3B Q4',
    description: '阿里云通义千问 2.5 系列 3B 参数模型，Q4 量化版本，支持 32K 上下文，适合会议摘要',
  },
  'qwen2.5:7b': {
    name: 'Qwen2.5-7B Q4',
    description: '阿里云通义千问 2.5 系列 7B 参数模型，Q4 量化版本，支持 128K 上下文，摘要质量最好',
  },
  'qwen3.5:4b': {
    name: 'Qwen3.5-4B Q4',
    description: '阿里云通义千问 3.5 系列 4B 参数模型，思考型模型，支持 32K 上下文',
  },
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

/** 把字节数格式化成人类可读体积，用于展示模型实际占用 */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** 把测速明细翻译成一行人话，用来解释速度为什么偏低 */
function formatSpeedNotes(
  detail: NonNullable<TestConnectionResponse['details']>,
): string {
  const notes: string[] = [];
  if (detail.load_seconds != null && detail.load_seconds >= 1) {
    notes.push(`加载权重 ${detail.load_seconds}s`);
  }
  if (detail.prompt_tokens_per_second != null) {
    notes.push(`prompt 前向 ${detail.prompt_tokens_per_second.toFixed(0)} tok/s`);
  }
  if (detail.done_reason === 'length') {
    notes.push('撞到生成上限');
  }
  if (detail.thinking_chars && detail.response_chars != null && detail.thinking_chars > detail.response_chars) {
    notes.push(
      `思考过程 ${detail.thinking_chars} 字，可见输出仅 ${detail.response_chars} 字`,
    );
  }
  return notes.join(' · ');
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

/** 深合并配置：后端存的旧值/空对象不会覆盖默认值 */
function deepMergeConfig(base: unknown, override: unknown): unknown {
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
  if (base && override && typeof base === 'object' && typeof override === 'object') {
    const result: Record<string, unknown> = { ...(base as Record<string, unknown>), ...(override as Record<string, unknown>) };
    for (const key of Object.keys(result)) {
      if (key in (base as Record<string, unknown>) && key in (override as Record<string, unknown>)) {
        result[key] = deepMergeConfig((base as Record<string, unknown>)[key], (override as Record<string, unknown>)[key]);
      }
    }
    return result;
  }
  return override ?? base;
}
export default function ThirdPartyConfigPage() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<{ ai: boolean; asr: boolean }>({ ai: false, asr: false });
  const [speedTesting, setSpeedTesting] = useState(false);
  const [speedResult, setSpeedResult] = useState<number | null>(null);
  // 测速明细（加载耗时、prompt 速率、思考/可见输出占比），用于解释速度为什么偏低
  const [speedDetail, setSpeedDetail] = useState<NonNullable<TestConnectionResponse['details']> | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 模型下载状态
  const [aiModelStatus, setAiModelStatus] = useState<'not_downloaded' | 'downloading' | 'downloaded' | 'ready' | 'error'>('not_downloaded');
  // 已下载模型的实测体积（字节），来自 Ollama，比 PRESET_AI_MODEL 里的估算值准确
  const [aiModelSize, setAiModelSize] = useState<number | null>(null);
  // 本机 ollama 已下载的全部模型，用于模型选择器
  const [localModels, setLocalModels] = useState<{ name: string; size: number }[]>([]);
  const [asrModelStatus, setAsrModelStatus] = useState<'not_downloaded' | 'downloading' | 'downloaded' | 'ready' | 'error'>('not_downloaded');
  const [asrModelDetails, setAsrModelDetails] = useState<{ models: { name: string; repo_id: string; ready: boolean; size_mb: number }[]; downloaded: number; total: number } | null>(null);
  const [asrPreloading, setAsrPreloading] = useState(false);
  const [asrReloading, setAsrReloading] = useState(false);
  const [ollamaHealth, setOllamaHealth] = useState<'unknown' | 'ok' | 'error'>('unknown');
  // 后端回的具体失败原因（超时 / 连不上 / API 错误），展示给用户看
  const [ollamaHealthDetail, setOllamaHealthDetail] = useState<string | null>(null);
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
  const [downloadElapsed, setDownloadElapsed] = useState(0);
  // 系统内存信息
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  // ASR 卸载中
  const [asrUnloading, setAsrUnloading] = useState(false);
  const [aiUnloading, setAiUnloading] = useState(false);
  const [recheckingOllama, setRecheckingOllama] = useState(false);
  // 轮询定时器句柄。必须用 ref 而不是 state 持有：
  // poll 闭包捕获的是创建时的 stopPolling，若 stopPolling 读 state，
  // 它拿到的永远是上一次渲染的值（首次为 null），clearInterval 会变成空操作，
  // 轮询永远停不下来 —— 这就是「模型下载完成」提示反复弹出的原因
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  // ASR 模型预热轮询。预热在后台线程里跑，接口立即返回，
  // 所以只能靠轮询 /asr/status 看缓存里的模型有没有齐
  const asrPreloadTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 检查 Ollama 健康状态和模型状态。
  // 单次失败就报「不可用」太激进：ollama 在忙于加载模型时 /api/tags 会超时，
  // 所以先重试两次、每次间隔 1 秒，再下结论
  const checkOllamaStatus = async (modelOverride?: string) => {
    let healthRes: Awaited<ReturnType<typeof getOllamaHealth>> | null = null;
    let lastErr: unknown = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        healthRes = await getOllamaHealth();
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
      if (attempt < 2) {
        await new Promise((resolve) => { setTimeout(resolve, 1000); });
      }
    }

    // 后端本身没连上（页面到后端这一跳断了）
    if (lastErr !== null) {
      console.error('检查 Ollama 状态失败:', lastErr);
      setOllamaHealth('error');
      setOllamaHealthDetail('无法请求后端，请检查页面与后端之间的网络');
      if (!downloadTaskId) {
        setAiModelStatus('not_downloaded');
      }
      return;
    }

    if (healthRes?.code === 0 && healthRes.data?.status === 'ok') {
      setOllamaHealth('ok');
      setOllamaHealthDetail(null);

      // 拉取本机已下载的模型列表，供模型选择器使用
      const modelsRes = await getOllamaModels();
      if (modelsRes.code === 0 && Array.isArray(modelsRes.data?.models)) {
        const models = modelsRes.data.models.map((m) => ({ name: m.name, size: m.size ?? 0 }));
        setLocalModels(models);

        // 没有显式传入模型名时，看表单里有没有选中
        let targetModel: string | undefined = modelOverride || form.getFieldValue(['ai_provider', 'local', 'model']);

        // 表单里没选中模型时，默认选第一个已下载的
        if (!targetModel && models.length > 0) {
          // 优先选预设模型，否则选第一个
          const presetModel = models.find((m) => m.name === PRESET_AI_MODEL.ollamaName);
          targetModel = presetModel?.name || models[0]!.name;
          form.setFieldValue(['ai_provider', 'local', 'model'], targetModel);
        }

        // 没有选中任何模型就不查状态、不显示「已就绪」
        if (!targetModel) {
          setAiModelStatus('not_downloaded');
          setAiModelSize(null);
          return;
        }

        const modelRes = await getOllamaModelStatus(targetModel);
        if (modelRes.code === 0 && modelRes.data?.downloaded) {
          setAiModelStatus('downloaded');
          setAiModelSize(modelRes.data.size ?? null);
        } else if (!downloadTaskId) {
          setAiModelStatus('not_downloaded');
          setAiModelSize(null);
        }
      }
      return;
    }

    setOllamaHealth('error');
    setOllamaHealthDetail(
      healthRes?.data?.message || '无法连接到 Ollama 服务，请检查容器是否已启动并暴露 11434 端口',
    );
    // 只有在没有正在进行的下载任务时，才设置为 'not_downloaded'
    if (!downloadTaskId) {
      setAiModelStatus('not_downloaded');
    }
  };

  // 检查 ASR 模型状态
  const checkASRStatus = async () => {
    try {
      const res = await getASRModelStatus();
      if (res.code === 0 && res.data) {
        setAsrModelDetails(res.data.details ?? null);
        if (res.data.status === 'downloaded') {
          setAsrModelStatus('downloaded');
        } else if (res.data.status === 'partial') {
          setAsrModelStatus('not_downloaded');
        } else {
          setAsrModelStatus('not_downloaded');
        }
      }
    } catch (err) {
      console.error('检查 ASR 模型状态失败:', err);
      // 后端可能正在重启（内存紧张时容器会被 OOM 杀掉），
      // 不能直接判成 not_downloaded，否则下载按钮会出现，
      // 用户一点又被告知「已就绪」
      if (asrModelStatus !== 'downloaded') {
        setAsrModelStatus('not_downloaded');
      }
    }
  };

  const fetchConfig = async (skipOllamaCheck = false) => {
    setError(null);
    try {
      const res = await getThirdPartyConfig();
      if (res.code === 0 && res.data) {
        form.setFieldsValue(deepMergeConfig(DEFAULT_CONFIG, res.data));
      } else {
        form.setFieldsValue(DEFAULT_CONFIG);
      }
    } catch (err: unknown) {
      console.error('获取配置失败:', err);
      form.setFieldsValue(DEFAULT_CONFIG);
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
        setDownloadElapsed(
          typeof res.data.elapsed_seconds === 'number' ? res.data.elapsed_seconds : 0,
        );
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
    // 先填默认值，保证页面一进来就不是空白；API 回来后再合并真实配置
    form.setFieldsValue(DEFAULT_CONFIG);
    // 立即获取配置，不要等下载检查完成——否则用户会先看到默认值（看起来像「配置为零」）
    // 再看到实际配置，体感很差。配置请求本身很快（<100ms），直接并行跑
    fetchConfig();
    // 下载检查并行跑，只影响 aiModelStatus 的显示，不阻塞配置加载
    checkExistingDownload().then(() => {
      setCheckingDownload(false);
      // 下载检查完成，不影响配置显示
    });
    checkASRStatus();
    getMemoryInfo().then((res) => {
      if (res.code === 0 && res.data) setMemoryInfo(res.data);
    }).catch(() => undefined);
    
    // 清理轮询。直接清 ref：stopPolling 定义在本 effect 之后，
    // 在此引用会触发 block-scoped 变量未声明即使用
    return () => {
      if (pollingTimerRef.current !== null) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      if (asrPreloadTimerRef.current !== null) {
        clearInterval(asrPreloadTimerRef.current);
        asrPreloadTimerRef.current = null;
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
      // 刷新内存信息
      const memRes = await getMemoryInfo();
      if (memRes.code === 0 && memRes.data) setMemoryInfo(memRes.data);
    } catch (err: unknown) {
      message.error(errorMessage(err, '测试失败'));
    } finally {
      setTesting((prev) => ({ ...prev, asr: false }));
    }
  };

  const handleReloadASR = async () => {
    setAsrReloading(true);
    try {
      const res = await reloadASRModel();
      if (res.code === 0 && res.data) {
        if (res.data.success) {
          message.success(res.data.message || 'ASR 模型已重载');
          void checkASRStatus();
        } else {
          message.error(res.data.message || '重载失败');
        }
      } else {
        message.error(res.msg || '重载失败');
      }
    } catch (err: unknown) {
      // 后端容器可能被 OOM 杀掉重启中，返回 502
      const msg = errorMessage(err, '重载失败');
      if (msg.includes('502') || msg.includes('Bad Gateway')) {
        message.error('后端正在重启，请稍后重试');
      } else {
        message.error(msg);
      }
    } finally {
      setAsrReloading(false);
    }
  };

  const handleDeleteASRModel = async () => {
    const models = asrModelDetails?.models ?? [];
    const total = asrModelDetails?.total ?? 0;
    const sizeGb = models.reduce((sum, m) => sum + (m.ready ? m.size_mb : 0), 0) / 1024;
    Modal.confirm({
      title: '删除 ASR 模型',
      content: `将删除 ${total} 个模型的本地缓存（约 ${sizeGb.toFixed(1)} GB），下次使用需要重新下载。确定要删除吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await deleteASRModel();
          if (res.code === 0 && res.data) {
            message.success(res.data.message || '模型已删除');
            setAsrModelDetails(null);
            setAsrModelStatus('not_downloaded');
          }
        } catch (err: unknown) {
          message.error(errorMessage(err, '删除失败'));
        }
      },
    });
  };

  const handleUnloadASR = async () => {
    setAsrUnloading(true);
    try {
      const res = await unloadASRModel();
      if (res.code === 0 && res.data) {
        message.success(res.data.message || 'ASR 模型已卸载');
        if (res.data.details?.loaded === false) {
          setAsrModelStatus('not_downloaded');
        }
        const memRes = await getMemoryInfo();
        if (memRes.code === 0 && memRes.data) setMemoryInfo(memRes.data);
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '卸载失败'));
    } finally {
      setAsrUnloading(false);
    }
  };

  const handleUnloadAI = async () => {
    setAiUnloading(true);
    try {
      const model = form.getFieldValue(['ai_provider', 'local', 'model']);
      const res = await unloadAIModel(model);
      if (res.code === 0 && res.data) {
        message.success(res.data.message || 'AI 模型已卸载');
        const memRes = await getMemoryInfo();
        if (memRes.code === 0 && memRes.data) setMemoryInfo(memRes.data);
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '卸载失败'));
    } finally {
      setAiUnloading(false);
    }
  };

  // 预热（必要时下载）本地 ASR 模型。
  // 后端在后台线程里跑，接口立即返回，这里只能轮询 /asr/status 看缓存有没有齐
  const handlePreloadASR = async () => {
    setAsrPreloading(true);
    try {
      const res = await preloadASRModels();
      if (res.code === 0 && res.data) {
        if (res.data.success) {
          // 后端发现缓存已经齐了，不用下载——直接刷新状态，
          // 不要让用户看到「下载模型」按钮点了却被告知已就绪
          if (res.data.details && res.data.details.downloaded === res.data.details.total) {
            setAsrPreloading(false);
            void checkASRStatus();
            message.info('ASR 模型已就绪');
            return;
          }
          message.info(res.data.message || '模型预热已开始');
        } else {
          message.warning(res.data.message || '无法开始预热');
          setAsrPreloading(false);
          return;
        }
      } else {
        setAsrPreloading(false);
        return;
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '预热失败'));
      setAsrPreloading(false);
      return;
    }

    let waited = 0;
    asrPreloadTimerRef.current = setInterval(async () => {
      const r = await getASRModelStatus();
      if (r.code === 0 && r.data) {
        setAsrModelDetails(r.data.details ?? null);
      }
      waited += 5;
      const done = r.data?.status === 'downloaded';
      if (done || waited >= 180) {
        if (asrPreloadTimerRef.current !== null) {
          clearInterval(asrPreloadTimerRef.current);
          asrPreloadTimerRef.current = null;
        }
        setAsrPreloading(false);
        if (done) {
          setAsrModelStatus('downloaded');
          message.success('ASR 模型已就绪');
        } else {
          message.warning('预热超时，请检查网络后重试');
        }
      }
    }, 5000);
  };

  // 载入模型 - 仅加载权重，不测速
  const handleLoadAI = async () => {
    setTesting((prev) => ({ ...prev, ai: true }));
    try {
      const values = form.getFieldsValue();
      const res = await testAIConnection({
        ai_provider: values.ai_provider,
        measure_speed: false,
      });

      if (res.code === 0 && res.data?.success) {
        message.success('载入成功');
        setAiModelStatus('ready');
        // 刷新内存信息
        const memRes = await getMemoryInfo();
        if (memRes.code === 0 && memRes.data) setMemoryInfo(memRes.data);
      } else {
        message.error(res.data?.message || '载入失败');
        setAiModelStatus('error');
      }
    } catch (err: unknown) {
      message.error(errorMessage(err, '载入失败'));
      setAiModelStatus('error');
    } finally {
      setTesting((prev) => ({ ...prev, ai: false }));
    }
  };

  // 测速功能 - 测量模型生成速度 (tokens/s)
  const handleSpeedTest = async () => {
    setSpeedTesting(true);
    setSpeedResult(null);
    setSpeedDetail(null);

    try {
      const values = form.getFieldsValue();
      const res = await testAIConnection({
        ai_provider: values.ai_provider,
        test_prompt: '请生成一段测试文本，用于测量生成速度。',
        measure_speed: true,
      });

      if (res.code === 0 && res.data?.success) {
        // 后端把测速指标放在 details 里，不在响应顶层
        const details = res.data.details;
        const tokensPerSecond = details?.tokens_per_second || 0;
        const totalTokens = details?.eval_count || details?.total_tokens || 0;
        const totalLatency = details?.total_latency_ms || 0;
        const loadSeconds = details?.load_seconds;

        setSpeedResult(tokensPerSecond);
        setSpeedDetail(details ?? null);

        // 加载耗时单独说明：冷启动第一次测速，时间主要花在加载权重上
        const loadNote = loadSeconds != null && loadSeconds >= 1
          ? `，其中加载权重 ${loadSeconds}s`
          : '';
        message.success(
          `测速完成：${tokensPerSecond.toFixed(1)} tokens/s（${totalTokens} 个生成 token，总耗时 ${totalLatency}ms${loadNote}）`,
        );
      } else {
        message.error(res.data?.message || '测速失败');
      }
      // 刷新内存信息
      const memRes = await getMemoryInfo();
      if (memRes.code === 0 && memRes.data) setMemoryInfo(memRes.data);
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

      const targetModel =
        form.getFieldValue(['ai_provider', 'local', 'model']) || PRESET_AI_MODEL.ollamaName;
      const res = await startModelDownload(targetModel);
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
        setDownloadElapsed(0);
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
    // 终态只处理一次：上一次 poll 的网络请求尚未返回时 setInterval 仍会再次触发，
    // 不加保护会重复弹「模型下载完成」
    let settled = false;

    const poll = async () => {
      if (settled) return;
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
          if (typeof data.elapsed_seconds === 'number') {
            setDownloadElapsed(data.elapsed_seconds);
          }
          
          if (data.status === 'completed') {
            settled = true;
            setAiModelStatus('downloaded');
            message.success('模型下载完成');
            stopPolling();
          } else if (data.status === 'error') {
            settled = true;
            setAiModelStatus('error');
            setDownloadError(data.error || '下载出错');
            
            // 只在第一次出错时显示消息
            if (!lastErrorShown) {
              message.error('下载出错');
              lastErrorShown = true;
            }
            
            stopPolling();
          } else if (data.status === 'cancelled') {
            settled = true;
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
    pollingTimerRef.current = setInterval(poll, 1000);
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
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current !== null) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);
  
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
    const targetModel =
      form.getFieldValue(['ai_provider', 'local', 'model']) || PRESET_AI_MODEL.ollamaName;
    const sizeText = aiModelSize != null ? `（已占 ${formatBytes(aiModelSize)}）` : '';
    Modal.confirm({
      title: '删除模型',
      content: `将删除 ${targetModel}${sizeText}，删除后需要重新下载。确定要删除吗？`,
      onOk: async () => {
        try {
          const res = await deleteOllamaModel(targetModel);
          if (res.code === 0) {
            setAiModelStatus('not_downloaded');
            setAiModelSize(null);
            // 重新拉取模型列表，选择器里的选项要同步更新
            void checkOllamaStatus();
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

      <Form form={form} layout="vertical" initialValues={DEFAULT_CONFIG}>
        <Card
          title="模型自启动预热"
          style={{ marginBottom: "var(--spacing-lg)" }}
        >
          <Form.Item
            name={['warmup', 'auto_start']}
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Paragraph type="secondary" style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 12 }}>
            系统启动后若资源充足，会自动载入本地模型并做几次轻量预热；资源不足或模型未下载时会跳过。此开关为全局开关，不再绑定到单个 AI 模型。
          </Paragraph>
        </Card>

        {/* AI 模型配置 */}
        <Card 
          title="AI 模型配置" 
          style={{ marginBottom: "var(--spacing-lg)" }}
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
                        ollamaHealth === 'error' ? 'Ollama 服务异常' : '正在检查 Ollama 状态…'
                      }
                      description={ollamaHealthDetail || undefined}
                      showIcon
                      action={
                        <Button
                          size="small"
                          type="link"
                          loading={recheckingOllama}
                          onClick={async () => {
                            setRecheckingOllama(true);
                            try {
                              await checkOllamaStatus();
                            } finally {
                              setRecheckingOllama(false);
                            }
                          }}
                        >
                          重新检查
                        </Button>
                      }
                      style={{ marginBottom: 16 }}
                    />

                    <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xxs)' }}>
                            模型
                          </div>
                          <Form.Item
                            name={['ai_provider', 'local', 'model']}
                            style={{ marginBottom: 0 }}
                          >
                            <Select
                              showSearch
                              optionFilterProp="label"
                              placeholder="选择模型"
                              options={Object.entries(MODEL_INFO).map(([key, info]) => {
                                const local = localModels.find((m) => m.name === key);
                                return {
                                  value: key,
                                  label: local
                                    ? `${info.name}（${formatBytes(local.size)}）`
                                    : `${info.name}（未下载）`,
                                };
                              })}
                              onChange={(value: string) => {
                                // 直接查 localModels 判断是否已下载，避免额外 API 调用
                                const model = localModels.find((m) => m.name === value);
                                if (model) {
                                  setAiModelStatus('downloaded');
                                  setAiModelSize(model.size);
                                } else if (!downloadTaskId) {
                                  setAiModelStatus('not_downloaded');
                                  setAiModelSize(null);
                                }
                                // 异步刷新 Ollama 健康状态（不影响即时显示）
                                void checkOllamaStatus(value);
                              }}
                            />
                          </Form.Item>
                          <Paragraph type="secondary" style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 12 }}>
                            {(() => {
                              const selected = form.getFieldValue(['ai_provider', 'local', 'model']);
                              if (!selected) return '选择模型后自动检测状态';
                              return MODEL_INFO[selected]?.description || '';
                            })()}
                          </Paragraph>
                        </div>
                        <div style={{ paddingTop: 24 }}>
                          {aiModelStatus === 'not_downloaded' && !checkingDownload && (
                            <Button type="primary" size="small" icon={<DownloadOutlined />} onClick={handleDownloadAIModel}>
                              下载模型
                            </Button>
                          )}
                          {aiModelStatus === 'downloading' && (
                            <Tag color="processing" icon={<LoadingOutlined />} style={{ margin: 0, fontSize: 12, display: 'inline-flex', alignItems: 'center', height: 24 }}>
                              下载中
                            </Tag>
                          )}
                          {aiModelStatus === 'downloaded' && (
                            <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0, fontSize: 12, display: 'inline-flex', alignItems: 'center', height: 24 }}>
                              已下载
                            </Tag>
                          )}
                          {aiModelStatus === 'ready' && (
                            <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0, fontSize: 12, display: 'inline-flex', alignItems: 'center', height: 24 }}>
                              已就绪
                            </Tag>
                          )}
                          {aiModelStatus === 'error' && (
                            <Tag color="error" style={{ margin: 0, fontSize: 12, display: 'inline-flex', alignItems: 'center', height: 24 }}>错误</Tag>
                          )}
                          {checkingDownload && (
                            <Tag icon={<LoadingOutlined />} style={{ margin: 0, fontSize: 12, display: 'inline-flex', alignItems: 'center', height: 24 }}>
                              检查中...
                            </Tag>
                          )}
                        </div>
                      </div>
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
                          <span style={{ marginLeft: 16 }}>
                            用时: {formatDuration(downloadElapsed)}
                          </span>
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

                    {(aiModelStatus === 'downloaded' || aiModelStatus === 'ready') && (
                      <div style={{ marginTop: 12 }}>
                        <Space>
                          {aiModelStatus === 'ready' && (
                            <Button onClick={handleTestAI} loading={testing.ai}>
                              测试连接
                            </Button>
                          )}
                          {aiModelStatus === 'ready' && (
                            <Button
                              type="primary"
                              icon={<ThunderboltOutlined />}
                              onClick={handleSpeedTest}
                              loading={speedTesting}
                            >
                              测速
                            </Button>
                          )}
                          {aiModelStatus === 'ready' && (
                            <Button loading={aiUnloading} onClick={handleUnloadAI}>
                              卸载模型
                            </Button>
                          )}
                          {aiModelStatus === 'downloaded' && (
                            <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleLoadAI} loading={testing.ai}>
                              载入
                            </Button>
                          )}
                          <Button danger icon={<DeleteOutlined />} onClick={handleDeleteAIModel}>
                            删除模型
                          </Button>
                        </Space>
                        {aiModelStatus === 'ready' && speedResult !== null && (
                          <div style={{ marginTop: 12 }}>
                            <Progress
                              percent={Math.min(100, Math.round(speedResult / 2))}
                              status="success"
                              format={() => `${speedResult.toFixed(1)} tokens/s`}
                            />
                            {speedDetail && (() => {
                              const notes = formatSpeedNotes(speedDetail);
                              return notes ? (
                                <Paragraph
                                  type="secondary"
                                  style={{ margin: '8px 0 0', fontSize: 12 }}
                                >
                                  {notes}
                                </Paragraph>
                              ) : null;
                            })()}
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
                        {(asrModelStatus === 'not_downloaded' || asrPreloading) && (
                          <Button
                            type="primary"
                            icon=<DownloadOutlined />
                            loading={asrPreloading}
                            onClick={handlePreloadASR}
                          >
                            {asrPreloading ? '载入中…' : '下载模型'}
                          </Button>
                        )}
                        {asrModelStatus === 'downloaded' && (
                          <Tag color="success">
                            <CheckCircleOutlined />
                            已下载
                          </Tag>
                        )}
                        {asrModelStatus === 'ready' && (
                          <Tag color="success">
                            <CheckCircleOutlined />
                            已就绪
                          </Tag>
                        )}
                      </Space>
                    </div>

                    {asrModelDetails && asrModelDetails.total > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Progress
                          percent={Math.round(
                            (asrModelDetails.downloaded / Math.max(1, asrModelDetails.total)) * 100,
                          )}
                          format={() => `${asrModelDetails.downloaded} / ${asrModelDetails.total} 个模型已就绪`}
                          size="small"
                        />
                        {asrModelDetails.models.map((m) => (
                          <div
                            key={m.name}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 12,
                              padding: '2px 0',
                            }}
                          >
                            <Text type="secondary">{m.name}</Text>
                            <Text type={m.ready ? 'success' : 'secondary'}>
                              {m.ready ? `${m.size_mb.toFixed(1)} MB` : '未下载'}
                            </Text>
                          </div>
                        ))}
                      </div>
                    )}

                    {(asrModelStatus === 'downloaded' || asrModelStatus === 'ready') && (
                      <Space style={{ marginTop: 12 }}>
                        {asrModelStatus === 'ready' && (
                          <Button onClick={handleTestASR} loading={testing.asr}>
                            测试识别
                          </Button>
                        )}
                        {asrModelStatus === 'ready' && (
                          <Button icon={<ReloadOutlined />} loading={asrReloading} onClick={handleReloadASR}>
                            重载模型
                          </Button>
                        )}
                        {asrModelStatus === 'ready' && (
                          <Button loading={asrUnloading} onClick={handleUnloadASR}>
                            卸载模型
                          </Button>
                        )}
                        {asrModelStatus === 'downloaded' && (
                          <Button type="primary" icon={<ReloadOutlined />} loading={asrPreloading} onClick={handlePreloadASR}>
                            载入
                          </Button>
                        )}
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

      {/* 系统资源建议 */}
      {memoryInfo && (
        <Card
          title="系统资源建议"
          style={{ marginBottom: 'var(--spacing-lg)' }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Statistic
                title="Docker VM 内存"
                value={memoryInfo.total_mb ? `${(memoryInfo.total_mb / 1024).toFixed(1)} GB` : 'N/A'}
                suffix={memoryInfo.total_mb ? `/ ${memoryInfo.used_mb ? (memoryInfo.used_mb / 1024).toFixed(1) : '?'} GB 已用` : ''}
              />
              <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 12 }}>
                建议 {memoryInfo.recommended_vm_mb ? `${(memoryInfo.recommended_vm_mb / 1024).toFixed(1)} GB` : '8 GB'}
                （Docker Desktop → Settings → Resources → Memory）
              </Paragraph>
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="可用内存"
                value={memoryInfo.available_mb ? `${(memoryInfo.available_mb / 1024).toFixed(1)} GB` : 'N/A'}
                valueStyle={{ color: memoryInfo.available_mb && memoryInfo.available_mb < 3000 ? '#ff4d4f' : undefined }}
              />
              <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 12 }}>
                ASR 模型约 2.1 GB · AI 模型约 1-2.2 GB
              </Paragraph>
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="宿主机建议"
                value={`${memoryInfo.recommended_host_gb} GB`}
              />
              <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 12 }}>
                macOS / Windows / Linux 均需 ≥ 此值
              </Paragraph>
            </Col>
          </Row>

          {(memoryInfo.warning || memoryInfo.asr_warning || memoryInfo.ai_warning) && (
            <div style={{ marginTop: 12 }}>
              {memoryInfo.warning && (
                <Alert type="warning" message={memoryInfo.warning} showIcon style={{ marginBottom: 8 }} />
              )}
              {memoryInfo.asr_warning && (
                <Alert type="error" message={memoryInfo.asr_warning} showIcon style={{ marginBottom: 8 }} />
              )}
              {memoryInfo.ai_warning && (
                <Alert type="error" message={memoryInfo.ai_warning} showIcon />
              )}
            </div>
          )}

          <Paragraph type="secondary" style={{ margin: '12px 0 0', fontSize: 12 }}>
            提示：ASR 和 AI 模型共用 Docker VM 内存。如果内存不足，可以先卸载 ASR 模型释放空间，
            再加载 AI 模型。两者通常不会同时使用。
          </Paragraph>
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
          保存配置
        </Button>
      </div>
    </div>
  );
}