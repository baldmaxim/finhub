import { useState, useCallback } from 'react';
import { Card, Spin, Alert, message, Button, Space, Table, Popconfirm, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { useBddsReceipts } from '../../../hooks/useBddsReceipts';
import { YearSelect } from '../../common/YearSelect';
import { ReceiptExcelImport } from './ReceiptExcelImport';
import { ReceiptExcelExport } from './ReceiptExcelExport';
import type { BddsReceiptDetail, BddsReceiptImportRow } from '../../../types/bddsReceipt';
import type { Project } from '../../../types/projects';
import { formatAmount } from '../../../utils/formatters';

const currentYear = new Date().getFullYear();

export const BddsReceiptsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCategoryId = searchParams.get('categoryId');

  const [year, setYear] = useState(currentYear);

  const {
    rows,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    error,
    importReceipts,
    deleteReceipt,
  } = useBddsReceipts(year, initialCategoryId);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleProjectChange = useCallback((projectId: string | null, project: Project | null) => {
    setSelectedProjectId(projectId);
    if (project?.start_date) {
      setYear(new Date(project.start_date).getFullYear());
    } else if (!projectId) {
      setYear(currentYear);
    }
  }, [setSelectedProjectId]);

  const handleImport = async (data: BddsReceiptImportRow[]) => {
    if (!selectedProjectId) {
      message.error('Выберите проект для импорта');
      return;
    }
    try {
      await importReceipts(selectedProjectId, year, data);
      message.success('Данные импортированы');
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      message.error(`Ошибка импорта: ${msg}`, 10);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReceipt(id);
      message.success('Запись удалена');
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const columns: ColumnsType<BddsReceiptDetail> = [
    {
      title: '№ п/п',
      dataIndex: 'row_number',
      key: 'row_number',
      width: 80,
    },
    {
      title: 'Дата',
      dataIndex: 'receipt_date',
      key: 'receipt_date',
      width: 120,
      render: (val: string | null) => {
        if (!val) return '—';
        const d = new Date(val);
        return d.toLocaleDateString('ru-RU');
      },
    },
    {
      title: 'Заказчик',
      dataIndex: 'customer',
      key: 'customer',
      ellipsis: true,
    },
    {
      title: 'Договор',
      dataIndex: 'contract',
      key: 'contract',
      ellipsis: true,
    },
    {
      title: 'Проект',
      dataIndex: 'project_name',
      key: 'project_name',
      ellipsis: true,
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right',
      render: (val: number) => (
        <span className={val < 0 ? 'amount-negative' : ''}>
          {formatAmount(val)}
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: unknown, record: BddsReceiptDetail) => (
        <Popconfirm title="Удалить запись?" onConfirm={() => handleDelete(record.id)} okText="Да" cancelText="Нет">
          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      ),
    },
  ];

  const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0);

  if (error) {
    return <Alert type="error" message="Ошибка" description={error} showIcon />;
  }

  return (
    <Card
      title={
        <span>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/bdds')}
            className="mr-8"
          />
          Поступления от продажи продукции и товаров
        </span>
      }
    >
      <div className="receipt-toolbar">
        <Space wrap>
          <Typography.Text>Год</Typography.Text>
          <YearSelect value={year} onChange={setYear} />
          <ReceiptExcelImport
            disabled={!selectedProjectId}
            onImport={handleImport}
          />
          <ReceiptExcelExport
            rows={rows}
            disabled={rows.length === 0}
            projectName={selectedProject?.name}
            year={year}
          />
        </Space>
        <div className="dashboard-project-tags">
          <Tag.CheckableTag
            checked={selectedProjectId === null}
            onChange={() => handleProjectChange(null, null)}
          >
            Все проекты
          </Tag.CheckableTag>
          {projects.map((p) => (
            <Tag.CheckableTag
              key={p.id}
              checked={selectedProjectId === p.id}
              onChange={(checked) => handleProjectChange(checked ? p.id : null, checked ? p : null)}
            >
              {p.name}
            </Tag.CheckableTag>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="page-center">
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Table
            dataSource={rows}
            columns={columns}
            rowKey="id"
            pagination={false}
            bordered
            size="small"
            scroll={{ x: 'max-content' }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}>
                  <strong>Итого</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <strong>{formatAmount(totalAmount)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} />
              </Table.Summary.Row>
            )}
          />
          {rows.length === 0 && selectedProjectId && (
            <Alert
              className="mt-16"
              type="info"
              message="Нет данных. Импортируйте файл Excel с поступлениями."
              showIcon
            />
          )}
          {!selectedProjectId && (
            <Alert
              className="mt-16"
              type="info"
              message="Выберите проект для просмотра и импорта поступлений."
              showIcon
            />
          )}
        </>
      )}
    </Card>
  );
};
