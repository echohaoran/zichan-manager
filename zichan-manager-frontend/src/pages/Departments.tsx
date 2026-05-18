import { useEffect, useState } from 'react';
import { Table, Button, Modal, Space, message, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { Department, Person, Asset } from '../types';

interface DepartmentDetail {
  id: number;
  name: string;
  description: string;
  persons: Person[];
  assets: Asset[];
}

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<DepartmentDetail | null>(null);
  const navigate = useNavigate();

  const fetch = async () => {
    setLoading(true);
    const res = await client.get('/api/departments');
    setDepartments(res.data);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await client.delete(`/api/departments/${deleteId}`);
      message.success('已删除');
      setDeleteId(null);
      fetch();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '删除失败');
      setDeleteId(null);
    }
  };

  const openDetail = async (dept: Department) => {
    try {
      const res = await client.get(`/api/departments/${dept.id}`);
      setDetail(res.data);
      setDetailOpen(true);
    } catch {
      message.error('获取详情失败');
    }
  };

  const goToPerson = (person: Person) => {
    navigate(`/persons?highlight=${person.id}`);
    setDetailOpen(false);
  };

  const goToAsset = (asset: Asset) => {
    navigate(`/assets?highlight=${asset.id}`);
    setDetailOpen(false);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string) => v || '-' },
    { title: '人员数', dataIndex: 'person_count', key: 'person_count' },
    { title: '资产数', dataIndex: 'asset_count', key: 'asset_count' },
    {
      title: '操作', key: 'action',
      render: (_: any, record: Department) => (
        <Space>
          <Button type="link" onClick={() => openDetail(record)}>详情</Button>
          <Button type="link" danger onClick={() => setDeleteId(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  const personColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '姓名', dataIndex: 'name', key: 'name', render: (v: string, record: Person) => <Button type="link" onClick={() => goToPerson(record)}>{v}</Button> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (v: string) => v?.slice(0, 10) },
  ];

  const assetColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '资产名称', dataIndex: 'name', key: 'name', render: (v: string, record: Asset) => <Button type="link" onClick={() => goToAsset(record)}>{v}</Button> },
    { title: '状态', dataIndex: 'status', key: 'status' },
    { title: '分类', dataIndex: 'category_name', key: 'category_name' },
  ];

  return (
    <div>
      <Table columns={columns} dataSource={departments} rowKey="id" loading={loading} />

      <Modal
        title="部门详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={700}
      >
        {detail && (
          <Tabs
            items={[
              {
                key: 'persons',
                label: `人员 (${detail.persons.length})`,
                children: (
                  <Table
                    dataSource={detail.persons}
                    rowKey="id"
                    pagination={false}
                    columns={personColumns}
                    size="small"
                  />
                ),
              },
              {
                key: 'assets',
                label: `资产 (${detail.assets.length})`,
                children: (
                  <Table
                    dataSource={detail.assets}
                    rowKey="id"
                    pagination={false}
                    columns={assetColumns}
                    size="small"
                  />
                ),
              },
            ]}
          />
        )}
      </Modal>

      <Modal title="确认删除" open={deleteId !== null} onOk={handleDelete} onCancel={() => setDeleteId(null)} okText="确认删除" okButtonProps={{ danger: true, style: { background: '#ff3b30', color: '#fff', border: 'none' } }}>
        <p>确定要删除这个部门吗？</p>
      </Modal>
    </div>
  );
}