import { Select } from 'antd';

interface IProps {
  value: number;
  onChange: (year: number) => void;
}

const currentYear = new Date().getFullYear();
const startYear = 2022;
const years = Array.from({ length: currentYear + 5 - startYear }, (_, i) => startYear + i);

export const YearSelect = ({ value, onChange }: IProps) => {
  return (
    <Select
      value={value}
      onChange={onChange}
      className="select-year"
      options={years.map((y) => ({ value: y, label: String(y) }))}
    />
  );
}
