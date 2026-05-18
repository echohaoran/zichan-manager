import { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Spin, message } from 'antd';
import client from '../api/client';
import type { FeishuTokenResponse } from '../types';

export default function FeishuCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const code = searchParams.get('code');
    if (!code) {
      message.error('飞书授权失败：缺少授权码');
      navigate('/login', { replace: true });
      return;
    }

    client
      .post<FeishuTokenResponse>('/api/feishu/login', { code })
      .then((res) => {
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        message.success('飞书登录成功');
        navigate('/', { replace: true });
      })
      .catch((err) => {
        message.error(err.response?.data?.detail || '飞书登录失败');
        navigate('/login', { replace: true });
      });
  }, [searchParams, navigate]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <Spin size="large" />
      <span style={{ color: '#86868b', fontSize: 15 }}>飞书登录中...</span>
    </div>
  );
}
