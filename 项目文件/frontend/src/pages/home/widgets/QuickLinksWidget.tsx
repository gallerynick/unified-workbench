import { useNavigate } from 'react-router-dom';
import { Button, Space } from 'antd';
import {
  FileOutlined,
  FileTextOutlined,
  ProjectOutlined,
  UserOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  BellOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const links = [
  { label: '文件共享', icon: <FileOutlined />, path: '/shares' },
  { label: '内容管理', icon: <FileTextOutlined />, path: '/content' },
  { label: '项目管理', icon: <ProjectOutlined />, path: '/projects' },
  { label: '团队成员', icon: <UserOutlined />, path: '/members' },
  { label: '日程日历', icon: <CalendarOutlined />, path: '/calendar' },
  { label: '任务中心', icon: <CheckSquareOutlined />, path: '/tasks' },
  { label: '提醒管理', icon: <BellOutlined />, path: '/reminders' },
  { label: '系统设置', icon: <SettingOutlined />, path: '/settings/site' },
];

// 外壳与标题行由 SortableWidget 统一渲染（标题见 Home.tsx 的 WIDGET_META）
export default function QuickLinksWidget() {
  const navigate = useNavigate();

  return (
    // gap 显式绑定 --spacing-xs：antd Space 的 size 只接受数字或预设值，
    // 不接受 CSS 变量，故用内联 style 覆盖默认的 paddingXS 派生间距
    <Space wrap style={{ gap: 'var(--spacing-xs)' }}>
      {links.map((link) => (
        <Button
          key={link.path}
          icon={link.icon}
          onClick={() => navigate(link.path)}
          size="middle"
        >
          {link.label}
        </Button>
      ))}
    </Space>
  );
}