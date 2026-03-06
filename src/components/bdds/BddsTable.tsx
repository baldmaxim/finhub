import { useMemo } from 'react';
import { Table } from 'antd';
import { RightOutlined, DownOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { BddsSection, BddsTableRow } from '../../types/bdds';
import { MONTHS } from '../../utils/constants';
import { buildMonthColumns, buildTotalColumns } from './BddsMonthColumns';

interface IProps {
  sections: BddsSection[];
  expandedParents: Set<string>;
  onToggleParent: (categoryId: string) => void;
  onUpdateFact?: (categoryId: string, month: number, amount: number) => void;
}

export const BddsTable = ({ sections, expandedParents, onToggleParent, onUpdateFact }: IProps) => {
  const dataSource = useMemo((): BddsTableRow[] => {
    const rows: BddsTableRow[] = [];

    for (const section of sections) {
      rows.push({
        key: `header-${section.sectionCode}`,
        name: section.sectionName.toUpperCase(),
        isHeader: true,
      });

      for (const row of section.rows) {
        const hasChildren = row.children && row.children.length > 0;
        const tableRow: BddsTableRow = {
          key: row.categoryId,
          name: row.name,
          categoryId: row.categoryId,
          isCalculated: row.isCalculated,
          isExpandable: hasChildren,
          rowType: row.rowType,
          sectionCode: section.sectionCode,
          plan_total: row.total,
          fact_total: row.factTotal,
        };

        for (const m of MONTHS) {
          tableRow[`plan_month_${m.key}`] = row.months[m.key] || 0;
          tableRow[`fact_month_${m.key}`] = row.factMonths[m.key] || 0;
        }

        rows.push(tableRow);

        // Добавляем дочерние строки если раскрыто
        if (hasChildren && expandedParents.has(row.categoryId)) {
          for (const child of row.children!) {
            const childRow: BddsTableRow = {
              key: child.categoryId,
              name: child.name,
              categoryId: child.categoryId,
              isCalculated: child.isCalculated,
              isChild: true,
              rowType: child.rowType,
              sectionCode: section.sectionCode,
              plan_total: child.total,
              fact_total: child.factTotal,
            };

            for (const m of MONTHS) {
              childRow[`plan_month_${m.key}`] = child.months[m.key] || 0;
              childRow[`fact_month_${m.key}`] = child.factMonths[m.key] || 0;
            }

            rows.push(childRow);
          }
        }
      }
    }

    return rows;
  }, [sections, expandedParents]);

  const columns = useMemo((): ColumnsType<BddsTableRow> => {
    const nameCol: ColumnsType<BddsTableRow> = [
      {
        title: 'Статья',
        dataIndex: 'name',
        key: 'name',
        fixed: 'left',
        width: 320,
        render: (text: string, record: BddsTableRow) => {
          if (record.isHeader) {
            return <strong>{text}</strong>;
          }
          if (record.isExpandable && record.categoryId) {
            const expanded = expandedParents.has(record.categoryId);
            return (
              <span
                className="bdds-clickable-name bdds-semibold-name"
                onClick={() => onToggleParent(record.categoryId!)}
              >
                {expanded ? <DownOutlined /> : <RightOutlined />}
                {' '}{text}
              </span>
            );
          }
          if (record.isChild) {
            return <span className="bdds-child-indent">{text}</span>;
          }
          return text;
        },
      },
    ];

    const monthCols = buildMonthColumns({ onUpdateFact });
    const totalCols = buildTotalColumns();

    return [...nameCol, ...monthCols, ...totalCols];
  }, [onUpdateFact, expandedParents, onToggleParent]);

  return (
    <Table
      dataSource={dataSource}
      columns={columns}
      pagination={false}
      bordered
      size="small"
      scroll={{ x: 4500 }}
      sticky
      rowClassName={(record) => {
        if (record.isHeader) return 'bdds-section-header';
        if (record.isCalculated && !record.isExpandable) return 'bdds-calculated-row';
        if (record.isExpandable) return 'bdds-expandable-row';
        if (record.isChild) return 'bdds-child-row';
        if (record.rowType === 'income' && record.sectionCode === 'operating') return 'bdds-auto-row';
        return '';
      }}
    />
  );
}
