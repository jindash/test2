import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const users = [
  { username: 'admin', password: 'admin123', role: 'admin', name: '系统管理员' },
  { username: 'user', password: 'user123', role: 'user', name: '普通用户' }
];

const menusByRole = {
  admin: [
    {
      id: 'sys-config',
      name: '系统配置',
      children: [
        { id: 'db-config', name: '数据库配置' },
        { id: 'biz-menu-config', name: '业务单据菜单配置' },
        { id: 'script-config', name: '脚本配置' }
      ]
    },
    {
      id: 'biz-query',
      name: '业务单据查询',
      children: [{ id: 'bill-query', name: '单据查询工作台' }]
    }
  ],
  user: [
    {
      id: 'biz-query',
      name: '业务单据查询',
      children: [{ id: 'bill-query', name: '单据查询工作台' }]
    }
  ]
};

let dbConfigs = [
  { id: 1, name: 'prod-main', ip: '10.1.1.5', port: 5432, account: 'ops_ro', password: '******', enabled: true },
  { id: 2, name: 'test-report', ip: '10.8.2.11', port: 3306, account: 'report', password: '******', enabled: false }
];

let bizMenuTree = [
  {
    id: 1,
    name: '采购单',
    children: [
      { id: 2, name: '采购订单查询', children: [], scriptCount: 2 },
      { id: 3, name: '退货单查询', children: [], scriptCount: 1 }
    ]
  },
  {
    id: 4,
    name: '销售单',
    children: [{ id: 5, name: '销售发货单查询', children: [], scriptCount: 3 }]
  }
];

let scripts = [
  {
    id: 1,
    dbName: 'prod-main',
    bizMenuName: '采购订单查询',
    name: '采购订单状态追踪',
    functionDesc: '按单号查询采购订单头与明细',
    enabled: true,
    scriptText: 'SELECT * FROM po_header WHERE order_no = :orderNo; SELECT * FROM po_line WHERE order_no = :orderNo;',
    params: ['orderNo'],
    queries: [
      { name: '采购订单头', columns: ['order_no', 'vendor', 'status'], rows: [{ order_no: 'PO1001', vendor: 'A供应商', status: '已审核' }] },
      {
        name: '采购订单明细',
        columns: ['order_no', 'line_no', 'item_code', 'qty'],
        rows: [
          { order_no: 'PO1001', line_no: 1, item_code: 'RM-001', qty: 10 },
          { order_no: 'PO1001', line_no: 2, item_code: 'RM-002', qty: 20 }
        ]
      }
    ]
  },
  {
    id: 2,
    dbName: 'test-report',
    bizMenuName: '销售发货单查询',
    name: '发货单执行跟踪',
    functionDesc: '按发货单号查看执行状态',
    enabled: false,
    scriptText: 'SELECT * FROM shipment WHERE shipment_no = :shipmentNo;',
    params: ['shipmentNo'],
    queries: [
      {
        name: '发货执行',
        columns: ['shipment_no', 'warehouse', 'status'],
        rows: [{ shipment_no: 'S10001', warehouse: 'WH-A', status: '已发货' }]
      }
    ]
  }
];

const fuzzy = (v, k) => (k ? String(v ?? '').toLowerCase().includes(k.toLowerCase()) : true);

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ message: '用户名或密码错误' });
  res.json({ username: user.username, role: user.role, name: user.name, token: `${user.role}-token` });
});

app.get('/api/menu', (req, res) => {
  const role = req.query.role || 'user';
  res.json(menusByRole[role] || []);
});

app.get('/api/db-configs', (req, res) => {
  const { name, ip, enabled } = req.query;
  const list = dbConfigs.filter(
    (x) => fuzzy(x.name, name) && fuzzy(x.ip, ip) && (enabled === undefined || fuzzy(x.enabled ? '启用' : '禁用', enabled))
  );
  res.json(list);
});

app.post('/api/db-configs/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  dbConfigs = dbConfigs.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x));
  res.json({ success: true });
});

app.get('/api/biz-menus', (_req, res) => res.json(bizMenuTree));

function addChild(nodes, parentId, node) {
  for (const n of nodes) {
    if (n.id === parentId) {
      n.children = n.children || [];
      n.children.push(node);
      return true;
    }
    if (addChild(n.children || [], parentId, node)) return true;
  }
  return false;
}

function removeNode(nodes, id) {
  const idx = nodes.findIndex((x) => x.id === id);
  if (idx >= 0) {
    const target = nodes[idx];
    if ((target.children?.length || 0) > 0 || (target.scriptCount || 0) > 0) return false;
    nodes.splice(idx, 1);
    return true;
  }
  return nodes.some((node) => removeNode(node.children || [], id));
}

app.post('/api/biz-menus', (req, res) => {
  const { parentId, name } = req.body;
  const node = { id: Date.now(), name, children: [], scriptCount: 0 };
  if (!parentId) bizMenuTree.push(node);
  else addChild(bizMenuTree, parentId, node);
  res.json({ success: true });
});

app.delete('/api/biz-menus/:id', (req, res) => {
  const ok = removeNode(bizMenuTree, Number(req.params.id));
  if (!ok) return res.status(400).json({ message: '节点有子菜单或已关联脚本，无法删除' });
  res.json({ success: true });
});

app.get('/api/scripts', (req, res) => {
  const { dbName, bizMenuName, name, enabled } = req.query;
  const list = scripts.filter(
    (s) =>
      fuzzy(s.dbName, dbName) &&
      fuzzy(s.bizMenuName, bizMenuName) &&
      fuzzy(s.name, name) &&
      (enabled === undefined || fuzzy(s.enabled ? '启用' : '禁用', enabled))
  );
  res.json(list);
});

app.post('/api/scripts', (req, res) => {
  scripts.push({ id: Date.now(), enabled: true, functionDesc: '自定义脚本', params: [], queries: [], ...req.body });
  res.json({ success: true });
});

app.put('/api/scripts/:id', (req, res) => {
  const id = Number(req.params.id);
  scripts = scripts.map((s) => (s.id === id ? { ...s, ...req.body } : s));
  res.json({ success: true });
});

app.post('/api/scripts/batch', (req, res) => {
  const { ids, action } = req.body;
  if (action === 'delete') scripts = scripts.filter((s) => !ids.includes(s.id));
  else if (action === 'enable') scripts = scripts.map((s) => (ids.includes(s.id) ? { ...s, enabled: true } : s));
  else if (action === 'disable') scripts = scripts.map((s) => (ids.includes(s.id) ? { ...s, enabled: false } : s));
  res.json({ success: true });
});

app.get('/api/query/databases', (_req, res) => {
  res.json(dbConfigs.filter((d) => d.enabled).map((d) => ({ id: d.id, name: d.name })));
});

app.get('/api/query/scripts', (req, res) => {
  const { dbName } = req.query;
  res.json(scripts.filter((s) => s.enabled && (!dbName || s.dbName === dbName)).map((s) => ({ id: s.id, name: s.name, params: s.params })));
});

app.post('/api/query/execute', (req, res) => {
  const { scriptId } = req.body;
  const script = scripts.find((s) => s.id === scriptId);
  if (!script) return res.status(404).json({ message: '脚本不存在' });
  res.json({ script: script.name, results: script.queries });
});

app.listen(3001, () => console.log('API running on 3001'));
