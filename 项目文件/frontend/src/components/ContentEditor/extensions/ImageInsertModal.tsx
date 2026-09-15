import { useEffect, useState } from 'react';
import { Input, Modal } from 'antd';
import { LinkOutlined } from '@ant-design/icons';

interface ImageInsertModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (src: string, alt: string) => void;
}

/**
 * 按链接插入图片。
 *
 * 工作台前端目前没有通用图片上传接口，因此只支持填 URL。
 * 后端补齐上传能力后可在此处加「本地上传」选项。
 */
export default function ImageInsertModal({
  open,
  onClose,
  onConfirm,
}: ImageInsertModalProps) {
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');

  useEffect(() => {
    if (open) {
      setSrc('');
      setAlt('');
    }
  }, [open]);

  const trimmed = src.trim();
  // 避免正则转义在生成代码时被吞；输入框为单行，只校验空格
  const isValid =
    (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
    trimmed.indexOf(' ') === -1 &&
    trimmed.length > 8;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(src.trim(), alt.trim());
    onClose();
  };

  return (
    <Modal
      title="插入图片"
      open={open}
      onCancel={onClose}
      okText="插入"
      cancelText="取消"
      okButtonProps={{ disabled: !isValid }}
      onOk={handleConfirm}
    >
      <div className="note-image-modal-field">
        <Input
          prefix={<LinkOutlined />}
          placeholder="https://example.com/image.png"
          value={src}
          onChange={(event) => setSrc(event.target.value)}
          autoFocus
        />
      </div>
      <div className="note-image-modal-field" style={{ marginTop: 12 }}>
        <Input
          placeholder="替代文本（可留空）"
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
        />
      </div>
      <div
        style={{
          marginTop: 12,
          color: 'var(--text-tertiary)',
          fontSize: '0.85em',
          lineHeight: 1.6,
        }}
      >
        仅支持 http/https 链接。工作台目前没有图片上传接口，本地图片请先通过文件模块
        上传后使用其访问地址。
      </div>
    </Modal>
  );
}
