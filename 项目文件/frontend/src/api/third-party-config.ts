import { request } from '../utils/request';
import type {
  ASRModelStatus,
  TestASRServiceRequest,
  TestAIConnectionRequest,
  TestConnectionResponse,
  ThirdPartyConfig,
  ThirdPartyConfigUpdate,
  MemoryInfo,
} from '../types/third-party-config';
import type { UnifiedResponse } from '../types/user';

export async function getThirdPartyConfig(): Promise<UnifiedResponse<ThirdPartyConfig>> {
  return request<ThirdPartyConfig>('/config/third-party/');
}

export async function updateThirdPartyConfig(
  data: ThirdPartyConfigUpdate,
): Promise<UnifiedResponse<ThirdPartyConfig>> {
  return request<ThirdPartyConfig>('/config/third-party/', { method: 'PUT', body: data });
}

export async function testAIConnection(config?: TestAIConnectionRequest): Promise<UnifiedResponse<TestConnectionResponse>> {
  return request<TestConnectionResponse>('/config/third-party/ai/test', { method: 'POST', body: config });
}

export async function testASRService(config?: TestASRServiceRequest): Promise<UnifiedResponse<TestConnectionResponse>> {
  return request<TestConnectionResponse>('/config/third-party/asr/test', { method: 'POST', body: config });
}

export async function reloadASRModel(): Promise<UnifiedResponse<TestConnectionResponse>> {
  return request<TestConnectionResponse>('/config/third-party/asr/reload', { method: 'POST' });
}

export async function deleteASRModel(): Promise<UnifiedResponse<TestConnectionResponse>> {
  return request<TestConnectionResponse>('/config/third-party/asr/delete', { method: 'POST' });
}

export async function getASRModelStatus(): Promise<UnifiedResponse<ASRModelStatus>> {
  return request<ASRModelStatus>('/config/third-party/asr/status');
}

/** 预热本地 ASR 模型：缓存里没有的从 ModelScope 下载，后台执行 */
export async function preloadASRModels(): Promise<UnifiedResponse<TestConnectionResponse>> {
  return request<TestConnectionResponse>('/config/third-party/asr/preload', { method: 'POST' });
}

/** 获取系统内存信息和建议 */
export async function getMemoryInfo(): Promise<UnifiedResponse<MemoryInfo>> {
  return request<MemoryInfo>('/config/third-party/asr/memory');
}

/** 卸载已加载的 ASR 模型，释放内存 */
export async function unloadASRModel(): Promise<UnifiedResponse<TestConnectionResponse>> {
  return request<TestConnectionResponse>('/config/third-party/asr/unload', { method: 'POST' });
}
