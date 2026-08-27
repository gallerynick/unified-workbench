import { useState, useEffect } from 'react';
import type { CustomizationConfig, DisplayMode } from '../types/customization';
import { DEFAULT_CONFIG } from '../types/customization';

const CONFIG_URL = '/custom/config.json';
const STORAGE_KEY = 'custom_app_settings';
const CUSTOM_CONFIG_API = '/api/v1/system/custom-config';

interface StoredSettings {
  name?: string;
  shortName?: string;
  description?: string;
  favicon?: string;
  logoExpanded?: string;
  logoCollapsed?: string;
  displayMode?: DisplayMode;
}

interface CustomConfigResponse {
  app_name: string;
  app_short_name: string;
  app_description: string;
  favicon: string;
  logo_expanded: string;
  logo_collapsed: string;
  display_mode: string;
}

function getStoredSettings(): StoredSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function useCustomization(): CustomizationConfig {
  const [config, setConfig] = useState<CustomizationConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    async function loadConfig() {
      // 1. 服务器端基线：/custom/config.json（静态文件，所有访问者共享）
      let fileConfig: Partial<CustomizationConfig> = {};
      try {
        const fileRes = await fetch(CONFIG_URL);
        if (fileRes.ok) {
          fileConfig = await fileRes.json();
        }
      } catch { /* 忽略 */ }

      // 2. 站点自定义配置从后端读取（管理员界面修改覆盖，全站统一）
      let backendConfig: CustomConfigResponse | null = null;
      try {
        const res = await fetch(CUSTOM_CONFIG_API);
        if (res.ok) {
          const json = await res.json();
          if (json?.code === 0 && json.data) {
            backendConfig = json.data;
          }
        }
      } catch { /* 后端不可用时回退 */ }

      // 3. 本地缓存仅作离线兜底
      const stored = getStoredSettings();

      // 优先级：后端(界面修改) > config.json(文件基线) > localStorage(离线兜底) > 默认值
      const mergedConfig: CustomizationConfig = {
        app: {
          ...DEFAULT_CONFIG.app,
          ...fileConfig.app,
          name: backendConfig?.app_name || fileConfig.app?.name || stored.name || DEFAULT_CONFIG.app.name,
          shortName: backendConfig?.app_short_name || fileConfig.app?.shortName || stored.shortName || DEFAULT_CONFIG.app.shortName,
          description: backendConfig?.app_description || fileConfig.app?.description || stored.description || DEFAULT_CONFIG.app.description,
        },
        branding: {
          ...DEFAULT_CONFIG.branding,
          ...fileConfig.branding,
          favicon: backendConfig?.favicon || fileConfig.branding?.favicon || stored.favicon || DEFAULT_CONFIG.branding.favicon,
          logoExpanded: backendConfig?.logo_expanded || fileConfig.branding?.logoExpanded || stored.logoExpanded || DEFAULT_CONFIG.branding.logoExpanded,
          logoCollapsed: backendConfig?.logo_collapsed || fileConfig.branding?.logoCollapsed || stored.logoCollapsed || DEFAULT_CONFIG.branding.logoCollapsed,
          displayMode: (backendConfig?.display_mode as DisplayMode) || fileConfig.branding?.displayMode || stored.displayMode || DEFAULT_CONFIG.branding.displayMode,
        },
      };

      setConfig(mergedConfig);

      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = mergedConfig.branding.favicon || '/favicon.svg';

      document.title = mergedConfig.app.name;
    }
    loadConfig();
  }, []);

  return config;
}

/**
 * 保存站点自定义配置到后端（全站统一生效）
 * 同时写入本地缓存作为快速回显
 */
export async function saveAppSettings(settings: {
  name?: string;
  shortName?: string;
  description?: string;
  favicon?: string;
  logoExpanded?: string;
  logoCollapsed?: string;
  displayMode?: DisplayMode;
}): Promise<{ code: number; msg?: string }> {
  // 本地缓存（快速回显）
  const existing = getStoredSettings();
  const merged = { ...existing, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

  // 同步后端（全站统一）
  try {
    const resp = await fetch(CUSTOM_CONFIG_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_name: settings.name,
        app_short_name: settings.shortName,
        app_description: settings.description,
        favicon: settings.favicon,
        logo_expanded: settings.logoExpanded,
        logo_collapsed: settings.logoCollapsed,
        display_mode: settings.displayMode,
      }),
    });
    const json = await resp.json();
    return json;
  } catch {
    return { code: 1, msg: '网络错误' };
  }
}