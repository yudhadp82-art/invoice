import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FiTrendingUp, FiDollarSign, FiBarChart2, FiCalendar } from 'react-icons/fi';
import { Invoices, Products, Purchases } from '../utils/storage';
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
  const [purchases, setPurchases] = useState([]);

  useEffect(() => {
    async function loadData() {
      setInvoices(await Invoices.getAll());
      setProducts(await Products.getAll());
      setPurchases(await Purchases.getAll());
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
  const filteredPurchases = purchases.filter(p => filterByPeriod(p.createdAt));

  // ===== Profit Margin Analysis =====
  const productProfitData = [];
  const productSalesMap = {};
  filteredInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const key = item.productName || 'Lainnya';
      if (!productSalesMap[key]) productSalesMap[key] = { revenue: 0, cost: 0, qty: 0 };
      productSalesMap[key].revenue += item.subtotal || 0;
      productSalesMap[key].cost += (item.purchaseCost || 0) * (item.qty || 0);
      productSalesMap[key].qty += item.qty || 0;
    });
  });
  Object.entries(productSalesMap).forEach(([name, data]) => {
    productProfitData.push({
      name: name.length > 20 ? name.slice(0, 20) + '...' : name,
      Revenue: data.revenue,
      Modal: data.cost,
      Profit: data.revenue - data.cost,
      margin: data.revenue > 0 ? (((data.revenue - data.cost) / data.revenue) * 100).toFixed(1) : 0,
      qty: data.qty,
    });
  });
  productProfitData.sort((a, b) => b.Profit - a.Profit);

  // Customer profit
  const customerProfitMap = {};
  filteredInvoices.forEach(inv => {
    const key = inv.customerName || 'Lainnya';
    if (!customerProfitMap[key]) customerProfitMap[key] = { revenue: 0, cost: 0, count: 0 };
    customerProfitMap[key].revenue += inv.grandTotal || 0;
    customerProfitMap[key].cost += (inv.items || []).reduce((s, item) => s + ((item.purchaseCost || 0) * (item.qty || 0)), 0);
    customerProfitMap[key].count++;
  });
  const customerProfitData = Object.entries(customerProfitMap).map(([name, data]) => ({
    name,
    Revenue: data.revenue,
    Profit: data.revenue - data.cost,
    count: data.count,
    margin: data.revenue > 0 ? (((data.revenue - data.cost) / data.revenue) * 100).toFixed(1) : 0,
  })).sort((a, b) => b.Revenue - a.Revenue);

  // ===== Purchase Cost Report =====
  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalCOGS = filteredInvoices.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + ((it.purchaseCost || 0) * (it.qty || 0)), 0), 0);
  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (p.totalCost || 0), 0);
  const grossProfit = totalRevenue - totalCOGS;
  const netMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

  // Product margin table
  const productMarginTable = products.map(p => ({
    name: p.name,
    category: p.category,
    cost: p.purchaseCost,
    sellPrice: p.sellPrice,
    margin: calculateMargin(p.purchaseCost, p.sellPrice),
    profitPerUnit: p.sellPrice - p.purchaseCost,
    stock: p.stock,
  })).sort((a, b) => b.margin - a.margin);

  // ===== Daily Recap =====
  const dailyData = {};
  invoices.forEach(inv => {
    const date = (inv.createdAt || '').slice(0, 10);
    if (!date) return;
    if (!dailyData[date]) dailyData[date] = { revenue: 0, cost: 0, count: 0 };
    dailyData[date].revenue += inv.grandTotal || 0;
    dailyData[date].cost += (inv.items || []).reduce((s, it) => s + ((it.purchaseCost || 0) * (it.qty || 0)), 0);
    dailyData[date].count++;
  });
  const dailyChartData = Object.entries(dailyData)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, data]) => ({
      name: formatDateShort(date),
      Revenue: data.revenue,
      Profit: data.revenue - data.cost,
      count: data.count,
    }));

  const periodLabels = { today: 'Hari Ini', week: 'Minggu Ini', month: 'Bulan Ini', all: 'Semua' };

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Laporan</h1>
          <p>Analisa profit margin, modal pembelian, dan rekap</p>
        </div>
        <div className="flex gap-sm">
          <select name="select_1_2" className="form-select" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="today">Hari Ini</option>
            <option value="week">Minggu Ini</option>
            <option value="month">Bulan Ini</option>
            <option value="all">Semua</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'profit' ? 'active' : ''}`} onClick={() => setActiveTab('profit')}>
          <FiTrendingUp style={{ marginRight: 6 }} /> Profit Margin
        </button>
        <button className={`tab ${activeTab === 'cost' ? 'active' : ''}`} onClick={() => setActiveTab('cost')}>
          <FiDollarSign style={{ marginRight: 6 }} /> Modal Pembelian
        </button>
        <button className={`tab ${activeTab === 'recap' ? 'active' : ''}`} onClick={() => setActiveTab('recap')}>
          <FiCalendar style={{ marginRight: 6 }} /> Rekap Harian
        </button>
      </div>

      {/* ===== Profit Margin Tab ===== */}
      {activeTab === 'profit' && (
        <div>
          {/* Summary Stats */}
          <div className="stats-grid">
            <div className="stat-card purple">
              <div className="stat-card-value">{formatCurrency(totalRevenue)}</div>
              <div className="stat-card-label">Total Revenue ({periodLabels[period]})</div>
            </div>
            <div className="stat-card green">
              <div className="stat-card-value">{formatCurrency(grossProfit)}</div>
              <div className="stat-card-label">Gross Profit</div>
            </div>
            <div className="stat-card cyan">
              <div className="stat-card-value">{netMargin}%</div>
              <div className="stat-card-label">Net Margin</div>
            </div>
          </div>

          {/* Profit by Product Chart */}
          <div className="charts-grid">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Profit per Produk</h3>
              </div>
              {productProfitData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productProfitData.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}jt` : `${(v/1000).toFixed(0)}rb`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Revenue" />
                    <Bar dataKey="Modal" fill="#ef4444" radius={[4, 4, 0, 0]} name="Modal" />
                    <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p className="text-muted">Belum ada data penjualan</p></div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Profit per Customer</h3>
              </div>
              {customerProfitData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={customerProfitData} cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={3} dataKey="Revenue" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                      {customerProfitData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p className="text-muted">Belum ada data</p></div>
              )}
            </div>
          </div>

          {/* Product Margin Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Tabel Margin per Produk</h3>
            </div>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Kategori</th>
                    <th style={{ textAlign: 'right' }}>Modal</th>
                    <th style={{ textAlign: 'right' }}>Harga Jual</th>
                    <th style={{ textAlign: 'right' }}>Profit/Unit</th>
                    <th style={{ textAlign: 'right' }}>Margin</th>
                    <th style={{ textAlign: 'right' }}>Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {productMarginTable.map((p, i) => (
                    <tr key={i}>
                      <td><strong>{p.name}</strong></td>
                      <td><span className="badge badge-purple">{p.category}</span></td>
                      <td className="text-right">{formatCurrency(p.cost)}</td>
                      <td className="text-right">{formatCurrency(p.sellPrice)}</td>
                      <td className="text-right text-success" style={{ fontWeight: 600 }}>{formatCurrency(p.profitPerUnit)}</td>
                      <td className="text-right">
                        <span style={{ color: p.margin >= 20 ? '#34d399' : p.margin >= 10 ? '#fbbf24' : '#f87171', fontWeight: 600 }}>
                          {p.margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right">{formatNumber(p.stock)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== Purchase Cost Tab ===== */}
      {activeTab === 'cost' && (
        <div>
          <div className="stats-grid">
            <div className="stat-card orange">
              <div className="stat-card-value">{formatCurrency(totalPurchases)}</div>
              <div className="stat-card-label">Total Pembelian ({periodLabels[period]})</div>
            </div>
          </div>

           {filteredPurchases.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              <div style={{ fontSize: '48px' }}>🛒</div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Belum Ada Data Pembelian</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: '400px' }}>
                Tidak ada data pembelian yang ditemukan untuk periode ini. Silakan pilih periode lain atau tambahkan data pembelian baru.
              </p>
            </div>
          ) : (
            <>
              {/* Purchase by Product */}
              <div className="card mb-lg">
                <div className="card-header">
                  <h3 className="card-title">Rincian Modal per Produk</h3>
                </div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Produk</th>
                        <th>Kategori</th>
                        <th style={{ textAlign: 'right' }}>Modal/Unit</th>
                        <th style={{ textAlign: 'right' }}>Harga Jual</th>
                        <th style={{ textAlign: 'right' }}>Stok</th>
                        <th style={{ textAlign: 'right' }}>Nilai Stok (Modal)</th>
                        <th style={{ textAlign: 'right' }}>Nilai Stok (Jual)</th>
                        <th style={{ textAlign: 'right' }}>Potensi Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p, i) => (
                        <tr key={i}>
                          <td><strong>{p.name}</strong></td>
                          <td><span className="badge badge-purple">{p.category}</span></td>
                          <td className="text-right">{formatCurrency(p.purchaseCost)}</td>
                          <td className="text-right">{formatCurrency(p.sellPrice)}</td>
                          <td className="text-right">{formatNumber(p.stock)}</td>
                          <td className="text-right text-warning" style={{ fontWeight: 600 }}>{formatCurrency(p.purchaseCost * p.stock)}</td>
                          <td className="text-right">{formatCurrency(p.sellPrice * p.stock)}</td>
                          <td className="text-right text-success" style={{ fontWeight: 600 }}>{formatCurrency((p.sellPrice - p.purchaseCost) * p.stock)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: 'rgba(99,102,241,0.05)' }}>
                        <td colSpan={5}><strong>TOTAL</strong></td>
                        <td className="text-right" style={{ fontWeight: 700 }}>{formatCurrency(products.reduce((s, p) => s + p.purchaseCost * p.stock, 0))}</td>
                        <td className="text-right" style={{ fontWeight: 700 }}>{formatCurrency(products.reduce((s, p) => s + p.sellPrice * p.stock, 0))}</td>
                        <td className="text-right text-success" style={{ fontWeight: 700 }}>{formatCurrency(products.reduce((s, p) => s + (p.sellPrice - p.purchaseCost) * p.stock, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Purchases */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Histori Pembelian Terakhir</h3>
                </div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Supplier</th>
                        <th>Items</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPurchases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10).map((p, i) => (
                        <tr key={i}>
                          <td>{formatDateShort(p.createdAt)}</td>
                          <td><strong>{p.supplier || '-'}</strong></td>
                          <td className="text-sm">{(p.items || []).map(it => `${it.productName} ×${formatNumber(it.qty)}`).join(', ')}</td>
                          <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(p.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== Daily Recap Tab ===== */}
      {activeTab === 'recap' && (
        <div>
          <div className="stats-grid">
            <div className="stat-card purple">
              <div className="stat-card-value">{filteredInvoices.length}</div>
              <div className="stat-card-label">Invoice ({periodLabels[period]})</div>
            </div>
            <div className="stat-card cyan">
              <div className="stat-card-value">{formatCurrency(totalRevenue)}</div>
              <div className="stat-card-label">Revenue</div>
            </div>
            <div className="stat-card orange">
              <div className="stat-card-value">{formatCurrency(totalCOGS)}</div>
              <div className="stat-card-label">COGS</div>
            </div>
            <div className="stat-card green">
              <div className="stat-card-value">{formatCurrency(grossProfit)}</div>
              <div className="stat-card-label">Gross Profit ({netMargin}%)</div>
            </div>
          </div>

          {/* Daily Chart */}
          <div className="card mb-lg">
            <div className="card-header">
              <h3 className="card-title">Trend Harian (14 Hari Terakhir)</h3>
            </div>
            {dailyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}jt` : `${(v/1000).toFixed(0)}rb`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Revenue" />
                  <Line type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><p className="text-muted">Belum ada data</p></div>
            )}
          </div>

          {/* Daily Breakdown Table */}
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
                    <th style={{ textAlign: 'right' }}>Profit</th>
                    <th style={{ textAlign: 'right' }}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dailyData)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 30)
                    .map(([date, data], i) => {
                      const profit = data.revenue - data.cost;
                      const margin = data.revenue > 0 ? ((profit / data.revenue) * 100).toFixed(1) : 0;
                      return (
                        <tr key={i}>
                          <td><strong>{formatDateShort(date)}</strong></td>
                          <td className="text-right">{data.count}</td>
                          <td className="text-right">{formatCurrency(data.revenue)}</td>
                          <td className="text-right" style={{ color: profit >= 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>{formatCurrency(profit)}</td>
                          <td className="text-right" style={{ fontWeight: 600 }}>{margin}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
