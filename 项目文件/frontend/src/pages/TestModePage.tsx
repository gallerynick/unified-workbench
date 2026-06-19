import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { clearTokens } from '../utils/auth';

export default function TestModePage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearTokens();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Result
        status="warning"
        title="系统维护中"
        subTitle="系统当前处于测试模式，仅管理员可以访问。请联系管理员获取更多信息。"
        extra={
          <Button type="primary" onClick={handleLogout}>
            退出登录
          </Button>
        }
      />
    </div>
  );
}
