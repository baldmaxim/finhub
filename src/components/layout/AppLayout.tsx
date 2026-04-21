import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import { AppSider } from './AppSider';
import { AppHeader } from './AppHeader';
import { DossierProvider } from '../../contexts/DossierContext';

const { Content } = Layout;

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <DossierProvider>
      <Layout style={{ minHeight: '100vh' }}>
        <AppSider collapsed={collapsed} onCollapse={setCollapsed} />
        <Layout>
          <AppHeader />
          <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </DossierProvider>
  );
}
