import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  FileOutlined,
  FileTextOutlined,
  ProjectOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { listFileShares } from '../../../api/file-shares';
import { listContents } from '../../../api/contents';
import { listProjects } from '../../../api/projects';
import { listUsers } from '../../../api/users';

// 统计小卡间距走 token，不再硬编码 16。
// antd 对字符串 gutter 生成 calc(var(--x) / 2)（Row 负 margin 用 / -2），与数字 gutter 等价。
const cardGutter: [string, string] = ['var(--spacing-card-gap)', 'var(--spacing-card-gap)'];

// 外壳与标题行由 SortableWidget 统一渲染（标题「数据概览」见 Home.tsx 的 WIDGET_META）。
// 内部 4 张统计小卡保留 Card：它们需要独立圆角与 hover 交互。
export default function StatsWidget() {
  const [stats, setStats] = useState({ files: 0, contents: 0, projects: 0, members: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [filesRes, contentsRes, projectsRes, membersRes] = await Promise.all([
          listFileShares(1, 1).catch(() => ({ code: -1, data: { total: 0 } })),
          listContents({ page_size: 1 }).catch(() => ({ code: -1, data: { total: 0 } })),
          listProjects({ page: 1, page_size: 1 }).catch(() => ({ code: -1, data: { total: 0 } })),
          listUsers({ page_size: 1 }).catch(() => ({ code: -1, data: { total: 0 } })),
        ]);
        setStats({
          files: filesRes.code === 0 ? filesRes.data.total : 0,
          contents: contentsRes.code === 0 ? contentsRes.data.total : 0,
          projects: projectsRes.code === 0 ? projectsRes.data.total : 0,
          members: membersRes.code === 0 ? membersRes.data.total : 0,
        });
      } catch {
        // 保持默认值 0
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <Spin />;
  }

  return (
    <Row gutter={cardGutter}>
      <Col xs={24} sm={12} lg={6}>
        <Card hoverable onClick={() => navigate('/shares')}>
          <Statistic title="文件数量" value={stats.files} prefix={<FileOutlined />} />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card hoverable onClick={() => navigate('/content')}>
          <Statistic title="内容数量" value={stats.contents} prefix={<FileTextOutlined />} />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card hoverable onClick={() => navigate('/projects')}>
          <Statistic title="项目数量" value={stats.projects} prefix={<ProjectOutlined />} />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card hoverable onClick={() => navigate('/members')}>
          <Statistic title="团队成员" value={stats.members} prefix={<UserOutlined />} />
        </Card>
      </Col>
    </Row>
  );
}