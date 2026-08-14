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
      colorPrimary: '#0066cc',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: 14,
      controlHeight: 32,
      borderRadius: 8,
      colorBorder: isDark ? '#434343' : '#d9d9d9',
      colorBgContainer: isDark ? '#141414' : '#ffffff',
      colorText: isDark ? '#ffffff' : '#1d1d1f',
      colorTextSecondary: isDark ? '#a6a6a6' : '#8c8c8c',
      colorBgElevated: isDark ? '#1d1d1f' : '#ffffff',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
      colorSuccess: isDark ? '#73d13d' : '#52c41a',
      colorSuccessBg: isDark ? '#162312' : '#f6ffed',
      colorWarning: isDark ? '#d89614' : '#faad14',
      colorWarningBg: isDark ? '#2b2111' : '#fffbe6',
      colorError: isDark ? '#ff7875' : '#ff4d4f',
      colorErrorBg: isDark ? '#2a1215' : '#fff2f0',
      colorInfo: isDark ? '#1668dc' : '#1677ff',
      colorInfoBg: isDark ? '#111d2c' : '#e6f4ff',
    },
    components: {
      Table: {
        cellPaddingBlock: 12,
        cellPaddingInline: 16,
        headerBg: isDark ? '#262626' : '#f5f5f5',
        headerColor: isDark ? '#a6a6a6' : '#8c8c8c',
        rowHoverBg: isDark ? '#141414' : '#fafafa',
        borderColor: isDark ? '#303030' : '#f0f0f0',
      },
      Button: {
        borderRadius: 8,
        borderRadiusSM: 8,
        controlHeightLG: 44,
        paddingContentHorizontal: 22,
        primaryColor: '#ffffff',
        defaultBg: isDark ? 'transparent' : '#ffffff',
        defaultColor: isDark ? '#2997ff' : '#0066cc',
        defaultBorderColor: isDark ? '#2997ff' : '#0066cc',
      },
      Modal: {
        contentBg: isDark ? '#1d1d1f' : '#ffffff',
        headerBg: isDark ? '#1d1d1f' : '#ffffff',
        footerBg: isDark ? '#1d1d1f' : '#ffffff',
        borderRadiusLG: 8,
        paddingContentHorizontal: 24,
      },
      Tag: {
        borderRadiusSM: 4,
      },
      Badge: {
        indicatorHeight: 20,
        dotSize: 6,
        statusSize: 6,
        textFontSize: 12,
        borderRadius: 4,
      },
      Cascader: {
        colorBgContainer: isDark ? '#1f2937' : '#ffffff',
        colorBorder: isDark ? '#374151' : '#d9d9d9',
        colorText: isDark ? '#d1d5db' : '#1d1d1f',
        colorTextDisabled: isDark ? '#6b7280' : '#d9d9d9',
        activeBorderColor: isDark ? '#1677ff' : '#1677ff',
        activeBg: isDark ? '#0050b3' : '#e6f4ff',
        optionActiveBg: isDark ? '#1d2a3a' : '#f5f5f5',
        optionSelectedBg: isDark ? '#0050b3' : '#e6f4ff',
        optionSelectedColor: isDark ? '#ffffff' : '#1677ff',
        colorFill: isDark ? '#374151' : '#f5f5f5',
      },
      Avatar: {
        containerSize: 32,
        containerSizeLG: 48,
        containerSizeSM: 24,
        colorBgContainer: isDark ? '#262626' : '#f5f5f5',
        colorText: isDark ? '#a6a6a6' : '#8c8c8c',
      },
      Card: {
        borderRadiusLG: 18,
        paddingLG: 16,
        colorBorderSecondary: isDark ? '#303030' : '#f0f0f0',
        colorBgContainer: isDark ? '#141414' : '#ffffff',
      },
      Select: {
        optionSelectedBg: isDark ? '#111d2c' : '#e6f4ff',
        optionSelectedColor: isDark ? '#1668dc' : '#1677ff',
      },
      Switch: {
        trackMinWidth: 44,
        handleSize: 18,
        trackHeight: 22,
        borderRadius: 9999,
      },
      Checkbox: {
        lineWidth: 1,
        borderRadiusSM: 2,
      },
      Radio: {
        radioSize: 16,
        dotSize: 6,
        borderRadiusSM: 9999,
        radioButtonBg: isDark ? '#262626' : '#ffffff',
        radioButtonColor: isDark ? '#ffffff' : '#1d1d1f',
      },
      Tree: {
        nodeHoverBg: isDark ? '#262626' : '#f5f5f5',
        nodeSelectedBg: isDark ? '#111d2c' : '#e6f4ff',
        colorBgContainer: isDark ? '#141414' : '#ffffff',
        nodeHeight: 28,
        nodePaddingInline: 8,
      },
      TreeSelect: {
        nodeHoverBg: isDark ? '#1d2a3a' : '#f5f5f5',
        nodeSelectedBg: isDark ? '#0050b3' : '#e6f4ff',
        nodeSelectedFg: isDark ? '#ffffff' : '#1677ff',
        activeBorderColor: isDark ? '#1677ff' : '#1677ff',
        activeBg: isDark ? '#0050b3' : '#e6f4ff',
        optionActiveBg: isDark ? '#1d2a3a' : '#f5f5f5',
        optionActiveColor: isDark ? '#ffffff' : '#1d1d1f',
        colorBgContainer: isDark ? '#1f2937' : '#ffffff',
        colorBorder: isDark ? '#374151' : '#d9d9d9',
        colorText: isDark ? '#d1d5db' : '#1d1d1f',
        colorTextDisabled: isDark ? '#6b7280' : '#d9d9d9',
      },
      Input: {
        controlHeight: 32,
        borderRadius: 8,
        paddingInline: 11,
        paddingBlock: 4,
        colorBgContainer: isDark ? '#141414' : '#ffffff',
        colorBorder: isDark ? '#434343' : '#d9d9d9',
        colorText: isDark ? '#ffffff' : '#1d1d1f',
      },
      TextArea: {
        borderRadius: 8,
        paddingInline: 11,
        paddingBlock: 6,
        colorBgContainer: isDark ? '#141414' : '#ffffff',
        colorBorder: isDark ? '#434343' : '#d9d9d9',
        colorText: isDark ? '#ffffff' : '#1d1d1f',
      },
      DatePicker: {
        controlHeight: 32,
        borderRadius: 8,
        colorBgContainer: isDark ? '#141414' : '#ffffff',
        colorBorder: isDark ? '#434343' : '#d9d9d9',
      },
      InputNumber: {
        controlHeight: 32,
        borderRadius: 8,
        colorBgContainer: isDark ? '#141414' : '#ffffff',
        colorBorder: isDark ? '#434343' : '#d9d9d9',
      },
      Alert: {
        borderRadius: 8,
        colorBgContainer: isDark ? '#141414' : '#ffffff',
      },
      Empty: {
        descriptionFontSize: 14,
      },
      Form: {
        labelColor: isDark ? '#a6a6a6' : '#8c8c8c',
        labelRequiredColor: isDark ? '#ff7875' : '#ff4d4f',
        validateColor: isDark ? '#ff7875' : '#ff4d4f',
        validateSuccessColor: isDark ? '#73d13d' : '#52c41a',
        validateWarningColor: isDark ? '#d89614' : '#faad14',
        validateErrorColor: isDark ? '#ff7875' : '#ff4d4f',
        margin: isDark ? 24 : 24,
        itemMarginBottom: isDark ? 24 : 24,
      },
      Spin: {
        dotSize: 20,
        color: isDark ? '#2997ff' : '#1677ff',
      },
      Skeleton: {
        borderRadius: 8,
        colorBgContainer: isDark ? '#262626' : '#f5f5f5',
      },
      Tabs: {
        itemColor: isDark ? '#a6a6a6' : '#8c8c8c',
        itemActiveColor: isDark ? '#2997ff' : '#1677ff',
        inkBarColor: isDark ? '#2997ff' : '#1677ff',
        colorBorderSecondary: isDark ? '#303030' : '#f0f0f0',
      },
      Breadcrumb: {
        color: isDark ? '#a6a6a6' : '#8c8c8c',
        lastColor: isDark ? '#2997ff' : '#1677ff',
        separatorColor: isDark ? '#595959' : '#bfbfbf',
        fontSize: 14,
      },
      Sider: {
        width: 240,
        collapsedWidth: 80,
        colorBgContainer: isDark ? '#141414' : '#ffffff',
        colorBorderSecondary: isDark ? '#303030' : '#f0f0f0',
        menuItemHeight: 40,
        borderRadius: 8,
      },
      Segmented: {
        borderRadius: 8,
        trackBg: isDark ? '#262626' : '#f5f5f5',
        itemSelectedBg: isDark ? '#1d1d1f' : '#ffffff',
        itemColor: isDark ? '#a6a6a6' : '#8c8c8c',
        itemSelectedColor: isDark ? '#ffffff' : '#1d1d1f',
      },
      List: {
        itemPadding: '12px 16px',
        colorBorder: isDark ? '#303030' : '#f0f0f0',
      },
      Dropdown: {
        borderRadius: 8,
        colorBgElevated: isDark ? '#1d1d1f' : '#ffffff',
        boxShadowSecondary: isDark
          ? '0 4px 12px rgba(0,0,0,0.3)'
          : '0 4px 12px rgba(0,0,0,0.08)',
      },
      Tooltip: {
        borderRadius: 8,
        paddingXS: 6,
        paddingXXS: 8,
        colorBgSpotlight: isDark ? '#ffffff' : '#1d1d1f',
        colorTextLightSolid: isDark ? '#000000' : '#ffffff',
        boxShadowSecondary: isDark
          ? '0 4px 12px rgba(0,0,0,0.3)'
          : '0 4px 12px rgba(0,0,0,0.08)',
      },
      Popover: {
        borderRadius: 8,
        colorBgElevated: isDark ? '#1d1d1f' : '#ffffff',
        paddingSM: 12,
        colorBorder: isDark ? '#434343' : '#d9d9d9',
        boxShadowSecondary: isDark
          ? '0 4px 12px rgba(0,0,0,0.3)'
          : '0 4px 12px rgba(0,0,0,0.08)',
      },
      Progress: {
        railHeight: 6,
        borderRadiusSM: 9999,
        defaultColor: isDark ? '#1668dc' : '#1677ff',
        remainingColor: isDark ? '#262626' : '#f5f5f5',
      },
      Collapse: {
        borderRadiusLG: 8,
        contentPadding: 16,
        headerPadding: 16,
        colorBorder: isDark ? '#303030' : '#f0f0f0',
        colorBgContainer: isDark ? '#141414' : '#ffffff',
      },
      Descriptions: {
        paddingSM: 16,
        colorBorderSecondary: isDark ? '#303030' : '#f0f0f0',
      },
      Drawer: {
        paddingLG: 24,
        colorBgElevated: isDark ? '#1d1d1f' : '#ffffff',
        borderRadiusLG: 0,
        boxShadowSecondary: isDark
          ? '0 8px 24px rgba(0,0,0,0.4)'
          : '0 8px 24px rgba(0,0,0,0.12)',
      },
      Upload: {
        colorBgContainer: isDark ? '#262626' : '#f5f5f5',
        colorBorder: isDark ? '#434343' : '#d9d9d9',
        borderRadius: 8,
      },
      Steps: {
        navArrowColor: isDark ? '#2997ff' : '#1677ff',
        iconSize: 32,
        iconFontSize: 14,
        titleFontSize: 14,
        finishIconBorderColor: isDark ? '#2997ff' : '#1677ff',
      },
      Timeline: {
        dotBg: isDark ? '#2997ff' : '#1677ff',
        dotBorderWidth: 2,
        tailColor: isDark ? '#303030' : '#f0f0f0',
        itemPaddingBottom: 20,
      },
      Result: {
        iconFontSize: 72,
        titleFontSize: 32,
        subtitleFontSize: 14,
        extraMargin: 24,
      },
      Divider: {
        colorBorder: isDark ? '#303030' : '#f0f0f0',
        margin: 0,
      },
      Header: {
        height: 64,
        colorBgContainer: isDark ? '#141414' : '#ffffff',
        colorBorderSecondary: isDark ? '#303030' : '#f0f0f0',
      },
      Menu: {
        itemHeight: 40,
        itemPaddingInline: 16,
        itemMarginInline: 8,
        itemActiveBg: isDark ? '#111d2c' : '#e6f4ff',
        itemActiveColor: isDark ? '#1668dc' : '#1677ff',
        itemHoverBg: isDark ? '#262626' : '#f5f5f5',
        itemSelectedBg: isDark ? '#111d2c' : '#e6f4ff',
        itemSelectedColor: isDark ? '#1668dc' : '#1677ff',
        colorBgContainer: isDark ? '#141414' : '#ffffff',
      },
      Statistic: {
        contentFontSize: 20,
        titleFontSize: 14,
      },
      Slider: {
        railSize: 4,
        handleSize: 14,
        borderRadius: 9999,
        trackBg: isDark ? '#2997ff' : '#1677ff',
        railBg: isDark ? '#262626' : '#f5f5f5',
        handleColor: isDark ? '#2997ff' : '#1677ff',
        railHoverBg: isDark ? '#111d2c' : '#e6f4ff',
      },
      Rate: {
        starSize: 16,
        starColor: isDark ? '#d89614' : '#faad14',
      },
    },
  };
}
