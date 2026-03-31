import { useRef } from 'react';
import type { FC } from 'react';
import { Button, Space, Typography, FloatButton } from 'antd';
import { FilePdfOutlined, ArrowUpOutlined } from '@ant-design/icons';
import html2canvas from 'html2canvas';
import { DossierHeader } from './DossierHeader';
import { BddsConditionsBlock } from './BddsConditionsBlock';
import { AdvanceCalculatorBlock } from './AdvanceCalculatorBlock';
import { BdrConditionsBlock } from './BdrConditionsBlock';
import { RiskRadarBlock } from './RiskRadarBlock';

const { Title } = Typography;

export const ContractDossierPage: FC = () => {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = async () => {
    if (!contentRef.current) return;
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fff',
      });
      const link = document.createElement('a');
      link.download = 'Финансовое_досье_К14.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // fallback: window.print
      window.print();
    }
  };

  return (
    <div className="dossier-page">
      <div className="dossier-toolbar">
        <Title level={3} className="dossier-page-title">Финансовое досье договора</Title>
        <Button
          type="primary"
          icon={<FilePdfOutlined />}
          onClick={handleExportPdf}
        >
          Экспорт в PDF
        </Button>
      </div>

      <div ref={contentRef} className="dossier-content">
        <DossierHeader />
        <Space direction="vertical" size={24} className="w-full">
          <BddsConditionsBlock />
          <AdvanceCalculatorBlock />
          <BdrConditionsBlock />
          <RiskRadarBlock />
        </Space>
      </div>

      <FloatButton.BackTop
        icon={<ArrowUpOutlined />}
        className="dossier-backtop"
      />
    </div>
  );
};
