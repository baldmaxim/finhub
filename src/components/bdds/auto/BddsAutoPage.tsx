import { FC, useState, useCallback } from 'react';
import {
  Row, Col, Card, Button, Select, Typography, Space, Alert, Descriptions,
  InputNumber, Divider, Badge, Tooltip,
} from 'antd';
import {
  ThunderboltOutlined, SettingOutlined, WarningOutlined, LinkOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useBddsAuto } from '../../../hooks/useBddsAuto';
import { useProjects } from '../../../hooks/useProjects';
import { BddsContractStatus } from './BddsContractStatus';
import { BddsKsPlanTable } from './BddsKsPlanTable';
import type { Project } from '../../../types/projects';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => currentYear - 2 + i).map((y) => ({
  value: y,
  label: String(y),
}));

export const BddsAutoPage: FC = () => {
  const navigate = useNavigate();
  const { projects, loading: projectsLoading } = useProjects();

  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [year, setYear] = useState(currentYear);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const {
    calcRows, status, genResult, loading, generating,
    guRatePct, prefAdvancePct, lagMonths, effective,
    setGuRatePct, setPrefAdvancePct, setLagMonths,
    saveKsPlanEntry, removeKsPlanEntry, generatePlan,
  } = useBddsAuto(selectedProjectId, year);

  const hasDossier = !!effective;

  const handleProjectChange = useCallback((id: string) => {
    setSelectedProjectId(id);
    const project = projects.find((p) => p.id === id) ?? null;
    setSelectedProject(project);
    if (project?.start_date) {
      setYear(new Date(project.start_date).getFullYear());
    }
  }, [projects]);

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const lagDays = lagMonths * 30;

  return (
    <div className="bdds-auto-page">
      {/* Тулбар */}
      <Card className="bdds-auto-toolbar" size="small">
        <Row gutter={12} align="middle" wrap>
          <Col>
            <Select
              showSearch
              placeholder="Выберите проект"
              style={{ width: 300 }}
              loading={projectsLoading}
              options={projectOptions}
              optionFilterProp="label"
              onChange={handleProjectChange}
              value={selectedProjectId}
              allowClear
              onClear={() => { setSelectedProjectId(undefined); setSelectedProject(null); }}
            />
          </Col>
          <Col>
            <Select
              value={year}
              onChange={setYear}
              options={YEAR_OPTIONS}
              style={{ width: 90 }}
            />
          </Col>
          <Col flex="auto" />
          <Col>
            <Space>
              <Tooltip title="Перейти в Шлюз 1С для разбора неразнесённых платежей">
                <Button
                  icon={<LinkOutlined />}
                  onClick={() => navigate('/etl')}
                >
                  Шлюз 1С
                </Button>
              </Tooltip>
              <Tooltip title="Перейти в Досье договора">
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => navigate('/dossier')}
                >
                  Досье
                </Button>
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Статус-бар */}
      <BddsContractStatus status={status} loading={loading} />

      {/* Параметры генерации */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            <span>Плановый генератор БДДС</span>
            {selectedProject && (
              <Typography.Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>
                — {selectedProject.name}, {year}
              </Typography.Text>
            )}
          </Space>
        }
        className="bdds-auto-gen-card"
      >
        {!selectedProjectId ? (
          <Alert
            message="Выберите проект для работы с плановым генератором"
            type="info"
            showIcon
          />
        ) : (
          <>
            {/* Параметры досье (предпросмотр для расчёта в таблице) */}
            <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
              <Col>
                <Typography.Text type="secondary">
                  Параметры лага и удержаний:
                  {hasDossier && (
                    <Tooltip title="Значения загружены из досье договора. Можно изменить вручную.">
                      <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 6 }} />
                    </Tooltip>
                  )}
                </Typography.Text>
              </Col>
              <Col>
                <Space>
                  <span>ГУ, %:</span>
                  <InputNumber
                    min={0} max={20} step={0.5}
                    value={guRatePct}
                    onChange={(v) => setGuRatePct(v ?? 0)}
                    style={{ width: 80 }}
                  />
                </Space>
              </Col>
              <Col>
                <Space>
                  <span>Целевой аванс, %:</span>
                  <InputNumber
                    min={0} max={100} step={1}
                    value={prefAdvancePct}
                    onChange={(v) => setPrefAdvancePct(v ?? 0)}
                    style={{ width: 80 }}
                  />
                </Space>
              </Col>
              <Col>
                <Space>
                  <Tooltip title="Общий лаг = день сдачи КС + дней приёмки + дней оплаты (из досье)">
                    <span>Лаг оплаты, мес.:</span>
                  </Tooltip>
                  <InputNumber
                    min={1} max={6}
                    value={lagMonths}
                    onChange={(v) => setLagMonths(v ?? 2)}
                    style={{ width: 70 }}
                  />
                  <Typography.Text type="secondary">(≈{lagDays} дн.)</Typography.Text>
                </Space>
              </Col>
              <Col flex="auto" />
              <Col>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  loading={generating}
                  disabled={!selectedProjectId || calcRows.length === 0}
                  onClick={generatePlan}
                >
                  Сгенерировать план БДДС
                </Button>
              </Col>
            </Row>

            {calcRows.length === 0 && (
              <Alert
                icon={<WarningOutlined />}
                message="Добавьте плановый график КС-2 ниже, затем нажмите «Сгенерировать план БДДС»."
                description="Система рассчитает плановые поступления с учётом лага оплаты, зачётов авансов и ГУ."
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Результат последней генерации */}
            {genResult && !genResult.error && (
              <Alert
                type="success"
                showIcon
                closable
                style={{ marginBottom: 16 }}
                message={`Создано ${genResult.inserted} плановых записей`}
                description={
                  <Descriptions size="small" column={3}>
                    <Descriptions.Item label="Лаг оплаты">{genResult.lag_months} мес.</Descriptions.Item>
                    <Descriptions.Item label="Накоплено ГУ">
                      {new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(
                        genResult.total_gu_accumulated
                      )} ₽
                    </Descriptions.Item>
                  </Descriptions>
                }
              />
            )}

            <Divider orientation="left" style={{ margin: '8px 0 12px' }}>
              График КС-2
              <Badge count={calcRows.length} style={{ marginLeft: 8, backgroundColor: '#1677ff' }} />
            </Divider>

            <BddsKsPlanTable
              projectId={selectedProjectId}
              year={year}
              rows={calcRows}
              guRatePct={guRatePct}
              prefAdvancePct={prefAdvancePct}
              lagMonths={lagMonths}
              onSave={saveKsPlanEntry}
              onDelete={removeKsPlanEntry}
            />
          </>
        )}
      </Card>

      {/* Нераспределённые платежи */}
      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: '#faad14' }} />
            <span>Нераспределённые платежи</span>
          </Space>
        }
        extra={
          <Button type="link" onClick={() => navigate('/etl')}>
            Открыть Шлюз 1С →
          </Button>
        }
        size="small"
        className="bdds-auto-quarantine-card"
      >
        <Typography.Text type="secondary">
          Платежи, где ИНН контрагента или номер договора не совпали с реестром, отображаются
          в разделе <Typography.Link onClick={() => navigate('/etl')}>Шлюз 1С → Карантин</Typography.Link>.
          Там доступна ручная привязка выписки к проекту и статье БДДС.
        </Typography.Text>
      </Card>
    </div>
  );
};
