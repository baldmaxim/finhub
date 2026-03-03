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
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

const menuItems: MenuItem[] = [
  { key: '/actual-execution', icon: <CheckCircleOutlined />, label: 'Факт. выполнение' },
  { key: '/bdds', icon: <DollarOutlined />, label: 'БДДС' },
  { key: '/bdds/income', icon: <FundOutlined />, label: 'Плановый график' },
  { key: '/bdr', icon: <BarChartOutlined />, label: 'БДР' },
  { key: '/bbl', icon: <BankOutlined />, label: 'ББЛ' },
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
