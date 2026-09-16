import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Segmented, Space, Spin, Tabs, Tooltip, Typography, message } from 'antd';
import {
  AppstoreOutlined,
  FileAddOutlined,
  LoadingOutlined,
  ShareAltOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
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

/**
 * 笔记工作台：左侧栏 + 中间编辑/图谱 + 右侧面板的三栏布局。
 *
 * 搜索框放在侧栏而非顶部工具条——它与结果同屏更顺手，功能与计划一致，
 * 仅位置调整，工具条保留新建、视图切换、图谱范围、右侧面板开关。
 */
export default function NoteWorkspace() {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('workspace');
  const [graphScope, setGraphScope] = useState<GraphScope>('global');
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const bumpRefresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const handleNotesLoaded = useCallback((notes: Note[]) => {
    setAllNotes(notes);
  }, []);

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
        setLeftCollapsed(false);
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
    setAllNotes((prev) => {
      const index = prev.findIndex((item) => item.id === note.id);
      if (index === -1) return [note, ...prev];
      const next = [...prev];
      next[index] = note;
      return next;
    });
    // 标题与正文变更会影响侧栏排序、分类筛选与标签聚合，故同步刷新
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

  const handleSelectView = useCallback((value: ViewMode) => {
    setViewMode(value);
  }, []);

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>笔记知识库</Title>
        <Space size={8}>
          {viewMode === 'graph' ? (
            <Segmented
              size="small"
              value={graphScope}
              onChange={(value) => setGraphScope(value as GraphScope)}
              options={[
                { label: '全局图谱', value: 'global' },
                { label: '局部图谱', value: 'local', disabled: !currentId },
              ]}
            />
          ) : null}
          <Segmented
            size="small"
            value={viewMode}
            onChange={(value) => handleSelectView(value as ViewMode)}
            options={[
              { label: '工作台', value: 'workspace', icon: <AppstoreOutlined /> },
              { label: '图谱', value: 'graph', icon: <ShareAltOutlined /> },
            ]}
          />
          <Tooltip title={leftCollapsed ? '展开笔记列表' : '折叠笔记列表'}>
            <Button
              type="text"
              icon={leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              aria-label="折叠或展开笔记列表"
              onClick={() => setLeftCollapsed((prev) => !prev)}
            />
          </Tooltip>
          {viewMode === 'workspace' ? (
            <Tooltip title={rightCollapsed ? '展开右侧面板' : '折叠右侧面板'}>
              <Button
                type="text"
                icon={rightCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                aria-label="折叠或展开右侧面板"
                onClick={() => setRightCollapsed((prev) => !prev)}
              />
            </Tooltip>
          ) : null}
          <Button type="primary" icon={<FileAddOutlined />} onClick={() => void handleCreate()}>
            新建笔记
          </Button>
        </Space>
      </div>

      <div className={styles.columns ?? ''}>
        <aside className={leftCollapsed ? styles.leftCollapsed ?? '' : styles.left ?? ''}>
          <NoteSidebar
            currentId={currentId}
            collapsed={leftCollapsed}
            onOpenNote={(id) => void openNote(id)}
            onCreate={() => void handleCreate()}
            onNotesLoaded={handleNotesLoaded}
            refreshKey={refreshKey}
          />
        </aside>

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
              {graphLoading ? (
                <div className={styles.loadingBox ?? ''}><Spin indicator={<LoadingOutlined spin />} /></div>
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
              size="small"
              items={[
                {
                  key: 'meta',
                  label: '元信息',
                  children: (
                    <NoteMetaPanel
                      note={currentNote}
                      allNotes={allNotes}
                      onOpenNote={(id) => void openNote(id)}
                      onSaved={handleSaved}
                    />
                  ),
                },
                {
                  key: 'backlinks',
                  label: '反向链接',
                  children: <BacklinksPanel noteId={currentId} onOpenNote={(id) => void openNote(id)} />
                },
              ]}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}