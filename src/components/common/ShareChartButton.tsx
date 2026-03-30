import { type FC, useRef, useCallback } from 'react';
import { Button, message } from 'antd';
import { ShareAltOutlined } from '@ant-design/icons';
import html2canvas from 'html2canvas';

interface IProps {
  chartRef: React.RefObject<HTMLDivElement | null>;
  title?: string;
}

export const ShareChartButton: FC<IProps> = ({ chartRef, title = 'График' }) => {
  const loadingRef = useRef(false);

  const handleShare = useCallback(async () => {
    if (loadingRef.current || !chartRef.current) return;
    loadingRef.current = true;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#fff',
        scale: 2,
        useCORS: true,
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      });

      const download = () => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title}.png`;
        link.click();
        URL.revokeObjectURL(url);
        message.success('График сохранён');
      };

      const file = new File([blob], `${title}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title });
        } catch {
          download();
        }
      } else {
        download();
      }
    } catch {
      message.error('Не удалось сохранить график');
    } finally {
      loadingRef.current = false;
    }
  }, [chartRef, title]);

  return (
    <Button
      type="text"
      size="small"
      icon={<ShareAltOutlined />}
      onClick={handleShare}
      title="Поделиться"
    />
  );
};
