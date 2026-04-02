import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FiTrendingUp, FiDollarSign, FiBarChart2, FiCalendar, FiFileText } from 'react-icons/fi';
import { Invoices, Products } from '../utils/storage';
import { formatCurrency, formatDateShort, formatNumber, calculateMargin, isToday, isThisWeek, isThisMonth } from '../utils/formatter';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

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

export default function Reports() {
  const [activeTab, setActiveTab] = useState('profit');
  const [period, setPeriod] = useState('month');
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function loadData() {
      setInvoices(await Invoices.getAll());
      setProducts(await Products.getAll());
    }
    loadData();
  }, []);

  // Filter by period
  const filterByPeriod = (dateStr) => {
    if (period === 'today') return isToday(dateStr);
    if (period === 'week') return isThisWeek(dateStr);
    if (period === 'month') return isThisMonth(dateStr);
    return true;
  };

  const filteredInvoices = invoices.filter(inv => filterByPeriod(inv.createdAt));

  // ===== Revenue Analysis =====
  const productRevenueData = [];
  const productSalesMap = {};
  filteredInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const key = item.productName || 'Lainnya';
      if (!productSalesMap[key]) productSalesMap[key] = { revenue: 0, qty: 0 };
      productSalesMap[key].revenue += item.subtotal || 0;
      productSalesMap[key].qty += item.qty || 0;
    });
  });
  Object.entries(productSalesMap).forEach(([name, data]) => {
    productRevenueData.push({
      name: name.length > 20 ? name.slice(0, 20) + '...' : name,
      Revenue: data.revenue,
      qty: data.qty,
    });
  });
  productRevenueData.sort((a, b) => b.Revenue - a.Revenue);

  // Customer Revenue
  const customerRevenueMap = {};
  filteredInvoices.forEach(inv => {
    const key = inv.customerName || 'Lainnya';
    if (!customerRevenueMap[key]) customerRevenueMap[key] = { revenue: 0, count: 0 };
    customerRevenueMap[key].revenue += inv.grandTotal || 0;
    customerRevenueMap[key].count++;
  });
  const customerRevenueData = Object.entries(customerRevenueMap).map(([name, data]) => ({
    name,
    Revenue: data.revenue,
    count: data.count,
  })).sort((a, b) => b.Revenue - a.Revenue);

  // ===== Statistics =====
  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

  // ===== Daily Recap =====
  const dailyData = {};
  invoices.forEach(inv => {
    const date = (inv.createdAt || '').slice(0, 10);
    if (!date) return;
    if (!dailyData[date]) dailyData[date] = { revenue: 0, count: 0 };
    dailyData[date].revenue += inv.grandTotal || 0;
    dailyData[date].count++;
  });
  const dailyChartData = Object.entries(dailyData)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, data]) => ({
      name: formatDateShort(date),
      Revenue: data.revenue,
      count: data.count,
    }));

  const periodLabels = { today: 'Hari Ini', week: 'Minggu Ini', month: 'Bulan Ini', all: 'Semua' };

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Laporan</h1>
          <p>Analisa pendapatan dan rekap harian</p>
        </div>
        <div className="flex gap-sm">
          <select name="period_select" className="form-select" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="today">Hari Ini</option>
            <option value="week">Minggu Ini</option>
            <option value="month">Bulan Ini</option>
            <option value="all">Semua</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs mb-lg">
        <button className={`tab ${activeTab === 'profit' ? 'active' : ''}`} onClick={() => setActiveTab('profit')}>
          <FiTrendingUp style={{ marginRight: 6 }} /> Analisis Pendapatan
        </button>
        <button className={`tab ${activeTab === 'recap' ? 'active' : ''}`} onClick={() => setActiveTab('recap')}>
          <FiCalendar style={{ marginRight: 6 }} /> Rekap Harian
        </button>
      </div>

      {/* ===== Revenue Analysis Tab ===== */}
      {activeTab === 'profit' && (
        <div className="animate-in">
          <div className="stats-grid">
            <div className="stat-card purple">
              <div className="stat-card-value">{formatCurrency(totalRevenue)}</div>
              <div className="stat-card-label">Total Revenue ({periodLabels[period]})</div>
            </div>
            <div className="stat-card cyan">
              <div className="stat-card-value">{filteredInvoices.length}</div>
              <div className="stat-card-label">Jumlah Invoice</div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Pendapatan per Produk</h3>
              </div>
              {productRevenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productRevenueData.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}jt` : `${(v/1000).toFixed(0)}rb`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p className="text-muted">Belum ada data penjualan</p></div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Kontribusi Pelanggan</h3>
              </div>
              {customerRevenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={customerRevenueData} cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={3} dataKey="Revenue" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                      {customerRevenueData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p className="text-muted">Belum ada data</p></div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Tabel Penjualan per Produk</h3>
            </div>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th style={{ textAlign: 'right' }}>Harga Jual</th>
                    <th style={{ textAlign: 'right' }}>Total Terjual</th>
                    <th style={{ textAlign: 'right' }}>Total Revenue</th>
                    <th style={{ textAlign: 'right' }}>Stok Saat Ini</th>
                  </tr>
                </thead>
                <tbody>
                  {productRevenueData.map((p, i) => {
                    const originalProduct = products.find(prod => prod.name === p.name) || {};
                    return (
                      <tr key={i}>
                        <td><strong>{p.name}</strong></td>
                        <td className="text-right">{formatCurrency(originalProduct.sellPrice || 0)}</td>
                        <td className="text-right">{formatNumber(p.qty)}</td>
                        <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(p.Revenue)}</td>
                        <td className="text-right">{formatNumber(originalProduct.stock || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* ===== Daily Recap Tab ===== */}
      {activeTab === 'recap' && (
        <div className="animate-in">
          <div className="stats-grid">
            <div className="stat-card purple">
              <div className="stat-card-value">{filteredInvoices.length}</div>
              <div className="stat-card-label">Invoice ({periodLabels[period]})</div>
            </div>
            <div className="stat-card cyan">
              <div className="stat-card-value">{formatCurrency(totalRevenue)}</div>
              <div className="stat-card-label">Revenue</div>
            </div>
          </div>

          <div className="card mb-lg">
            <div className="card-header">
              <h3 className="card-title">Trend Pendapatan (14 Hari Terakhir)</h3>
            </div>
            {dailyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}jt` : `${(v/1000).toFixed(0)}rb`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><p className="text-muted">Belum ada data</p></div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Rincian per Hari</h3>
            </div>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th style={{ textAlign: 'right' }}>Invoice</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dailyData)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 30)
                    .map(([date, data], i) => (
                      <tr key={i}>
                        <td><strong>{formatDateShort(date)}</strong></td>
                        <td className="text-right">{data.count}</td>
                        <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(data.revenue)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
