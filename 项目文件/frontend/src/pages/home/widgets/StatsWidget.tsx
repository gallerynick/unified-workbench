import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  FileOutlined,
  FileTextOutlined,
  ProjectOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { listFiles } from '../../../api/files';
import { listContents } from '../../../api/contents';
import { listRecords } from '../../../api/records';
import { listUsers } from '../../../api/users';

export default function StatsWidget() {
  const [stats, setStats] = useState({ files: 0, contents: 0, projects: 0, members: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [filesRes, contentsRes, projectsRes, membersRes] = await Promise.all([
          listFiles({ page_size: 1 }).catch(() => ({ code: -1, data: { total: 0 } })),
          listContents({ page_size: 1 }).catch(() => ({ code: -1, data: { total: 0 } })),
          listRecords({ page: 1, page_size: 1, type: 'project' }).catch(() => ({ code: -1, data: { total: 0 } })),
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
    return <Card><Spin /></Card>;
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <Card hoverable onClick={() => navigate('/files')}>
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
