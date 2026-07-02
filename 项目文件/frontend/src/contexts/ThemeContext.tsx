import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { theme as antdTheme } from 'antd';

const THEME_KEY = 'user_personalization';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  isDark: boolean;
  themeMode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  themeMode: 'light',
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function readThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      if (config.theme === 'dark' || config.theme === 'light' || config.theme === 'system') {
        return config.theme;
      }
    }
  } catch (e) { console.warn('Failed to read theme:', e); }
  return 'light';
}

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(readThemeMode);
  const [systemDark, setSystemDark] = useState(getSystemPrefersDark);

  const isDark = themeMode === 'system' ? systemDark : themeMode === 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    try {
      const stored = localStorage.getItem(THEME_KEY);
      const config = stored ? JSON.parse(stored) : {};
      localStorage.setItem(THEME_KEY, JSON.stringify({ ...config, theme: mode }));
    } catch (e) { console.warn('Failed to write theme:', e); }
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, themeMode, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function getAntdThemeConfig(isDark: boolean) {
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#1677ff',
    },
  };
}
