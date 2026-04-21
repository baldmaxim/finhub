import { useEffect } from 'react';
import type { FC } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Tabs,
  Row,
  Col,
  Switch,
  Button,
  Divider,
  Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type {
  ContractDossier,
  ContractDossierFormData,
  DossierDocumentType,
} from '../../types/dossier';

const fmtNum = (v: number | undefined) =>
  v != null ? v.toLocaleString('ru-RU') : '—';
const fmtDate = (v: string | undefined) =>
  v ? v.split('-').reverse().join('.') : '—';

const { TextArea } = Input;
const { Text } = Typography;

interface IProps {
  open: boolean;
  mode: DossierDocumentType;
  projectId: string;
  dossier: ContractDossier | null;
  base?: ContractDossier | null;
  loading: boolean;
  onSave: (data: ContractDossierFormData) => void;
  onCancel: () => void;
}

const numFmt = (v: number | string | undefined) =>
  `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const numParse = (v: string | undefined): string =>
  (v ?? '').replace(/\s/g, '');

export const DossierEditModal: FC<IProps> = ({
  open,
  mode,
  projectId,
  dossier,
  base,
  loading,
  onSave,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const isEdit = !!dossier;
  const isAmendment = mode === 'amendment';
  const showHints = isAmendment && !isEdit && !!base;

  const hint = (label: string, current: string) =>
    showHints
      ? <>{label} <Text type="secondary" style={{ fontSize: 11 }}>({current})</Text></>
      : label;

  useEffect(() => {
    if (!open) return;
    if (dossier) {
      form.setFieldsValue({
        document_number: dossier.document_number,
        document_date: dossier.document_date ? dayjs(dossier.document_date) : null,
        amendment_summary: dossier.amendment_summary,
        // Header
        contract_name: dossier.header_data.contract_name,
        contract_object: dossier.header_data.contract_object,
        contract_amount: dossier.header_data.contract_amount,
        price_type: dossier.header_data.price_type,
        nds_rate: dossier.header_data.nds_rate,
        start_date: dossier.header_data.start_date ? dayjs(dossier.header_data.start_date) : null,
        end_date: dossier.header_data.end_date ? dayjs(dossier.header_data.end_date) : null,
        status: dossier.header_data.status,
        duration_months: dossier.header_data.duration_months,
        // BDDS
        advance_payment_days: dossier.bdds_data.advance_payment_days,
        advance_requires_bg: dossier.bdds_data.advance_requires_bg,
        preferential_advance_pct: dossier.bdds_data.preferential_advance_pct,
        preferential_advance_bank: dossier.bdds_data.preferential_advance_bank,
        ks2_submission_day: dossier.bdds_data.ks2_submission_day,
        ks2_acceptance_days: dossier.bdds_data.ks2_acceptance_days,
        ks2_payment_days: dossier.bdds_data.ks2_payment_days,
        gu_rate_pct: dossier.bdds_data.gu_rate_pct,
        gu_return_months: dossier.bdds_data.gu_return_months,
        gu_bg_replacement: dossier.bdds_data.gu_bg_replacement,
        gu_bg_return_days: dossier.bdds_data.gu_bg_return_days,
        // BDR
        savings_gp_pct: dossier.bdr_data.savings_gp_pct,
        savings_customer_pct: dossier.bdr_data.savings_customer_pct,
        savings_customer_init_gp_pct: dossier.bdr_data.savings_customer_init_gp_pct,
        savings_customer_init_pct: dossier.bdr_data.savings_customer_init_pct,
        price_revision_threshold_pct: dossier.bdr_data.price_revision_threshold_pct,
        price_revision_appendix: dossier.bdr_data.price_revision_appendix,
        insurance_go_amount: dossier.bdr_data.insurance_go_amount,
        opex_items: dossier.bdr_data.opex_items,
        // Penalties
        penalties: dossier.penalties_data.penalties,
        customer_penalty_rate_pct: dossier.penalties_data.customer_penalty_rate_pct,
        customer_penalty_start_day: dossier.penalties_data.customer_penalty_start_day,
      });
    } else {
      form.resetFields();
      if (isAmendment) {
        form.setFieldsValue({ document_number: '' });
      }
    }
  }, [open, dossier, form, isAmendment]);

  const handleOk = async () => {
    try {
      const vals = await form.validateFields();
      const data: ContractDossierFormData = {
        project_id: projectId,
        document_type: mode,
        document_number: vals.document_number,
        document_date: vals.document_date ? vals.document_date.format('YYYY-MM-DD') : null,
        is_active: true,
        header_data: {
          contract_name: vals.contract_name || '',
          contract_object: vals.contract_object || '',
          contract_amount: vals.contract_amount || 0,
          price_type: vals.price_type || 'fixed',
          nds_rate: vals.nds_rate ?? 20,
          start_date: vals.start_date ? vals.start_date.format('YYYY-MM-DD') : '',
          end_date: vals.end_date ? vals.end_date.format('YYYY-MM-DD') : '',
          status: vals.status || 'active',
          duration_months: vals.duration_months || 0,
        },
        bdds_data: {
          advance_payment_days: vals.advance_payment_days ?? 0,
          advance_requires_bg: vals.advance_requires_bg ?? true,
          preferential_advance_pct: vals.preferential_advance_pct ?? 0,
          preferential_advance_bank: vals.preferential_advance_bank || '',
          ks2_submission_day: vals.ks2_submission_day ?? 5,
          ks2_acceptance_days: vals.ks2_acceptance_days ?? 15,
          ks2_payment_days: vals.ks2_payment_days ?? 15,
          gu_rate_pct: vals.gu_rate_pct ?? 0,
          gu_return_months: vals.gu_return_months ?? 24,
          gu_bg_replacement: vals.gu_bg_replacement ?? false,
          gu_bg_return_days: vals.gu_bg_return_days ?? 10,
        },
        bdr_data: {
          savings_gp_pct: vals.savings_gp_pct ?? 0,
          savings_customer_pct: vals.savings_customer_pct ?? 100,
          savings_customer_init_gp_pct: vals.savings_customer_init_gp_pct ?? 0,
          savings_customer_init_pct: vals.savings_customer_init_pct ?? 100,
          price_revision_threshold_pct: vals.price_revision_threshold_pct ?? 10,
          price_revision_appendix: vals.price_revision_appendix || '',
          insurance_go_amount: vals.insurance_go_amount ?? 0,
          opex_items: vals.opex_items ?? [],
        },
        penalties_data: {
          penalties: vals.penalties ?? [],
          customer_penalty_rate_pct: vals.customer_penalty_rate_pct ?? 0,
          customer_penalty_start_day: vals.customer_penalty_start_day ?? 0,
        },
        amendment_summary: vals.amendment_summary || null,
      };
      onSave(data);
    } catch {
      // validation
    }
  };

  const title = isEdit
    ? `Редактировать: ${dossier?.document_number}`
    : isAmendment
      ? 'Новое дополнительное соглашение'
      : 'Новый базовый договор';

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okText="Сохранить"
      cancelText="Отмена"
      width={900}
      destroyOnClose
    >
      <Form form={form} layout="vertical" size="small">
        <Tabs
          items={[
            {
              key: 'general',
              label: 'Общее',
              children: (
                <>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        name="document_number"
                        label="Номер документа"
                        rules={[{ required: true, message: 'Обязательное поле' }]}
                      >
                        <Input placeholder={isAmendment ? 'ДС №1' : '№К14'} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="document_date" label="Дата документа">
                        <DatePicker className="w-full" format="DD.MM.YYYY" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="status" label="Статус">
                        <Select
                          options={[
                            { value: 'active', label: 'В работе' },
                            { value: 'completed', label: 'Завершён' },
                            { value: 'suspended', label: 'Приостановлен' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  {isAmendment && (
                    <Form.Item name="amendment_summary" label="Краткое описание изменений ДС">
                      <TextArea rows={2} placeholder="Что изменяет данное ДС?" />
                    </Form.Item>
                  )}
                  <Divider>Шапка договора</Divider>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="contract_name" label="Наименование договора">
                        <Input placeholder="Договор генподряда №К14" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="contract_object" label="Объект">
                        <Input placeholder="ЖК PRIMAVERA квартал Bellini. К14" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="contract_amount" label={hint('Сумма договора, ₽', `${fmtNum(base?.header_data.contract_amount)} ₽`)}>
                        <InputNumber
                          className="w-full"
                          min={0}
                          formatter={numFmt}
                          parser={numParse}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item name="price_type" label="Тип цены">
                        <Select
                          options={[
                            { value: 'fixed', label: 'Твёрдая' },
                            { value: 'estimated', label: 'Ориентировочная' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item name="nds_rate" label={hint('НДС, %', `${base?.header_data.nds_rate ?? '—'}%`)}>
                        <InputNumber className="w-full" min={0} max={100} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item name="start_date" label={hint('Начало', fmtDate(base?.header_data.start_date))}>
                        <DatePicker className="w-full" format="DD.MM.YYYY" />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item name="end_date" label={hint('Окончание', fmtDate(base?.header_data.end_date))}>
                        <DatePicker className="w-full" format="DD.MM.YYYY" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="duration_months" label={hint('Срок, мес.', `${base?.header_data.duration_months ?? '—'} мес.`)}>
                    <InputNumber min={0} />
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'bdds',
              label: 'БДДС',
              children: (
                <>
                  <Text type="secondary">Условия денежных потоков</Text>
                  <Divider>Авансирование</Divider>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="advance_payment_days" label={hint('Срок выплаты аванса, раб. дн.', `${base?.bdds_data.advance_payment_days ?? '—'} дн.`)}>
                        <InputNumber className="w-full" min={0} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="advance_requires_bg" label="Требуется БГ" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="preferential_advance_pct" label={hint('Льготный аванс (без БГ), %', `${base?.bdds_data.preferential_advance_pct ?? '—'}%`)}>
                        <InputNumber className="w-full" min={0} max={100} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="preferential_advance_bank" label="Банк льготного аванса">
                    <Input placeholder="ВТБ" />
                  </Form.Item>
                  <Divider>Тайминг КС-2/КС-3</Divider>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="ks2_submission_day" label={hint('Подача актов (до N числа)', `${base?.bdds_data.ks2_submission_day ?? '—'}`)}>
                        <InputNumber className="w-full" min={1} max={31} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="ks2_acceptance_days" label={hint('Приёмка, раб. дн.', `${base?.bdds_data.ks2_acceptance_days ?? '—'} дн.`)}>
                        <InputNumber className="w-full" min={0} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="ks2_payment_days" label={hint('Оплата, раб. дн.', `${base?.bdds_data.ks2_payment_days ?? '—'} дн.`)}>
                        <InputNumber className="w-full" min={0} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Divider>Гарантийное удержание</Divider>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item name="gu_rate_pct" label={hint('Ставка ГУ, %', `${base?.bdds_data.gu_rate_pct ?? '—'}%`)}>
                        <InputNumber className="w-full" min={0} max={100} step={0.5} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="gu_return_months" label={hint('Возврат через, мес.', `${base?.bdds_data.gu_return_months ?? '—'} мес.`)}>
                        <InputNumber className="w-full" min={0} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="gu_bg_replacement" label="Замена на БГ" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="gu_bg_return_days" label={hint('Возврат при замене, раб. дн.', `${base?.bdds_data.gu_bg_return_days ?? '—'} дн.`)}>
                        <InputNumber className="w-full" min={0} />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ),
            },
            {
              key: 'bdr',
              label: 'БДР',
              children: (
                <>
                  <Divider>Распределение экономии</Divider>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item name="savings_gp_pct" label={hint('Инициатива ГП — нам, %', `${base?.bdr_data.savings_gp_pct ?? '—'}%`)}>
                        <InputNumber className="w-full" min={0} max={100} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="savings_customer_pct" label={hint('Инициатива ГП — заказчику, %', `${base?.bdr_data.savings_customer_pct ?? '—'}%`)}>
                        <InputNumber className="w-full" min={0} max={100} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="savings_customer_init_gp_pct" label={hint('Инициатива Заказчика — нам, %', `${base?.bdr_data.savings_customer_init_gp_pct ?? '—'}%`)}>
                        <InputNumber className="w-full" min={0} max={100} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="savings_customer_init_pct" label={hint('Инициатива Заказчика — им, %', `${base?.bdr_data.savings_customer_init_pct ?? '—'}%`)}>
                        <InputNumber className="w-full" min={0} max={100} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Divider>Пересчёт цены</Divider>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="price_revision_threshold_pct" label={hint('Порог изменения рынка, %', `${base?.bdr_data.price_revision_threshold_pct ?? '—'}%`)}>
                        <InputNumber className="w-full" min={0} max={100} />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item name="price_revision_appendix" label="Приложение">
                        <Input placeholder="Приложение №2.1" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Divider>Страхование</Divider>
                  <Form.Item name="insurance_go_amount" label="Полис страхования ГО, ₽">
                    <InputNumber
                      className="w-full"
                      min={0}
                      formatter={numFmt}
                      parser={numParse}
                    />
                  </Form.Item>
                  <Divider>OPEX (специфические затраты)</Divider>
                  <Form.List name="opex_items">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...rest }) => (
                          <Row gutter={8} key={key} className="mb-8">
                            <Col span={8}>
                              <Form.Item {...rest} name={[name, 'title']} noStyle>
                                <Input placeholder="Название" />
                              </Form.Item>
                            </Col>
                            <Col span={14}>
                              <Form.Item {...rest} name={[name, 'description']} noStyle>
                                <Input placeholder="Описание" />
                              </Form.Item>
                            </Col>
                            <Col span={2}>
                              <Button
                                icon={<DeleteOutlined />}
                                size="small"
                                danger
                                onClick={() => remove(name)}
                              />
                            </Col>
                          </Row>
                        ))}
                        <Button
                          type="dashed"
                          onClick={() => add({ title: '', description: '' })}
                          icon={<PlusOutlined />}
                          block
                        >
                          Добавить статью OPEX
                        </Button>
                      </>
                    )}
                  </Form.List>
                </>
              ),
            },
            {
              key: 'penalties',
              label: 'Штрафы',
              children: (
                <>
                  <Form.List name="penalties">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...rest }) => (
                          <Row gutter={8} key={key} className="mb-8">
                            <Col span={10}>
                              <Form.Item {...rest} name={[name, 'violation']} noStyle>
                                <Input placeholder="Тип нарушения" />
                              </Form.Item>
                            </Col>
                            <Col span={6}>
                              <Form.Item {...rest} name={[name, 'rate']} noStyle>
                                <InputNumber
                                  placeholder="Сумма штрафа"
                                  className="w-full"
                                  min={0}
                                  formatter={numFmt}
                                  parser={numParse}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={6}>
                              <Form.Item {...rest} name={[name, 'unit']} noStyle>
                                <Input placeholder="за каждый день" />
                              </Form.Item>
                            </Col>
                            <Col span={2}>
                              <Button
                                icon={<DeleteOutlined />}
                                size="small"
                                danger
                                onClick={() => remove(name)}
                              />
                            </Col>
                          </Row>
                        ))}
                        <Button
                          type="dashed"
                          onClick={() => add({ violation: '', rate: 0, unit: 'за каждый день' })}
                          icon={<PlusOutlined />}
                          block
                          className="mb-16"
                        >
                          Добавить штраф
                        </Button>
                      </>
                    )}
                  </Form.List>
                  <Divider>Встречная ответственность заказчика</Divider>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="customer_penalty_rate_pct" label={hint('Пени заказчика, %/день', `${base?.penalties_data.customer_penalty_rate_pct ?? '—'}%`)}>
                        <InputNumber className="w-full" min={0} max={100} step={0.01} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="customer_penalty_start_day" label={hint('Начисление с N-го раб. дня', `с ${base?.penalties_data.customer_penalty_start_day ?? '—'}-го`)}>
                        <InputNumber className="w-full" min={0} />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
};
