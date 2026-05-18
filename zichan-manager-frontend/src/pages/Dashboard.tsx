import { useEffect, useState } from 'react';
import { Row, Col, Card, Spin, Radio, Empty } from 'antd';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import client from '../api/client';
import type { DashboardStats } from '../types';

const COLORS = ['#0071e3', '#34c759', '#ff9500', '#ff3b30', '#af52de', '#5856d6', '#ffcc00', '#5ac8fa'];

const StatCard = ({ title, value, suffix, color }: { title: string; value: number | string; suffix?: string; color: string }) => (
  <Card
    style={{
      borderRadius: 20,
      border: '1px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
      background: 'rgba(255, 255, 255, 0.85)',
    }}
    styles={{ body: { padding: 24 } }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: color,
            }}
          />
        </div>
        <div style={{ fontSize: 14, color: '#86868b', fontWeight: 500, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 32, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.021em' }}>
          {value}
          {suffix && <span style={{ fontSize: 18, marginLeft: 4 }}>{suffix}</span>}
        </div>
      </div>
    </div>
  </Card>
);

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartType, setChartType] = useState<'category' | 'department'>('category');

  useEffect(() => {
    client.get('/api/dashboard/stats').then((res) => setStats(res.data));
  }, []);

  if (!stats) return <Spin style={{ display: 'block', marginTop: 100 }} />;

  const pieData = chartType === 'category'
    ? stats.category_stats.filter((c) => c.count > 0).map((c) => ({ name: c.name, value: c.count }))
    : stats.department_stats.filter((d) => d.count > 0).map((d) => ({ name: d.name, value: d.count }));

  const ganttData = stats.category_stats
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <h1 style={{ fontSize: 32, fontWeight: 600, color: '#1d1d1f', marginBottom: 24, letterSpacing: '-0.021em' }}>
        工作台
      </h1>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="资产总数" value={stats.total_assets} color="#0071e3" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="在库" value={stats.in_stock} color="#34c759" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="领用中" value={stats.checked_out} color="#ff9500" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="已报废" value={stats.disposed} color="#ff3b30" />
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            style={{ borderRadius: 20, border: 'none', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)' }}
            styles={{ body: { padding: 24 } }}
            title={
              <span style={{ fontSize: 18, fontWeight: 600, color: '#1d1d1f' }}>资产分布</span>
            }
            extra={
              <Radio.Group
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                style={{
                  display: 'flex',
                  gap: 8,
                }}
              >
                <Radio.Button
                  value="category"
                  style={{
                    borderRadius: 8,
                    border: chartType === 'category' ? 'none' : '1px solid #d2d2d7',
                    background: chartType === 'category' ? '#0071e3' : '#ffffff',
                    color: chartType === 'category' ? '#ffffff' : '#1d1d1f',
                    fontWeight: 500,
                    padding: '4px 14px',
                    height: 32,
                    lineHeight: '22px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  资产类型
                </Radio.Button>
                <Radio.Button
                  value="department"
                  style={{
                    borderRadius: 8,
                    border: chartType === 'department' ? 'none' : '1px solid #d2d2d7',
                    background: chartType === 'department' ? '#0071e3' : '#ffffff',
                    color: chartType === 'department' ? '#ffffff' : '#1d1d1f',
                    fontWeight: 500,
                    padding: '4px 14px',
                    height: 32,
                    lineHeight: '22px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  部门
                </Radio.Button>
              </Radio.Group>
            }
          >
            {pieData.length === 0 ? (
              <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description={<span style={{ color: '#86868b' }}>暂无数据</span>} />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={110}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: 'none',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            style={{ borderRadius: 20, border: 'none', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)' }}
            styles={{ body: { padding: 24 } }}
            title={
              <span style={{ fontSize: 18, fontWeight: 600, color: '#1d1d1f' }}>各分类资产统计</span>
            }
          >
            {ganttData.length === 0 ? (
              <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description={<span style={{ color: '#86868b' }}>暂无数据</span>} />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  layout="vertical"
                  data={ganttData}
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
                  <XAxis type="number" tick={{ fill: '#86868b' }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#1d1d1f', fontSize: 13 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: 'none',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Bar dataKey="count" fill="#0071e3" radius={[0, 8, 8, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}