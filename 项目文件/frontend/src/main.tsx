import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { router } from './router';
import ErrorBoundary from './components/ErrorBoundary';
import { startBuildWatcher } from './utils/chunkGuard';
import { ThemeProvider, useTheme, getAntdThemeConfig } from './contexts/ThemeContext';
import { UserProvider } from './contexts/UserContext';
import { LockProvider } from './contexts/LockContext';
import './styles/token.css';
import './styles/typography.css';
import './global.css';

// 重新部署后，长时间闲置的标签页仍引用已下线的哈希 chunk，会撞
// "Failed to fetch dynamically imported module"。启动构建变更探测（见 chunkGuard.ts）。
startBuildWatcher();

function AppWithTheme() {
  const { isDark } = useTheme();
  return (
    <ConfigProvider locale={zhCN} theme={getAntdThemeConfig(isDark)}>
      <ErrorBoundary>
        <App>
          <UserProvider>
            <LockProvider>
              <RouterProvider router={router} />
            </LockProvider>
          </UserProvider>
        </App>
      </ErrorBoundary>
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
