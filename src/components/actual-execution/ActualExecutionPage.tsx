import { useState } from 'react';
import { Card, Spin, Alert, message, Modal, Form, InputNumber, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { useActualExecution } from '../../hooks/useActualExecution';
import { ActualExecutionToolbar } from './ActualExecutionToolbar';
import { ActualExecutionTable } from './ActualExecutionTable';

export const ActualExecutionPage = () => {
  const {
    entries,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    error,
    importFromExcel,
    addEntry,
    deleteEntry,
  } = useActualExecution();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleImport = async (
    data: Array<{ monthKey: string; ksAmount: number; factAmount: number }>
  ) => {
    if (!selectedProjectId) {
      message.error('Выберите проект для импорта');
      return;
    }
    try {
      await importFromExcel(selectedProjectId, data);
      message.success('Данные импортированы');
    } catch {
      message.error('Ошибка импорта данных');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry(id);
      message.success('Запись удалена');
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      const date = values.month as dayjs.Dayjs;
      const monthKey = date.format('YYYY-MM');

      await addEntry({
        project_id: selectedProjectId!,
        month_key: monthKey,
        ks_amount: values.ks_amount || 0,
        fact_amount: values.fact_amount || 0,
      });

      setAddModalOpen(false);
      form.resetFields();
      message.success('Запись добавлена');
    } catch {
      // validation error
    }
  };

  if (error) {
    return <Alert type="error" message="Ошибка" description={error} showIcon />;
  }

  return (
    <>
      <Card title="Фактическое выполнение" loading={loading}>
        <ActualExecutionToolbar
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
          onImport={handleImport}
          onAdd={() => setAddModalOpen(true)}
          entries={entries}
        />
        {loading ? (
          <div className="page-center">
            <Spin size="large" />
          </div>
        ) : (
          <ActualExecutionTable
            entries={entries}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onDelete={handleDelete}
          />
        )}
      </Card>

      <Modal
        title="Добавить запись"
        open={addModalOpen}
        onOk={handleAdd}
        onCancel={() => {
          setAddModalOpen(false);
          form.resetFields();
        }}
        okText="Добавить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="month"
            label="Период"
            rules={[{ required: true, message: 'Выберите период' }]}
          >
            <DatePicker picker="month" format="MMMM YYYY" className="w-full" />
          </Form.Item>
          <Form.Item name="ks_amount" label="Выполнено по КС (подписано)">
            <InputNumber className="w-full" precision={2} />
          </Form.Item>
          <Form.Item name="fact_amount" label="Выполнение фактическое">
            <InputNumber className="w-full" precision={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
