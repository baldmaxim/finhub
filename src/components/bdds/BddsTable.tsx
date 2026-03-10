import { useMemo } from 'react';
import { Table } from 'antd';
import { RightOutlined, DownOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { BddsSection, BddsTableRow } from '../../types/bdds';
import type { YearMonthSlot } from '../../utils/constants';
import { MONTHS } from '../../utils/constants';
import { buildMonthColumns, buildTotalColumns } from './BddsMonthColumns';

interface IProps {
  sections: BddsSection[];
  yearSections?: Map<number, BddsSection[]>;
  yearMonthSlots?: YearMonthSlot[];
  expandedParents: Set<string>;
  onToggleParent: (categoryId: string) => void;
  onUpdateFact?: (categoryId: string, month: number, amount: number) => void;
}

export const BddsTable = ({ sections, yearSections, yearMonthSlots, expandedParents, onToggleParent, onUpdateFact }: IProps) => {
  const isMultiYear = yearMonthSlots ? yearMonthSlots.length > 12 : false;

  const dataSource = useMemo((): BddsTableRow[] => {
    if (!isMultiYear || !yearSections || !yearMonthSlots) {
      // Single year — старая логика
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
    }

    // Multi-year: merge per-year sections into rows with year-month dataKeys
    const rows: BddsTableRow[] = [];
    const firstYear = [...yearSections.keys()].sort((a, b) => a - b)[0];
    const baseSections = yearSections.get(firstYear) ?? [];

    for (const section of baseSections) {
      rows.push({
        key: `header-${section.sectionCode}`,
        name: section.sectionName.toUpperCase(),
        isHeader: true,
      });

      for (let ri = 0; ri < section.rows.length; ri++) {
        const row = section.rows[ri];
        const hasChildren = row.children && row.children.length > 0;
        const tableRow: BddsTableRow = {
          key: row.categoryId,
          name: row.name,
          categoryId: row.categoryId,
          isCalculated: row.isCalculated,
          isExpandable: hasChildren,
          rowType: row.rowType,
          sectionCode: section.sectionCode,
          plan_total: 0,
          fact_total: 0,
        };

        let planTotal = 0;
        let factTotal = 0;

        for (const slot of yearMonthSlots) {
          const ySections = yearSections.get(slot.year);
          const ySection = ySections?.find((s) => s.sectionCode === section.sectionCode);
          const yRow = ySection?.rows[ri];
          const pv = yRow?.months[slot.month] || 0;
          const fv = yRow?.factMonths[slot.month] || 0;
          tableRow[`plan_month_${slot.dataKey}`] = pv;
          tableRow[`fact_month_${slot.dataKey}`] = fv;
          planTotal += pv;
          factTotal += fv;
        }

        tableRow.plan_total = planTotal;
        tableRow.fact_total = factTotal;
        rows.push(tableRow);

        if (hasChildren && expandedParents.has(row.categoryId)) {
          for (let ci = 0; ci < row.children!.length; ci++) {
            const child = row.children![ci];
            const childRow: BddsTableRow = {
              key: child.categoryId,
              name: child.name,
              categoryId: child.categoryId,
              isCalculated: child.isCalculated,
              isChild: true,
              rowType: child.rowType,
              sectionCode: section.sectionCode,
              plan_total: 0,
              fact_total: 0,
            };

            let cPlanTotal = 0;
            let cFactTotal = 0;

            for (const slot of yearMonthSlots) {
              const ySections = yearSections.get(slot.year);
              const ySection = ySections?.find((s) => s.sectionCode === section.sectionCode);
              const yRow = ySection?.rows[ri];
              const yChild = yRow?.children?.[ci];
              const pv = yChild?.months[slot.month] || 0;
              const fv = yChild?.factMonths[slot.month] || 0;
              childRow[`plan_month_${slot.dataKey}`] = pv;
              childRow[`fact_month_${slot.dataKey}`] = fv;
              cPlanTotal += pv;
              cFactTotal += fv;
            }

            childRow.plan_total = cPlanTotal;
            childRow.fact_total = cFactTotal;
            rows.push(childRow);
          }
        }
      }
    }

    return rows;
  }, [sections, yearSections, yearMonthSlots, isMultiYear, expandedParents]);

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

    const monthCols = buildMonthColumns({
      onUpdateFact,
      slots: isMultiYear ? yearMonthSlots : undefined,
    });
    const totalCols = buildTotalColumns();

    return [...nameCol, ...monthCols, ...totalCols];
  }, [onUpdateFact, expandedParents, onToggleParent, isMultiYear, yearMonthSlots]);

  return (
    <Table
      dataSource={dataSource}
      columns={columns}
      pagination={false}
      bordered
      size="small"
      scroll={{ x: 'max-content' }}
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
