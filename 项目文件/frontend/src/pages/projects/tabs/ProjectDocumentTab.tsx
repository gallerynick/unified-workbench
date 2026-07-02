import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Button,
  Input,
  Modal,
  Select,
  Space,
  Typography,
  Collapse,
  Empty,
  message,
  Tooltip,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  ArrowLeftOutlined,
  AppstoreOutlined,
  SearchOutlined,
  FolderOutlined,
  DeleteOutlined,
  CopyOutlined,
  ExportOutlined,
  EditOutlined,
  SaveOutlined,
  FormOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { WorkRecord } from '../../../types/record';
import ContentEditor from '../../content/ContentEditor';
import styles from './ProjectDocumentTab.module.css';

const { Text } = Typography;

// ─── 接口定义 ───────────────────────────────────────────────

interface ProjectDocument {
  id: string;
  title: string;
  content: Record<string, unknown> | null;
  category: string;
  created_at: string;
  updated_at: string;
}

// ─── 工具函数 ───────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 将文档列表按分类分组 */
function groupByCategory(docs: ProjectDocument[]): Record<string, ProjectDocument[]> {
  const groups: Record<string, ProjectDocument[]> = {};
  for (const doc of docs) {
    const cat = doc.category || '未分类';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(doc);
  }
  return groups;
}

/** 从 Tiptap JSON 内容中提取纯文本摘要 */
function extractTextSummary(content: Record<string, unknown> | null, maxLen = 200): string {
  if (!content) return '暂无内容';
  try {
    const walk = (node: Record<string, unknown>): string => {
      let text = '';
      if (node.type === 'text' && typeof node.text === 'string') {
        return node.text;
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) {
          text += walk(child as Record<string, unknown>);
        }
      }
      return text;
    };
    const full = walk(content).trim();
    if (!full) return '暂无内容';
    return full.length > maxLen ? full.slice(0, maxLen) + '...' : full;
  } catch {
    return '暂无内容';
  }
}

/** 格式化日期 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Props ──────────────────────────────────────────────────

interface ProjectDocumentTabProps {
  project: WorkRecord;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
}

// ─── 主组件 ─────────────────────────────────────────────────

export default function ProjectDocumentTab({ project, onUpdate }: ProjectDocumentTabProps) {
  // ── 数据状态 ──
  const [documents, setDocuments] = useState<ProjectDocument[]>(() => {
    const data = project.data as Record<string, unknown>;
    return (data?.documents as ProjectDocument[]) || [];
  });

  // ── 自定义分类（尚未包含文档的分类） ──
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const data = project.data as Record<string, unknown>;
    return (data?.customCategories as string[]) || [];
  });

  // ── 编辑快照（用于取消编辑时回滚） ──
  const [snapshotOnEdit, setSnapshotOnEdit] = useState<ProjectDocument[]>([]);

  // ── UI 状态 ──
  const [mode, setMode] = useState<'list' | 'preview' | 'edit'>('list');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<string | undefined>(undefined);
  const [hoveredDocId, setHoveredDocId] = useState<string | null>(null);
  const [renameCategoryModalVisible, setRenameCategoryModalVisible] = useState(false);
  const [renameCategoryOld, setRenameCategoryOld] = useState('');
  const [renameCategoryNew, setRenameCategoryNew] = useState('');

  // ── 编辑模式下的临时标题 ──
  const [editTitle, setEditTitle] = useState('');

  // ── 保存相关 ──
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 派生数据 ──
  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) ?? null,
    [documents, activeDocId],
  );

  // 按分类分组（过滤搜索）
  const groupedDocs = useMemo(() => {
    const filtered = search
      ? documents.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
      : documents;
    const groups = groupByCategory(filtered);
    for (const cat of customCategories) {
      if (!groups[cat]) {
        groups[cat] = [];
      }
    }
    return groups;
  }, [documents, search, customCategories]);

  // 所有分类（文档分类 + 自定义分类）
  const allCategories = useMemo(() => {
    const docCategories = [...new Set(documents.map((d) => d.category || '未分类'))];
    const allCats = [...new Set([...docCategories, ...customCategories])];
    return allCats.sort();
  }, [documents, customCategories]);

  // ── 保存文档列表到项目数据 ──
  const saveDocuments = useCallback(
    async (docs: ProjectDocument[]) => {
      setSaving(true);
      try {
        await onUpdate({
          data: {
            ...project.data,
            documents: docs,
            customCategories,
          },
        });
      } catch {
        // 错误已在父组件处理
      } finally {
        setSaving(false);
      }
    },
    [project.data, onUpdate, customCategories],
  );

  // ── 防抖保存 ──
  const debouncedSave = useCallback(
    (docs: ProjectDocument[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void saveDocuments(docs);
      }, 2000);
    },
    [saveDocuments],
  );

  // ── 清除定时器 ──
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── 操作：进入预览模式 ──
  const handleEnterPreview = useCallback((docId: string) => {
    setActiveDocId(docId);
    setMode('preview');
  }, []);

  // ── 操作：从预览进入编辑模式 ──
  const handleEnterEdit = useCallback(() => {
    if (!activeDoc) return;
    setSnapshotOnEdit([...documents]);
    setEditTitle(activeDoc.title);
    setMode('edit');
  }, [activeDoc, documents]);

  // ── 操作：保存编辑并返回预览 ──
  const handleSaveEdit = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!activeDocId) return;
    const trimmed = editTitle.trim();
    if (!trimmed) {
      void message.warning('文档标题不能为空');
      return;
    }
    const updatedDocs = documents.map((d) =>
      d.id === activeDocId
        ? { ...d, title: trimmed, updated_at: new Date().toISOString() }
        : d,
    );
    setDocuments(updatedDocs);
    void saveDocuments(updatedDocs);
    setMode('preview');
    void message.success('文档已保存');
  }, [activeDocId, editTitle, documents, saveDocuments]);

  // ── 操作：取消编辑返回预览 ──
  const handleCancelEdit = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setDocuments(snapshotOnEdit);
    setMode('preview');
  }, [snapshotOnEdit]);

  // ── 操作：返回列表模式 ──
  const handleBackToList = useCallback(() => {
    setMode('list');
    setActiveDocId(null);
  }, []);

  // ── 操作：删除文档 ──
  const handleDeleteDocument = useCallback(
    (docId: string, docTitle: string) => {
      Modal.confirm({
        title: '确认删除',
        icon: <ExclamationCircleOutlined />,
        content: `确定要删除文档「${docTitle}」吗？此操作不可撤销。`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          const updatedDocs = documents.filter((d) => d.id !== docId);
          setDocuments(updatedDocs);
          void saveDocuments(updatedDocs);
          void message.success('文档已删除');
        },
      });
    },
    [documents, saveDocuments],
  );

  // ── 操作：复制文档 ──
  const handleCopyDocument = useCallback(
    (docId: string) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) return;
      const newDoc: ProjectDocument = {
        id: generateId(),
        title: `${doc.title}（副本）`,
        content: doc.content ? JSON.parse(JSON.stringify(doc.content)) : null,
        category: doc.category,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updatedDocs = [...documents, newDoc];
      setDocuments(updatedDocs);
      void saveDocuments(updatedDocs);
      void message.success('文档已复制');
    },
    [documents, saveDocuments],
  );

  // ── 操作：导出文档 ──
  const handleExportDocument = useCallback(
    (docId: string) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) return;
      const exportData = {
        title: doc.title,
        category: doc.category,
        content: doc.content,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${doc.title}.json`;
      a.click();
      URL.revokeObjectURL(url);
      void message.success('文档已导出');
    },
    [documents],
  );

  // ── 操作：删除分类 ──
  const handleDeleteCategory = useCallback(
    (category: string) => {
      const docsInCategory = documents.filter((d) => (d.category || '未分类') === category);
      Modal.confirm({
        title: '确认删除分类',
        icon: <ExclamationCircleOutlined />,
        content: `确定要删除分类「${category}」及其包含的 ${docsInCategory.length} 篇文档吗？此操作不可撤销。`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          if (docsInCategory.length > 0) {
            const updatedDocs = documents.filter(
              (d) => (d.category || '未分类') !== category,
            );
            setDocuments(updatedDocs);
            void saveDocuments(updatedDocs);
          }
          setCustomCategories((prev) => prev.filter((c) => c !== category));
          void message.success(`分类「${category}」已删除`);
        },
      });
    },
    [documents, saveDocuments],
  );

  // ── 操作：重命名分类（打开模态框） ──
  const handleOpenRenameCategory = useCallback((category: string) => {
    setRenameCategoryOld(category);
    setRenameCategoryNew(category);
    setRenameCategoryModalVisible(true);
  }, []);

  // ── 操作：确认重命名分类 ──
  const handleConfirmRenameCategory = useCallback(() => {
    const trimmed = renameCategoryNew.trim();
    if (!trimmed) {
      void message.warning('分类名称不能为空');
      return;
    }
    if (trimmed === renameCategoryOld) {
      setRenameCategoryModalVisible(false);
      return;
    }
    const existingCategories = [
      ...new Set(documents.map((d) => d.category || '未分类')),
      ...customCategories,
    ];
    if (existingCategories.includes(trimmed)) {
      void message.warning('该分类名称已存在');
      return;
    }
    const updatedDocs = documents.map((d) =>
      (d.category || '未分类') === renameCategoryOld
        ? { ...d, category: trimmed }
        : d,
    );
    setDocuments(updatedDocs);
    setCustomCategories((prev) =>
      prev.map((c) => (c === renameCategoryOld ? trimmed : c)),
    );
    void saveDocuments(updatedDocs);
    setRenameCategoryModalVisible(false);
    void message.success(`分类已重命名为「${trimmed}」`);
  }, [renameCategoryNew, renameCategoryOld, documents, customCategories, saveDocuments]);

  // ── 操作：创建新文档（打开模态框） ──
  const handleCreateDocument = useCallback(
    (category?: string) => {
      setNewDocTitle(`新文档 ${documents.length + 1}`);
      setNewDocCategory(category);
      setDocModalVisible(true);
    },
    [documents.length],
  );

  // ── 操作：确认创建文档 ──
  const handleConfirmCreateDocument = useCallback(() => {
    const trimmed = newDocTitle.trim();
    if (!trimmed) {
      void message.warning('请输入文档标题');
      return;
    }
    const newDoc: ProjectDocument = {
      id: generateId(),
      title: trimmed,
      content: null,
      category: newDocCategory ?? '未分类',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updatedDocs = [...documents, newDoc];
    setDocuments(updatedDocs);
    setActiveDocId(newDoc.id);
    setMode('preview');
    setDocModalVisible(false);
    setNewDocTitle('');
    setNewDocCategory(undefined);
    void saveDocuments(updatedDocs);
  }, [newDocTitle, newDocCategory, documents, saveDocuments]);

  // ── 操作：新增分类 ──
  const handleAddCategory = useCallback(() => {
    setNewCategoryName('');
    setCategoryModalVisible(true);
  }, []);

  const handleConfirmAddCategory = useCallback(() => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      void message.warning('请输入分类名称');
      return;
    }
    const existingCategories = [
      ...new Set(documents.map((d) => d.category || '未分类')),
      ...customCategories,
    ];
    if (existingCategories.includes(trimmed)) {
      void message.warning('该分类已存在');
      return;
    }
    setCustomCategories((prev) => [...prev, trimmed]);
    setExpandedCategories((prev) => [...prev, trimmed]);
    setCategoryModalVisible(false);
    setNewCategoryName('');
    void message.success(`分类「${trimmed}」已创建`);
  }, [newCategoryName, documents, customCategories]);

  // ── 操作：更新文档内容（编辑模式下） ──
  const handleContentChange = useCallback(
    (content: Record<string, unknown>) => {
      if (!activeDocId) return;
      const updatedDocs = documents.map((d) =>
        d.id === activeDocId
          ? { ...d, content, updated_at: new Date().toISOString() }
          : d,
      );
      setDocuments(updatedDocs);
      debouncedSave(updatedDocs);
    },
    [documents, activeDocId, debouncedSave],
  );

  // ── 展开/折叠分类 ──
  const handleCollapseChange = useCallback((keys: string | string[]) => {
    setExpandedCategories(Array.isArray(keys) ? keys : [keys]);
  }, []);

  // ── 模板 Modal ──
  const handleOpenTemplateModal = useCallback(() => {
    setTemplateModalVisible(true);
  }, []);

  const handleCloseTemplateModal = useCallback(() => {
    setTemplateModalVisible(false);
  }, []);

  // ─── 渲染：预览模式 ──────────────────────────────────────

  if (mode === 'preview' && activeDoc) {
    return (
      <div className={styles.flexColumnFill}>
        {/* 顶栏：返回 + 标题 + 操作按钮 */}
        <div className={styles.previewToolbar}
        >
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBackToList}
          >
            返回列表
          </Button>

          <Text strong style={{ fontSize: 16 }}>
            {activeDoc.title}
          </Text>

          <Space>
            {saving && <Text type="secondary" style={{ fontSize: 12 }}>保存中...</Text>}
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={handleEnterEdit}
            >
              编辑
            </Button>
          </Space>
        </div>

        {/* 文档元数据 */}
        <div className={styles.metadataBar}
        >
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>分类</Text>
            <div>
              <Tag color="blue">{activeDoc.category || '未分类'}</Tag>
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>创建时间</Text>
            <div>
              <Text style={{ fontSize: 13 }}>{formatDate(activeDoc.created_at)}</Text>
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>更新时间</Text>
            <div>
              <Text style={{ fontSize: 13 }}>{formatDate(activeDoc.updated_at)}</Text>
            </div>
          </div>
        </div>

        {/* 文档内容（只读） */}
        <div className={styles.contentArea}
        >
          {activeDoc.content ? (
            <ContentEditor
              value={activeDoc.content}
              onChange={() => {}}
              editable={false}
              placeholder=""
              minHeight={400}
            />
          ) : (
            <Empty
              description="暂无内容"
              className={styles.emptyState ?? ''}
            >
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={handleEnterEdit}
              >
                开始编辑
              </Button>
            </Empty>
          )}
        </div>
      </div>
    );
  }

  // ─── 渲染：编辑模式 ──────────────────────────────────────

  if (mode === 'edit' && activeDoc) {
    return (
      <div className={styles.flexColumnFill}>
        {/* 顶栏：返回 + 可编辑标题 + 操作按钮 */}
        <div className={styles.previewToolbar}
        >
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleCancelEdit}
          >
            取消
          </Button>

          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            style={{
              maxWidth: 300,
              textAlign: 'center',
              fontWeight: 600,
              fontSize: 16,
            }}
            placeholder="文档标题"
          />

          <Space>
            {saving && <Text type="secondary" style={{ fontSize: 12 }}>保存中...</Text>}
            <Button
              icon={<AppstoreOutlined />}
              onClick={handleOpenTemplateModal}
            >
              套用模板
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveEdit}
            >
              保存
            </Button>
          </Space>
        </div>

        {/* 富文本编辑器 */}
        <div className={styles.contentArea}>
          <ContentEditor
            value={activeDoc.content}
            onChange={handleContentChange}
            placeholder="开始编写文档内容..."
            minHeight={500}
          />
        </div>

        {/* 模板选择 Modal */}
        <Modal
          title="选择模板"
          open={templateModalVisible}
          onCancel={handleCloseTemplateModal}
          footer={
            <Button onClick={handleCloseTemplateModal}>关闭</Button>
          }
          destroyOnClose
          width={560}
          styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
        >
          <Empty description="暂无可用模板" />
        </Modal>
      </div>
    );
  }

  // ─── 渲染：列表模式 ──────────────────────────────────────

  return (
    <div className={styles.flexColumnFill}>
      {/* 顶栏：搜索 + 新增分类 + 新增文档 */}
      <div className={styles.listToolbar}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索文档..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 280 }}
        />

        <Space>
          <Button icon={<FolderOutlined />} onClick={handleAddCategory}>
            新增分类
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleCreateDocument()}
          >
            新增文档
          </Button>
        </Space>
      </div>

      {/* 文档列表：按分类折叠展示 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {documents.length === 0 ? (
          <Empty description="暂无文档">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleCreateDocument()}
            >
              创建第一个文档
            </Button>
          </Empty>
        ) : Object.keys(groupedDocs).length === 0 ? (
          <Empty description="没有匹配的文档" />
        ) : (
          <Collapse
            activeKey={expandedCategories}
            onChange={handleCollapseChange}
            ghost
            items={Object.entries(groupedDocs).map(([category, docs]) => ({
              key: category,
              label: (
                <div className={styles.categoryHeader}>
                  <Space>
                    <FolderOutlined style={{ color: '#1890ff' }} />
                    <Text strong>{category}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {docs.length} 篇
                    </Text>
                  </Space>
                  <Space size={4}>
                    <Tooltip title="重命名分类">
                      <Button
                        type="text"
                        size="small"
                        icon={<FormOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRenameCategory(category);
                        }}
                      />
                    </Tooltip>
                    <Tooltip title="删除分类">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(category);
                        }}
                      />
                    </Tooltip>
                  </Space>
                </div>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {docs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        background: hoveredDocId === doc.id ? '#f5f5f5' : 'transparent',
                        width: '100%',
                        border: 'none',
                        textAlign: 'left',
                        font: 'inherit',
                      }}
                      onMouseEnter={() => setHoveredDocId(doc.id)}
                      onMouseLeave={() => setHoveredDocId(null)}
                      onClick={() => handleEnterPreview(doc.id)}
                    >
                      <FileTextOutlined style={{ fontSize: 16, color: '#1890ff', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ display: 'block' }}>{doc.title}</Text>
                        <Text
                          type="secondary"
                          style={{ fontSize: 12 }}
                          ellipsis
                        >
                          {extractTextSummary(doc.content, 60)}
                        </Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                        {new Date(doc.updated_at).toLocaleDateString('zh-CN')}
                      </Text>

                      {/* 操作按钮（hover 时显示） */}
                      {hoveredDocId === doc.id && (
                        <Space
                          size={2}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tooltip title="复制">
                            <Button
                              type="text"
                              size="small"
                              icon={<CopyOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyDocument(doc.id);
                              }}
                            />
                          </Tooltip>
                          <Tooltip title="导出">
                            <Button
                              type="text"
                              size="small"
                              icon={<ExportOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportDocument(doc.id);
                              }}
                            />
                          </Tooltip>
                          <Tooltip title="删除">
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDocument(doc.id, doc.title);
                              }}
                            />
                          </Tooltip>
                        </Space>
                      )}
                    </button>
                  ))}
                </div>
              ),
            }))}
          />
        )}
      </div>

      {/* 新增分类 Modal */}
      <Modal
        title="新增分类"
        open={categoryModalVisible}
        onCancel={() => setCategoryModalVisible(false)}
        onOk={handleConfirmAddCategory}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Input
          placeholder="请输入分类名称"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onPressEnter={handleConfirmAddCategory}
          autoFocus
        />
      </Modal>

      {/* 重命名分类 Modal */}
      <Modal
        title="重命名分类"
        open={renameCategoryModalVisible}
        onCancel={() => setRenameCategoryModalVisible(false)}
        onOk={handleConfirmRenameCategory}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Input
          placeholder="请输入新的分类名称"
          value={renameCategoryNew}
          onChange={(e) => setRenameCategoryNew(e.target.value)}
          onPressEnter={handleConfirmRenameCategory}
          autoFocus
        />
      </Modal>

      {/* 新增文档 Modal */}
      <Modal
        title="新增文档"
        open={docModalVisible}
        onCancel={() => {
          setDocModalVisible(false);
          setNewDocTitle('');
          setNewDocCategory(undefined);
        }}
        onOk={handleConfirmCreateDocument}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={560}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Input
          placeholder="请输入文档标题"
          value={newDocTitle}
          onChange={(e) => setNewDocTitle(e.target.value)}
          onPressEnter={handleConfirmCreateDocument}
          autoFocus
        />
        <Select
          placeholder="选择分类（可选）"
          style={{ width: '100%', marginTop: 12 }}
          allowClear
          value={newDocCategory || undefined}
          onChange={(value) => setNewDocCategory(value || undefined)}
          options={[
            { value: '', label: '不分类' },
            ...allCategories.map(cat => ({ value: cat, label: cat }))
          ]}
        />
      </Modal>
    </div>
  );
}
