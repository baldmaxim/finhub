import type { FC } from 'react';
import { Card, Timeline, Tag, Button, Space, Typography, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import type { ContractDossier } from '../../types/dossier';
import { computeAmendmentDiff } from '../../utils/dossierDiff';

const { Text } = Typography;

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
};

const fmtAmount = (v: number) =>
  v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface IProps {
  base: ContractDossier | null;
  amendments: ContractDossier[];
  onEdit: (doc: ContractDossier) => void;
  onDelete: (id: string) => void;
}

export const AmendmentsList: FC<IProps> = ({ base, amendments, onEdit, onDelete }) => {
  if (!base) return null;

  const items = [
    {
      color: 'blue' as const,
      children: (
        <div className="dossier-timeline-item">
          <Space>
            <Tag color="blue">Базовый договор</Tag>
            <Text strong>{base.document_number}</Text>
            <Text type="secondary">{fmtDate(base.document_date)}</Text>
          </Space>
          <div className="dossier-timeline-details">
            <Text type="secondary">
              {base.header_data.contract_amount > 0
                ? `${fmtAmount(base.header_data.contract_amount)} ₽`
                : ''}
            </Text>
          </div>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(base)}
            className="dossier-timeline-btn"
          >
            Ред.
          </Button>
        </div>
      ),
    },
    ...amendments.map((am) => {
      const changes = computeAmendmentDiff(base, am);
      return {
        color: (am.is_active ? 'green' : 'gray') as 'green' | 'gray',
        children: (
          <div className="dossier-timeline-item" key={am.id}>
            <Space>
              <Tag color={am.is_active ? 'green' : 'default'}>ДС</Tag>
              <Text strong>{am.document_number}</Text>
              <Text type="secondary">{fmtDate(am.document_date)}</Text>
            </Space>
            {am.amendment_summary && (
              <div className="dossier-timeline-details">
                <Text type="secondary">{am.amendment_summary}</Text>
              </div>
            )}
            {changes.length > 0 && (
              <div className="dossier-amendment-diff">
                {changes.map((c) => (
                  <span key={c.label} className="dossier-diff-item">
                    <Text type="secondary" className="dossier-diff-label">{c.label}:</Text>{' '}
                    <Text className="dossier-diff-value">{c.value}</Text>
                    {c.delta && (
                      <Text
                        type={c.delta.startsWith('+') ? 'success' : 'danger'}
                        className="dossier-diff-delta"
                      >
                        {' '}({c.delta})
                      </Text>
                    )}
                  </span>
                ))}
              </div>
            )}
            <Space className="dossier-timeline-btn">
              <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(am)}>
                Ред.
              </Button>
              <Popconfirm
                title="Удалить ДС?"
                onConfirm={() => onDelete(am.id)}
                okText="Да"
                cancelText="Нет"
              >
                <Button size="small" icon={<DeleteOutlined />} danger />
              </Popconfirm>
            </Space>
          </div>
        ),
      };
    }),
  ];

  return (
    <Card
      title={
        <Space>
          <FileTextOutlined />
          <span>Документы договора</span>
        </Space>
      }
      className="dossier-card"
      size="small"
    >
      <Timeline items={items} />
    </Card>
  );
};
