/** 第三方服务配置类型 */

export type ServiceMode = 'local' | 'online';

export interface AIProviderConfig {
  mode: ServiceMode;
  local: {
    base_url: string;
    model: string;
  };
  online: {
    base_url: string;
    model: string;
    api_key: string | null;
  };
  parameters: {
    temperature: number;
    max_tokens: number;
    response_format: string;
  };
}

export interface ASRConfig {
  mode: ServiceMode;
  local: {
    model: string;
    punc_model: string;
    spk_model: string;
  };
  online: {
    provider: string;
    model: string;
    api_key: string | null;
    base_url: string;
  };
  parameters: {
    sample_rate: number;
    hpf_cutoff: number;
    noise_reduction: number;
    vad_threshold: number;
    silence_timeout: number;
  };
}

export interface ThirdPartyConfig {
  ai_provider: AIProviderConfig;
  asr_config: ASRConfig;
}

export interface ThirdPartyConfigUpdate {
  ai_provider?: AIProviderConfig;
  asr_config?: ASRConfig;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  /** 后端把所有指标放在 details 里，不在响应顶层：
   *  测速模式 → tokens_per_second / total_tokens / total_latency_ms 等；
   *  普通连接测试 → model / model_count；
   *  ASR 预热 → downloaded / total */
  details?: {
    model?: string;
    model_count?: number;
    tokens_per_second?: number;
    total_tokens?: number;
    total_latency_ms?: number;
    /** 已就绪的 ASR 模型数 */
    downloaded?: number;
    /** ASR 模型总数 */
    total?: number;
    /** 只算解码的 token 数（不含 prompt 前向） */
    eval_count?: number;
    /** prompt 前向的 token 数 */
    prompt_eval_count?: number;
    /** prompt 前向速率，和生成速率是两个数 */
    prompt_tokens_per_second?: number;
    /** 权重加载耗时（秒），冷启动时很大 */
    load_seconds?: number;
    /** length = 撞到 num_predict 上限；stop = 自然结束 */
    done_reason?: string;
    /** 可见输出字符数；思考型模型这里可能很小 */
    response_chars?: number;
    /** 思考过程字符数，思考型模型会把预算烧在这里 */
    thinking_chars?: number;
  } | null;
}

export interface TestAIConnectionRequest {
  ai_provider: AIProviderConfig;
  test_prompt?: string;
  measure_speed?: boolean;
}

export interface TestASRServiceRequest {
  asr_config: ASRConfig;
}

/** ASR 模型缓存明细：name 是配置里填的名字，repo_id 是 ModelScope 上的仓库 */
export interface ASRCachedModel {
  name: string;
  repo_id: string;
  ready: boolean;
  size_mb: number;
}

export interface ASRModelStatus {
  /** downloaded 全部就绪 / partial 部分就绪 / not_downloaded 未下载 /
   *  not_available 当前是在线模式 / error 检查失败 */
  status: 'downloaded' | 'partial' | 'not_downloaded' | 'not_available' | 'error' | string;
  message?: string;
  details?: {
    models: ASRCachedModel[];
    downloaded: number;
    total: number;
    loaded: boolean;
  } | null;
}
