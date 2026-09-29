import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Segmented, Space, Spin, Tabs, Tooltip, Typography, message } from 'antd';
import {
  AppstoreOutlined,
  FileAddOutlined,
  LoadingOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { createNote, deleteNote, getGlobalGraph, getGraph, getNote } from '@/api/notes';
import type { GraphData, Note } from '@/types/note';
import BacklinksPanel from './BacklinksPanel';
import GraphView from './GraphView';
import NoteEditor from './NoteEditor';
import NoteMetaPanel from './NoteMetaPanel';
import NoteSidebar from './NoteSidebar';
import styles from './NoteWorkspace.module.css';

const { Title } = Typography;

type ViewMode = 'workspace' | 'graph';
type GraphScope = 'global' | 'local';

/** 左侧面板开关图标：圆角矩形 + 内部竖线靠左 */
function PanelLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.6" y="2.6" width="12.8" height="10.8" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5.6" y1="2.6" x2="5.6" y2="13.4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** 右侧面板开关图标：与左侧镜像 */
function PanelRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.6" y="2.6" width="12.8" height="10.8" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
      <line x1="10.4" y1="2.6" x2="10.4" y2="13.4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * 笔记工作台：左侧栏 + 中间编辑/图谱 + 右侧面板的三栏布局。
 *
 * 右侧面板默认收起：编辑器拿满宽度，元信息按需打开。两个面板开关是
 * 自定义 SVG 图标（矩形 + 内部竖线），不占用文字空间。
 */
export default function NoteWorkspace() {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('workspace');
  const [graphScope, setGraphScope] = useState<GraphScope>('global');
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const bumpRefresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const openNote = useCallback(async (noteId: string) => {
    try {
      const res = await getNote(noteId);
      if (res.code === 0 && res.data) {
        setCurrentId(noteId);
        setCurrentNote(res.data);
        setIsNew(false);
        setViewMode('workspace');
      } else {
        message.error('笔记不存在或已删除');
      }
    } catch {
      message.error('打开笔记失败');
    }
  }, []);

  const handleCreate = useCallback(async () => {
    try {
      const res = await createNote({ title: '未命名笔记' });
      if (res.code === 0 && res.data) {
        setCurrentId(res.data.id);
        setCurrentNote(res.data);
        setIsNew(true);
        setViewMode('workspace');
      } else {
        message.error('新建笔记失败');
      }
    } catch {
      message.error('新建笔记失败');
    }
  }, []);

  const handleCancelNew = useCallback(async () => {
    if (!currentId) return;
    try {
      const res = await deleteNote(currentId);
      if (res.code === 0) {
        message.success('已删除');
        setCurrentId(null);
        setCurrentNote(null);
        setIsNew(false);
        bumpRefresh();
      }
    } catch {
      message.error('删除失败');
    }
  }, [currentId, bumpRefresh]);

  const handleSaved = useCallback((note: Note) => {
    setCurrentNote(note);
    setIsNew(false);
    // 标题与正文变更会影响侧栏排序与搜索索引，故同步刷新
    bumpRefresh();
  }, [bumpRefresh]);

  const loadGraph = useCallback(async () => {
    setGraphLoading(true);
    try {
      const res = graphScope === 'global' ? await getGlobalGraph() : await getGraph(currentId ?? '', 1);
      if (res.code === 0) setGraph(res.data);
      else message.error('图谱加载失败');
    } catch {
      message.error('图谱加载失败');
    } finally {
      setGraphLoading(false);
    }
  }, [graphScope, currentId]);

  // 切到图谱视图或切换范围时重新拉取
  useEffect(() => {
    if (viewMode !== 'graph') return;
    if (graphScope === 'local' && !currentId) {
      setGraphScope('global');
      return;
    }
    void loadGraph();
  }, [viewMode, graphScope, currentId, loadGraph]);

  const handleOpenInGraph = useCallback((noteId: string) => {
    void openNote(noteId);
  }, [openNote]);

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>笔记知识库</Title>
        <Space size={8}>
          <Tooltip title={leftCollapsed ? '展开左侧侧栏' : '收起左侧侧栏'}>
            <Button
              type="text"
              icon={<PanelLeftIcon />}
              aria-label={leftCollapsed ? '展开左侧侧栏' : '收起左侧侧栏'}
              aria-pressed={!leftCollapsed}
              disabled={viewMode === 'graph'}
              onClick={() => setLeftCollapsed((prev) => !prev)}
            />
          </Tooltip>
          <Tooltip title={rightCollapsed ? '展开右侧面板' : '收起右侧面板'}>
            <Button
              type="text"
              icon={<PanelRightIcon />}
              aria-label={rightCollapsed ? '展开右侧面板' : '收起右侧面板'}
              aria-pressed={!rightCollapsed}
              disabled={viewMode === 'graph'}
              onClick={() => setRightCollapsed((prev) => !prev)}
            />
          </Tooltip>
          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            options={[
              { label: '工作台', value: 'workspace', icon: <AppstoreOutlined /> },
              { label: '图谱', value: 'graph', icon: <ShareAltOutlined /> },
            ]}
          />
          <Button type="primary" icon={<FileAddOutlined />} onClick={() => void handleCreate()}>
            新建笔记
          </Button>
        </Space>
      </div>

      <div className={styles.columns ?? ''}>
        {leftCollapsed ? null : (
          <aside className={styles.left ?? ''}>
            <NoteSidebar
              currentId={currentId}
              onOpenNote={(id) => void openNote(id)}
              refreshKey={refreshKey}
            />
          </aside>
        )}

        <main className={styles.center ?? ''}>
          {viewMode === 'workspace' ? (
            <NoteEditor
              note={currentNote}
              isNew={isNew}
              onNavigate={(id) => void openNote(id)}
              onSaved={handleSaved}
              onCancelNew={() => void handleCancelNew()}
            />
          ) : (
            <div className={styles.graphWrap ?? ''}>
              <div className={styles.graphControls ?? ''}>
                <Segmented
                  value={graphScope}
                  onChange={(value) => setGraphScope(value as GraphScope)}
                  options={[
                    { label: '全局图谱', value: 'global' },
                    { label: '局部图谱', value: 'local', disabled: !currentId },
                  ]}
                />
              </div>
              {graphLoading ? (
                <div className={styles.loadingBox ?? ''}>
                  <Spin indicator={<LoadingOutlined spin />} />
                </div>
              ) : graph ? (
                <GraphView graph={graph} onNodeClick={handleOpenInGraph} />
              ) : (
                <div className={styles.loadingBox ?? ''}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="图谱为空" />
                </div>
              )}
            </div>
          )}
        </main>

        {viewMode === 'workspace' && !rightCollapsed ? (
          <aside className={styles.right ?? ''}>
            <Tabs
              className={styles.rightTabs ?? ''}
              defaultActiveKey="meta"
              items={[
                {
                  key: 'meta',
                  label: '元信息',
                  children: (
                    <NoteMetaPanel note={currentNote} onSaved={handleSaved} />
                  ),
                },
                {
                  key: 'backlinks',
                  label: '反向链接',
                  children: <BacklinksPanel noteId={currentId} onOpenNote={(id) => void openNote(id)} />,
                },
              ]}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
