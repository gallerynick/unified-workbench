import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { router } from './router';
import { ThemeProvider, useTheme, getAntdThemeConfig } from './contexts/ThemeContext';
import { UserProvider } from './contexts/UserContext';
import './styles/token.css';
import './styles/typography.css';
import './global.css';

function AppWithTheme() {
  const { isDark } = useTheme();
  return (
    <ConfigProvider locale={zhCN} theme={getAntdThemeConfig(isDark)}>
      <UserProvider>
        <RouterProvider router={router} />
      </UserProvider>
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
