import { Card, Tabs } from 'antd';
import { UploadOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useContracts1c } from '../../hooks/useContracts1c';
import { useProjects } from '../../hooks/useProjects';
import { Contracts1cImportTab } from './Contracts1cImportTab';
import { Contracts1cRegistryTab } from './Contracts1cRegistryTab';

export const Contracts1cPage = () => {
  const { contracts, loading, enrich, revalidate, remove, pushToBdr, reload } = useContracts1c();
  const { projects } = useProjects();

  const items = [
    {
      key: 'import',
      label: <span><UploadOutlined /> Импорт из 1С</span>,
      children: (
        <Contracts1cImportTab
          contracts={contracts}
          onImportDone={reload}
        />
      ),
    },
    {
      key: 'registry',
      label: <span><UnorderedListOutlined /> Реестр договоров</span>,
      children: (
        <Contracts1cRegistryTab
          contracts={contracts}
          projects={projects}
          loading={loading}
          onEnrich={enrich}
          onRevalidate={revalidate}
          onRemove={remove}
          onPushToBdr={pushToBdr}
        />
      ),
    },
  ];

  return (
    <Card title="Управление контрактами 1С" className="mt-16">
      <Tabs items={items} />
    </Card>
  );
};
