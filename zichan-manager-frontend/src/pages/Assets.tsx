import { useEffect, useState, useRef } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space, Tag, message } from 'antd';
import { PlusOutlined, SearchOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import client from '../api/client';
import type { Asset, Category, AssetCreate, Person } from '../types';

const ASSET_FIELDS = [
  { key: 'name', label: '资产名称', required: true },
  { key: 'category_name', label: '分类名称', required: true },
  { key: 'asset_code', label: '资产编码', required: false },
  { key: 'model', label: '型号', required: false },
  { key: 'color', label: '颜色', required: false },
  { key: 'price', label: '价格', required: false },
  { key: 'sn', label: '设备SN', required: false },
  { key: 'purchase_date', label: '购买日期', required: false },
  { key: 'description', label: '描述', required: false },
  { key: 'status', label: '状态', required: false },
];

const STATUS_OPTIONS = ['在库', '领用中', '已报废'];

export default function Assets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [form] = Form.useForm();
  const [keyword, setKeyword] = useState('');
  const [persons, setPersons] = useState<Person[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutAssetId, setCheckoutAssetId] = useState<number | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [disposeAssetId, setDisposeAssetId] = useState<number | null>(null);

  // Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    setLoading(true);
    const params: any = {};
    if (keyword) params.keyword = keyword;
    const res = await client.get('/api/assets', { params });
    setAssets(res.data);
    setLoading(false);
  };

  const fetchCategories = async () => {
    const res = await client.get('/api/categories');
    setCategories(res.data);
  };

  const fetchPersons = async () => {
    const res = await client.get('/api/persons');
    setPersons(res.data);
  };

  useEffect(() => {
    fetchAssets();
    fetchCategories();
    fetchPersons();

    const highlightId = searchParams.get('highlight');
    if (highlightId) {
      showDetail(parseInt(highlightId));
      setSearchParams({}, { replace: true });
    }
  }, []);

  // ---------- Download ----------
  const handleDownload = async () => {
    try {
      const res = await client.get('/api/assets');
      const data: Asset[] = res.data;
      const rows = data.map(a => ({
        '资产编码': a.asset_code,
        '资产名称': a.name,
        '型号': a.model,
        '颜色': a.color,
        '分类': a.category_name,
        '价格': a.price,
        '购买日期': dayjs(a.purchase_date).format('YYYY-MM-DD'),
        '状态': a.status,
        '领用人': a.person_name || '',
        '设备SN': a.sn,
        '描述': a.description,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      // set column widths
      ws['!cols'] = [
        { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 10 },
        { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
        { wch: 12 }, { wch: 20 }, { wch: 30 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '资产');
      XLSX.writeFile(wb, `资产导出_${dayjs().format('YYYYMMDD')}.xlsx`);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  // ---------- Download Template ----------
  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        '资产编码': 'CODE001',
        '资产名称': '示例资产',
        '型号': 'Model-X',
        '颜色': '黑色',
        '分类': '电子设备',
        '价格': 5000,
        '购买日期': '2024-01-15',
        '状态': '在库',
        '领用人': '',
        '设备SN': 'SN123456',
        '描述': '示例描述',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateRows);
    ws['!cols'] = [
      { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 10 },
      { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
      { wch: 12 }, { wch: 20 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '资产导入模板');
    XLSX.writeFile(wb, '资产导入模板.xlsx');
    message.success('模板下载成功，请按示例格式填写后导入');
  };

  // ---------- Import ----------
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });
        if (json.length < 2) {
          message.error('文件内容不足，至少需要表头和一行数据');
          return;
        }
        const headers = (json[0] as string[]).map(h => String(h).trim());
        const rows = json.slice(1).filter((r: any[]) => r.some((c: any) => c !== undefined && c !== null && c !== ''));
        setRawHeaders(headers);
        setRawData(rows as any[][]);

        // auto-detect field mapping
        const mapping: Record<string, string> = {};
        for (const h of headers) {
          const hClean = h.replace(/[*\s]/g, '').toLowerCase();
          const matched = ASSET_FIELDS.find(f => {
            const fClean = f.label.replace(/[*\s]/g, '').toLowerCase();
            return hClean === fClean || hClean === f.key.toLowerCase() || hClean.includes(fClean) || fClean.includes(hClean);
          });
          if (matched) mapping[h] = matched.key;
        }
        setFieldMapping(mapping);
        setImportModalOpen(true);
      } catch {
        message.error('文件解析失败，请检查格式');
      }
    };
    reader.readAsArrayBuffer(file);
    // reset input so same file can be selected again
    e.target.value = '';
  };

  const buildPreviewData = () => {
    return rawData.map(row => {
      const item: Record<string, any> = {};
      for (const field of ASSET_FIELDS) {
        item[field.key] = '';
      }
      item._key = Math.random().toString(36).slice(2);
      for (let i = 0; i < rawHeaders.length; i++) {
        const mappedKey = fieldMapping[rawHeaders[i]];
        if (mappedKey) {
          const val = row[i];
          if (val instanceof Date && !isNaN(val.getTime())) {
            item[mappedKey] = val.toISOString().split('T')[0];
          } else {
            item[mappedKey] = val !== undefined ? String(val) : '';
          }
        }
      }
      return item;
    });
  };

  const handleMappingConfirm = () => {
    const mapped = buildPreviewData();
    setPreviewData(mapped);
    setImportModalOpen(false);
    setPreviewOpen(true);
  };

  const updatePreviewRow = (index: number, key: string, value: any) => {
    setPreviewData(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const addPreviewRow = () => {
    const item: Record<string, any> = { _key: Math.random().toString(36).slice(2) };
    for (const field of ASSET_FIELDS) {
      item[field.key] = '';
    }
    setPreviewData(prev => [...prev, item]);
  };

  const removePreviewRow = (index: number) => {
    setPreviewData(prev => prev.filter((_, i) => i !== index));
  };

  const handleImportConfirm = async () => {
    const valid = previewData.filter(item => item.name && item.category_name);
    if (valid.length === 0) {
      message.warning('没有有效数据可导入（需要资产名称和分类名称）');
      return;
    }
    setImporting(true);
    try {
      const payload = valid.map(item => {
        let purchaseDate = item.purchase_date || '';
        if (purchaseDate instanceof Date && !isNaN(purchaseDate.getTime())) {
          purchaseDate = purchaseDate.toISOString().split('T')[0];
        } else if (typeof purchaseDate === 'string' && purchaseDate.match(/^\d{5}$/)) {
          const d = new Date((parseInt(purchaseDate) - 25569) * 86400000);
          purchaseDate = d.toISOString().split('T')[0];
        } else if (typeof purchaseDate === 'string' && purchaseDate.includes('GMT')) {
          const d = new Date(purchaseDate);
          if (!isNaN(d.getTime())) purchaseDate = d.toISOString().split('T')[0];
        }
        return {
          name: item.name,
          category_name: item.category_name,
          price: parseFloat(item.price) || 0,
          purchase_date: purchaseDate,
          description: item.description || '',
          model: item.model || '',
          color: item.color || '',
          asset_code: item.asset_code || '',
          sn: item.sn || '',
          status: item.status || '在库',
        };
      });
      await client.post('/api/assets/batch-import', payload);
      message.success(`成功导入 ${payload.length} 条资产`);
      setPreviewOpen(false);
      fetchAssets();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '导入失败');
    }
    setImporting(false);
  };

  // ---------- CRUD ----------
  const openCreate = () => {
    setEditingAsset(null);
    form.resetFields();
    form.setFieldsValue({ sn: '空' });
    setModalOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset);
    form.setFieldsValue({
      ...asset,
      purchase_date: dayjs(asset.purchase_date),
      sn: asset.sn || '空',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const data: AssetCreate = {
      ...values,
      purchase_date: values.purchase_date.format('YYYY-MM-DD'),
      sn: values.sn?.trim() || '空',
    };
    if (editingAsset) {
      await client.put(`/api/assets/${editingAsset.id}`, data);
      message.success('资产已更新');
    } else {
      await client.post('/api/assets', data);
      message.success('资产已创建');
    }
    setModalOpen(false);
    fetchAssets();
  };

  const openCheckout = (id: number) => {
    setCheckoutAssetId(id);
    setSelectedPersonId(null);
    setCheckoutOpen(true);
  };

  const handleCheckout = async () => {
    if (!checkoutAssetId || !selectedPersonId) return;
    await client.post(`/api/assets/${checkoutAssetId}/checkout?person_id=${selectedPersonId}`);
    message.success('领用成功');
    setCheckoutOpen(false);
    setCheckoutAssetId(null);
    setSelectedPersonId(null);
    fetchAssets();
  };

  const handleReturn = async (id: number) => {
    await client.post(`/api/assets/${id}/return`);
    message.success('归还成功');
    fetchAssets();
  };

  const openDispose = (id: number) => {
    setDisposeAssetId(id);
    setDisposeOpen(true);
  };

  const handleDispose = async () => {
    if (!disposeAssetId) return;
    await client.post(`/api/assets/${disposeAssetId}/dispose`);
    message.success('已报废');
    setDisposeOpen(false);
    setDisposeAssetId(null);
    fetchAssets();
  };

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await client.delete(`/api/assets/${deleteId}`);
      message.success('已删除');
      setDeleteId(null);
      fetchAssets();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '删除失败');
      setDeleteId(null);
    }
  };

  const showDetail = async (id: number) => {
    const res = await client.get(`/api/assets/${id}`);
    setDetailAsset(res.data);
    setDetailOpen(true);
  };

  const statusColors: Record<string, string> = { '在库': 'green', '领用中': 'blue', '已报废': 'red' };

  const columns: any[] = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60, sorter: (a: Asset, b: Asset) => a.id - b.id, defaultSortOrder: 'ascend' as const },
    { title: '资产编码', dataIndex: 'asset_code', key: 'asset_code', sorter: (a: Asset, b: Asset) => (a.asset_code || '').localeCompare(b.asset_code || '') },
    { title: '名称', dataIndex: 'name', key: 'name', sorter: (a: Asset, b: Asset) => a.name.localeCompare(b.name), render: (_: string, record: Asset) => <a onClick={() => showDetail(record.id)}>{_}</a> },
    { title: '型号', dataIndex: 'model', key: 'model', sorter: (a: Asset, b: Asset) => (a.model || '').localeCompare(b.model || '') },
    { title: '颜色', dataIndex: 'color', key: 'color', sorter: (a: Asset, b: Asset) => (a.color || '').localeCompare(b.color || '') },
    { title: '分类', dataIndex: 'category_name', key: 'category_name', sorter: (a: Asset, b: Asset) => (a.category_name || '').localeCompare(b.category_name || '') },
    { title: '价格', dataIndex: 'price', key: 'price', sorter: (a: Asset, b: Asset) => a.price - b.price, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '购买日期', dataIndex: 'purchase_date', key: 'purchase_date', sorter: (a: Asset, b: Asset) => dayjs(a.purchase_date).valueOf() - dayjs(b.purchase_date).valueOf(), render: (v: string) => dayjs(v).format('YYYY-MM-DD') },
    { title: '状态', dataIndex: 'status', key: 'status', sorter: (a: Asset, b: Asset) => a.status.localeCompare(b.status), render: (v: string) => <Tag color={statusColors[v]}>{v}</Tag> },
    { title: '领用人', dataIndex: 'person_name', key: 'person_name', sorter: (a: Asset, b: Asset) => (a.person_name || '').localeCompare(b.person_name || '') },
    {
      title: '操作', key: 'action',
      render: (_: any, record: Asset) => (
        <Space>
          {record.status === '在库' && <Button type="link" onClick={() => openCheckout(record.id)}>领用</Button>}
          {record.status === '领用中' && <Button type="link" onClick={() => handleReturn(record.id)}>归还</Button>}
          {record.status !== '已报废' && <Button type="link" danger onClick={() => openDispose(record.id)}>报废</Button>}
          <Button type="link" onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" danger onClick={() => setDeleteId(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索资产名称" value={keyword} onChange={(e) => setKeyword(e.target.value)} onPressEnter={fetchAssets} prefix={<SearchOutlined />} style={{ width: 250 }} />
        <Button type="primary" onClick={fetchAssets}>搜索</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增资产</Button>
        <Button icon={<DownloadOutlined />} onClick={handleDownload}>导出数据</Button>
        <Button onClick={handleDownloadTemplate}>下载导入模板</Button>
        <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>上传</Button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileSelect} />
      </Space>

      <Table columns={columns} dataSource={assets} rowKey="id" loading={loading} showSorterTooltip={false} />

      <Modal title={editingAsset ? '编辑资产' : '新增资产'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={<><span style={{color:'#ff3b30'}}>*</span> 资产名称</>} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category_id" label={<><span style={{color:'#ff3b30'}}>*</span> 分类</>} rules={[{ required: true }]}>
            <Select options={categories.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="price" label="价格">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="purchase_date" label={<><span style={{color:'#ff3b30'}}>*</span> 购买日期</>} rules={[{ required: true, message: '请选择购买日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="model" label="型号">
            <Input />
          </Form.Item>
          <Form.Item name="color" label="颜色">
            <Input />
          </Form.Item>
          <Form.Item name="asset_code" label={<><span style={{color:'#ff3b30'}}>*</span> 资产编码</>} rules={[{ required: true, message: '请输入资产编码' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sn" label={<><span style={{color:'#ff3b30'}}>*</span> 设备SN</>} rules={[{ required: true, message: '请输入设备SN' }]}>
            <Input placeholder="若无则填'空'" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="资产详情" open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={700}>
        {detailAsset && (
          <div>
            <p><strong>资产编码：</strong>{detailAsset.asset_code || '-'}</p>
            <p><strong>名称：</strong>{detailAsset.name}</p>
            <p><strong>型号：</strong>{detailAsset.model || '-'}</p>
            <p><strong>颜色：</strong>{detailAsset.color || '-'}</p>
            <p><strong>设备SN：</strong>{detailAsset.sn || '-'}</p>
            <p><strong>分类：</strong>{detailAsset.category_name}</p>
            <p><strong>价格：</strong>¥{detailAsset.price.toFixed(2)}</p>
            <p><strong>购买日期：</strong>{dayjs(detailAsset.purchase_date).format('YYYY-MM-DD')}</p>
            <p><strong>状态：</strong><Tag color={statusColors[detailAsset.status]}>{detailAsset.status}</Tag></p>
            <p><strong>领用人：</strong>{detailAsset.person_name || '-'}</p>
            <p><strong>描述：</strong>{detailAsset.description || '-'}</p>
            <h4 style={{ marginTop: 16 }}>操作日志</h4>
            <Table
              columns={[
                { title: '操作', dataIndex: 'action', key: 'action' },
                { title: '详情', dataIndex: 'detail', key: 'detail' },
                { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
              ]}
              dataSource={detailAsset.logs}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
        )}
      </Modal>

      {/* 领用弹窗 */}
      <Modal
        title="选择领用人"
        open={checkoutOpen}
        onOk={handleCheckout}
        onCancel={() => { setCheckoutOpen(false); setCheckoutAssetId(null); setSelectedPersonId(null); }}
        okButtonProps={{ disabled: !selectedPersonId }}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="请选择领用人"
          value={selectedPersonId}
          onChange={(value) => setSelectedPersonId(value)}
          options={persons.map((p) => ({ label: p.name, value: p.id }))}
        />
      </Modal>

      {/* 报废确认弹窗 */}
      <Modal
        title="确认报废"
        open={disposeOpen}
        onOk={handleDispose}
        onCancel={() => { setDisposeOpen(false); setDisposeAssetId(null); }}
        okText="确认报废"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>报废后无法撤回，请确认</p>
      </Modal>

      {/* 字段映射 Modal */}
      <Modal
        title="字段映射"
        open={importModalOpen}
        onOk={handleMappingConfirm}
        onCancel={() => setImportModalOpen(false)}
        width={600}
      >
        <p style={{ marginBottom: 16, color: '#666' }}>请将上传文件的列与系统字段进行匹配：</p>
        <Table
          dataSource={rawHeaders.map((h, i) => ({ header: h, index: i }))}
          rowKey="index"
          pagination={false}
          size="small"
          columns={[
            { title: '文件列名', dataIndex: 'header', key: 'header', width: 180 },
            {
              title: '映射到系统字段', dataIndex: 'mapping', key: 'mapping',
              render: (_: any, record: { header: string; index: number }) => (
                <Select
                  style={{ width: '100%' }}
                  value={fieldMapping[record.header] || ''}
                  onChange={(val) => setFieldMapping(prev => ({ ...prev, [record.header]: val }))}
                  placeholder="不导入此列"
                  allowClear
                >
                  {ASSET_FIELDS.map(f => (
                    <Select.Option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</Select.Option>
                  ))}
                </Select>
              ),
            },
          ]}
        />
      </Modal>

      {/* 导入预览 Modal */}
      <Modal
        title="导入预览"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={1000}
        onOk={handleImportConfirm}
        okText="确认导入"
        confirmLoading={importing}
      >
        <Space style={{ marginBottom: 12 }}>
          <Button size="small" onClick={addPreviewRow}>添加一行</Button>
          <span style={{ color: '#666', fontSize: 12 }}>共 {previewData.length} 行，标红行为名称或分类为空</span>
        </Space>
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          <Table
            dataSource={previewData}
            rowKey="_key"
            pagination={false}
            size="small"
            bordered
            columns={[
              { title: '#', key: 'index', width: 40, render: (_: any, __: any, i: number) => i + 1 },
              ...ASSET_FIELDS.filter(f => f.key !== 'status').map(f => ({
                title: f.label + (f.required ? ' *' : ''),
                dataIndex: f.key,
                key: f.key,
                width: f.key === 'description' ? 180 : 120,
                onCell: (_: any, index?: number) => {
                  const row = previewData[index!];
                  const invalid = f.required && !row?.[f.key];
                  return { style: invalid ? { background: '#fff2f0' } : {} };
                },
                render: (val: any, _: any, index?: number) => {
                  if (f.key === 'category_name') {
                    return (
                      <Select
                        size="small"
                        style={{ width: '100%' }}
                        value={val || undefined}
                        onChange={(v) => updatePreviewRow(index!, f.key, v)}
                        showSearch
                      >
                        {categories.map(c => (
                          <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>
                        ))}
                      </Select>
                    );
                  }
                  if (f.key === 'price') {
                    return (
                      <InputNumber
                        size="small"
                        style={{ width: '100%' }}
                        value={parseFloat(val) || 0}
                        min={0}
                        onChange={(v) => updatePreviewRow(index!, f.key, v)}
                      />
                    );
                  }
                  if (f.key === 'purchase_date') {
                    return (
                      <Input
                        size="small"
                        value={val}
                        placeholder="YYYY-MM-DD"
                        onChange={(e) => updatePreviewRow(index!, f.key, e.target.value)}
                      />
                    );
                  }
                  return (
                    <Input
                      size="small"
                      value={val}
                      onChange={(e) => updatePreviewRow(index!, f.key, e.target.value)}
                    />
                  );
                },
              })),
              {
                title: '状态', key: 'status',
                width: 100,
                render: (_: any, record: any, index?: number) => (
                  <Select
                    size="small"
                    style={{ width: 90 }}
                    value={record.status || '在库'}
                    onChange={(v) => updatePreviewRow(index!, 'status', v)}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <Select.Option key={s} value={s}>{s}</Select.Option>
                    ))}
                  </Select>
                ),
              },
              {
                title: '操作', key: 'action', width: 60,
                render: (_: any, __: any, index?: number) => (
                  <Button type="link" danger size="small" onClick={() => removePreviewRow(index!)}>删除</Button>
                ),
              },
            ]}
          />
        </div>
      </Modal>

      <Modal title="确认删除" open={deleteId !== null} onOk={handleDelete} onCancel={() => setDeleteId(null)} okText="确认删除" okButtonProps={{ danger: true, style: { background: '#ff3b30', color: '#fff', border: 'none' } }}>
        <p>确定要删除这个资产吗？</p>
      </Modal>
    </div>
  );
}