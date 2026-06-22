import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { theme as antdTheme } from 'antd';

const THEME_KEY = 'user_personalization';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
  setDark: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  toggleTheme: () => {},
  setDark: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function readThemeFromStorage(): boolean {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      return config.theme === 'dark';
    }
  } catch {}
  return false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(readThemeFromStorage);

  useEffect(() => {
    const handleStorageChange = () => {
      setIsDark(readThemeFromStorage());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        const stored = localStorage.getItem(THEME_KEY);
        const config = stored ? JSON.parse(stored) : {};
        localStorage.setItem(THEME_KEY, JSON.stringify({ ...config, theme: next ? 'dark' : 'light' }));
      } catch {}
      return next;
    });
  }, []);

  const setDark = useCallback((dark: boolean) => {
    setIsDark(dark);
    try {
      const stored = localStorage.getItem(THEME_KEY);
      const config = stored ? JSON.parse(stored) : {};
      localStorage.setItem(THEME_KEY, JSON.stringify({ ...config, theme: dark ? 'dark' : 'light' }));
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, setDark }}>
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
