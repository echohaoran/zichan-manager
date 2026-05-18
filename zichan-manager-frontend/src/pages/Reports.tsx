import { useEffect, useState } from 'react';
import { Card, Table, Spin } from 'antd';
import client from '../api/client';
import type { DashboardStats } from '../types';

export default function Reports() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    client.get('/api/dashboard/stats').then((res) => setStats(res.data));
  }, []);

  if (!stats) return <Spin style={{ display: 'block', marginTop: 100 }} />;

  const summaryColumns = [
    { title: '指标', dataIndex: 'label', key: 'label' },
    { title: '数值', dataIndex: 'value', key: 'value' },
  ];

  const summaryData = [
    { label: '资产总数', value: stats.total_assets },
    { label: '在库资产', value: stats.in_stock },
    { label: '领用中', value: stats.checked_out },
    { label: '已报废', value: stats.disposed },
    { label: '在库总价值 (元)', value: stats.total_value.toFixed(2) },
  ];

  const catColumns = [
    { title: '分类名称', dataIndex: 'name', key: 'name' },
    { title: '资产数量', dataIndex: 'count', key: 'count' },
    { title: '占比', dataIndex: 'pct', key: 'pct', render: (v: string) => v },
  ];

  const catData = stats.category_stats.map((c) => ({
    ...c,
    pct: stats.total_assets ? `${((c.count / stats.total_assets) * 100).toFixed(1)}%` : '0%',
  }));

  return (
    <div>
      <Card title="资产汇总报表" style={{ marginBottom: 24 }}>
        <Table columns={summaryColumns} dataSource={summaryData} rowKey="label" pagination={false} />
      </Card>

      <Card title="各分类资产统计">
        <Table columns={catColumns} dataSource={catData} rowKey="name" pagination={false} />
      </Card>
    </div>
  );
}
