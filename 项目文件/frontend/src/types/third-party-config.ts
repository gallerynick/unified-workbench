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
  details: Record<string, unknown> | null;
  /** 测速模式下返回 */
  tokens_per_second?: number;
  total_tokens?: number;
  total_latency_ms?: number;
}

export interface TestAIConnectionRequest {
  ai_provider: AIProviderConfig;
  test_prompt?: string;
  measure_speed?: boolean;
}

export interface TestASRServiceRequest {
  asr_config: ASRConfig;
}

export interface ASRModelStatus {
  status: 'downloaded' | 'partial' | 'not_downloaded' | string;
  message?: string;
}
