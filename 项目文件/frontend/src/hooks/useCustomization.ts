import { useState, useEffect } from 'react';
import type { CustomizationConfig } from '../types/customization';
import { DEFAULT_CONFIG } from '../types/customization';

const CONFIG_URL = '/custom/config.json';
const STORAGE_KEY = 'custom_app_settings';

function getStoredSettings(): Partial<CustomizationConfig['app']> {
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

        const storedSettings = getStoredSettings();

        const mergedConfig: CustomizationConfig = {
          app: {
            ...DEFAULT_CONFIG.app,
            ...fileConfig.app,
            ...storedSettings,
          },
          branding: {
            ...DEFAULT_CONFIG.branding,
            ...fileConfig.branding,
          },
        };

        setConfig(mergedConfig);

        // Apply favicon dynamically
        if (mergedConfig.branding.favicon) {
          let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = mergedConfig.branding.favicon;
        }

        // Apply page title dynamically
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
}): void {
  const existing = getStoredSettings();
  const merged = { ...existing, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}
