import { request } from '../utils/request';
import type {
  ThirdPartyConfig,
  ThirdPartyConfigUpdate,
  TestConnectionResponse,
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

export async function testAIConnection(): Promise<UnifiedResponse<TestConnectionResponse>> {
  return request<TestConnectionResponse>('/config/third-party/ai/test', { method: 'POST' });
}

export async function testASRService(): Promise<UnifiedResponse<TestConnectionResponse>> {
  return request<TestConnectionResponse>('/config/third-party/asr/test', { method: 'POST' });
}

export async function reloadASRModel(): Promise<UnifiedResponse<TestConnectionResponse>> {
  return request<TestConnectionResponse>('/config/third-party/asr/reload', { method: 'POST' });
}
