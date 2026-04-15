import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  DollarOutlined,
  BarChartOutlined,
  BankOutlined,
  SettingOutlined,
  TeamOutlined,
  ProjectOutlined,
  FundOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  SafetyCertificateOutlined,
  FileSearchOutlined,
  ToolOutlined,
  FileProtectOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

const menuItems: MenuItem[] = [
  { key: '/bdr', icon: <BarChartOutlined />, label: 'БДР' },
  { key: '/bdds', icon: <DollarOutlined />, label: 'БДДС' },
  { key: '/bdds/auto', icon: <ThunderboltOutlined />, label: 'БДДС Авто' },
  { key: '/bbl', icon: <BankOutlined />, label: 'ББЛ' },
  { key: '/bdds/income', icon: <FundOutlined />, label: 'Плановый график' },
  { key: '/bdds/schedule-v2', icon: <FundOutlined />, label: 'Плановый график 2.0' },
  { key: '/actual-execution', icon: <CheckCircleOutlined />, label: 'Факт. выполнение' },
  { key: '/ks6a', icon: <ToolOutlined />, label: 'КС-6а Готовность' },
  { key: '/contracts', icon: <FileProtectOutlined />, label: 'Договоры' },
  { key: '/contracts-1c', icon: <SwapOutlined />, label: 'Контракты 1С' },
  { key: '/guarantee', icon: <SafetyCertificateOutlined />, label: 'Контроль ГУ' },
  { key: '/dashboards', icon: <DashboardOutlined />, label: 'Дашборды' },
  { key: '/dossier', icon: <FileSearchOutlined />, label: 'Досье договора' },
  { key: '/etl', icon: <SwapOutlined />, label: 'Шлюз 1С' },
  { key: '/bank-balances', icon: <BankOutlined />, label: 'Остатки р/с' },
  {
    key: 'admin',
    icon: <SettingOutlined />,
    label: 'Администрирование',
    children: [
      { key: '/admin/users', icon: <TeamOutlined />, label: 'Пользователи' },
      { key: '/admin/projects', icon: <ProjectOutlined />, label: 'Проекты' },
    ],
  },
];

interface IProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

export const AppSider = ({ collapsed, onCollapse }: IProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const openKeys = location.pathname.startsWith('/admin') ? ['admin'] : [];

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      breakpoint="lg"
      width={220}
      className="sider-container"
    >
      <div className="sider-logo">
        <Typography.Text strong className={`sider-logo-text ${collapsed ? 'sider-logo-text--collapsed' : 'sider-logo-text--expanded'}`}>
          {collapsed ? 'FH' : 'FinHub'}
        </Typography.Text>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        defaultOpenKeys={openKeys}
        items={menuItems}
        onClick={({ key }) => {
          if (key !== 'admin') navigate(key);
        }}
      />
    </Sider>
  );
}
