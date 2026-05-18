import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Select, Tag, List, Checkbox, Spin, AutoComplete } from 'antd';
import { PlusOutlined, LinkOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { Person, Department, Asset, FeishuDepartmentTree, FeishuContactMember } from '../types';

function DepartmentNode({
  department,
  expandedKeys,
  selectedMembers,
  selectedDeptIds,
  searchText,
  onToggleExpand,
  onSelectMember,
  onSelectDept,
  selectedDept,
  onToggleDept,
}: {
  department: FeishuDepartmentTree;
  expandedKeys: string[];
  selectedMembers: Record<string, { member: FeishuContactMember; deptName: string }>;
  selectedDeptIds: Set<string>;
  searchText: string;
  onToggleExpand: (key: string) => void;
  onSelectMember: (member: FeishuContactMember, deptName: string) => void;
  onSelectDept: (deptName: string) => void;
  selectedDept: string | null;
  onToggleDept: (deptId: string) => void;
}) {
  const hasChildren = department.children && department.children.length > 0;
  const isExpanded = expandedKeys.includes(department.open_department_id);
  const members = department.members || [];
  const isChecked = selectedDeptIds.has(department.open_department_id);

  return (
    <div>
      <div
        style={{
          padding: '4px 8px',
          marginBottom: 2,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderRadius: 6,
          background: selectedDept === department.name ? '#e6f4ff' : 'transparent',
        }}
      >
        <Checkbox
          checked={isChecked}
          onChange={() => onToggleDept(department.open_department_id)}
        />
        <span
          onClick={() => {
            onSelectDept(department.name);
            if (hasChildren) onToggleExpand(department.open_department_id);
          }}
          style={{
            cursor: 'pointer',
            color: selectedDept === department.name ? '#0071e3' : '#1d1d1f',
            fontWeight: selectedDept === department.name ? 500 : 400,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {hasChildren ? (
            <span style={{ fontSize: 10, color: '#86868b' }}>
              {isExpanded ? <DownOutlined /> : <RightOutlined />}
            </span>
          ) : (
            <span style={{ width: 10 }} />
          )}
          <span>{department.name || '根部门'}</span>
        </span>
        <span style={{ color: '#86868b', fontSize: 11 }}>
          {members.length}
        </span>
      </div>
      {isExpanded && hasChildren && department.children ? (
        <div style={{ paddingLeft: 24 }}>
          {department.children.map((child) => (
            <DepartmentNode
              key={child.open_department_id}
              department={child}
              expandedKeys={expandedKeys}
              selectedMembers={selectedMembers}
              selectedDeptIds={selectedDeptIds}
              searchText={searchText}
              onToggleExpand={onToggleExpand}
              onSelectMember={onSelectMember}
              onSelectDept={onSelectDept}
              selectedDept={selectedDept}
              onToggleDept={onToggleDept}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Persons() {
  const navigate = useNavigate();
  const [persons, setPersons] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [assetsModalOpen, setAssetsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [personAssets, setPersonAssets] = useState<Asset[]>([]);
  const [personAssetCount, setPersonAssetCount] = useState<Record<number, number>>({});
  const [form] = Form.useForm();

  const [feishuOpen, setFeishuOpen] = useState(false);
  const [feishuTree, setFeishuTree] = useState<FeishuDepartmentTree[]>([]);
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Record<string, { member: FeishuContactMember; deptName: string }>>({});
  const [syncing, setSyncing] = useState(false);
  const [feishuSearch, setFeishuSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [totalStats, setTotalStats] = useState({ departments: 0, users: 0 });
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());

  const [searchResults, setSearchResults] = useState<FeishuContactMember[]>([]);
  const [hasCache, setHasCache] = useState<boolean | null>(null);

  const fetch = async () => {
    setLoading(true);
    const [personsRes, deptsRes] = await Promise.all([
      client.get('/api/persons'),
      client.get('/api/departments'),
    ]);
    setPersons(personsRes.data);
    setDepartments(deptsRes.data);
    try {
      const cacheRes = await client.get('/api/feishu/contacts');
      setHasCache((cacheRes.data.total_users || 0) > 0);
    } catch {
      setHasCache(false);
    }
    const counts: Record<number, number> = {};
    for (const person of personsRes.data) {
      try {
        const res = await client.get(`/api/persons/${person.id}/assets`);
        counts[person.id] = res.data.assets?.length || 0;
      } catch {
        counts[person.id] = 0;
      }
    }
    setPersonAssetCount(counts);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleSearch = async (value: string) => {
    if (!value) { setSearchResults([]); return; }
    try {
      const res = await client.get<FeishuContactMember[]>('/api/feishu/search', { params: { q: value } });
      setSearchResults(res.data);
    } catch { setSearchResults([]); }
  };

  const handleSelectFeishuUser = async (open_id: string) => {
    const user = searchResults.find(u => u.open_id === open_id);
    if (!user) return;
    form.setFieldsValue({ name: user.name });
    const deptName = user.department_name || '';
    if (deptName) {
      let deptId: number | undefined;
      const existing = departments.find(d => d.name === deptName);
      if (existing) { deptId = existing.id; }
      else {
        try {
          const res = await client.post('/api/departments', { name: deptName });
          deptId = res.data.id;
          setDepartments(prev => [...prev, res.data]);
        } catch {
          message.warning(`部门 "${deptName}" 创建失败`);
        }
      }
      form.setFieldsValue({ department_id: deptId });
    }
  };

  const openCreate = () => { setEditing(null); setSearchResults([]); form.resetFields(); setModalOpen(true); };
  const openEdit = (person: Person) => { setEditing(person); setSearchResults([]); form.setFieldsValue({ name: person.name, department_id: person.department_id }); setModalOpen(true); };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) { await client.put(`/api/persons/${editing.id}`, values); message.success('已更新'); }
    else { await client.post('/api/persons', values); message.success('已创建'); }
    setModalOpen(false); fetch();
  };

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const handleDelete = async () => {
    if (deleteId === null) return;
    try { await client.delete(`/api/persons/${deleteId}`); message.success('已删除'); setDeleteId(null); fetch(); }
    catch (err: any) { message.error(err.response?.data?.detail || '删除失败'); setDeleteId(null); }
  };

  const openFeishu = async () => {
    setFeishuOpen(true); setFeishuLoading(true);
    setSelectedMembers({}); setSelectedDeptIds(new Set());
    setFeishuSearch(''); setExpandedKeys([]);
    try {
      const res = await client.get<{ departments: FeishuDepartmentTree[]; total_departments: number; total_users: number }>('/api/feishu/contacts');
      setFeishuTree(res.data.departments || []);
      setTotalStats({ departments: res.data.total_departments || 0, users: res.data.total_users || 0 });
      setHasCache((res.data.total_users || 0) > 0);
      setExpandedKeys((res.data.departments || []).map(d => d.open_department_id));
    } catch (err: any) {
      message.error('获取飞书通讯录失败: ' + (err.response?.data?.detail || err.message));
    }
    setFeishuLoading(false);
  };

  const toggleMember = (member: FeishuContactMember, deptName: string) => {
    setSelectedMembers((prev) => {
      const next = { ...prev };
      if (next[member.open_id]) delete next[member.open_id];
      else next[member.open_id] = { member, deptName };
      return next;
    });
  };

  const findDeptById = (nodes: FeishuDepartmentTree[], id: string): FeishuDepartmentTree | null => {
    for (const node of nodes) {
      if (node.open_department_id === id) return node;
      const found = findDeptById(node.children || [], id);
      if (found) return found;
    }
    return null;
  };

  const collectAllDeptMembers = useCallback((nodes: FeishuDepartmentTree[]): { member: FeishuContactMember; deptName: string }[] => {
    const results: { member: FeishuContactMember; deptName: string }[] = [];
    for (const node of nodes) {
      for (const m of (node.members || [])) {
        results.push({ member: m, deptName: node.name });
      }
      results.push(...collectAllDeptMembers(node.children || []));
    }
    return results;
  }, []);

  const collectSubDeptIds = useCallback((node: FeishuDepartmentTree): string[] => {
    const ids = [node.open_department_id];
    for (const child of (node.children || [])) ids.push(...collectSubDeptIds(child));
    return ids;
  }, []);

  const toggleDept = (deptId: string) => {
    const dept = findDeptById(feishuTree, deptId);
    if (!dept) return;
    if (selectedDeptIds.has(deptId)) {
      const subIds = collectSubDeptIds(dept);
      const toRemove = collectAllDeptMembers([dept]);
      setSelectedDeptIds(prev => { const n = new Set(prev); subIds.forEach(id => n.delete(id)); return n; });
      setSelectedMembers(prev => { const n = { ...prev }; toRemove.forEach(({ member }) => delete n[member.open_id]); return n; });
    } else {
      const subIds = collectSubDeptIds(dept);
      const toAdd = collectAllDeptMembers([dept]);
      setSelectedDeptIds(prev => { const n = new Set(prev); subIds.forEach(id => n.add(id)); return n; });
      setSelectedMembers(prev => { const n = { ...prev }; toAdd.forEach(({ member, deptName }) => { if (!n[member.open_id]) n[member.open_id] = { member, deptName }; }); return n; });
    }
  };

  const handleFeishuSync = async () => {
    const members = Object.values(selectedMembers);
    if (members.length === 0) { message.warning('请至少选择一位成员'); return; }
    setSyncing(true);
    try {
      const payload = members.map(({ member: m, deptName }) => ({ name: m.name, department_name: deptName || '' }));
      const res = await client.post('/api/persons/batch-import', payload);
      const { created, skipped } = res.data;
      let msg = '成功同步';
      if (created > 0) msg += ' ' + created + ' 位成员';
      if (skipped > 0) msg += '，跳过 ' + skipped + ' 位已存在';
      message.success(msg);
      setFeishuOpen(false); fetch();
    } catch (err: any) { message.error('同步失败: ' + (err.response?.data?.detail || err.message)); }
    setSyncing(false);
  };

  const viewAssets = async (person: Person) => {
    try { const res = await client.get(`/api/persons/${person.id}/assets`); setPersonAssets(res.data.assets || []); setAssetsModalOpen(true); }
    catch { message.error('获取资产列表失败'); }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '姓名', dataIndex: 'name', key: 'name', render: (v: string, record: Person) => <Button type="link" onClick={() => viewAssets(record)}>{v}</Button> },
    { title: '部门', dataIndex: 'department_name', key: 'department_name', render: (v: string) => v || '-' },
    { title: '借用资产数', key: 'asset_count', render: (_: any, record: Person) => <Tag color="blue">{personAssetCount[record.id] || 0}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (v: string) => v?.slice(0, 10) },
    { title: '操作', key: 'action', render: (_: any, record: Person) => (
      <Space>
        <Button type="link" onClick={() => viewAssets(record)}>资产({personAssetCount[record.id] || 0})</Button>
        <Button type="link" onClick={() => openEdit(record)}>编辑</Button>
        <Button type="link" danger onClick={() => setDeleteId(record.id)}>删除</Button>
      </Space>
    )},
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增人员</Button>
        <Button icon={<LinkOutlined />} onClick={openFeishu}>从飞书同步</Button>
      </Space>
      <Table columns={columns} dataSource={persons} rowKey="id" loading={loading} />

      <Modal title={editing ? '编辑人员' : '新增人员'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名 *" rules={[{ required: true }]}>
            <AutoComplete
              options={searchResults.map(u => ({ value: u.open_id, label: `${u.name}${u.department_name ? ` (${u.department_name})` : ''}` }))}
              onSearch={handleSearch} onSelect={handleSelectFeishuUser}
              placeholder={hasCache === false ? "请先点击'从飞书同步'导入通讯录" : '输入姓名搜索飞书用户'}
              style={{ width: '100%' }} disabled={hasCache === false}
            ><Input /></AutoComplete>
          </Form.Item>
          {hasCache === false && <div style={{ marginTop: -12, marginBottom: 12, color: '#faad14', fontSize: 12 }}>飞书通讯录未同步，请先点击"从飞书同步"按钮导入数据</div>}
          <Form.Item name="department_id" label="部门">
            <Select allowClear placeholder="选择部门">{departments.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}</Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="从飞书通讯录导入人员" open={feishuOpen} onCancel={() => setFeishuOpen(false)} onOk={handleFeishuSync} confirmLoading={syncing}
        okText={`同步选中成员 (${Object.keys(selectedMembers).length}人)`} width={800}
      >
        {feishuLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /><p style={{ marginTop: 16, color: '#86868b' }}>正在加载飞书通讯录...</p></div>
        ) : feishuTree.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#86868b' }}>暂无通讯录数据</div>
        ) : (
          <>
            <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <Input placeholder="搜索人员姓名..." value={feishuSearch} onChange={e => { setFeishuSearch(e.target.value); if (e.target.value) setExpandedKeys(feishuTree.map(d => d.open_department_id)); }}
                style={{ width: 200 }} allowClear />
              <span style={{ color: '#86868b', fontSize: 13 }}>共 {totalStats.departments} 个部门，{totalStats.users} 人</span>
            </div>
            <div style={{ display: 'flex', gap: 16, minHeight: 360 }}>
              <div style={{ width: 280, borderRight: '1px solid #f0f0f0', overflow: 'auto', maxHeight: 400 }}>
                <div style={{ padding: '8px 0', fontWeight: 600, fontSize: 13, color: '#86868b' }}>部门列表（勾选导入）</div>
                {feishuTree.map((dept) => (
                  <DepartmentNode
                    key={dept.open_department_id} department={dept}
                    expandedKeys={expandedKeys} selectedMembers={selectedMembers} selectedDeptIds={selectedDeptIds}
                    searchText={feishuSearch}
                    onToggleExpand={(key) => { if (expandedKeys.includes(key)) setExpandedKeys(expandedKeys.filter(k => k !== key)); else setExpandedKeys([...expandedKeys, key]); }}
                    onSelectMember={(member, deptName) => toggleMember(member, deptName)}
                    onSelectDept={(deptName) => setSelectedDept(deptName)}
                    selectedDept={selectedDept}
                    onToggleDept={toggleDept}
                  />
                ))}
              </div>
              <div style={{ flex: 1, overflow: 'auto', maxHeight: 400 }}>
                {(() => {
                  const selectedList = Object.values(selectedMembers);
                  if (selectedList.length === 0) {
                    return <div style={{ padding: 48, textAlign: 'center', color: '#86868b' }}>
                      <div style={{ fontSize: 14, marginBottom: 8 }}>请选择人员</div>
                      <div style={{ fontSize: 12 }}>在左侧勾选部门或右侧勾选成员</div>
                    </div>;
                  }
                  return (
                    <List dataSource={selectedList} renderItem={({ member: m, deptName }) => (
                      <List.Item key={m.open_id} onClick={() => toggleMember(m, deptName)}
                        style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 6, background: '#fafafa' }}>
                        <Checkbox checked={true} />
                        <span style={{ marginLeft: 8, fontWeight: 500 }}>{m.name}</span>
                        <span style={{ marginLeft: 8, color: '#0071e3', fontSize: 12 }}>{deptName}</span>
                        {m.email && <span style={{ marginLeft: 8, color: '#86868b', fontSize: 12 }}>{m.email}</span>}
                      </List.Item>
                    )} />
                  );
                })()}
              </div>
            </div>
          </>
        )}
      </Modal>

      <Modal title="借用资产" open={assetsModalOpen} onCancel={() => setAssetsModalOpen(false)} footer={null} width={700}>
        {personAssets.length === 0 ? <p>该人员未借用任何资产</p> : (
          <Table dataSource={personAssets} rowKey="id" pagination={false} columns={[
            { title: '资产名称', dataIndex: 'name', key: 'name', render: (v: string, record: Asset) => <Button type="link" onClick={() => navigate(`/assets?highlight=${record.id}`)}>{v}</Button> },
            { title: '状态', dataIndex: 'status', key: 'status' },
            { title: '分类', dataIndex: 'category_name', key: 'category_name' },
          ]} />
        )}
      </Modal>

      <Modal title="确认删除" open={deleteId !== null} onOk={handleDelete} onCancel={() => setDeleteId(null)} okText="确认删除" okButtonProps={{ danger: true, style: { background: '#ff3b30', color: '#fff', border: 'none' } }}>
        <p>确定要删除这个人员吗？</p>
      </Modal>
    </div>
  );
}