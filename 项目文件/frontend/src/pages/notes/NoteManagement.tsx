import { useState, useEffect, useCallback, useMemo } from 'react';
import { Tree, Button, Typography, Modal, message, Space, Input, Tag, Tooltip, TreeSelect, Switch, Segmented, Form } from 'antd';
import { PlusOutlined, DeleteOutlined, PushpinOutlined, SearchOutlined, EditOutlined, FileOutlined, FolderOutlined, ApartmentOutlined, ShareAltOutlined } from '@ant-design/icons';
import type { DataNode, TreeProps } from 'antd/es/tree';
import { listAllNotes, createNote, updateNote, deleteNote, moveNote } from '../../api/notes';
import type { Note } from '../../types/note';
import { useTheme } from '../../contexts/ThemeContext';
import GraphView from './GraphView';
import styles from './NoteManagement.module.css';

const { Title } = Typography;

interface TreeNodeData extends DataNode {
  note: Note;
  children?: TreeNodeData[];
}

function buildTree(notes: Note[]): TreeNodeData[] {
  const map = new Map<string, TreeNodeData>();
  const roots: TreeNodeData[] = [];

  // First pass: create all nodes
  notes.forEach((note) => {
    map.set(note.id, {
      key: note.id,
      note,
      title: '', // will be set in second pass
      children: [],
    });
  });

  // Second pass: build hierarchy
  notes.forEach((note) => {
    const node = map.get(note.id)!;
    if (note.parent_id && map.has(note.parent_id)) {
      const parent = map.get(note.parent_id)!;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort: pinned first, then by updated_at desc
  const sortNodes = (nodes: TreeNodeData[]) => {
    nodes.sort((a, b) => {
      if (a.note.is_pinned !== b.note.is_pinned) return a.note.is_pinned ? -1 : 1;
      return new Date(b.note.updated_at).getTime() - new Date(a.note.updated_at).getTime();
    });
    nodes.forEach((n) => { if (n.children) sortNodes(n.children); });
  };
  sortNodes(roots);

  return roots;
}

function renderTreeTitle(node: TreeNodeData, onPin: (note: Note) => void, onEdit: (note: Note) => void, onDelete: (note: Note) => void): React.ReactNode {
  const { note } = node;
  const hasChildren = node.children && node.children.length > 0;
  return (
    <span className={styles.treeNode}>
      <span className={styles.treeNodeTitle}>
        {hasChildren ? <FolderOutlined style={{ marginRight: 8, color: 'var(--tree-icon-folder, #64748b)' }} /> : <FileOutlined style={{ marginRight: 8, color: 'var(--tree-icon-file, #94a3b8)' }} />}
        {note.is_pinned && <PushpinOutlined style={{ marginRight: 4, color: '#f59e0b', fontSize: 12 }} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</span>
        {note.category && <Tag style={{ marginLeft: 8, fontSize: 12, lineHeight: '18px', padding: '0 6px', borderRadius: 3, color: 'var(--tree-tag-text, #64748b)', background: 'transparent', border: '1px solid var(--tree-border, #e2e8f0)' }}>{note.category}</Tag>}
      </span>
      <span className={styles.treeNodeActions}>
        <Tooltip title={note.is_pinned ? '取消置顶' : '置顶'}>
          <Button type="text" size="small" icon={<PushpinOutlined style={{ fontSize: 13 }} />} onClick={(e) => { e.stopPropagation(); onPin(note); }} />
        </Tooltip>
        <Tooltip title="编辑">
          <Button type="text" size="small" icon={<EditOutlined style={{ fontSize: 13 }} />} onClick={(e) => { e.stopPropagation(); onEdit(note); }} />
        </Tooltip>
        <Tooltip title="删除">
          <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: 13 }} />} onClick={(e) => { e.stopPropagation(); onDelete(note); }} />
        </Tooltip>
      </span>
    </span>
  );
}

function filterTree(nodes: TreeNodeData[], search: string): TreeNodeData[] {
  const lower = search.toLowerCase();
  const result: TreeNodeData[] = [];
  nodes.forEach((node) => {
    const matchedChildren = node.children ? filterTree(node.children, search) : [];
    const selfMatch = node.note.title.toLowerCase().includes(lower) ||
      (node.note.content?.toLowerCase().includes(lower) ?? false) ||
      (node.note.category?.toLowerCase().includes(lower) ?? false);
    if (selfMatch || matchedChildren.length > 0) {
      const newNode: TreeNodeData = { ...node };
      if (matchedChildren.length > 0) newNode.children = matchedChildren;
      else delete (newNode as TreeNodeData & { children?: unknown }).children;
      result.push(newNode);
    }
  });
  return result;
}

function collectAllNodes(nodes: TreeNodeData[]): TreeNodeData[] {
  const result: TreeNodeData[] = [];
  nodes.forEach((n) => {
    result.push(n);
    if (n.children) result.push(...collectAllNodes(n.children));
  });
  return result;
}

export default function NoteManagement() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'graph'>('tree');
  const { isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [form] = Form.useForm();
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [formPinned, setFormPinned] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAllNotes();
      if (res.code === 0) setNotes(res.data.items);
    } catch { message.error('获取笔记列表失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const openCreateModal = useCallback(() => {
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('');
    setFormParentId(null);
    setFormPinned(false);
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((note: Note) => {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content || '');
    setFormCategory(note.category || '');
    setFormParentId(note.parent_id);
    setFormPinned(note.is_pinned);
    setSelectedKeys([note.id]);
    setModalVisible(true);
  }, []);

  const handleDelete = useCallback((note: Note) => {
    const hasChildren = notes.some((n) => n.parent_id === note.id);
    Modal.confirm({
      title: '确认删除',
      content: hasChildren
        ? `确定要删除笔记「${note.title}」吗？其子笔记将变为根笔记。`
        : `确定要删除笔记「${note.title}」吗？`,
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteNote(note.id);
          if (res.code === 0) { message.success('笔记已删除'); fetchNotes(); }
        } catch { message.error('删除失败'); }
      },
    });
  }, [notes, fetchNotes]);

  const handleTogglePin = useCallback(async (note: Note) => {
    try {
      const res = await updateNote(note.id, { is_pinned: !note.is_pinned });
      if (res.code === 0) { message.success(note.is_pinned ? '已取消置顶' : '已置顶'); fetchNotes(); }
    } catch { message.error('操作失败'); }
  }, [fetchNotes]);

  const treeData = useMemo(() => {
    const tree = buildTree(notes);
    const allNodes = collectAllNodes(tree);
    const pinHandler = (note: Note) => handleTogglePin(note);
    const editHandler = (note: Note) => openEditModal(note);
    const deleteHandler = (note: Note) => handleDelete(note);
    allNodes.forEach((n) => { n.title = renderTreeTitle(n, pinHandler, editHandler, deleteHandler); });
    return search ? filterTree(tree, search) : tree;
  }, [notes, search, handleTogglePin, openEditModal, handleDelete]);

  const treeSelectData = useMemo(() => {
    const tree = buildTree(notes);
    type SelectNode = { value: string; title: string; children: SelectNode[]; selectable: boolean };
    const buildSelectNodes = (nodes: TreeNodeData[]): SelectNode[] =>
      nodes.map((n) => {
        const node: SelectNode = {
          value: n.key as string,
          title: n.note.title,
          children: [],
          selectable: !editingNote || n.key !== editingNote.id,
        };
        if (n.children) node.children = buildSelectNodes(n.children);
        return node;
      });
    return buildSelectNodes(tree);
  }, [notes, editingNote]);

  const handleCreate = async () => {
    if (!formTitle.trim()) { message.warning('请输入笔记标题'); return; }
    try {
      const payload = {
        title: formTitle,
        content: formContent || undefined,
        category: formCategory || undefined,
        parent_id: formParentId,
        is_pinned: formPinned,
      };
      const res = await createNote(payload);
      if (res.code === 0) { message.success('笔记已创建'); setModalVisible(false); setSelectedKeys([]); fetchNotes(); }
    } catch { message.error('创建失败'); }
  };

  const handleUpdate = async () => {
    if (!editingNote) return;
    if (!formTitle.trim()) { message.warning('请输入笔记标题'); return; }
    try {
      const payload = {
        title: formTitle,
        content: formContent || undefined,
        category: formCategory || undefined,
        parent_id: formParentId,
        is_pinned: formPinned,
      };
      const res = await updateNote(editingNote.id, payload);
      if (res.code === 0) { message.success('笔记已更新'); setModalVisible(false); setSelectedKeys([]); fetchNotes(); }
    } catch { message.error('更新失败'); }
  };

  const onDrop: TreeProps['onDrop'] = async (info) => {
    const dragKey = info.dragNode.key as string;
    let dropKey: string | null;
    if (info.dropToGap) {
      const dropNoteId = info.node.key as string;
      const dropNote = notes.find((n) => n.id === dropNoteId);
      dropKey = dropNote?.parent_id ?? null;
    } else {
      dropKey = info.node.key as string;
    }
    try {
      const res = await moveNote(dragKey, dropKey);
      if (res.code === 0) {
        message.success('移动成功');
        fetchNotes();
      } else {
        message.error('移动失败');
        fetchNotes();
      }
    } catch {
      message.error('移动失败: 不能移动到子节点下');
      fetchNotes();
    }
  };

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>笔记知识库</Title>
        <Space>
          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as 'tree' | 'graph')}
            options={[
              { label: '树形浏览', value: 'tree', icon: <ApartmentOutlined /> },
              { label: '图形视图', value: 'graph', icon: <ShareAltOutlined /> },
            ]}
          />
          <Input placeholder="搜索笔记" prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} allowClear value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} variant="filled" />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新建笔记</Button>
        </Space>
      </div>

      {notes.length === 0 && !loading ? (
        <div className={styles.emptyState}>
          <FileOutlined style={{ fontSize: 40, marginBottom: 12, color: 'var(--tree-empty-color, #94a3b8)' }} />
          <div>还没有笔记，点击「新建笔记」创建一个吧</div>
        </div>
      ) : viewMode === 'tree' ? (
        <Tree
          treeData={treeData}
          draggable
          blockNode
          showLine={{ showLeafIcon: false }}
          onDrop={onDrop}
          selectedKeys={selectedKeys}
          className={styles.noteTree ?? ''}
        />
      ) : (
        <div style={{ height: 'calc(100vh - 220px)', minHeight: 400 }}>
          <GraphView
            notes={notes}
            onNodeClick={openEditModal}
            isDark={isDark}
            search={search}
          />
        </div>
      )}

      <Modal
        title={editingNote ? '编辑笔记' : '新建笔记'}
        open={modalVisible}
        onOk={editingNote ? handleUpdate : handleCreate}
        onCancel={() => { setModalVisible(false); setSelectedKeys([]); form.resetFields(); }}
        okText={editingNote ? '保存' : '创建'}
        cancelText="取消"
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="笔记标题" required>
            <Input placeholder="请输入笔记标题" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} variant="filled" size="large" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item label="分类">
              <Input placeholder="请输入分类" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} variant="filled" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item label="父笔记">
              <TreeSelect
                placeholder="选择父笔记（可选）"
                style={{ width: 200 }}
                value={formParentId}
                onChange={setFormParentId}
                treeData={treeSelectData}
                allowClear
                treeDefaultExpandAll
              />
            </Form.Item>
          </Space>
          <Form.Item label="置顶">
            <Switch checked={formPinned} onChange={setFormPinned} checkedChildren="置顶" unCheckedChildren="普通" size="small" />
          </Form.Item>
          <Form.Item label="笔记内容">
            <Input.TextArea placeholder="请输入笔记内容" value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={8} variant="filled" style={{ fontSize: 14, lineHeight: 1.6 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
