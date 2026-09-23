import { ReloadOutlined } from '@ant-design/icons';
import { Button, Result, Typography } from 'antd';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';
import { isChunkLoadError } from '../utils/chunkGuard';

const { Text } = Typography;

interface State {
  error: Error | null;
  chunkError: boolean;
}

function normalize(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err ?? '未知错误'));
}

/**
 * 统一错误页 UI。
 *
 * 替换 React Router 内置的 "Unexpected Application Error!" 页面：
 * 那个页面是纯文本、没有操作入口、也不区分深浅色模式，用户只能靠手动刷新。
 */
function ErrorResult({ error, chunkError }: { error: Error; chunkError: boolean }) {
  const subTitle = chunkError
    ? '当前页面引用的静态资源已随新版本部署更新，自动刷新未能恢复，请手动刷新后继续使用。'
    : `程序发生异常：${error.message}`;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Result
        status="error"
        title="页面加载失败"
        subTitle={subTitle}
        extra={
          <Button type="primary" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            重新加载页面
          </Button>
        }
      />
      <Text type="secondary">错误详情已输出到浏览器控制台</Text>
    </div>
  );
}

/**
 * 路由级错误元素：挂在 router.tsx 各顶层路由的 errorElement 上。
 *
 * React Router 在路由组件渲染失败时由路由级错误边界接管，外层 ErrorBoundary
 * 拿不到该错误，因此必须用 errorElement 才能替换掉 "Unexpected Application Error!"。
 */
export function RouteErrorElement() {
  const err = useRouteError();
  const error = normalize(err);
  console.error('[Workbench] 路由渲染异常：', error);
  return <ErrorResult error={error} chunkError={isChunkLoadError(error)} />;
}

/**
 * 全局错误边界（类组件），包裹 RouterProvider 之外的部分。
 *
 * 承接：路由守卫、上下文 Provider、布局容器等路由树之外的未捕获异常，
 * 以及 React Router 自身初始化阶段抛出的错误。
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, chunkError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error: normalize(error), chunkError: isChunkLoadError(error) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Workbench] 未捕获异常：', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error, chunkError } = this.state;
    if (!error) return this.props.children;
    return <ErrorResult error={error} chunkError={chunkError} />;
  }
}
