import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Dropdown, Empty, Input, Modal, Segmented, Spin, Tooltip, Tree, message } from 'antd';
import type { MenuProps } from 'antd';
import type { DataNode, TreeProps } from 'antd/es/tree';
import {
  AppstoreOutlined,
  CheckOutlined,
  DeleteOutlined,
  DownOutlined,
  FileOutlined,
  FolderOutlined,
  LoadingOutlined,
  MoreOutlined,
  PushpinOutlined,
  SearchOutlined,
  TagsOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { deleteNote, listAllNotes, listNoteTags, moveNote, updateNote } from '@/api/notes';
import type { Note, TagCount } from '@/types/note';
import styles from './NoteSidebar.module.css';

interface NoteSidebarProps {
  currentId: string | null;
  collapsed: boolean;
  onOpenNote: (noteId: string) => void;
  onCreate: () => void;
  /** 上报全量可见笔记，供元信息面板构建父笔记下拉 */
  onNotesLoaded: (notes: Note[]) => void;
  /** 外部触发的刷新信号；变化即重新拉取列表 */
  refreshKey: number;
}

interface SidebarTreeNode extends DataNode {
  note: Note;
  children: SidebarTreeNode[];
}

type ViewMode = 'tree' | 'flat';

const SEARCH_DEBOUNCE_MS = 300;

function buildTree(notes: Note[]): SidebarTreeNode[] {
  const map = new Map<string, SidebarTreeNode>();
  const roots: SidebarTreeNode[] = [];

  for (const note of notes) {
    map.set(note.id, { key: note.id, note, children: [] });
  }

  for (const note of notes) {
    const node = map.get(note.id);
    if (!node) continue;
    const parent = note.parent_id ? map.get(note.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortNodes = (nodes: SidebarTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.note.is_pinned !== b.note.is_pinned) return a.note.is_pinned ? -1 : 1;
      return new Date(b.note.updated_at).getTime() - new Date(a.note.updated_at).getTime();
    });
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);
  return roots;
}

function hasChild(notes: Note[], id: string): boolean {
  return notes.some((note) => note.parent_id === id);
}

/** 递归过滤：命中自身或命中子树即保留（保留父链路） */
function filterTree(nodes: SidebarTreeNode[], keyword: string): SidebarTreeNode[] {
  const lower = keyword.toLowerCase();
  const result: SidebarTreeNode[] = [];
  for (const node of nodes) {
    const matchedChildren = node.children.length ? filterTree(node.children, keyword) : [];
    const note = node.note;
    const selfMatch =
      note.title.toLowerCase().includes(lower) ||
      (note.plain_text ?? note.content ?? '').toLowerCase().includes(lower) ||
      (note.category ?? '').toLowerCase().includes(lower) ||
      (note.tags ?? []).some((tag) => tag.toLowerCase().includes(lower));
    if (selfMatch || matchedChildren.length > 0) {
      result.push({
        ...node,
        children: matchedChildren.length > 0 ? matchedChildren : node.children,
      });
    }
  }
  return result;
}

export default function NoteSidebar({
  currentId,
  collapsed,
  onOpenNote,
  onCreate,
  onNotesLoaded,
  refreshKey,
}: NoteSidebarProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [tagCounts, setTagCounts] = useState<TagCount[]>([]);
  const autoExpanded = useRef(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAllNotes();
      if (res.code === 0) {
        const items = res.data.items;
        setNotes(items);
        onNotesLoaded(items);
      } else {
        message.error('获取笔记列表失败');
      }
    } catch {
      message.error('获取笔记列表失败');
    } finally {
      setLoading(false);
    }
  }, [onNotesLoaded]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes, refreshKey]);

  useEffect(() => {
    if (autoExpanded.current || notes.length === 0) return;
    autoExpanded.current = true;
    setExpandedKeys(notes.map((note) => note.id));
  }, [notes]);

  useEffect(() => {
    listNoteTags()
      .then((res) => {
        if (res.code === 0) setTagCounts(res.data ?? []);
      })
      .catch(() => undefined);
  }, []);

  // 搜索走前端过滤：后端 listNotes 不传 parent_id 时只返回根笔记，会破坏树结构
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const note of notes) if (note.category) set.add(note.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [notes]);

  const filtered = useMemo(() => {
    let list = notes;
    if (categoryFilter) list = list.filter((note) => note.category === categoryFilter);
    if (tagFilters.length > 0) {
      list = list.filter((note) => tagFilters.every((tag) => (note.tags ?? []).includes(tag)));
    }
    if (pinnedOnly) list = list.filter((note) => note.is_pinned);
    return list;
  }, [notes, categoryFilter, tagFilters, pinnedOnly]);

  const flatNotes = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [filtered]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);
  const visibleTree = useMemo(() => (search ? filterTree(tree, search) : tree), [search, tree]);

  const handleDelete = useCallback((note: Note) => {
    const childCount = notes.filter((n) => n.parent_id === note.id).length;
    Modal.confirm({
      title: '确认删除',
      content: childCount > 0 ? `删除「${note.title}」会把它的 ${childCount} 篇子笔记提升为根笔记，确定继续吗？` : `确定要删除「${note.title}」吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteNote(note.id);
          if (res.code === 0) {
            message.success('笔记已删除');
            await fetchNotes();
          }
        } catch {
          message.error('删除失败');
        }
      },
    });
  }, [notes, fetchNotes]);

  const handleTogglePin = useCallback(async (note: Note) => {
    try {
      const res = await updateNote(note.id, { is_pinned: !note.is_pinned });
      if (res.code === 0) {
        message.success(note.is_pinned ? '已取消置顶' : '已置顶');
        await fetchNotes();
      }
    } catch {
      message.error('操作失败');
    }
  }, [fetchNotes]);

  /** 树形节点的行内操作菜单：平铺模式一直有置顶/删除，树形模式原先完全没有 */
  const nodeMenu = useCallback(
    (note: Note): MenuProps => ({
      items: [
        {
          key: 'pin',
          icon: <PushpinOutlined />,
          label: note.is_pinned ? '取消置顶' : '置顶',
          onClick: () => void handleTogglePin(note),
        },
        { type: 'divider' },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: '删除',
          danger: true,
          onClick: () => handleDelete(note),
        },
      ],
    }),
    [handleTogglePin, handleDelete],
  );

  // 第二参数只取 length 判断是否文件夹，故放宽为带 length 的结构
  const renderTitle = useCallback((note: Note, children: { length: number }): ReactNode => {
    const isFolder = children.length > 0;
    return (
      <div className={styles.item ?? ''}>
        {isFolder ? <FolderOutlined className={styles.itemIcon ?? ''} /> : <FileOutlined className={styles.itemIcon ?? ''} />}
        {note.is_pinned ? <PushpinOutlined className={styles.pinIcon ?? ''} /> : null}
        <span className={styles.itemTitle ?? ''}>{note.title}</span>
        {note.category ? <span className={styles.categoryTag ?? ''}>{note.category}</span> : null}
        <Dropdown trigger={['hover']} menu={nodeMenu(note)}>
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            className={styles.nodeMore ?? ''}
            aria-label="笔记操作"
            onMouseDown={(event) => event.stopPropagation()}
          />
        </Dropdown>
      </div>
    );
  }, [nodeMenu]);

  const onDrop: TreeProps['onDrop'] = async (info) => {
    const dragKey = String(info.dragNode.key);
    let dropKey: string | null;
    if (info.dropToGap) {
      const dropNote = notes.find((note) => note.id === String(info.node.key));
      dropKey = dropNote?.parent_id ?? null;
    } else {
      dropKey = String(info.node.key);
    }
    if (dropKey === dragKey) return;
    try {
      const res = await moveNote(dragKey, dropKey);
      if (res.code === 0) {
        message.success('已移动');
      } else {
        message.error('移动失败');
      }
    } catch {
      message.error('不能移动到自身或子笔记下');
    }
    await fetchNotes();
  };

  const toggleTag = useCallback((tag: string) => {
    setTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setCategoryFilter(undefined);
    setTagFilters([]);
    setPinnedOnly(false);
  }, []);

  if (collapsed) {
    return (
      <div className={styles.rail ?? ''}>
        <Tooltip title="新建笔记" placement="right">
          <Button type="text" icon={<FileOutlined />} aria-label="新建笔记" onClick={onCreate} />
        </Tooltip>
        {flatNotes.slice(0, 50).map((note) => (
          <Tooltip key={note.id} title={note.title} placement="right">
            <button
              type="button"
              className={note.id === currentId ? styles.railItemActive ?? '' : styles.railItem ?? ''}
              onClick={() => onOpenNote(note.id)}
            >
              {hasChild(notes, note.id) ? <FolderOutlined /> : <FileOutlined />}
            </button>
          </Tooltip>
        ))}
      </div>
    );
  }

  const isFiltering = search !== '' || categoryFilter !== undefined || tagFilters.length > 0 || pinnedOnly;
  const activeFilterCount =
    (categoryFilter !== undefined ? 1 : 0) + tagFilters.length + (pinnedOnly ? 1 : 0);

  // 徽标占位恒定：数量为 0 时也渲染同样的占位，只是不显示，
  // 这样按钮宽度在筛选前后完全一致，右侧的视图切换不会被顶出侧栏
  const countClass =
    activeFilterCount > 0
      ? styles.filterCount ?? ''
      : (styles.filterCount ?? '') + ' ' + (styles.filterCountHidden ?? '');

  // 筛选收进多级菜单：分类、标签各一个子菜单。选中项带勾选图标，
  // 菜单标题回显当前值，按钮带激活数量——状态全部可见，不做无提示的收纳
  const filterItems: NonNullable<MenuProps['items']> = [
    {
      key: 'category',
      icon: <AppstoreOutlined />,
      label: categoryFilter ?? '全部分类',
      children: [
        { key: 'category-all', label: '全部分类', onClick: () => setCategoryFilter(undefined) },
        ...categories.map((category) => ({
          key: `category-${category}`,
          label: category,
          ...(categoryFilter === category ? { icon: <CheckOutlined /> } : {}),
          onClick: () => setCategoryFilter((prev) => (prev === category ? undefined : category)),
        })),
      ],
    },
    {
      key: 'tags',
      icon: <TagsOutlined />,
      label: tagFilters.length > 0 ? `标签（已选 ${tagFilters.length}）` : '标签',
      children: [
        { key: 'tags-clear', label: '清除标签筛选', onClick: () => setTagFilters([]) },
        ...tagCounts.map((item) => ({
          key: `tag-${item.tag}`,
          label: `${item.tag} (${item.count})`,
          ...(tagFilters.includes(item.tag) ? { icon: <CheckOutlined /> } : {}),
          onClick: () => toggleTag(item.tag),
        })),
      ],
    },
    { type: 'divider' },
    {
      key: 'pinned-only',
      icon: <PushpinOutlined />,
      label: pinnedOnly ? '显示全部笔记' : '仅显示置顶',
      onClick: () => setPinnedOnly((prev) => !prev),
    },
  ];
  if (activeFilterCount > 0) {
    filterItems.push(
      { type: 'divider' },
      { key: 'clear-all', label: '清除全部筛选', onClick: clearAllFilters },
    );
  }

  return (
    <div className={styles.sidebar ?? ''}>
      <div className={styles.controls ?? ''}>
        <div className={styles.searchRow ?? ''}>
          <Input
            placeholder="搜索标题、正文、标签"
            prefix={<SearchOutlined />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            variant="filled"
            allowClear
            aria-label="搜索笔记"
          />
        </div>
        <div className={styles.filterRow ?? ''}>
          <Dropdown trigger={['click']} menu={{ items: filterItems }}>
            <Tooltip title="筛选笔记">
              <Button size="small" aria-label="筛选笔记">
                筛选
                <span className={countClass}>{activeFilterCount}</span>
                <DownOutlined className={styles.filterCaret ?? ''} />
              </Button>
            </Tooltip>
          </Dropdown>
          <Segmented
            size="small"
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            options={[
              { label: '树形', value: 'tree', icon: <FolderOutlined /> },
              { label: '平铺', value: 'flat', icon: <UnorderedListOutlined /> },
            ]}
          />
        </div>
      </div>

      {loading && notes.length === 0 ? (
        <div className={styles.emptyBox ?? ''}><Spin indicator={<LoadingOutlined spin />} /></div>
      ) : isFiltering && filtered.length === 0 ? (
        <div className={styles.emptyBox ?? ''}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的笔记" /></div>
      ) : viewMode === 'tree' ? (
        <div className={styles.treeWrap ?? ''}>
          <Tree
            treeData={visibleTree}
            draggable
            blockNode
            showLine={{ showLeafIcon: false }}
            onDrop={onDrop}
            selectedKeys={currentId ? [currentId] : []}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys.map(String))}
            onSelect={(keys) => {
              const first = keys[0];
              if (first) onOpenNote(String(first));
            }}
            titleRender={(data) => {
              const node = data as SidebarTreeNode;
              return renderTitle(node.note, node.children);
            }}
          />
        </div>
      ) : (
        <div className={styles.flatList ?? ''}>
          {flatNotes.map((note) => {
            const isActive = note.id === currentId;
            const itemClass = isActive ? styles.flatItemActive ?? '' : styles.flatItem ?? '';
            return (
              <div key={note.id} className={itemClass}>
                <button type="button" className={styles.flatItemBody ?? ''} onClick={() => onOpenNote(note.id)}>
                  {hasChild(notes, note.id) ? <FolderOutlined className={styles.itemIcon ?? ''} /> : <FileOutlined className={styles.itemIcon ?? ''} />}
                  {note.is_pinned ? <PushpinOutlined className={styles.pinIcon ?? ''} /> : null}
                  <span className={styles.itemTitle ?? ''}>{note.title}</span>
                  {note.category ? <span className={styles.categoryTag ?? ''}>{note.category}</span> : null}
                </button>
                <div className={styles.rowActions ?? ''}>
                  <Tooltip title={note.is_pinned ? '取消置顶' : '置顶'}>
                    <Button type="text" size="small" icon={<PushpinOutlined />} aria-label="切换置顶" onClick={() => void handleTogglePin(note)} />
                  </Tooltip>
                  <Tooltip title="删除">
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="删除" onClick={() => handleDelete(note)} />
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}