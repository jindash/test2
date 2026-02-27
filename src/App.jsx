import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

const pages = {
  'db-config': DatabaseConfigPage,
  'biz-menu-config': BizMenuConfigPage,
  'script-config': ScriptConfigPage,
  'bill-query': BillQueryPage
};

export function App() {
  const [user, setUser] = useState(null);
  const [menus, setMenus] = useState([]);
  const [activeTop, setActiveTop] = useState('');
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('');

  useEffect(() => {
    if (!user) return;
    api.get('/menu', { params: { role: user.role } }).then((r) => {
      setMenus(r.data);
      if (r.data[0]) setActiveTop(r.data[0].id);
    });
  }, [user]);

  const currentLeftMenus = useMemo(() => menus.find((m) => m.id === activeTop)?.children || [], [menus, activeTop]);

  const openTab = (item) => {
    if (!tabs.find((t) => t.id === item.id)) setTabs((x) => [...x, item]);
    setActiveTab(item.id);
  };

  if (!user) return <LoginPage onSuccess={setUser} />;

  const ActivePage = pages[activeTab] || (() => <div className="text-muted">请选择左侧菜单开始操作</div>);

  return (
    <div className="container-fluid vh-100 d-flex flex-column p-0">
      <div className="top-nav d-flex justify-content-between align-items-center px-3 py-2 bg-primary text-white">
        <div className="fw-bold">运维查询工具</div>
        <div className="d-flex gap-2 align-items-center">
          {menus.map((m) => (
            <button key={m.id} className={`btn btn-sm ${m.id === activeTop ? 'btn-light' : 'btn-outline-light'}`} onClick={() => setActiveTop(m.id)}>{m.name}</button>
          ))}
        </div>
        <div>{user.name}（{user.role === 'admin' ? '管理员' : '普通用户'}）</div>
      </div>
      <div className="d-flex flex-grow-1 overflow-hidden">
        <aside className="border-end p-2" style={{ width: 240 }}>
          {currentLeftMenus.map((item) => (
            <button key={item.id} className="btn btn-outline-secondary w-100 text-start mb-2" onClick={() => openTab(item)}>{item.name}</button>
          ))}
        </aside>
        <main className="flex-grow-1 p-3 overflow-auto bg-light">
          <ul className="nav nav-tabs mb-3">
            {tabs.map((t) => (
              <li className="nav-item" key={t.id}>
                <button className={`nav-link ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.name}</button>
              </li>
            ))}
          </ul>
          <ActivePage />
        </main>
      </div>
    </div>
  );
}

function LoginPage({ onSuccess }) {
  const [form, setForm] = useState({ username: 'admin', password: 'admin123' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/login', form);
      onSuccess(res.data);
    } catch {
      setError('登录失败，请检查账号密码');
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center vh-100 bg-body-tertiary">
      <form className="card p-4 shadow-sm" style={{ width: 380 }} onSubmit={submit}>
        <h4 className="mb-3">登录 - 运维查询工具</h4>
        <input className="form-control mb-2" placeholder="用户名" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className="form-control mb-2" type="password" placeholder="密码" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <small className="text-muted mb-2">管理员：admin/admin123；普通用户：user/user123</small>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <button className="btn btn-primary w-100">登录</button>
      </form>
    </div>
  );
}

function DatabaseConfigPage() {
  const [filters, setFilters] = useState({ name: '', ip: '', enabled: '' });
  const [rows, setRows] = useState([]);
  const load = () => api.get('/db-configs', { params: filters }).then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const toggle = async (id) => {
    await api.post(`/db-configs/${id}/toggle`);
    load();
  };

  return <div>
    <h5>数据库配置</h5>
    <div className="row g-2 mb-3">
      {['name', 'ip', 'enabled'].map((k) => <div className="col" key={k}><input className="form-control" placeholder={k === 'name' ? '数据库名称' : k === 'ip' ? '数据库IP' : '是否可用'} value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })} /></div>)}
      <div className="col-auto"><button className="btn btn-primary" onClick={load}>查询</button></div>
    </div>
    <table className="table table-bordered bg-white">
      <thead><tr><th>数据库名称</th><th>IP</th><th>端口</th><th>账号</th><th>密码</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.ip}</td><td>{r.port}</td><td>{r.account}</td><td>{r.password}</td><td>{r.enabled ? '启用' : '禁用'}</td><td><button className={`btn btn-sm ${r.enabled ? 'btn-warning' : 'btn-success'}`} onClick={() => toggle(r.id)}>{r.enabled ? '禁用' : '启用'}</button></td></tr>)}</tbody>
    </table>
  </div>;
}

function BizMenuConfigPage() {
  const [tree, setTree] = useState([]);
  const [newName, setNewName] = useState('');
  const [parentId, setParentId] = useState('');
  const load = () => api.get('/biz-menus').then((r) => setTree(r.data));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newName) return;
    await api.post('/biz-menus', { parentId: parentId ? Number(parentId) : null, name: newName });
    setNewName('');
    load();
  };

  const del = async (id) => {
    try { await api.delete(`/biz-menus/${id}`); } catch (e) { alert(e.response?.data?.message || '删除失败'); }
    load();
  };

  const flatten = (nodes, acc = []) => {
    nodes.forEach((n) => { acc.push({ id: n.id, name: n.name }); flatten(n.children || [], acc); });
    return acc;
  };

  const renderNode = (n) => {
    const count = (n.children?.length || 0) || (n.scriptCount || 0);
    return <li key={n.id} className="mb-1"><span>{n.name} ({count})</span>
      <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => del(n.id)}>删除</button>
      {!!n.children?.length && <ul>{n.children.map(renderNode)}</ul>}
    </li>;
  };

  return <div>
    <h5>业务单据菜单配置</h5>
    <div className="d-flex gap-2 mb-3">
      <select className="form-select" value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">根节点</option>{flatten(tree).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
      <input className="form-control" placeholder="新增子节点名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
      <button className="btn btn-primary" onClick={add}>新增子节点</button>
    </div>
    <ul>{tree.map(renderNode)}</ul>
  </div>;
}

function ScriptConfigPage() {
  const [filters, setFilters] = useState({ dbName: '', bizMenuName: '', name: '', enabled: '' });
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', scriptText: '' });
  const load = () => api.get('/scripts', { params: filters }).then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const batch = async (action) => {
    if (!selected.length) return;
    if (action === 'delete' && !window.confirm('确认批量删除?')) return;
    await api.post('/scripts/batch', { ids: selected, action });
    setSelected([]);
    load();
  };

  const openModal = (row) => {
    setEditing(row || null);
    setForm(row ? { name: row.name, scriptText: row.scriptText || '' } : { name: '', scriptText: '' });
    setModal(true);
  };

  const save = async () => {
    if (editing) await api.put(`/scripts/${editing.id}`, form);
    else await api.post('/scripts', { ...form, dbName: 'prod-main', bizMenuName: '采购订单查询' });
    setModal(false);
    load();
  };

  return <div>
    <h5>脚本配置</h5>
    <div className="d-flex gap-2 mb-2"><button className="btn btn-primary" onClick={() => openModal()}>新增</button>
      <select className="form-select w-auto" onChange={(e) => e.target.value && batch(e.target.value)} defaultValue=""><option value="">批量操作</option><option value="enable">批量启用</option><option value="disable">批量禁用</option><option value="delete">批量删除</option></select>
    </div>
    <div className="row g-2 mb-3">{Object.keys(filters).map((k) => <div className="col" key={k}><input className="form-control" placeholder={k} value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })} /></div>)}<div className="col-auto"><button className="btn btn-secondary" onClick={load}>查询</button></div></div>
    <table className="table table-striped bg-white">
      <thead><tr><th><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? rows.map((x) => x.id) : [])} /></th><th>数据库名称</th><th>业务菜单</th><th>脚本名称</th><th>脚本功能</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td><input type="checkbox" checked={selected.includes(r.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((id) => id !== r.id))} /></td><td>{r.dbName}</td><td>{r.bizMenuName}</td><td>{r.name}</td><td>{r.functionDesc}</td><td>{r.enabled ? '启用' : '禁用'}</td><td><button className="btn btn-sm btn-outline-primary" onClick={() => openModal(r)}>编辑</button></td></tr>)}</tbody>
    </table>
    {modal && <div className="modal d-block bg-dark bg-opacity-50"><div className="modal-dialog"><div className="modal-content"><div className="modal-header"><h6>{editing ? '编辑' : '新增'}脚本</h6></div><div className="modal-body"><input className="form-control mb-2" placeholder="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><textarea className="form-control" rows={6} maxLength={5000} placeholder="脚本内容(最大5000)" value={form.scriptText} onChange={(e) => setForm({ ...form, scriptText: e.target.value })} /></div><div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModal(false)}>取消</button><button className="btn btn-primary" onClick={save}>保存</button></div></div></div></div>}
  </div>;
}

function BillQueryPage() {
  const [dbs, setDbs] = useState([]);
  const [modules, setModules] = useState([{ id: 1, dbName: '', scriptId: '', params: {}, scripts: [], results: [] }]);

  useEffect(() => { api.get('/query/databases').then((r) => setDbs(r.data)); }, []);

  const updateModule = (id, data) => setModules((list) => list.map((m) => (m.id === id ? { ...m, ...data } : m)));

  const onDbChange = async (m, dbName) => {
    const scripts = (await api.get('/query/scripts', { params: { dbName } })).data;
    updateModule(m.id, { dbName, scripts, scriptId: '', params: {}, results: [] });
  };

  const execute = async (m) => {
    const res = await api.post('/query/execute', { scriptId: Number(m.scriptId), params: m.params });
    updateModule(m.id, { results: res.data.results });
  };

  return <div>
    <h5>业务单据查询</h5>
    <button className="btn btn-outline-primary btn-sm mb-2" onClick={() => setModules((x) => [...x, { id: Date.now(), dbName: '', scriptId: '', params: {}, scripts: [], results: [] }])}>新增查询模块</button>
    {modules.map((m, idx) => {
      const selectedScript = m.scripts.find((s) => s.id === Number(m.scriptId));
      return <div className="card mb-3" key={m.id}><div className="card-header">模块 {idx + 1}</div><div className="card-body">
        <div className="row g-2 mb-2">
          <div className="col"><select className="form-select" value={m.dbName} onChange={(e) => onDbChange(m, e.target.value)}><option value="">选择数据库</option>{dbs.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}</select></div>
          <div className="col"><select className="form-select" value={m.scriptId} onChange={(e) => updateModule(m.id, { scriptId: e.target.value, params: {} })}><option value="">选择脚本</option>{m.scripts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
        <div className="row g-2 mb-2">{selectedScript?.params?.map((p) => <div className="col" key={p}><input className="form-control" placeholder={`参数: ${p}`} value={m.params[p] || ''} onChange={(e) => updateModule(m.id, { params: { ...m.params, [p]: e.target.value } })} /></div>)}</div>
        <button className="btn btn-success btn-sm mb-2" disabled={!m.scriptId} onClick={() => execute(m)}>执行</button>
        {m.results.map((r) => <div key={r.name} className="mb-3"><h6>{r.name}</h6><table className="table table-bordered table-sm"><thead><tr>{r.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{r.rows.map((row, i) => <tr key={i}>{r.columns.map((c) => <td key={c}>{row[c]}</td>)}</tr>)}</tbody></table></div>)}
      </div></div>;
    })}
  </div>;
}
