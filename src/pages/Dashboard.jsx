import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiDollarSign, FiFileText, FiTruck, FiTrendingUp, FiArrowUpRight, FiArrowDownRight } from 'react-icons/fi';
import { Invoices, DeliveryNotes, Purchases, Products } from '../utils/storage';
import { formatCurrency, formatDateShort, isToday, isThisMonth, getLast7Days, formatNumber } from '../utils/formatter';

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

  const monthPurchases = purchases.filter(p => isThisMonth(p.createdAt));
  const monthTotalPurchases = monthPurchases.reduce((sum, p) => sum + (p.totalCost || 0), 0);
  
  const todayPurchases = purchases.filter(p => isToday(p.createdAt));
  const todayTotalPurchases = todayPurchases.reduce((sum, p) => sum + (p.totalCost || 0), 0);

  // 7-day revenue chart
  const last7 = getLast7Days();
  const revenueData = last7.map(day => {
    const dayInvoices = invoices.filter(inv => inv.createdAt && inv.createdAt.slice(0, 10) === day.date);
    const revenue = dayInvoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0);
    return { name: day.label, Revenue: revenue };
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
            <span className="stat-card-trend">Aktual</span>
          </div>
          <div className="stat-card-value">{formatCurrency(monthTotalPurchases)}</div>
          <div className="stat-card-label">Pembelian Bulan Ini</div>
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
            <div className="text-sm text-muted">Total Penjualan</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{formatCurrency(todayRevenue)}</div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(245,158,11,0.08)', borderRadius: '12px' }}>
            <div className="text-sm text-muted">Total Pembelian</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{formatCurrency(todayTotalPurchases)}</div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(6,182,212,0.08)', borderRadius: '12px' }}>
            <div className="text-sm text-muted">Jumlah Invoice</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{todayInvoices.length}</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Trend Revenue (7 Hari)</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}jt` : v >= 1000 ? `${(v/1000).toFixed(0)}rb` : v} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} name="Revenue" />
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

      <div className="card" style={{ marginTop: '24px' }}>
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
                  <strong>{dn.dnNumber}</strong>
                  <span>{dn.customerName} · {formatDateShort(dn.createdAt)}</span>
                </div>
                <div className="activity-amount badge badge-cyan">Surat Jalan</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
