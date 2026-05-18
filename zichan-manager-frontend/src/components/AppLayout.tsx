import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Drawer, Button, Modal, Spin, Tag, Typography, message } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  LaptopOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  TeamOutlined,
  BankOutlined,
  MenuOutlined,
  SettingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import client from '../api/client';
import type { User, VersionInfo, UpdateCheckResult } from '../types';
import dayjs from 'dayjs';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckResult | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchVersion = async () => {
    try {
      const res = await client.get('/api/version');
      setVersionInfo(res.data);
    } catch {
      // ignore on error
    }
  };

  useEffect(() => {
    fetchVersion();
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateCheck(null);
    try {
      const res = await client.get<UpdateCheckResult>('/api/version/check-update');
      setUpdateCheck(res.data);
    } catch (err: any) {
      message.error(err.response?.data?.detail || '检查更新失败');
    }
    setChecking(false);
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const res = await client.post('/api/version/update');
      if (res.data.success) {
        message.success('更新并部署完成，页面即将刷新...');
        setTimeout(() => window.location.reload(), 3000);
      } else {
        message.error(res.data.error || '更新失败');
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || '更新失败');
    }
    setUpdating(false);
  };

  const isAdmin = user?.role === 'admin' || user?.role === '管理员';

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '工作台' },
    ...(isAdmin ? [
      { key: '/assets', icon: <LaptopOutlined />, label: '资产管理' },
      { key: '/categories', icon: <AppstoreOutlined />, label: '分类管理' },
      { key: '/persons', icon: <TeamOutlined />, label: '人员管理' },
      { key: '/departments', icon: <BankOutlined />, label: '部门管理' },
      { key: '/reports', icon: <BarChartOutlined />, label: '资产报表' },
    ] : []),
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleMenuClick = (key: string) => {
    navigate(key);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  useEffect(() => {
    if (user) return;
    client.get('/api/users/me').then((res) => {
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
    });
  }, [user]);

  const getRoleName = (role: string | undefined) => {
    if (role === 'admin' || role === '管理员') return '管理员';
    if (role === 'user') return '普通用户';
    if (role === '来访') return '来访人员';
    return role || '未知';
  };

  const dropdownItems = {
    items: [
      { key: 'username', label: user?.username, disabled: true },
      { key: 'role', label: `角色: ${getRoleName(user?.role)}`, disabled: true },
      { type: 'divider' as const },
      ...(isAdmin ? [
        { key: 'users', icon: <SettingOutlined />, label: '账号管理' },
        { type: 'divider' as const },
      ] : []),
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') handleLogout();
      if (key === 'users') navigate('/users');
    },
  };

  const menuContent = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={({ key }) => handleMenuClick(key)}
      style={{
        borderRight: 'none',
        padding: '12px 8px',
      }}
    />
  );

  const versionText = versionInfo
    ? (versionInfo.tag || versionInfo.commit || 'dev')
    : '...';

  const logoSection = (
    <div
      style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
        padding: collapsed && !isMobile ? '0 16px' : '0 24px',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        gap: collapsed && !isMobile ? 0 : 10,
      }}
    >
      <img
        src="/logo.png"
        alt="Logo"
        style={{
          maxHeight: collapsed && !isMobile ? 28 : 36,
          maxWidth: '100%',
          transition: 'all 0.3s ease',
        }}
      />
      {(!collapsed || isMobile) && (
        <Tag
          color="blue"
          style={{
            cursor: 'pointer',
            borderRadius: 10,
            fontSize: 11,
            lineHeight: '18px',
            margin: 0,
            padding: '0 8px',
          }}
          onClick={() => {
            setVersionModalOpen(true);
            setUpdateCheck(null);
          }}
        >
          {versionText}
        </Tag>
      )}
    </div>
  );

  const versionModal = (
    <Modal
      title="版本信息"
      open={versionModalOpen}
      onCancel={() => { setVersionModalOpen(false); setUpdateCheck(null); }}
      footer={[
        <Button key="check" icon={<ReloadOutlined />} loading={checking} onClick={handleCheckUpdate}>
          检查更新
        </Button>,
        ...(updateCheck?.has_update && isAdmin ? [
          <Button key="update" type="primary" danger loading={updating} onClick={handleUpdate}>
            更新并重新部署
          </Button>,
        ] : []),
        <Button key="close" onClick={() => { setVersionModalOpen(false); setUpdateCheck(null); }}>
          关闭
        </Button>,
      ]}
    >
      {versionInfo ? (
        <div style={{ lineHeight: 2 }}>
          <p><Tag color="blue">版本</Tag> {versionInfo.version || '-'}</p>
          <p><Tag color="geekblue">Commit</Tag> {versionInfo.commit || '-'}</p>
          <p><Tag>日期</Tag> {versionInfo.commit_date ? dayjs(versionInfo.commit_date).format('YYYY-MM-DD HH:mm') : '-'}</p>
          {updateCheck?.has_update && (
            <div style={{
              marginTop: 12,
              padding: 12,
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: 8,
            }}>
              <Typography.Text strong style={{ color: '#faad14' }}>发现新版本</Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                当前: {updateCheck.current_commit} → 最新: {updateCheck.latest_commit}
              </Typography.Text>
              {updateCheck.changes && (
                <pre style={{ fontSize: 11, marginTop: 8, color: '#666' }}>{updateCheck.changes}</pre>
              )}
            </div>
          )}
          {updateCheck && !updateCheck.has_update && (
            <div style={{ marginTop: 12, color: '#52c41a' }}>
              <Typography.Text strong>✓ 已是最新版本</Typography.Text>
            </div>
          )}
        </div>
      ) : (
        <Spin />
      )}
    </Modal>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {versionModal}

      {/* Mobile Header */}
      {isMobile && (
        <Header
          className="mobile-header"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 56,
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            zIndex: 100,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 20, color: '#1d1d1f' }} />}
            onClick={() => setMobileOpen(true)}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
          <span style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f' }}>
            资产管理
          </span>
          <Dropdown menu={dropdownItems} placement="bottomRight">
            <Avatar
              icon={<UserOutlined />}
              style={{
                background: 'linear-gradient(135deg, #0071e3 0%, #00c6ff 100%)',
                cursor: 'pointer',
              }}
            />
          </Dropdown>
        </Header>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          closable={false}
          styles={{
            body: { padding: 0 },
            header: { display: 'none' },
          }}
          style={{ background: '#ffffff' }}
        >
          {logoSection}
          {menuContent}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '16px 24px',
              borderTop: '1px solid rgba(0, 0, 0, 0.06)',
              background: '#ffffff',
            }}
          >
            <div
              style={{ fontSize: 12, color: '#86868b', textAlign: 'center', cursor: 'pointer' }}
              onClick={() => {
                setVersionModalOpen(true);
                setUpdateCheck(null);
              }}
            >
              资产管理系统 {versionText}
            </div>
          </div>
        </Drawer>
      )}

      {/* Desktop Sider */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{
            background: '#ffffff',
            borderRight: '1px solid rgba(0, 0, 0, 0.06)',
            boxShadow: '4px 0 24px rgba(0, 0, 0, 0.04)',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
          }}
          width={240}
          collapsedWidth={80}
          trigger={null}
        >
          {logoSection}
          {menuContent}
          {/* Custom Collapse Button */}
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderTop: '1px solid rgba(0, 0, 0, 0.06)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: '#ffffff',
            }}
            className="sider-trigger"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="#86868b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition: 'transform 0.3s ease',
                transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </div>
        </Sider>
      )}

      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 80 : 240,
          transition: 'none',
          minHeight: '100vh',
        }}
      >
        {/* Desktop Header */}
        {!isMobile && (
          <Header
            style={{
              background: '#ffffff',
              padding: '0 32px',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              position: 'sticky',
              top: 0,
              zIndex: 99,
              height: 56,
            }}
          >
            <Dropdown menu={dropdownItems} placement="bottomRight">
              <Space
                style={{
                  cursor: 'pointer',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  transition: 'all 0.2s ease',
                }}
                className="user-dropdown"
              >
                <Avatar
                  icon={<UserOutlined />}
                  style={{
                    background: 'linear-gradient(135deg, #0071e3 0%, #00c6ff 100%)',
                  }}
                />
                <span style={{ fontWeight: 500, color: '#1d1d1f', fontSize: 14 }}>
                  {user?.username || '加载中...'}
                </span>
              </Space>
            </Dropdown>
          </Header>
        )}

        <Content
          style={{
            flex: 1,
            padding: isMobile ? '72px 12px 24px' : '24px 32px',
            overflowX: 'hidden',
            background: '#fbfbfd',
          }}
        >
          <div
            style={{
              maxWidth: 1600,
              margin: '0 auto',
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>

      <style>{`
        .user-dropdown:hover {
          background: rgba(0, 0, 0, 0.04);
        }
        .sider-trigger:hover {
          background: #f5f5f7 !important;
        }
        .sider-trigger:hover svg {
          stroke: #0071e3 !important;
        }
        .ant-drawer-body {
          padding: 0 !important;
        }
        .ant-menu-light .ant-menu-item {
          margin: 4px 12px;
          width: calc(100% - 24px);
          height: 44px;
          line-height: 44px;
          border-radius: 8px;
          transition: background 0.2s ease, color 0.2s ease;
          color: #1d1d1f;
        }
        .ant-menu-light .ant-menu-item .anticon {
          color: #1d1d1f;
        }
        .ant-menu-light .ant-menu-item:hover {
          background: #f5f5f7;
          color: #1d1d1f;
        }
        .ant-menu-light .ant-menu-item:hover .anticon {
          color: #1d1d1f;
        }
        .ant-menu-light .ant-menu-item-selected {
          background: rgba(0, 113, 227, 0.1);
          color: #0071e3;
          box-shadow: none;
        }
        .ant-menu-light .ant-menu-item-selected .anticon {
          color: #0071e3;
        }
        .ant-btn {
          transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }
        .ant-btn:hover {
          transform: none !important;
        }
        .ant-table-column-sorter {
          transition: none !important;
        }
        .ant-table-column-sorter:hover {
          transform: none !important;
        }
        .ant-table-filter-trigger {
          transition: none !important;
        }
        .ant-table-filter-trigger:hover {
          transform: none !important;
        }
        .ant-table-thead > tr > th {
          transition: none !important;
          position: relative;
        }
        .ant-table-cell {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ant-table-wrapper {
          overflow-x: auto !important;
        }
        .ant-table-column-sorter .anticon {
          pointer-events: none;
        }
        .ant-table-filter-trigger .anticon {
          pointer-events: none;
        }
      `}</style>
    </Layout>
  );
}