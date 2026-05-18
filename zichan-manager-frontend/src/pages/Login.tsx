import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await client.post('/api/users/login', values);
      localStorage.setItem('token', res.data.access_token);
      message.success('登录成功');
      navigate('/');
    } catch {
      message.error('用户名或密码错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 100%)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: 24,
          padding: 48,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img
            src="/logo.png"
            alt="logo"
            style={{
              maxHeight: 64,
              maxWidth: '100%',
              marginBottom: 24,
            }}
          />
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: '#1d1d1f',
              margin: 0,
              letterSpacing: '-0.021em',
            }}
          >
            欢迎回来
          </h1>
          <p
            style={{
              fontSize: 15,
              color: '#86868b',
              marginTop: 8,
            }}
          >
            请登录您的账户
          </p>
        </div>

        <Form onFinish={onFinish} size="large" layout="vertical">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
            style={{ marginBottom: 20 }}
          >
            <Input placeholder="用户名 *" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
            style={{ marginBottom: 28 }}
          >
            <Input.Password placeholder="密码 *" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{
                height: 52,
                borderRadius: 12,
                fontSize: 17,
                fontWeight: 600,
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '24px 0',
          }}
        >
          <div style={{ flex: 1, height: 1, background: '#e5e5e7' }} />
          <span style={{ color: '#86868b', fontSize: 13 }}>或</span>
          <div style={{ flex: 1, height: 1, background: '#e5e5e7' }} />
        </div>

        <Button
          block
          size="large"
          onClick={() => {
            const redirectUri = `${window.location.origin}/login/feishu/callback`;
            const encodedRedirectUri = encodeURIComponent(redirectUri);
            window.location.href =
              `https://open.feishu.cn/open-apis/authen/v1/index?app_id=${import.meta.env.VITE_FEISHU_APP_ID}&redirect_uri=${encodedRedirectUri}&state=`;
          }}
          style={{
            height: 52,
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #00c6ff 0%, #0071e3 100%)',
            border: 'none',
            color: '#fff',
          }}
        >
          飞书一键登录
        </Button>


      </div>
    </div>
  );
}
