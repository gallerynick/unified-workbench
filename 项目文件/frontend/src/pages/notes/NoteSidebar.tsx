import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Dropdown, Empty, Input, Modal, Spin, Tooltip, message } from 'antd';
import type { MenuProps } from 'antd';
import {
  CheckOutlined,
  CompressOutlined,
  DeleteOutlined,
  EditOutlined,
  ExpandOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  LoadingOutlined,
  MoreOutlined,
  PushpinOutlined,
  SearchOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import {
  createFolder,
  deleteFolder,
  deleteNote,
  listAllNotes,
  listFolders,
  listNotes,
  updateFolder,
  updateNote,
} from '@/api/notes';
import type { Note, NoteFolder } from '@/types/note';
import styles from './NoteSidebar.module.css';

interface NoteSidebarProps {
  currentId: string | null;
  onOpenNote: (noteId: string) => void;
  /** 外部触发的刷新信号；变化即重新拉取笔记与文件夹 */
  refreshKey: number;
}

type SortField = 'name' | 'updated_at' | 'created_at';
type SortDir = 'asc' | 'desc';

interface SortKey {
  field: SortField;
  dir: SortDir;
}

interface SortOption {
  key: string;
  field: SortField;
  dir: SortDir;
  label: string;
}

/** 排序选项：文件夹与笔记共用同一套规则 */
const SORT_OPTIONS: SortOption[] = [
  { key: 'name-asc', field: 'name', dir: 'asc', label: '名称 A → Z' },
  { key: 'name-desc', field: 'name', dir: 'desc', label: '名称 Z → A' },
  { key: 'updated-desc', field: 'updated_at', dir: 'desc', label: '更新时间 新 → 旧' },
  { key: 'updated-asc', field: 'updated_at', dir: 'asc', label: '更新时间 旧 → 新' },
  { key: 'created-desc', field: 'created_at', dir: 'desc', label: '创建时间 新 → 旧' },
  { key: 'created-asc', field: 'created_at', dir: 'asc', label: '创建时间 旧 → 新' },
];

const DEFAULT_SORT: SortKey = { field: 'updated_at', dir: 'desc' };

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_PAGE_SIZE = 500;

/** 可排序的统一条目信息：文件夹与笔记共用同一套比较键 */
interface SortableItem {
  name: string;
  created_at: string;
  updated_at: string;
  /** 文件夹的手动排序值；笔记恒为 0，同键时作为兜底 */
  sort_order: number;
}

function compareItems(a: SortableItem, b: SortableItem, sort: SortKey): number {
  let diff: number;
  if (sort.field === 'name') {
    diff = a.name.localeCompare(b.name, 'zh-CN');
  } else {
    diff = new Date(a[sort.field]).getTime() - new Date(b[sort.field]).getTime();
  }
  if (diff === 0 && a.sort_order !== b.sort_order) diff = a.sort_order - b.sort_order;
  return sort.dir === 'asc' ? diff : -diff;
}

function noteSortable(note: Note): SortableItem {
  return {
    name: note.title,
    created_at: note.created_at,
    updated_at: note.updated_at,
    sort_order: 0,
  };
}

function folderSortable(folder: NoteFolder): SortableItem {
  return {
    name: folder.name,
    created_at: folder.created_at,
    updated_at: folder.updated_at,
    sort_order: folder.sort_order,
  };
}

/** 置顶恒在分组内最上，其余按当前排序规则 */
function compareNotes(a: Note, b: Note, sort: SortKey): number {
  if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
  return compareItems(noteSortable(a), noteSortable(b), sort);
}

/** 侧栏顶级条目：文件夹与顶级笔记混排 */
interface FolderItem {
  kind: 'folder';
  folder: NoteFolder;
  children: Note[];
}

interface NoteItem {
  kind: 'note';
  note: Note;
}

type SidebarItem = FolderItem | NoteItem;

function toSortable(item: SidebarItem): SortableItem {
  return item.kind === 'folder' ? folderSortable(item.folder) : noteSortable(item.note);
}

function compareTopLevel(a: SidebarItem, b: SidebarItem, sort: SortKey): number {
  const aPinned = a.kind === 'note' && a.note.is_pinned;
  const bPinned = b.kind === 'note' && b.note.is_pinned;
  if (aPinned !== bPinned) return aPinned ? -1 : 1;
  return compareItems(toSortable(a), toSortable(b), sort);
}

export default function NoteSidebar({
  currentId,
  onOpenNote,
  refreshKey,
}: NoteSidebarProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [searching, setSearching] = useState(false);

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<NoteFolder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderDesc, setFolderDesc] = useState('');
  const [folderSaving, setFolderSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [notesRes, foldersRes] = await Promise.all([listAllNotes(), listFolders()]);
      if (notesRes.code === 0) {
        setNotes(notesRes.data.items);
      } else {
        message.error('获取笔记列表失败');
      }
      if (foldersRes.code === 0) {
        setFolders(foldersRes.data.items);
      } else {
        message.error('获取文件夹失败');
      }
    } catch {
      message.error('获取笔记列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll, refreshKey]);

  // 搜索输入防抖
  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, searchOpen]);

  // 搜索走后端：文件夹名称与简介也参与命中
  useEffect(() => {
    if (!searchOpen || searchQuery === '') {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    listNotes({ search: searchQuery, page_size: SEARCH_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        if (res.code === 0) setSearchResults(res.data.items);
        else message.error('搜索失败');
      })
      .catch(() => {
        if (!cancelled) message.error('搜索失败');
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [searchQuery, searchOpen]);

  const handleToggleSearch = useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) {
        setSearchInput('');
        return false;
      }
      return true;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (allExpanded) {
      setExpanded(new Set());
      setAllExpanded(false);
    } else {
      setExpanded(new Set(folders.map((folder) => folder.id)));
      setAllExpanded(true);
    }
  }, [allExpanded, folders]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const items = useMemo<SidebarItem[]>(() => {
    const childrenByFolder = new Map<string, Note[]>();
    for (const folder of folders) childrenByFolder.set(folder.id, []);
    const independents: Note[] = [];
    for (const note of notes) {
      let placed = false;
      for (const folder of note.folders) {
        const bucket = childrenByFolder.get(folder.id);
        if (bucket) {
          bucket.push(note);
          placed = true;
        }
      }
      if (!placed) independents.push(note);
    }
    const folderItems: FolderItem[] = folders.map((folder) => ({
      kind: 'folder',
      folder,
      children: childrenByFolder.get(folder.id) ?? [],
    }));
    const noteItems: NoteItem[] = independents.map((note) => ({ kind: 'note', note }));
    return [...folderItems, ...noteItems].sort((a, b) => compareTopLevel(a, b, sort));
  }, [notes, folders, sort]);

  const pinnedNotes = useMemo(
    () => notes.filter((note) => note.is_pinned).sort((a, b) => compareNotes(a, b, sort)),
    [notes, sort],
  );

  const sortedChildren = useCallback(
    (children: Note[]): Note[] => [...children].sort((a, b) => compareNotes(a, b, sort)),
    [sort],
  );

  const noteMenu = useCallback(
    (note: Note): MenuProps => ({
      items: [
        {
          key: 'pin',
          icon: <PushpinOutlined />,
          label: note.is_pinned ? '取消置顶' : '置顶',
          onClick: () => {
            void updateNote(note.id, { is_pinned: !note.is_pinned }).then((res) => {
              if (res.code === 0) {
                message.success(note.is_pinned ? '已取消置顶' : '已置顶');
                void fetchAll();
              } else {
                message.error('操作失败');
              }
            });
          },
        },
        { type: 'divider' },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: '删除',
          danger: true,
          onClick: () => {
            Modal.confirm({
              title: '确认删除',
              content: `确定要删除「${note.title}」吗？`,
              okText: '删除',
              okButtonProps: { danger: true },
              cancelText: '取消',
              onOk: async () => {
                try {
                  const res = await deleteNote(note.id);
                  if (res.code === 0) {
                    message.success('笔记已删除');
                    await fetchAll();
                  } else {
                    message.error('删除失败');
                  }
                } catch {
                  message.error('删除失败');
                }
              },
            });
          },
        },
      ],
    }),
    [fetchAll],
  );

  const sortMenu: MenuProps = {
    items: SORT_OPTIONS.map((option) => ({
      key: option.key,
      label: option.label,
      icon: sort.field === option.field && sort.dir === option.dir ? <CheckOutlined /> : null,
      onClick: () => setSort({ field: option.field, dir: option.dir }),
    })),
  };

  const openCreateFolder = useCallback(() => {
    setEditingFolder(null);
    setFolderName('');
    setFolderDesc('');
    setFolderModalOpen(true);
  }, []);

  const openEditFolder = useCallback((folder: NoteFolder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderDesc(folder.description ?? '');
    setFolderModalOpen(true);
  }, []);

  const handleFolderSave = useCallback(async () => {
    const name = folderName.trim();
    if (name.length === 0 || name.length > 100) {
      message.error('文件夹名称需为 1-100 字');
      return;
    }
    setFolderSaving(true);
    try {
      const description = folderDesc.trim();
      const res = editingFolder
        ? await updateFolder(editingFolder.id, { name, description })
        : await createFolder({ name, description });
      if (res.code === 0) {
        message.success(editingFolder ? '文件夹已更新' : '文件夹已创建');
        setFolderModalOpen(false);
        await fetchAll();
      } else {
        message.error('保存失败');
      }
    } catch {
      message.error('保存失败');
    } finally {
      setFolderSaving(false);
    }
  }, [folderName, folderDesc, editingFolder, fetchAll]);

  const handleDeleteFolder = useCallback(
    (folder: NoteFolder) => {
      Modal.confirm({
        title: '确认删除文件夹',
        content: `删除「${folder.name}」后，其下的 ${folder.note_count} 篇笔记不会受影响，只会移出该文件夹。`,
        okText: '删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          try {
            const res = await deleteFolder(folder.id);
            if (res.code === 0) {
              message.success('文件夹已删除');
              setExpanded((prev) => {
                const next = new Set(prev);
                next.delete(folder.id);
                return next;
              });
              await fetchAll();
            } else {
              message.error('删除失败');
            }
          } catch {
            message.error('删除失败');
          }
        },
      });
    },
    [fetchAll],
  );

  const noteRow = useCallback(
    (note: Note, depth: number): ReactNode => {
      const active = note.id === currentId;
      const rowClass = [styles.noteRow ?? '', active ? styles.noteRowActive ?? '' : '', styles.depth0 ?? ''];
      return (
        <div key={note.id} className={rowClass.join(' ')}>
          <span className={styles.indent} style={{ width: depth * 16 }} />
          <FileOutlined className={styles.noteIcon ?? ''} />
          {note.is_pinned ? <PushpinOutlined className={styles.pinIcon ?? ''} /> : null}
          <button
            type="button"
            className={styles.noteTitle ?? ''}
            onClick={(event) => {
              event.stopPropagation();
              onOpenNote(note.id);
            }}
          >
            {note.title}
          </button>
          <Dropdown trigger={['hover']} menu={noteMenu(note)}>
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              className={styles.noteMore ?? ''}
              aria-label="笔记操作"
              onMouseDown={(event) => event.stopPropagation()}
            />
          </Dropdown>
        </div>
      );
    },
    [currentId, noteMenu, onOpenNote],
  );

  const renderItem = useCallback(
    (item: SidebarItem): ReactNode => {
      if (item.kind === 'note') return noteRow(item.note, 0);
      const folder = item.folder;
      const isExpanded = expanded.has(folder.id);
      const hasChildren = item.children.length > 0;
      const rowClass = [styles.folderRow ?? '', isExpanded ? styles.folderRowOpen ?? '' : ''];
      return (
        <div key={folder.id}>
          <div className={rowClass.join(' ')}>
            <Button
              type="text"
              size="small"
              className={styles.folderArrow ?? ''}
              aria-label={isExpanded ? '收起文件夹' : '展开文件夹'}
              icon={
                isExpanded
                  ? <CompressOutlined />
                  : <ExpandOutlined />
              }
              disabled={!hasChildren}
              onClick={() => toggleFolder(folder.id)}
            />
            {isExpanded ? (
              <FolderOpenOutlined className={styles.folderIcon ?? ''} />
            ) : (
              <FolderOutlined className={styles.folderIcon ?? ''} />
            )}
            <button
              type="button"
              className={styles.folderName ?? ''}
              onClick={() => {
                if (hasChildren) toggleFolder(folder.id);
              }}
            >
              {folder.name}
            </button>
            <span className={styles.folderCount ?? ''}>{folder.note_count}</span>
            <Dropdown
              trigger={['hover']}
              menu={{
                items: [
                  {
                    key: 'edit',
                    icon: <EditOutlined />,
                    label: '重命名 / 编辑简介',
                    onClick: () => openEditFolder(folder),
                  },
                  { type: 'divider' },
                  {
                    key: 'delete',
                    icon: <DeleteOutlined />,
                    label: '删除文件夹',
                    danger: true,
                    onClick: () => handleDeleteFolder(folder),
                  },
                ],
              }}
            >
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                className={styles.noteMore ?? ''}
                aria-label="文件夹操作"
                onMouseDown={(event) => event.stopPropagation()}
              />
            </Dropdown>
          </div>
          {isExpanded && hasChildren ? (
            <div className={styles.children ?? ''}>
              {sortedChildren(item.children).map((note) => noteRow(note, 1))}
            </div>
          ) : null}
        </div>
      );
    },
    [expanded, handleDeleteFolder, noteRow, openEditFolder, sortedChildren, toggleFolder],
  );

  const searchingActive = searchOpen && searchQuery !== '';

  return (
    <div className={styles.sidebar ?? ''}>
      <div className={styles.controls ?? ''}>
        <div className={styles.toolbar ?? ''}>
          <Tooltip title={searchOpen ? '关闭搜索' : '搜索笔记'}>
            <Button
              type={searchOpen ? 'primary' : 'text'}
              size="small"
              icon={<SearchOutlined />}
              aria-label="搜索笔记"
              aria-pressed={searchOpen}
              onClick={() => handleToggleSearch()}
            />
          </Tooltip>
          <Tooltip title={allExpanded ? '全部收起' : '全部展开'}>
            <Button
              type="text"
              size="small"
              icon={allExpanded ? <CompressOutlined /> : <ExpandOutlined />}
              aria-label={allExpanded ? '全部收起' : '全部展开'}
              disabled={folders.length === 0}
              onClick={() => handleToggleAll()}
            />
          </Tooltip>
          <Dropdown trigger={['click']} menu={sortMenu}>
            <Tooltip title="排序方式">
              <Button
                type="text"
                size="small"
                icon={<SortAscendingOutlined />}
                aria-label="排序方式"
              />
            </Tooltip>
          </Dropdown>
          <span className={styles.toolbarGap} />
          <Tooltip title="新建文件夹">
            <Button
              type="text"
              size="small"
              icon={<FolderAddOutlined />}
              aria-label="新建文件夹"
              onClick={() => openCreateFolder()}
            />
          </Tooltip>
        </div>
        {searchOpen ? (
          <div className={styles.searchRow ?? ''}>
            <Input
              autoFocus
              placeholder="搜索标题、正文、标签、文件夹"
              prefix={<SearchOutlined />}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              variant="filled"
              allowClear
              aria-label="搜索笔记"
            />
          </div>
        ) : null}
      </div>

      {loading && notes.length === 0 ? (
        <div className={styles.emptyBox ?? ''}>
          <Spin indicator={<LoadingOutlined spin />} />
        </div>
      ) : searchingActive ? (
        <div className={styles.list ?? ''}>
          {searching && searchResults.length === 0 ? (
            <div className={styles.emptyBox ?? ''}>
              <Spin indicator={<LoadingOutlined spin />} />
            </div>
          ) : searchResults.length === 0 ? (
            <div className={styles.emptyBox ?? ''}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的结果" />
            </div>
          ) : (
            searchResults.map((note) => noteRow(note, 0))
          )}
        </div>
      ) : (
        <div className={styles.list ?? ''}>
          {pinnedNotes.length > 0 ? (
            <div>
              <div className={styles.groupLabel ?? ''}>置顶</div>
              <div className={styles.pinnedArea ?? ''}>
                {pinnedNotes.map((note) => {
                  const active = note.id === currentId;
                  return (
                    <button
                      key={note.id}
                      type="button"
                      className={active ? styles.pinnedItemActive ?? '' : styles.pinnedItem ?? ''}
                      onClick={() => onOpenNote(note.id)}
                    >
                      <PushpinOutlined className={styles.pinnedIcon ?? ''} />
                      <span className={styles.pinnedTitle ?? ''}>{note.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {items.length === 0 ? (
            <div className={styles.emptyBox ?? ''}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="还没有笔记或文件夹"
              />
            </div>
          ) : (
            items.map((item) => renderItem(item))
          )}
        </div>
      )}

      <Modal
        open={folderModalOpen}
        title={editingFolder ? '编辑文件夹' : '新建文件夹'}
        okText="保存"
        cancelText="取消"
        confirmLoading={folderSaving}
        onOk={() => void handleFolderSave()}
        onCancel={() => setFolderModalOpen(false)}
        destroyOnClose
      >
        <div className={styles.folderForm ?? ''}>
          <label className={styles.formLabel ?? ''} htmlFor="note-folder-name">名称</label>
          <Input
            id="note-folder-name"
            value={folderName}
            maxLength={100}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="如：项目、决策、随手记"
            autoFocus
          />
          <label className={styles.formLabel ?? ''} htmlFor="note-folder-desc">简介</label>
          <Input.TextArea
            id="note-folder-desc"
            value={folderDesc}
            rows={3}
            onChange={(event) => setFolderDesc(event.target.value)}
            placeholder="可选，说明这个文件夹放什么"
          />
        </div>
      </Modal>
    </div>
  );
}
