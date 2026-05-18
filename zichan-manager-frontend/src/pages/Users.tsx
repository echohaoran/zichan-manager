import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Select, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import client from '../api/client';
import type { User } from '../types';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/users');
      setUsers(res.data);
    } catch {
      message.error('获取用户列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    form.setFieldsValue({ username: user.username, role: user.role });
    setModalOpen(true);
  };

  const openPasswordEdit = (user: User) => {
    setPasswordUser(user);
    passwordForm.resetFields();
    setPasswordModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await client.put(`/api/users/${editing.id}`, values);
        message.success('已更新');
      } else {
        await client.post('/api/users', { ...values, password: values.password || '123456' });
        message.success('已创建');
      }
      setModalOpen(false);
      fetch();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '操作失败');
    }
  };

  const handlePasswordSubmit = async () => {
    const values = await passwordForm.validateFields();
    try {
      await client.put(`/api/users/${passwordUser!.id}/password`, values);
      message.success('密码已修改');
      setPasswordModalOpen(false);
    } catch (err: any) {
      message.error(err.response?.data?.detail || '修改密码失败');
    }
  };

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await client.delete(`/api/users/${deleteId}`);
      message.success('已删除');
      setDeleteId(null);
      fetch();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '删除失败');
      setDeleteId(null);
    }
  };

  const roleOptions = [
    { value: 'admin', label: '管理员' },
    { value: 'user', label: '普通用户' },
    { value: '来访', label: '来访人员' },
  ];

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const colors: Record<string, string> = { admin: 'red', user: 'blue', '来访': 'green' };
        const labels: Record<string, string> = { admin: '管理员', user: '普通用户', '来访': '来访人员' };
        return <Tag color={colors[role] || 'default'}>{labels[role] || role}</Tag>;
      },
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (v: string) => v?.slice(0, 10) },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space>
          <Button type="link" onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" onClick={() => openPasswordEdit(record)}>改密码</Button>
          {record.id !== currentUser.id && (
            <Button type="link" danger onClick={() => setDeleteId(record.id)}>删除</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增用户</Button>
      </Space>
      <Table columns={columns} dataSource={users} rowKey="id" loading={loading} />

      <Modal title={editing ? '编辑用户' : '新增用户'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名 *" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {!editing && (
            <Form.Item name="password" label="初始密码">
              <Input.Password placeholder="默认: 123456" />
            </Form.Item>
          )}
          <Form.Item name="role" label="角色 *" rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`修改 ${passwordUser?.username} 的密码`} open={passwordModalOpen} onOk={handlePasswordSubmit} onCancel={() => setPasswordModalOpen(false)}>
        <Form form={passwordForm} layout="vertical">
          <Form.Item name="password" label="新密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="确认删除" open={deleteId !== null} onOk={handleDelete} onCancel={() => setDeleteId(null)} okText="确认删除" okButtonProps={{ danger: true, style: { background: '#ff3b30', color: '#fff', border: 'none' } }}>
        <p>确定要删除这个账号吗？</p>
      </Modal>
    </div>
  );
}
