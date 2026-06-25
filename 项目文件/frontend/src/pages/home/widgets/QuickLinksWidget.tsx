import { Card, Button, Space } from 'antd';
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
import { useNavigate } from 'react-router-dom';

const links = [
  { label: '文件管理', icon: <FileOutlined />, path: '/files' },
  { label: '内容管理', icon: <FileTextOutlined />, path: '/content' },
  { label: '项目管理', icon: <ProjectOutlined />, path: '/projects' },
  { label: '团队成员', icon: <UserOutlined />, path: '/members' },
  { label: '日程日历', icon: <CalendarOutlined />, path: '/calendar' },
  { label: '任务管理', icon: <CheckSquareOutlined />, path: '/tasks' },
  { label: '提醒管理', icon: <BellOutlined />, path: '/reminders' },
  { label: '系统设置', icon: <SettingOutlined />, path: '/settings/site' },
];

export default function QuickLinksWidget() {
  const navigate = useNavigate();

  return (
    <Card title="快捷入口" size="small">
      <Space wrap>
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
    </Card>
  );
}
