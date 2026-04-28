import { useRef, useState, useCallback } from 'react';
import type { FC } from 'react';
import { Button, Space, Typography, FloatButton, Spin, Empty } from 'antd';
import { FilePdfOutlined, ArrowUpOutlined } from '@ant-design/icons';
import html2canvas from 'html2canvas';
import type { Project } from '../../types/projects';
import type { ContractDossier, ContractDossierFormData, DossierDocumentType } from '../../types/dossier';
import { useDossierContext } from '../../contexts/DossierContext';
import { DossierToolbar } from './DossierToolbar';
import { DossierHeader } from './DossierHeader';
import { AmendmentsList } from './AmendmentsList';
import { BddsConditionsBlock } from './BddsConditionsBlock';
import { AdvanceCalculatorBlock } from './AdvanceCalculatorBlock';
import { BdrConditionsBlock } from './BdrConditionsBlock';
import { RiskRadarBlock } from './RiskRadarBlock';
import { DossierEditModal } from './DossierEditModal';

const { Title } = Typography;

export const ContractDossierPage: FC = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Модалка
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<DossierDocumentType>('contract');
  const [editingDoc, setEditingDoc] = useState<ContractDossier | null>(null);

  const {
    documents,
    effective,
    loading,
    saving,
    loadDossier,
    clearDossier,
    saveDossier,
    updateDossier,
    deleteDossier,
  } = useDossierContext();

  const handleProjectChange = useCallback(
    (projectId: string | null, _project: Project | null) => {
      setSelectedProjectId(projectId);
      if (projectId) {
        loadDossier(projectId);
      } else {
        clearDossier();
      }
    },
    [loadDossier, clearDossier],
  );

  const handleAddContract = useCallback(() => {
    setModalMode('contract');
    setEditingDoc(null);
    setModalOpen(true);
  }, []);

  const handleAddAmendment = useCallback(() => {
    setModalMode('amendment');
    setEditingDoc(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((doc: ContractDossier) => {
    setModalMode(doc.document_type);
    setEditingDoc(doc);
    setModalOpen(true);
  }, []);

  const handleModalSave = useCallback(
    async (data: ContractDossierFormData) => {
      if (editingDoc) {
        await updateDossier(editingDoc.id, data);
      } else {
        await saveDossier(data);
      }
      setModalOpen(false);
      setEditingDoc(null);
    },
    [editingDoc, saveDossier, updateDossier],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDossier(id);
    },
    [deleteDossier],
  );

  const handleExportPdf = async () => {
    if (!contentRef.current) return;
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fff',
      });
      const link = document.createElement('a');
      const name = effective?.effective.header.contract_name ?? 'досье';
      link.download = `Финансовое_досье_${name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      window.print();
    }
  };

  const hasBaseContract = documents.some((d) => d.document_type === 'contract');

  return (
    <div className="dossier-page">
      <div className="dossier-toolbar">
        <Title level={3} className="dossier-page-title">Финансовое досье договора</Title>
        {effective && (
          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            onClick={handleExportPdf}
          >
            Экспорт в PDF
          </Button>
        )}
      </div>

      <DossierToolbar
        selectedProjectId={selectedProjectId}
        onProjectChange={handleProjectChange}
        documents={documents}
        hasBaseContract={hasBaseContract}
        onAddContract={handleAddContract}
        onAddAmendment={handleAddAmendment}
      />

      {!selectedProjectId && (
        <Empty
          description="Выберите проект для просмотра финансового досье"
          className="mt-16"
        />
      )}

      {selectedProjectId && loading && (
        <div className="page-center">
          <Spin size="large" />
        </div>
      )}

      {selectedProjectId && !loading && !hasBaseContract && (
        <Empty
          description="Досье не заведено. Создайте базовый договор."
          className="mt-16"
        />
      )}

      {selectedProjectId && !loading && effective && (
        <div ref={contentRef} className="dossier-content">
          <DossierHeader data={effective.effective.header} />

          <AmendmentsList
            base={effective.base}
            amendments={effective.amendments}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          <Space orientation="vertical" size={24} className="w-full">
            <BddsConditionsBlock data={effective.effective.bdds} header={effective.effective.header} />
            <AdvanceCalculatorBlock bdds={effective.effective.bdds} header={effective.effective.header} />
            <BdrConditionsBlock data={effective.effective.bdr} bdds={effective.effective.bdds} />
            <RiskRadarBlock data={effective.effective.penalties} />
          </Space>
        </div>
      )}

      {selectedProjectId && modalOpen && (
        <DossierEditModal
          open={modalOpen}
          mode={modalMode}
          projectId={selectedProjectId}
          dossier={editingDoc}
          base={effective?.base ?? null}
          loading={saving}
          onSave={handleModalSave}
          onCancel={() => {
            setModalOpen(false);
            setEditingDoc(null);
          }}
        />
      )}

      <FloatButton.BackTop
        icon={<ArrowUpOutlined />}
        className="dossier-backtop"
      />
    </div>
  );
};
