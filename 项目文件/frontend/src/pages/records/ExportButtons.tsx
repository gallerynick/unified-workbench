import { useState } from 'react';
import { Button, Dropdown, message } from 'antd';
import {
  DownloadOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { exportRecordWord, exportRecordPdf, exportRecordExcel } from '../../api/records';

interface ExportButtonsProps {
  recordId: string;
  recordTitle: string;
}

type ExportFormat = 'word' | 'pdf' | 'excel';

const FORMAT_META: Record<ExportFormat, { icon: React.ReactNode; label: string; ext: string }> = {
  word: { icon: <FileWordOutlined />, label: 'Word', ext: '.docx' },
  pdf: { icon: <FilePdfOutlined />, label: 'PDF', ext: '.pdf' },
  excel: { icon: <FileExcelOutlined />, label: 'Excel', ext: '.xlsx' },
};

export default function ExportButtons({ recordId, recordTitle }: ExportButtonsProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const exportFn = {
        word: exportRecordWord,
        pdf: exportRecordPdf,
        excel: exportRecordExcel,
      }[format];

      const blob = await exportFn(recordId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recordTitle}${FORMAT_META[format].ext}`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`${FORMAT_META[format].label} 导出成功`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '导出失败';
      message.error(msg);
    } finally {
      setExporting(null);
    }
  };

  const menuItems: MenuProps['items'] = (Object.keys(FORMAT_META) as ExportFormat[]).map((format) => ({
    key: format,
    icon: FORMAT_META[format].icon,
    label: FORMAT_META[format].label,
    disabled: exporting !== null,
    onClick: () => handleExport(format),
  }));

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']}>
      <Button type="link" size="small" icon={<DownloadOutlined />} loading={exporting !== null}>
        导出
      </Button>
    </Dropdown>
  );
}
