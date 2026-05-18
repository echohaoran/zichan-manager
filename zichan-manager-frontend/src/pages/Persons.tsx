import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Select, Tag, List, Checkbox, Spin, AutoComplete } from 'antd';
import { PlusOutlined, LinkOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { Person, Department, Asset, FeishuDepartmentTree, FeishuContactMember } from '../types';

// 递归部门节点组件
function DepartmentNode({
  department,
  expandedKeys,
  selectedMembers,
  searchText,
  onToggleExpand,
  onSelectMember,
  onSelectDept,
  selectedDept,
}: {
  department: FeishuDepartmentTree;
  expandedKeys: string[];
  selectedMembers: Record<string, { member: FeishuContactMember; deptName: string }>;
  searchText: string;
  onToggleExpand: (key: string) => void;
  onSelectMember: (member: FeishuContactMember, deptName: string) => void;
  onSelectDept: (deptName: string) => void;
  selectedDept: string | null;
}) {
  const hasChildren = department.children && department.children.length > 0;
  const isExpanded = expandedKeys.includes(department.open_department_id);
  const members = department.members || [];
  const filteredMembers = searchText
    ? members.filter(m => m.name.toLowerCase().includes(searchText.toLowerCase()))
    : members;

  return (
    <div>
      <div
        onClick={() => {
          onSelectDept(department.name);
          if (hasChildren) {
            onToggleExpand(department.open_department_id);
          }
        }}
        style={{
          padding: '6px 8px',
          cursor: 'pointer',
          borderRadius: 6,
          background: selectedDept === department.name ? '#e6f4ff' : 'transparent',
          color: selectedDept === department.name ? '#0071e3' : '#1d1d1f',
          fontWeight: selectedDept === department.name ? 500 : 400,
          marginBottom: 2,
          fontSize: 13,
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
        <span style={{ flex: 1 }}>{department.name || '根部门'}</span>
        <span style={{ color: '#86868b', fontSize: 11 }}>
          {searchText ? `${filteredMembers.length}/${members.length}` : members.length}
        </span>
      </div>
      {isExpanded && hasChildren && department.children ? (
        <div style={{ paddingLeft: 16 }}>
          {department.children.map(child => (
            <DepartmentNode
              key={child.open_department_id}
              department={child}
              expandedKeys={expandedKeys}
              selectedMembers={selectedMembers}
              searchText={searchText}
              onToggleExpand={onToggleExpand}
              onSelectMember={onSelectMember}
              onSelectDept={onSelectDept}
              selectedDept={selectedDept}
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

  // 飞书通讯录
  const [feishuOpen, setFeishuOpen] = useState(false);
  const [feishuTree, setFeishuTree] = useState<FeishuDepartmentTree[]>([]);
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Record<string, { member: FeishuContactMember; deptName: string }>>({});
  const [syncing, setSyncing] = useState(false);
  const [feishuSearch, setFeishuSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [totalStats, setTotalStats] = useState({ departments: 0, users: 0 });
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  // 搜索飞书用户
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

    // 检查是否有飞书缓存
    try {
      const cacheRes = await client.get('/api/feishu/contacts');
      const totalUsers = cacheRes.data.total_users || 0;
      setHasCache(totalUsers > 0);
    } catch {
      setHasCache(false);
    }

    // 获取每个人员的资产数量
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
    if (!value || value.length < 1) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await client.get<FeishuContactMember[]>('/api/feishu/search', { params: { q: value } });
      setSearchResults(res.data);
    } catch {
      setSearchResults([]);
    }
  };

  const handleSelectFeishuUser = async (open_id: string) => {
    const user = searchResults.find(u => u.open_id === open_id);
    if (user) {
      form.setFieldsValue({ name: user.name });
      
      // 自动处理部门
      const deptName = user.department_name || '';
      if (deptName) {
        let deptId: number | undefined;
        const existing = departments.find(d => d.name === deptName);
        if (existing) {
          deptId = existing.id;
        } else {
          // 部门不存在，自动创建
          try {
            const res = await client.post('/api/departments', { name: deptName });
            deptId = res.data.id;
            setDepartments(prev => [...prev, res.data]);
            message.success(`已自动创建部门: ${deptName}`);
          } catch {
            message.warning(`部门 "${deptName}" 创建失败，请手动选择`);
          }
        }
        form.setFieldsValue({ department_id: deptId });
      }
    }
  };

  const openCreate = () => {
    setEditing(null);
    setSearchResults([]);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (person: Person) => {
    setEditing(person);
    setSearchResults([]);
    form.setFieldsValue({ name: person.name, department_id: person.department_id });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await client.put(`/api/persons/${editing.id}`, values);
      message.success('已更新');
    } else {
      await client.post('/api/persons', values);
      message.success('已创建');
    }
    setModalOpen(false);
    fetch();
  };

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await client.delete(`/api/persons/${deleteId}`);
      message.success('已删除');
      setDeleteId(null);
      fetch();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '删除失败');
      setDeleteId(null);
    }
  };

  const openFeishu = async () => {
    setFeishuOpen(true);
    setFeishuLoading(true);
    setSelectedMembers({});
    setFeishuSearch('');
    setExpandedKeys([]);
    try {
      const res = await client.get<{ departments: FeishuDepartmentTree[]; total_departments: number; total_users: number }>('/api/feishu/contacts');
      setFeishuTree(res.data.departments || []);
      setTotalStats({ departments: res.data.total_departments || 0, users: res.data.total_users || 0 });
      setHasCache((res.data.total_users || 0) > 0);
      // 默认展开第一级
      const firstLevelKeys = (res.data.departments || []).map(d => d.open_department_id);
      setExpandedKeys(firstLevelKeys);
    } catch (err: any) {
      message.error('获取飞书通讯录失败: ' + (err.response?.data?.detail || err.message));
    }
    setFeishuLoading(false);
  };

  // 过滤树（搜索功能）
  const filterTree = (nodes: FeishuDepartmentTree[], search: string): FeishuDepartmentTree[] => {
    if (!search) return nodes;
    const result: FeishuDepartmentTree[] = [];
    for (const node of nodes) {
      const matchedMembers = (node.members || []).filter(m => m.name.includes(search));
      const filteredChildren = filterTree(node.children || [], search);
      if (matchedMembers.length > 0 || filteredChildren.length > 0) {
        result.push({
          ...node,
          members: matchedMembers,
          children: filteredChildren,
        });
      }
    }
    return result;
  };

  const toggleMember = (member: FeishuContactMember, deptName: string) => {
    setSelectedMembers((prev) => {
      const next = { ...prev };
      if (next[member.open_id]) {
        delete next[member.open_id];
      } else {
        next[member.open_id] = { member, deptName };
      }
      return next;
    });
  };

  const handleFeishuSync = async () => {
    const members = Object.values(selectedMembers);
    if (members.length === 0) {
      message.warning('请至少选择一位成员');
      return;
    }
    setSyncing(true);
    try {
      const deptsRes = await client.get('/api/departments');
      const existingDepts: Record<string, Department> = {};
      for (const d of deptsRes.data) {
        existingDepts[d.name] = d;
      }

      const existingPersons: Record<string, Person> = {};
      for (const p of persons) {
        existingPersons[p.name] = p;
      }

      for (const { member: m, deptName } of members) {
        if (existingPersons[m.name]) continue;

        let deptId: number | undefined;
        if (deptName) {
          if (existingDepts[deptName]) {
            deptId = existingDepts[deptName].id;
          } else {
            const dRes = await client.post('/api/departments', { name: deptName });
            existingDepts[deptName] = dRes.data;
            deptId = dRes.data.id;
          }
        }

        await client.post('/api/persons', {
          name: m.name,
          department_id: deptId || null,
        });
      }

      message.success(`成功同步 ${members.length} 位成员`);
      setFeishuOpen(false);
      fetch();
    } catch {
      message.error('同步失败');
    }
    setSyncing(false);
  };

  const viewAssets = async (person: Person) => {
    try {
      const res = await client.get(`/api/persons/${person.id}/assets`);
      setPersonAssets(res.data.assets || []);
      setAssetsModalOpen(true);
    } catch {
      message.error('获取资产列表失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '部门', dataIndex: 'department_name', key: 'department_name', render: (v: string) => v || '-' },
    { title: '借用资产数', key: 'asset_count', render: (_: any, record: Person) => (
      <Tag color="blue">{personAssetCount[record.id] || 0}</Tag>
    )},
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (v: string) => v?.slice(0, 10) },
    {
      title: '操作', key: 'action',
      render: (_: any, record: Person) => (
        <Space>
          <Button type="link" onClick={() => viewAssets(record)}>
            资产({personAssetCount[record.id] || 0})
          </Button>
          <Button type="link" onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" danger onClick={() => setDeleteId(record.id)}>删除</Button>
        </Space>
      ),
    },
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
              onSearch={handleSearch}
              onSelect={handleSelectFeishuUser}
              placeholder={hasCache === false ? "请先点击'从飞书同步'导入通讯录" : "输入姓名搜索飞书用户"}
              style={{ width: '100%' }}
              disabled={hasCache === false}
            >
              <Input />
            </AutoComplete>
          </Form.Item>
          {hasCache === false && (
            <div style={{ marginTop: -12, marginBottom: 12, color: '#faad14', fontSize: 12 }}>
              飞书通讯录未同步，请先点击"从飞书同步"按钮导入数据
            </div>
          )}
          <Form.Item name="department_id" label="部门">
            <Select allowClear placeholder="选择部门（输入姓名后自动带出）">
              {departments.map(d => (
                <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 飞书通讯录弹窗 */}
      <Modal
        title="从飞书通讯录导入人员"
        open={feishuOpen}
        onCancel={() => setFeishuOpen(false)}
        onOk={handleFeishuSync}
        confirmLoading={syncing}
        okText={`同步选中成员 (${Object.keys(selectedMembers).length}人)`}
        width={800}
      >
        {feishuLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: '#86868b' }}>正在加载飞书通讯录...</p>
            <p style={{ color: '#86868b', fontSize: 12 }}>获取所有部门和人员，请稍候</p>
          </div>
        ) : feishuTree.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#86868b' }}>
            暂无通讯录数据
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <Input
                placeholder="搜索人员姓名..."
                value={feishuSearch}
                onChange={e => {
                  setFeishuSearch(e.target.value);
                  if (e.target.value) {
                    // 搜索时自动展开所有部门
                    setExpandedKeys(feishuTree.map(d => d.open_department_id));
                  }
                }}
                style={{ width: 200 }}
                allowClear
              />
              <span style={{ color: '#86868b', fontSize: 13 }}>
                共 {totalStats.departments} 个部门，{totalStats.users} 人
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, minHeight: 360 }}>
              <div style={{ width: 280, borderRight: '1px solid #f0f0f0', overflow: 'auto', maxHeight: 400 }}>
                <div style={{ padding: '8px 0', fontWeight: 600, fontSize: 13, color: '#86868b' }}>
                  部门列表
                </div>
                {feishuTree.map((dept) => (
                  <DepartmentNode
                    key={dept.open_department_id}
                    department={dept}
                    expandedKeys={expandedKeys}
                    selectedMembers={selectedMembers}
                    searchText={feishuSearch}
                    onToggleExpand={(key) => {
                      if (expandedKeys.includes(key)) {
                        setExpandedKeys(expandedKeys.filter(k => k !== key));
                      } else {
                        setExpandedKeys([...expandedKeys, key]);
                      }
                    }}
                    onSelectMember={(member, deptName) => toggleMember(member, deptName)}
                    onSelectDept={(deptName) => setSelectedDept(deptName)}
                    selectedDept={selectedDept}
                  />
                ))}
              </div>
              <div style={{ flex: 1, overflow: 'auto', maxHeight: 400 }}>
                {(() => {
                  // 收集所有部门的所有成员
                  const collectAllMembers = (nodes: FeishuDepartmentTree[]): FeishuContactMember[] => {
                    const results: FeishuContactMember[] = [];
                    const traverse = (node: FeishuDepartmentTree) => {
                      if (node.members) {
                        for (const m of node.members) {
                          results.push({ ...m, department_name: node.name });
                        }
                      }
                      if (node.children) {
                        node.children.forEach(traverse);
                      }
                    };
                    nodes.forEach(traverse);
                    return results;
                  };

                  // 如果有搜索关键词，搜索所有成员
                  if (feishuSearch) {
                    const allMembers = collectAllMembers(feishuTree);
                    const filtered = allMembers.filter(m =>
                      m.name.toLowerCase().includes(feishuSearch.toLowerCase())
                    );
                    return filtered.length > 0 ? (
                      <List
                        dataSource={filtered}
                        renderItem={(m) => (
                          <List.Item
                            key={m.open_id}
                            onClick={() => toggleMember(m, m.department_name || '')}
                            style={{
                              cursor: 'pointer',
                              padding: '8px 12px',
                              borderRadius: 6,
                              background: selectedMembers[m.open_id] ? '#e6f4ff' : 'transparent',
                            }}
                          >
                            <Checkbox checked={!!selectedMembers[m.open_id]} />
                            <span style={{ marginLeft: 8, fontWeight: 500 }}>{m.name}</span>
                            <span style={{ marginLeft: 8, color: '#0071e3', fontSize: 12 }}>
                              {m.department_name}
                            </span>
                            {m.email && (
                              <span style={{ marginLeft: 8, color: '#86868b', fontSize: 12 }}>
                                {m.email}
                              </span>
                            )}
                          </List.Item>
                        )}
                      />
                    ) : (
                      <div style={{ padding: 48, textAlign: 'center', color: '#86868b' }}>
                        未找到匹配的人员
                      </div>
                    );
                  }

                  // 无搜索时显示选中部门的成员
                  if (!selectedDept) {
                    return (
                      <div style={{ padding: 48, textAlign: 'center', color: '#86868b' }}>
                        请选择左侧部门查看成员
                      </div>
                    );
                  }

                  const collectMembers = (nodes: FeishuDepartmentTree[], targetDept: string): FeishuContactMember[] => {
                    const results: FeishuContactMember[] = [];
                    const search = (node: FeishuDepartmentTree) => {
                      if (node.name === targetDept) {
                        results.push(...(node.members || []));
                      }
                      node.children?.forEach(search);
                    };
                    nodes.forEach(search);
                    return results;
                  };
                  const deptMembers = collectMembers(feishuTree, selectedDept);
                  return deptMembers.length > 0 ? (
                    <List
                      dataSource={deptMembers}
                      renderItem={(m) => (
                        <List.Item
                          key={m.open_id}
                          onClick={() => toggleMember(m, selectedDept)}
                          style={{
                            cursor: 'pointer',
                            padding: '8px 12px',
                            borderRadius: 6,
                            background: selectedMembers[m.open_id] ? '#e6f4ff' : 'transparent',
                          }}
                        >
                          <Checkbox checked={!!selectedMembers[m.open_id]} />
                          <span style={{ marginLeft: 8, fontWeight: 500 }}>{m.name}</span>
                          {m.email && (
                            <span style={{ marginLeft: 8, color: '#86868b', fontSize: 12 }}>
                              {m.email}
                            </span>
                          )}
                        </List.Item>
                      )}
                    />
                  ) : (
                    <div style={{ padding: 48, textAlign: 'center', color: '#86868b' }}>
                      该部门暂无成员
                    </div>
                  );
                })()}
              </div>
            </div>
          </>
        )}
      </Modal>

      <Modal title="借用资产" open={assetsModalOpen} onCancel={() => setAssetsModalOpen(false)} footer={null} width={700}>
        {personAssets.length === 0 ? (
          <p>该人员未借用任何资产</p>
        ) : (
          <Table
            dataSource={personAssets}
            rowKey="id"
            pagination={false}
            columns={[
              {
                title: '资产名称',
                dataIndex: 'name',
                key: 'name',
                render: (v: string, record: Asset) => (
                  <Button type="link" onClick={() => navigate(`/assets?highlight=${record.id}`)}>
                    {v}
                  </Button>
                )
              },
              { title: '状态', dataIndex: 'status', key: 'status' },
              { title: '分类', dataIndex: 'category_name', key: 'category_name' },
            ]}
          />
        )}
      </Modal>

      <Modal title="确认删除" open={deleteId !== null} onOk={handleDelete} onCancel={() => setDeleteId(null)} okText="确认删除" okButtonProps={{ danger: true, style: { background: '#ff3b30', color: '#fff', border: 'none' } }}>
        <p>确定要删除这个人员吗？</p>
      </Modal>
    </div>
  );
}