import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiDollarSign, FiFileText, FiTruck, FiTrendingUp, FiArrowUpRight, FiArrowDownRight } from 'react-icons/fi';
import { Invoices, DeliveryNotes, Purchases, Products } from '../utils/storage';
import { formatCurrency, formatDateShort, isToday, isThisMonth, getLast7Days, calculateMargin } from '../utils/formatter';

const CHART_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}>
      <p style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [invoices, setInvoices] = useState([]);
  const [deliveryNotes, setDN] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const load = async () => {
      setInvoices(await Invoices.getAll());
      setDN(await DeliveryNotes.getAll());
      setPurchases(await Purchases.getAll());
      setProducts(await Products.getAll());
    };
    load();
  }, []);

  // Stats calculations
  const todayInvoices = invoices.filter(inv => isToday(inv.createdAt));
  const monthInvoices = invoices.filter(inv => isThisMonth(inv.createdAt));
  const todayRevenue = todayInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const monthRevenue = monthInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

  const todayCOGS = todayInvoices.reduce((sum, inv) => {
    return sum + (inv.items || []).reduce((s, item) => s + ((item.purchaseCost || 0) * (item.qty || 0)), 0);
  }, 0);
  const todayProfit = todayRevenue - todayCOGS;

  const monthCOGS = monthInvoices.reduce((sum, inv) => {
    return sum + (inv.items || []).reduce((s, item) => s + ((item.purchaseCost || 0) * (item.qty || 0)), 0);
  }, 0);
  const monthProfit = monthRevenue - monthCOGS;
  const monthMargin = monthRevenue > 0 ? ((monthProfit / monthRevenue) * 100).toFixed(1) : 0;

  // 7-day revenue chart
  const last7 = getLast7Days();
  const revenueData = last7.map(day => {
    const dayInvoices = invoices.filter(inv => inv.createdAt && inv.createdAt.slice(0, 10) === day.date);
    const revenue = dayInvoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0);
    const cogs = dayInvoices.reduce((s, inv) => s + (inv.items || []).reduce((ss, it) => ss + ((it.purchaseCost || 0) * (it.qty || 0)), 0), 0);
    return { name: day.label, Revenue: revenue, Profit: revenue - cogs };
  });

  // Top products
  const productSales = {};
  invoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      if (!productSales[item.productName]) productSales[item.productName] = 0;
      productSales[item.productName] += item.subtotal || 0;
    });
  });
  const topProducts = Object.entries(productSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name: name.length > 15 ? name.slice(0, 15) + '...' : name, value }));

  // Profit margin by product category
  const categoryMargins = {};
  products.forEach(p => {
    const cat = p.category || 'Lainnya';
    if (!categoryMargins[cat]) categoryMargins[cat] = { revenue: 0, cost: 0 };
    categoryMargins[cat].revenue += p.sellPrice || 0;
    categoryMargins[cat].cost += p.purchaseCost || 0;
  });
  const marginData = Object.entries(categoryMargins).map(([name, data]) => ({
    name,
    value: Math.round(data.revenue - data.cost),
  }));

  // Recent activity
  const recentInvoices = [...invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const recentDN = [...deliveryNotes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Ringkasan bisnis dan aktivitas hari ini</p>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiDollarSign /></div>
            {todayRevenue > 0 && <span className="stat-card-trend up"><FiArrowUpRight /> Hari ini</span>}
          </div>
          <div className="stat-card-value">{formatCurrency(monthRevenue)}</div>
          <div className="stat-card-label">Revenue Bulan Ini</div>
        </div>

        <div className="stat-card green">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiTrendingUp /></div>
            <span className="stat-card-trend up">{monthMargin}%</span>
          </div>
          <div className="stat-card-value">{formatCurrency(monthProfit)}</div>
          <div className="stat-card-label">Profit Bulan Ini</div>
        </div>

        <div className="stat-card cyan">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiFileText /></div>
          </div>
          <div className="stat-card-value">{monthInvoices.length}</div>
          <div className="stat-card-label">Invoice Bulan Ini</div>
        </div>

        <div className="stat-card orange">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiTruck /></div>
          </div>
          <div className="stat-card-value">{deliveryNotes.filter(d => isThisMonth(d.createdAt)).length}</div>
          <div className="stat-card-label">Surat Jalan Bulan Ini</div>
        </div>
      </div>

      {/* Daily Recap */}
      <div className="card mb-lg">
        <div className="card-header">
          <h3 className="card-title">📊 Rekap Hari Ini</h3>
          <span className="text-sm text-muted">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="stats-grid" style={{ marginBottom: 0 }}>
          <div style={{ padding: '12px', background: 'rgba(99,102,241,0.08)', borderRadius: '12px' }}>
            <div className="text-sm text-muted">Pendapatan</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{formatCurrency(todayRevenue)}</div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', borderRadius: '12px' }}>
            <div className="text-sm text-muted">Modal (COGS)</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{formatCurrency(todayCOGS)}</div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(16,185,129,0.08)', borderRadius: '12px' }}>
            <div className="text-sm text-muted">Profit</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: todayProfit >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(todayProfit)}</div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(245,158,11,0.08)', borderRadius: '12px' }}>
            <div className="text-sm text-muted">Jumlah Invoice</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{todayInvoices.length}</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Revenue & Profit (7 Hari)</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}jt` : v >= 1000 ? `${(v/1000).toFixed(0)}rb` : v} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} name="Revenue" />
              <Area type="monotone" dataKey="Profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Produk Terjual</h3>
          </div>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}jt` : `${(v/1000).toFixed(0)}rb`} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Penjualan" radius={[0, 6, 6, 0]}>
                  {topProducts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <p className="text-muted">Belum ada data penjualan</p>
            </div>
          )}
        </div>
      </div>

      {/* Profit Margin by Category */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Margin per Kategori Produk</h3>
          </div>
          {marginData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={marginData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {marginData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p className="text-muted">Belum ada data</p></div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Aktivitas Terbaru</h3>
          </div>
          {recentInvoices.length === 0 && recentDN.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p className="text-muted">Belum ada aktivitas</p>
            </div>
          ) : (
            <div>
              {recentInvoices.map(inv => (
                <div key={inv.id} className="activity-item">
                  <div className="activity-icon invoice"><FiFileText /></div>
                  <div className="activity-details">
                    <strong>{inv.invoiceNumber}</strong>
                    <span>{inv.customerName} · {formatDateShort(inv.createdAt)}</span>
                  </div>
                  <div className="activity-amount">{formatCurrency(inv.grandTotal)}</div>
                </div>
              ))}
              {recentDN.map(dn => (
                <div key={dn.id} className="activity-item">
                  <div className="activity-icon delivery"><FiTruck /></div>
                  <div className="activity-details">
                    <strong>{dn.noteNumber}</strong>
                    <span>{dn.customerName} · {formatDateShort(dn.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
