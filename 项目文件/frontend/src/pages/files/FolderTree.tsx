import { useState, useEffect, useCallback, useRef } from 'react';
import { Tree, Button, Input, Modal, message, Space, Tag, Tooltip } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  HomeOutlined,
  SettingOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { listFolders, createFolder, deleteFolder } from '../../api/files';
import type { Folder } from '../../types/file';
import FolderSettingsModal from './FolderSettingsModal';
import styles from './FolderTree.module.css';

interface FolderTreeProps {
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
}

export default function FolderTree({ selectedFolderId, onSelect }: FolderTreeProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [settingsFolder, setSettingsFolder] = useState<Folder | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await listFolders();
      if (res.code === 0) {
        setFolders(res.data);
      } else {
        message.error(res.msg || '获取文件夹列表失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取文件夹列表失败';
      message.error(msg);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const buildTreeData = (): DataNode[] => {
    const rootFolders = folders.filter((f) => !f.parent_id);

    const buildNode = (folder: Folder): DataNode => {
      const children = folders.filter((f) => f.parent_id === folder.id);
      return {
        key: folder.id,
        title: (
          <div className={styles.treeNode ?? ''}>
            <span className={styles.nodeLabel ?? ''}>
              <FolderOutlined className={styles.folderIcon ?? ''} />
              {folder.name}
              {folder.unified_management && (
                <Tooltip title="已开启统一管理，子文件将继承文件夹设置">
                  <Tag color="blue" className={styles.unifiedTag ?? ''}>统一</Tag>
                </Tooltip>
              )}
            </span>
            <Space className={styles.nodeActions ?? ''} size={4}>
              <Tooltip title="文件夹设置">
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSettingsFolder(folder);
                    setSettingsVisible(true);
                  }}
                />
              </Tooltip>
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(folder);
                }}
              />
            </Space>
          </div>
        ),
        children: children.map(buildNode),
      };
    };

    return [
      {
        key: '__all__',
        title: (
          <div className={styles.treeNode ?? ''}>
            <span className={styles.nodeLabel ?? ''}>全部文件</span>
          </div>
        ),
        icon: <HomeOutlined className={styles.allFilesIcon ?? ''} />,
        children: rootFolders.map(buildNode),
      },
    ];
  };

  const handleCreateFolder = async () => {
    if (creatingRef.current) return;
    if (!newFolderName.trim()) {
      message.warning('请输入文件夹名称');
      return;
    }

    creatingRef.current = true;
    setCreating(true);
    try {
      const res = await createFolder({ name: newFolderName.trim() });
      if (res.code === 0) {
        message.success('文件夹创建成功');
        setNewFolderName('');
        setIsCreating(false);
        fetchFolders();
      } else {
        message.error(res.msg || '创建文件夹失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建文件夹失败';
      message.error(msg);
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const cancelCreate = () => {
    if (creatingRef.current) return;
    setIsCreating(false);
    setNewFolderName('');
  };

  const handleDeleteFolder = (folder: Folder) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文件夹「${folder.name}」吗？文件夹内的文件将被移至根目录。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteFolder(folder.id);
          if (res.code === 0) {
            message.success('文件夹已删除');
            if (selectedFolderId === folder.id) {
              onSelect(null);
            }
            fetchFolders();
          } else {
            message.error(res.msg || '删除文件夹失败');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '删除文件夹失败';
          message.error(msg);
        }
      },
    });
  };

  const handleSelect = (selectedKeys: React.Key[]) => {
    const key = selectedKeys[0] as string;
    if (key === '__all__') {
      onSelect(null);
    } else {
      onSelect(key);
    }
  };

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.toolbar ?? ''}>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setIsCreating(true)}
        />
      </div>

      {isCreating && (
        <div className={styles.inlineCreate ?? ''}>
          <Input
            size="small"
            placeholder="文件夹名称"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onPressEnter={handleCreateFolder}
            onKeyDown={(e) => e.key === 'Escape' && cancelCreate()}
            onBlur={cancelCreate}
            autoFocus
            disabled={creating}
          />
        </div>
      )}

      <div className={styles.treeWrapper ?? ''}>
        <Tree
          showIcon
          defaultExpandAll
          selectedKeys={[selectedFolderId ?? '__all__']}
          treeData={buildTreeData()}
          onSelect={handleSelect}
        />
      </div>

      <FolderSettingsModal
        visible={settingsVisible}
        folder={settingsFolder}
        onClose={() => {
          setSettingsVisible(false);
          setSettingsFolder(null);
        }}
        onSuccess={() => {
          fetchFolders();
        }}
      />
    </div>
  );
}
