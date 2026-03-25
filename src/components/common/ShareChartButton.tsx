import { type FC, useRef, useCallback } from 'react';
import { Button, message } from 'antd';
import { ShareAltOutlined } from '@ant-design/icons';
import { toPng } from 'html-to-image';

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
      const dataUrl = await toPng(chartRef.current, {
        backgroundColor: '#fff',
        pixelRatio: 2,
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${title}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${title}.png`;
        link.click();
        message.success('График сохранён');
      }
    } catch {
      message.error('Не удалось поделиться графиком');
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
