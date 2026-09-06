import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tag,
  Button,
  Divider,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { PROJECT_TYPE, parseRelatedProjects } from '../../../constants/project';
import { listProjects } from '../../../api/projects';
import type { Project, ProjectStatus } from '../../../types/project';
import type { Template } from '../../../types/template';
import { getVisibilityConfig } from '../../../utils/visibility';
import ProjectForm from '../ProjectForm';
import styles from './ProjectInfoTab.module.css';

// 状态标签配置
const STATUS_MAP: Record<ProjectStatus, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  ongoing: { color: 'processing', text: '进行中' },
  done: { color: 'success', text: '已完成' },
  archived: { color: 'warning', text: '已归档' },
};

const PRIORITY_MAP: Record<string, string> = {
  '立即': 'red',
  '重要': 'orange',
  '一般': 'blue',
  '最后': 'default',
  '待定': 'default',
};

const PROJECT_TYPE_MAP: Record<string, string> = PROJECT_TYPE.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

interface ProjectInfoTabProps {
  project: Project;
  template?: Template | null;
  /** 编辑保存成功后刷新项目数据（由父组件传入） */
  onRefresh?: () => Promise<void> | void;
}

/**
 * 项目信息 Tab（展示）+ 编辑复用 ProjectForm
 *
 * 编辑弹窗统一使用 ProjectForm（其本身即 create/edit 双模式共用组件，
 * 项目列表页新建/编辑与详情页信息编辑共用同一表单，一处修改、多处以一）。
 */
export default function ProjectInfoTab({ project, template, onRefresh }: ProjectInfoTabProps) {
  const navigate = useNavigate();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [projectOptions, setProjectOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    listProjects({ page: 1, page_size: 100 }).then((res) => {
      if (res.code === 0 && res.data) {
        const items = (res.data as { items?: Project[] }).items || [];
        setProjectOptions(
          (Array.isArray(items) ? items : [])
            .filter((p) => p.id !== project.id)
            .map((p) => ({ value: p.id, label: p.title || p.number || p.id }))
        );
      }
    }).catch(() => {});
  }, [project.id]);

  const statusCfg = STATUS_MAP[project.status] || { color: 'default', text: project.status };
  const memberCount = project.member_ids?.length ?? 0;
  const relatedIds = parseRelatedProjects(project.related_projects);

  const handleEdit = () => {
    setEditModalVisible(true);
  };

  const handleFormClose = () => {
    setEditModalVisible(false);
  };

  const handleFormSuccess = async () => {
    setEditModalVisible(false);
    if (onRefresh) await onRefresh();
  };

  // 定义列表项渲染辅助
  const renderDefItem = (label: string, value: React.ReactNode) => (
    <div className={styles.defItem ?? ''}>
      <span className={styles.defLabel ?? ''}>{label}</span>
      <span className={styles.defValue ?? ''}>{value}</span>
    </div>
  );

  // 长文本段落区块渲染辅助
  const renderTextBlock = (label: string, value: string | null | undefined) => (
    <div className={styles.textBlock ?? ''}>
      <div className={styles.textLabel ?? ''}>{label}</div>
      <div className={styles.textBody ?? ''}>{value || '-'}</div>
    </div>
  );

  const visibilityCfg = getVisibilityConfig(project.visibility);

  return (
    <>
      <div className={styles.container ?? ''}>
        {/* 区块 A：基础信息（短键值定义列表） */}
        <section className={styles.section ?? ''}>
          <div className={styles.sectionTitle ?? ''}>基础信息</div>
          <div className={styles.definitionList ?? ''}>
            {renderDefItem('项目名称', project.title)}
            {renderDefItem('项目编号', project.number || '-')}
            {renderDefItem('项目状态', <Tag color={statusCfg.color} style={{ margin: 0 }}>{statusCfg.text}</Tag>)}
            {renderDefItem(
              '可见性',
              <>
                <Tag color={visibilityCfg.color} style={{ margin: 0 }}>{visibilityCfg.text}</Tag>
                {project.visibility === 'restricted' && project.restricted_users && project.restricted_users.length > 0 && (
                  <span style={{ marginLeft: 'var(--spacing-xs)', color: 'var(--text-secondary)', fontSize: 'var(--text-body-xs-size)' }}>
                    {project.restricted_users.length} 个用户
                  </span>
                )}
              </>
            )}
            {renderDefItem('项目负责人', project.owner_name || '-')}
            {renderDefItem('所属团队/部门', project.department || '-')}
            {renderDefItem('项目语言', project.language || '-')}
            {renderDefItem(
              '是否开源',
              project.is_open_source ? <Tag color="success" style={{ margin: 0 }}>开源</Tag> : <Tag style={{ margin: 0 }}>闭源</Tag>
            )}
            {project.is_open_source && project.repo_url && renderDefItem(
              '仓库地址',
              <a href={project.repo_url} target="_blank" rel="noopener noreferrer">{project.repo_url}</a>
            )}
            {renderDefItem(
              '项目优先级',
              project.priority ? <Tag color={PRIORITY_MAP[project.priority] || 'default'} style={{ margin: 0 }}>{project.priority}</Tag> : '-'
            )}
            {renderDefItem('项目类型', project.project_type ? PROJECT_TYPE_MAP[project.project_type] || project.project_type : '-')}
            {renderDefItem('成员规模', <Tag color="blue" style={{ margin: 0 }}>成员 {memberCount}</Tag>)}
            {renderDefItem('创建时间', new Date(project.created_at).toLocaleString('zh-CN'))}
            {renderDefItem('更新时间', new Date(project.updated_at).toLocaleString('zh-CN'))}
          </div>
        </section>

        {/* 区块 B：项目描述（长文本独立段落区块） */}
        <section className={styles.section ?? ''}>
          <div className={styles.sectionTitle ?? ''}>项目描述</div>
          {renderTextBlock('项目描述', project.description)}
          {renderTextBlock('项目目标', project.goals)}
          {renderTextBlock('项目需求', project.requirements)}
          {project.additional_req && renderTextBlock('附加需求', project.additional_req)}
        </section>

        {/* 区块 C：规划与关联（长文本段落 + 交互） */}
        <section className={styles.section ?? ''}>
          <div className={styles.sectionTitle ?? ''}>规划与关联</div>
          {renderTextBlock('模块划分', project.modules)}
          {renderTextBlock('开发流程', project.dev_process)}
          <div className={styles.textBlock ?? ''}>
            <div className={styles.textLabel ?? ''}>关联项目</div>
            {relatedIds.length === 0 ? (
              <div className={styles.textBody ?? ''}>-</div>
            ) : (
              <div className={styles.relatedList ?? ''}>
                {relatedIds.map((rid) => {
                  const found = projectOptions.find((o) => o.value === rid);
                  const label = found?.label || rid;
                  return (
                    <Button
                      key={rid}
                      type="link"
                      size="small"
                      style={{ padding: 0, height: 'auto', lineHeight: 1.6 }}
                      onClick={() => navigate(`/projects/${rid}`)}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 编辑按钮 */}
        <div className={styles.actions ?? ''}>
          <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
            编辑信息
          </Button>
        </div>
      </div>

      {template && (
        <>
          <Divider>关联模板</Divider>
          <div className={styles.definitionList ?? ''}>
            {renderDefItem('模板名称', template.name)}
            {renderDefItem('模板分类', template.category)}
            {renderDefItem('模板版本', `v${template.version}`)}
            {renderDefItem('字段数量', `${template.schema.length} 个字段`)}
          </div>
        </>
      )}

      {/* 编辑弹窗：复用 ProjectForm（create/edit 双模式共用组件） */}
      <ProjectForm
        visible={editModalVisible}
        mode="edit"
        project={project}
        onClose={handleFormClose}
        onSuccess={() => void handleFormSuccess()}
      />
    </>
  );
}
