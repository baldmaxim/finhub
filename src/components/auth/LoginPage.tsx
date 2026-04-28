import { useState } from 'react';
import { Card, Form, Input, Button, Typography, message, Space } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSignIn = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await signIn(values.email, values.password);
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await signUp(values.email, values.password);
      message.success('Регистрация успешна! Проверьте email для подтверждения.');
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#f0f2f5',
    }}>
      <Card style={{ width: 400 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          FinHub
        </Title>
        <Form form={form} layout="vertical">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Некорректный email' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Введите пароль' },
              { min: 6, message: 'Минимум 6 символов' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Пароль" size="large" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%' }} orientation="vertical">
              <Button
                type="primary"
                block
                size="large"
                loading={loading}
                onClick={handleSignIn}
              >
                Войти
              </Button>
              <Button block size="large" loading={loading} onClick={handleSignUp}>
                Зарегистрироваться
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
