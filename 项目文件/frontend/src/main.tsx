import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { router } from './router';
import { ThemeProvider, useTheme, getAntdThemeConfig } from './contexts/ThemeContext';
import './global.css';

function AppWithTheme() {
  const { isDark } = useTheme();
  return (
    <ConfigProvider locale={zhCN} theme={getAntdThemeConfig(isDark)}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppWithTheme />
    </ThemeProvider>
  </React.StrictMode>,
);
