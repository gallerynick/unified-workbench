import { useState, useEffect } from 'react';
import { Card, List, Typography, Checkbox, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { CheckSquareOutlined } from '@ant-design/icons';
import { listTasks, updateTask } from '../../../api/tasks';
import type { Task } from '../../../types/task';

const { Text } = Typography;

export default function TodosWidget() {
  const [list, setList] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTodos = async () => {
      try {
        const res = await listTasks({ page: 1, page_size: 5 });
        if (res.code === 0) {
          setList(res.data.items);
        }
      } catch {
        // 保持空列表
      } finally {
        setLoading(false);
      }
    };
    fetchTodos();
  }, []);

  const toggleDone = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      const res = await updateTask(task.id, { status: newStatus });
      if (res.code === 0) {
        setList((prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, status: newStatus } : item))
        );
      }
    } catch {
      message.error('更新失败');
    }
  };

  return (
    <Card
      title={
        <span>
          <CheckSquareOutlined style={{ marginRight: "var(--spacing-xs)" }} />
          待办事项
        </span>
      }
      size="small"
      extra={<a onClick={() => navigate('/tasks')}>查看全部</a>}
    >
      {loading ? <Spin /> : (
        <List
          size="small"
          dataSource={list}
          locale={{ emptyText: '暂无待办' }}
          renderItem={(item) => (
            <List.Item style={{ cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: "var(--spacing-xs)", width: '100%' }}>
                <Checkbox checked={item.status === 'done'} onChange={() => toggleDone(item)} onClick={(e) => e.stopPropagation()} />
                <Text delete={item.status === 'done'} ellipsis style={{ flex: 1 }}>
                  {item.title}
                </Text>
                <Text type="secondary" style={{ fontSize: 'var(--text-body-xs-size)', whiteSpace: 'nowrap' }}>
                  {item.due_date ? new Date(item.due_date).toLocaleDateString('zh-CN') : ''}
                </Text>
              </div>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
