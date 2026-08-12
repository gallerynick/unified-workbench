import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { router } from './router';
import { ThemeProvider, useTheme, getAntdThemeConfig } from './contexts/ThemeContext';
import { UserProvider } from './contexts/UserContext';
import { LockProvider } from './contexts/LockContext';
import './styles/token.css';
import './styles/typography.css';
import './global.css';

function AppWithTheme() {
  const { isDark } = useTheme();
  return (
    <ConfigProvider locale={zhCN} theme={getAntdThemeConfig(isDark)}>
      <App>
        <UserProvider>
          <LockProvider>
            <RouterProvider router={router} />
          </LockProvider>
        </UserProvider>
      </App>
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
