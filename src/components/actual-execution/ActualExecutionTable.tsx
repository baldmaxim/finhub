import { Table, Button, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ActualExecutionEntry } from '../../types/actualExecution';
import type { Project } from '../../types/projects';
import { formatAmount } from '../../utils/formatters';
import { MONTHS } from '../../utils/constants';

interface IProps {
  entries: ActualExecutionEntry[];
  projects: Project[];
  selectedProjectId: string | null;
  onDelete: (id: string) => void;
}

function formatMonthKey(monthKey: string): string {
  const [year, monthStr] = monthKey.split('-');
  const month = parseInt(monthStr, 10);
  const m = MONTHS.find((m) => m.key === month);
  return m ? `${m.full} ${year}` : monthKey;
}

export const ActualExecutionTable = ({ entries, projects, selectedProjectId, onDelete }: IProps) => {
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const columns: ColumnsType<ActualExecutionEntry> = [
    {
      title: '№',
      width: 50,
      render: (_: unknown, __: ActualExecutionEntry, index: number) => index + 1,
    },
  ];

  if (!selectedProjectId) {
    columns.push({
      title: 'Проект',
      dataIndex: 'project_id',
      width: 200,
      render: (id: string) => projectMap.get(id) || id,
    });
  }

  columns.push(
    {
      title: 'Период',
      dataIndex: 'month_key',
      width: 150,
      sorter: (a: ActualExecutionEntry, b: ActualExecutionEntry) => a.month_key.localeCompare(b.month_key),
      defaultSortOrder: 'ascend',
      render: (monthKey: string) => formatMonthKey(monthKey),
    },
    {
      title: 'Выполнено по КС (подписано)',
      dataIndex: 'ks_amount',
      width: 200,
      align: 'right',
      render: (val: number) => (
        <span className={val < 0 ? 'amount-negative' : ''}>
          {formatAmount(val)}
        </span>
      ),
    },
    {
      title: 'Выполнение фактическое',
      dataIndex: 'fact_amount',
      width: 200,
      align: 'right',
      render: (val: number) => (
        <span className={val < 0 ? 'amount-negative' : ''}>
          {formatAmount(val)}
        </span>
      ),
    },
    {
      title: '',
      width: 50,
      render: (_: unknown, record: ActualExecutionEntry) => (
        <Popconfirm title="Удалить запись?" onConfirm={() => onDelete(record.id)}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    }
  );

  return (
    <Table
      dataSource={entries}
      columns={columns}
      rowKey="id"
      size="small"
      pagination={false}
      scroll={{ x: 700 }}
    />
  );
};
