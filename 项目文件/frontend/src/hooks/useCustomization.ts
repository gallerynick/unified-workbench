import { useState, useEffect } from 'react';
import type { CustomizationConfig, DisplayMode } from '../types/customization';
import { DEFAULT_CONFIG } from '../types/customization';

const CONFIG_URL = '/custom/config.json';
const STORAGE_KEY = 'custom_app_settings';

interface StoredSettings {
  name?: string;
  shortName?: string;
  description?: string;
  favicon?: string;
  logoExpanded?: string;
  logoCollapsed?: string;
  displayMode?: DisplayMode;
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
      try {
        const res = await fetch(CONFIG_URL);
        let fileConfig: Partial<CustomizationConfig> = {};
        if (res.ok) {
          fileConfig = await res.json();
        }

        const stored = getStoredSettings();

        const mergedConfig: CustomizationConfig = {
          app: {
            ...DEFAULT_CONFIG.app,
            ...fileConfig.app,
            name: stored.name ?? fileConfig.app?.name ?? DEFAULT_CONFIG.app.name,
            shortName: stored.shortName ?? fileConfig.app?.shortName ?? DEFAULT_CONFIG.app.shortName,
            description: stored.description ?? fileConfig.app?.description ?? DEFAULT_CONFIG.app.description,
          },
          branding: {
            ...DEFAULT_CONFIG.branding,
            ...fileConfig.branding,
            favicon: stored.favicon ?? fileConfig.branding?.favicon ?? DEFAULT_CONFIG.branding.favicon,
            logoExpanded: stored.logoExpanded ?? fileConfig.branding?.logoExpanded ?? DEFAULT_CONFIG.branding.logoExpanded,
            logoCollapsed: stored.logoCollapsed ?? fileConfig.branding?.logoCollapsed ?? DEFAULT_CONFIG.branding.logoCollapsed,
            displayMode: stored.displayMode ?? fileConfig.branding?.displayMode ?? DEFAULT_CONFIG.branding.displayMode,
          },
        };

        setConfig(mergedConfig);

        if (mergedConfig.branding.favicon) {
          let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = mergedConfig.branding.favicon;
        }

        document.title = mergedConfig.app.name;
      } catch {
        setConfig(DEFAULT_CONFIG);
      }
    }
    loadConfig();
  }, []);

  return config;
}

export function saveAppSettings(settings: {
  name?: string;
  shortName?: string;
  description?: string;
  favicon?: string;
  logoExpanded?: string;
  logoCollapsed?: string;
  displayMode?: DisplayMode;
}): void {
  const existing = getStoredSettings();
  const merged = { ...existing, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}
