import { useState, useEffect } from 'react';
import { FiBarChart2, FiCalendar, FiDownload, FiShoppingCart, FiFileText } from 'react-icons/fi';
import { Invoices as InvoiceStore, PurchaseNotes as PNStore } from '../utils/storage';
import { formatCurrency, formatNumber, formatDateShort, isToday, isThisMonth } from '../utils/formatter';

export default function Recap() {
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter] = useState('month'); // 'today', 'month', 'all'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [invs, notes] = await Promise.all([
        InvoiceStore.getAll(),
        PNStore.getAll()
      ]);
      setInvoices(invs);
      setPurchaseNotes(notes);
    } catch (err) {
      console.error('Recap reload error:', err);
      setError(err.message || 'Gagal memuat data rekap.');
    } finally {
      setLoading(false);
    }
  }

  const filterData = (data) => {
    return data.filter(item => {
      const date = item.date || item.createdAt;
      if (filter === 'today') return isToday(date);
      if (filter === 'month') return isThisMonth(date);
      return true;
    });
  };

  const [purchaseNotes, setPurchaseNotes] = useState([]);
  
  const filteredInvoices = filterData(invoices);
  const filteredPurchases = filterData(purchaseNotes);

  // Aggregasi Penjualan (Invoices)
  const salesSummary = {};
  filteredInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const key = item.productName || 'Tanpa Nama';
      if (!salesSummary[key]) {
        salesSummary[key] = { qty: 0, total: 0, unit: item.unit || '' };
      }
      salesSummary[key].qty += Number(item.qty) || 0;
      salesSummary[key].total += Number(item.subtotal) || 0;
    });
  });

  // Aggregasi Pembelian (Purchase Notes) - dengan perhitungan margin detail
  const purchaseSummary = {};
  let totalAdditionalCosts = 0;
  let totalSupplierDiscounts = 0;
  
  filteredPurchases.forEach(pn => {
    (pn.items || []).forEach(item => {
      const key = item.materialName || 'Tanpa Nama';
      if (!purchaseSummary[key]) {
        purchaseSummary[key] = { qty: 0, total: 0, unit: item.unit || '' };
      }
      purchaseSummary[key].qty += Number(item.qtyNota) || 0;
      purchaseSummary[key].total += Number(item.totalCost) || 0;
    });
    // Add supplier discounts and additional costs
    if (pn.supplierDiscounts) {
      Object.values(pn.supplierDiscounts).forEach(discount => {
        totalSupplierDiscounts += Number(discount) || 0;
      });
    }
    if (pn.additionalCosts) {
      Object.values(pn.additionalCosts).forEach(cost => {
        totalAdditionalCosts += Number(cost) || 0;
      });
    }
  });

  const totalPurchaseBaseCost = Object.values(purchaseSummary).reduce((sum, item) => sum + item.total, 0);
  const totalPurchaseCost = totalPurchaseBaseCost - totalSupplierDiscounts + totalAdditionalCosts;
  const totalSalesRevenue = Object.values(salesSummary).reduce((sum, item) => sum + item.total, 0);
  const balance = totalSalesRevenue - totalPurchaseCost;
  const marginPercentage = totalSalesRevenue > 0 ? ((balance / totalSalesRevenue) * 100).toFixed(1) : 0;

  // Calculate margin per invoice with item breakdown
  const invoiceMarginAnalysis = filteredInvoices.map(inv => {
    let totalCost = 0;
    const itemBreakdown = (inv.items || []).map(invItem => {
      // Try to find matching purchase note item
      let itemCost = 0;
      let purchasePricePerUnit = 0;

      filteredPurchases.forEach(pn => {
        (pn.items || []).forEach(pnItem => {
          // Match by product name or material name
          if ((invItem.productName || '').toLowerCase() === (pnItem.materialName || '').toLowerCase()) {
            purchasePricePerUnit = Number(pnItem.pricePerUnit) || 0;
            const qty = Number(invItem.qty) || 0;
            itemCost = purchasePricePerUnit * qty;
          }
        });
      });

      const itemRevenue = Number(invItem.subtotal) || (Number(invItem.qty) || 0) * (Number(invItem.unitPrice) || 0);
      const itemProfit = itemRevenue - itemCost;
      const itemMarginPercent = itemRevenue > 0 ? ((itemProfit / itemRevenue) * 100) : 0;

      totalCost += itemCost;

      return {
        productName: invItem.productName || 'Tanpa Nama',
        qty: Number(invItem.qty) || 0,
        unit: invItem.unit || '',
        unitPrice: Number(invItem.unitPrice) || 0,
        revenue: itemRevenue,
        cost: itemCost,
        purchasePricePerUnit,
        profit: itemProfit,
        marginPercent: itemMarginPercent
      };
    });

    const revenue = Number(inv.grandTotal) || 0;
    const profit = revenue - totalCost;
    const marginPercent = revenue > 0 ? ((profit / revenue) * 100) : 0;

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName,
      date: inv.date || inv.createdAt,
      revenue,
      cost: totalCost,
      profit,
      marginPercent,
      itemCount: (inv.items || []).length,
      itemBreakdown
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  // State for expanded rows
  const [expandedInvoices, setExpandedInvoices] = useState(new Set());

  if (loading) {
    return (
      <div className="card p-lg text-center animate-in">
        <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
        <p className="text-muted">Menganalisa data rekap...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-lg text-center animate-in" style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
        <div className="empty-state-icon" style={{ color: '#ef4444' }}><FiBarChart2 /></div>
        <h3 className="text-danger">{error.includes('Permission Denied') ? 'Akses Rekap Terbatas (RLS)' : 'Gagal Memuat Rekap'}</h3>
        <p className="mb-md text-muted">
          {error.includes('Permission Denied') 
            ? 'Data transaksi ditemukan tapi diblokir oleh kebijakan keamanan (RLS) Supabase Anda. Anda perlu mengaktifkan akses baca bagi role anon di dashboard Supabase.'
            : 'Terjadi kesalahan saat memuat data rekap dari database.'}
        </p>
        <div className="flex-center gap-md">
          <button className="btn btn-primary" onClick={reload}>Coba Lagi (Refresh)</button>
          {error.includes('Permission Denied') && (
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Buka Supabase Dashboard
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Rekap Penjualan</h1>
          <p>Ringkasan pergerakan barang terjual</p>
        </div>
        <div className="flex gap-sm">
          <div className="btn-group">
            <button 
              className={`btn btn-sm ${filter === 'today' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('today')}
            >
              Hari Ini
            </button>
            <button 
              className={`btn btn-sm ${filter === 'month' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('month')}
            >
              Bulan Ini
            </button>
            <button 
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
            >
              Semua
            </button>
          </div>
        </div>
      </div>

      <div className="stats-grid mb-lg">
        <div className="stat-card blue">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiFileText /></div>
            <div className="stat-card-label">Total Penjualan</div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalSalesRevenue)}</div>
          <div className="stat-card-footer text-sm">
            {filteredInvoices.length} Invoice ditemukan
          </div>
        </div>

        <div className="stat-card orange">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiShoppingCart /></div>
            <div className="stat-card-label">Total Pembelian</div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalPurchaseCost)}</div>
          <div className="stat-card-footer text-sm">
            {filteredPurchases.length} Nota ditemukan
          </div>
        </div>

        <div className={balance >= 0 ? 'stat-card green' : 'stat-card red'}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiBarChart2 /></div>
            <div className="stat-card-label">Net Balance / Margin</div>
          </div>
          <div className="stat-card-value">{formatCurrency(balance)}</div>
          <div className="stat-card-footer text-sm">
            {balance >= 0 ? 'Profit' : 'Loss'} <span style={{ fontWeight: 700, color: balance >= 0 ? '#10b981' : '#ef4444' }}>({marginPercentage}%)</span>
          </div>
        </div>
      </div>

      {/* Margin Breakdown Card */}
      <div className="card shadow-sm" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 className="flex-center gap-sm"><FiBarChart2 className="text-primary" /> Detail Perhitungan Margin</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total Penjualan (Revenue)</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#3b82f6' }}>{formatCurrency(totalSalesRevenue)}</div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(249, 115, 22, 0.1)', borderRadius: '8px', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Biaya Pembelian Dasar</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#f97316' }}>{formatCurrency(totalPurchaseBaseCost)}</div>
            </div>
            {totalSupplierDiscounts > 0 && (
              <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Diskon Supplier (-)</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#22c55e' }}>-{formatCurrency(totalSupplierDiscounts)}</div>
              </div>
            )}
            {totalAdditionalCosts > 0 && (
              <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Biaya Tambahan (+)</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#8b5cf6' }}>+{formatCurrency(totalAdditionalCosts)}</div>
              </div>
            )}
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total Biaya Pembelian</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(totalPurchaseCost)}</div>
            </div>
            <div style={{ padding: '12px', background: balance >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: `1px solid ${balance >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Margin Bersih (Laba/Rugi)</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: balance >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(balance)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2 gap-lg">
        {/* Tabel Penjualan */}
        <div className="card shadow-sm">
          <div className="card-header flex-between">
            <h3 className="flex-center gap-sm"><FiFileText className="text-primary" /> Penjualan per Barang</h3>
          </div>
          <div className="table-container p-0">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Nama Barang</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Total Nilai</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(salesSummary).length === 0 ? (
                  <tr><td colSpan="3" className="text-center text-muted p-md">Tidak ada data penjualan</td></tr>
                ) : (
                  Object.entries(salesSummary)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([name, data]) => (
                      <tr key={name}>
                        <td><strong>{name}</strong></td>
                        <td className="text-right">{formatNumber(data.qty)} {data.unit}</td>
                        <td className="text-right font-medium">{formatCurrency(data.total)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel Pembelian */}
        <div className="card shadow-sm">
          <div className="card-header flex-between">
            <h3 className="flex-center gap-sm"><FiShoppingCart className="text-primary" /> Pembelian Bahan Baku</h3>
          </div>
          <div className="table-container p-0">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Nama Bahan</th>
                  <th className="text-right">Qty Beli</th>
                  <th className="text-right">Total Biaya</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(purchaseSummary).length === 0 ? (
                  <tr><td colSpan="3" className="text-center text-muted p-md">Tidak ada data pembelian</td></tr>
                ) : (
                  Object.entries(purchaseSummary)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([name, data]) => (
                      <tr key={name}>
                        <td><strong>{name}</strong></td>
                        <td className="text-right">{formatNumber(data.qty)} {data.unit}</td>
                        <td className="text-right font-medium">{formatCurrency(data.total)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Margin Laba Per Invoice */}
      <div className="card shadow-sm" style={{ marginTop: '24px' }}>
        <div className="card-header flex-between">
          <h3 className="flex-center gap-sm">
            <FiBarChart2 className="text-success" />
            Margin Laba per Invoice
          </h3>
          <div className="flex gap-sm">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                if (expandedInvoices.size === invoiceMarginAnalysis.length) {
                  setExpandedInvoices(new Set());
                } else {
                  setExpandedInvoices(new Set(invoiceMarginAnalysis.map(inv => inv.id)));
                }
              }}
            >
              {expandedInvoices.size === invoiceMarginAnalysis.length ? 'Collapse All' : 'Expand All'}
            </button>
            <div className="text-sm text-muted flex-center gap-sm">
              <span>Total {invoiceMarginAnalysis.length} invoice</span>
              <span style={{ color: '#94a3b8' }}>|</span>
              <span>{expandedInvoices.size} expanded</span>
            </div>
          </div>
        </div>
        <div className="table-container p-0">
          <table className="table table-hover">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>No. Invoice</th>
                <th>Customer</th>
                <th>Tanggal</th>
                <th className="text-right">Penjualan (Revenue)</th>
                <th className="text-right">Pembelian (Cost)</th>
                <th className="text-right">Laba (Profit)</th>
                <th className="text-right">Margin %</th>
                <th className="text-center">Item</th>
              </tr>
            </thead>
            <tbody>
              {invoiceMarginAnalysis.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center text-muted p-md">
                    Tidak ada data invoice
                  </td>
                </tr>
              ) : (
                invoiceMarginAnalysis.map((inv, idx) => {
                  const isExpanded = expandedInvoices.has(inv.id);
                  return (
                    <>
                      <tr
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          const newExpanded = new Set(expandedInvoices);
                          if (isExpanded) {
                            newExpanded.delete(inv.id);
                          } else {
                            newExpanded.add(inv.id);
                          }
                          setExpandedInvoices(newExpanded);
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            fontSize: '12px',
                            color: '#64748b'
                          }}>▶</span>
                        </td>
                        <td><strong>{inv.invoiceNumber}</strong></td>
                        <td>{inv.customerName}</td>
                        <td className="text-muted">{formatDateShort(inv.date)}</td>
                        <td className="text-right" style={{ color: '#3b82f6', fontWeight: 600 }}>
                          {formatCurrency(inv.revenue)}
                        </td>
                        <td className="text-right" style={{ color: '#f97316', fontWeight: 600 }}>
                          {formatCurrency(inv.cost)}
                        </td>
                        <td className="text-right" style={{
                          color: inv.profit >= 0 ? '#10b981' : '#ef4444',
                          fontWeight: 700
                        }}>
                          {formatCurrency(inv.profit)}
                        </td>
                        <td className="text-right">
                          <span className={`badge ${inv.marginPercent >= 20 ? 'badge-success' : inv.marginPercent >= 10 ? 'badge-warning' : 'badge-danger'}`}>
                            {inv.marginPercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-center text-muted">{inv.itemCount}</td>
                      </tr>

                      {/* Expanded Item Details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="9" style={{ padding: 0, backgroundColor: '#f1f5f9' }}>
                            <div style={{ padding: '16px' }}>
                              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                                Detail Breakdown per Item
                              </h4>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#1e293b' }}>
                                    <th style={{ padding: '10px 8px', textAlign: 'left', border: '1px solid #334155', color: 'white', fontWeight: 600 }}>Nama Barang</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'center', border: '1px solid #334155', color: 'white', fontWeight: 600, width: '80px' }}>Qty</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'right', border: '1px solid #334155', color: 'white', fontWeight: 600, width: '120px' }}>Harga Jual</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'right', border: '1px solid #334155', color: 'white', fontWeight: 600, width: '120px' }}>Harga Beli</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'right', border: '1px solid #334155', color: 'white', fontWeight: 600, width: '120px' }}>Revenue</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'right', border: '1px solid #334155', color: 'white', fontWeight: 600, width: '120px' }}>Cost</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'right', border: '1px solid #334155', color: 'white', fontWeight: 600, width: '120px' }}>Laba</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'center', border: '1px solid #334155', color: 'white', fontWeight: 600, width: '100px' }}>Margin %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {inv.itemBreakdown.map((item, itemIdx) => (
                                    <tr key={itemIdx} style={{ backgroundColor: itemIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                      <td style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 600, color: '#1e293b' }}>
                                        {item.productName}
                                      </td>
                                      <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 500 }}>
                                        {formatNumber(item.qty)} {item.unit}
                                      </td>
                                      <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #cbd5e1', color: '#2563eb', fontWeight: 600 }}>
                                        {formatCurrency(item.unitPrice)}
                                      </td>
                                      <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #cbd5e1', color: '#ea580c', fontWeight: 600 }}>
                                        {formatCurrency(item.purchasePricePerUnit)}
                                      </td>
                                      <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #cbd5e1', fontWeight: 700, color: '#1e293b' }}>
                                        {formatCurrency(item.revenue)}
                                      </td>
                                      <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #cbd5e1', fontWeight: 700, color: '#1e293b' }}>
                                        {formatCurrency(item.cost)}
                                      </td>
                                      <td style={{
                                        padding: '8px',
                                        textAlign: 'right',
                                        border: '1px solid #cbd5e1',
                                        fontWeight: 800,
                                        color: item.profit >= 0 ? '#16a34a' : '#dc2626',
                                        fontSize: '13px'
                                      }}>
                                        {formatCurrency(item.profit)}
                                      </td>
                                      <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                        <span style={{
                                          backgroundColor: item.marginPercent >= 20 ? '#16a34a' : item.marginPercent >= 10 ? '#ca8a04' : '#dc2626',
                                          color: 'white',
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: 700
                                        }}>
                                          {item.marginPercent.toFixed(1)}%
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 992px) {
          .grid-2 {
            grid-template-columns: 1fr;
          }
        }
        .btn-group {
          display: flex;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px;
          border-radius: 8px;
        }
        .btn-group .btn {
          border-radius: 6px;
          border: none;
        }
        .font-medium {
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
