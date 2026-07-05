import { request } from '../utils/request';

export interface UpdateInfo {
  available: boolean;
  current: string;
  remote: string;
  release_notes: string;
  download_url: string;
  repo: string;
  error?: string;
}

export interface RepoInfo {
  repo: string;
}

export async function checkUpdate() {
  return request<UpdateInfo>('/system/check-update');
}

export async function getRepo() {
  return request<RepoInfo>('/system/repo');
}

export async function setRepo(repo: string) {
  return request<RepoInfo>('/system/repo', { method: 'PUT', body: { repo } });
}

export async function getToken() {
  return request<{ token: string; has_token: boolean }>('/system/token');
}

export async function setToken(token: string) {
  return request<null>('/system/token', { method: 'PUT', body: { token } });
}
