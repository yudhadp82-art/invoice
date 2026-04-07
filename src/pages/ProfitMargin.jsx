import { useState, useEffect } from 'react';
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiFileText, FiSearch, FiFilter, FiCalendar, FiChevronDown, FiChevronUp, FiAward } from 'react-icons/fi';
import { Invoices, PurchaseNotes } from '../utils/storage';
import { formatCurrency, formatDateShort } from '../utils/formatter';

function MarginBadge({ pct }) {
  if (pct === null || pct === undefined || isNaN(pct)) {
    return <span className="badge badge-secondary" style={{ fontSize: 11 }}>Belum Ada Data HPP</span>;
  }
  if (pct >= 30) return <span className="badge badge-success" style={{ fontSize: 11 }}>{pct.toFixed(1)}%</span>;
  if (pct >= 15) return <span className="badge badge-warning" style={{ fontSize: 11 }}>{pct.toFixed(1)}%</span>;
  return <span className="badge badge-danger" style={{ fontSize: 11 }}>{pct.toFixed(1)}%</span>;
}

function MiniBar({ pct, color }) {
  const capped = Math.min(Math.max(pct || 0, 0), 100);
  return (
    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        width: `${capped}%`,
        height: '100%',
        background: color,
        borderRadius: 4,
        transition: 'width 0.6s ease'
      }} />
    </div>
  );
}

export default function ProfitMargin() {
  const [invoices, setInvoices] = useState([]);
  const [purchaseNotes, setPurchaseNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [sortBy, setSortBy] = useState('date_desc');

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [allInvs, allNotes] = await Promise.all([
        Invoices.getAll(),
        PurchaseNotes.getAll()
      ]);
      setInvoices(allInvs);
      setPurchaseNotes(allNotes);
    } catch (err) {
      setError(err.message || 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }

  // Build margin data per invoice
  const marginData = invoices.map(inv => {
    const revenue = Number(inv.grandTotal) || 0;

    // Match purchase notes to this invoice
    const linkedNotes = purchaseNotes.filter(n => {
      if (n.invoiceId === inv.id) return true;
      if (Array.isArray(n.sourceInvoiceIds) && n.sourceInvoiceIds.includes(inv.id)) return true;
      return false;
    });

    // Calculate HPP based on items and matching purchase prices
    let calculatedHppItems = 0;
    (inv.items || []).forEach(invItem => {
      const invItemName = (invItem.productName || '').toLowerCase().trim();
      
      // Try to find price in linked notes first
      let price = 0;
      let found = false;
      
      for (const note of linkedNotes) {
        const match = (note.items || []).find(ni => (ni.materialName || '').toLowerCase().trim() === invItemName);
        if (match) {
          price = Number(match.pricePerUnit) || 0;
          found = true;
          break;
        }
      }
      
      // Fallback to any purchase note if not found in linked ones
      if (!found) {
        const latestMatch = purchaseNotes
          .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
          .find(n => (n.items || []).some(ni => (ni.materialName || '').toLowerCase().trim() === invItemName));
        
        if (latestMatch) {
          const m = latestMatch.items.find(ni => (ni.materialName || '').toLowerCase().trim() === invItemName);
          price = Number(m.pricePerUnit) || 0;
        }
      }
      
      calculatedHppItems += (Number(invItem.qty) || 0) * price;
    });

    // Distribute additional costs and discounts from linked notes
    let totalAdjustments = 0;
    linkedNotes.forEach(note => {
      const noteItemTotal = (note.items || []).reduce((s, it) => s + (Number(it.totalCost) || 0), 0);
      const noteDiscounts = Object.values(note.supplierDiscounts || {}).reduce((s, d) => s + (Number(d) || 0), 0);
      const noteAddCosts = Object.values(note.additionalCosts || {}).reduce((s, c) => s + (Number(c) || 0), 0);
      const netAdjustment = noteAddCosts - noteDiscounts;
      
      // If the note covers multiple invoices, distribute adjustments based on this invoice's share of items in that note
      const sourceIds = note.sourceInvoiceIds || (note.invoiceId ? [note.invoiceId] : []);
      if (sourceIds.length > 1) {
        // Simple distribution: 1/N or based on item total? 
        // For now, let's use 1/N as a simple proxy if we can't easily calculate the share
        totalAdjustments += netAdjustment / sourceIds.length;
      } else {
        totalAdjustments += netAdjustment;
      }
    });

    const totalHpp = calculatedHppItems + totalAdjustments;
    const grossProfit = revenue - totalHpp;
    const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const hasHpp = linkedNotes.length > 0 || calculatedHppItems > 0;

    return {
      ...inv,
      revenue,
      totalHpp,
      grossProfit,
      marginPct: hasHpp ? marginPct : null,
      linkedNotes,
      hasHpp,
    };
  });

  // Filter
  const uniqueCustomers = Array.from(new Set(invoices.map(i => i.customerName).filter(Boolean))).sort();

  const filtered = marginData.filter(item => {
    if (customerFilter !== 'all' && item.customerName !== customerFilter) return false;
    const q = search.toLowerCase();
    if (q && !(item.invoiceNumber || '').toLowerCase().includes(q) && !(item.customerName || '').toLowerCase().includes(q)) return false;
    if (dateFrom) {
      const itemDate = (item.date || item.createdAt || '').slice(0, 10);
      if (itemDate < dateFrom) return false;
    }
    if (dateTo) {
      const itemDate = (item.date || item.createdAt || '').slice(0, 10);
      if (itemDate > dateTo) return false;
    }
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'date_desc': {
        const tb = (b.date || b.createdAt || 0);
        const ta = (a.date || a.createdAt || 0);
        return new Date(tb) - new Date(ta) > 0 ? -1 : 1;
      }
      case 'date_asc': {
        const ta2 = (a.date || a.createdAt || 0);
        const tb2 = (b.date || b.createdAt || 0);
        return new Date(ta2) - new Date(tb2) > 0 ? -1 : 1;
      }
      case 'margin_desc': return (b.marginPct || 0) - (a.marginPct || 0);
      case 'margin_asc': return (a.marginPct || 0) - (b.marginPct || 0);
      case 'revenue_desc': return b.revenue - a.revenue;
      case 'profit_desc': return b.grossProfit - a.grossProfit;
      default: return 0;
    }
  });

  // Summary stats
  const withHpp = sorted.filter(i => i.hasHpp);
  const totalRevenue = sorted.reduce((s, i) => s + i.revenue, 0);
  const totalHpp = sorted.reduce((s, i) => s + i.totalHpp, 0);
  const totalProfit = sorted.reduce((s, i) => s + i.grossProfit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const bestInvoice = withHpp.length > 0 ? withHpp.reduce((best, i) => (i.marginPct > (best?.marginPct || -Infinity) ? i : best), null) : null;

  const getMarginColor = (pct) => {
    if (pct === null || pct === undefined || isNaN(pct)) return 'rgba(100,116,139,0.6)';
    if (pct >= 30) return 'linear-gradient(90deg, #22c55e, #16a34a)';
    if (pct >= 15) return 'linear-gradient(90deg, #f59e0b, #d97706)';
    return 'linear-gradient(90deg, #ef4444, #dc2626)';
  };

  const getMarginBarColor = (pct) => {
    if (pct === null || pct === undefined || isNaN(pct)) return 'rgba(100,116,139,0.4)';
    if (pct >= 30) return '#22c55e';
    if (pct >= 15) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="animate-in">
        <div className="page-header"><div><h1>Margin Laba per Invoice</h1><p>Memuat data...</p></div></div>
        <div className="card p-lg text-center">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-muted">Menganalisa data invoice dan pembelian...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-in">
        <div className="page-header"><div><h1>Margin Laba per Invoice</h1></div></div>
        <div className="card p-lg text-center" style={{ borderColor: '#ef4444' }}>
          <p className="text-danger">{error}</p>
          <button className="btn btn-primary mt-md" onClick={reload}>Coba Lagi</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <style>{`
        .margin-card {
          border-radius: 16px;
          padding: 20px 24px;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          position: relative;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .summary-stat {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 18px 22px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: transform 0.2s;
        }
        .summary-stat:hover { transform: translateY(-2px); }
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }
        .invoice-row {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          margin-bottom: 10px;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .invoice-row:hover {
          border-color: rgba(99,102,241,0.35);
          box-shadow: 0 4px 20px rgba(99,102,241,0.08);
        }
        .invoice-row-header {
          padding: 14px 18px;
          display: grid;
          grid-template-columns: 2fr 2fr 1.5fr 1.5fr 1.5fr 1fr 36px;
          gap: 12px;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }
        .invoice-row-detail {
          border-top: 1px solid var(--border-color);
          padding: 16px 18px;
          background: rgba(99,102,241,0.03);
          animation: fadeSlideIn 0.2s ease;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .detail-note-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 12px 16px;
          margin-bottom: 8px;
        }
        .filter-bar {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 16px;
        }
        .col-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
          margin-bottom: 3px;
        }
        @media (max-width: 768px) {
          .invoice-row-header {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .col-hide-mobile { display: none; }
        }
      `}</style>

      {/* Page Header */}
      <div className="page-header page-header-actions">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiTrendingUp style={{ color: 'var(--accent-primary)' }} />
            Margin Laba per Invoice
          </h1>
          <p>Analisa profitabilitas penjualan berdasarkan invoicedan biaya pembelian bahan</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="summary-stat">
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)' }}>
            <FiFileText />
          </div>
          <div>
            <div className="col-label">Total Invoice</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{sorted.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{withHpp.length} ada data HPP</div>
          </div>
        </div>

        <div className="summary-stat">
          <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
            <FiDollarSign />
          </div>
          <div>
            <div className="col-label">Total Pendapatan</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{formatCurrency(totalRevenue)}</div>
          </div>
        </div>

        <div className="summary-stat">
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <FiShoppingBasket />
          </div>
          <div>
            <div className="col-label">Total HPP (Biaya Bahan)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{formatCurrency(totalHpp)}</div>
          </div>
        </div>

        <div className="summary-stat">
          <div className="stat-icon" style={{ background: 'rgba(251,191,36,0.15)', color: '#f59e0b' }}>
            <FiTrendingUp />
          </div>
          <div>
            <div className="col-label">Laba Kotor</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: totalProfit >= 0 ? '#22c55e' : '#ef4444' }}>
              {formatCurrency(totalProfit)}
            </div>
          </div>
        </div>

        <div className="summary-stat" style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.1) 100%)',
          borderColor: 'rgba(99,102,241,0.25)'
        }}>
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--accent-primary)' }}>
            <FiAward />
          </div>
          <div>
            <div className="col-label">Rata-rata Margin</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: avgMargin >= 20 ? '#22c55e' : avgMargin >= 10 ? '#f59e0b' : '#ef4444' }}>
              {avgMargin.toFixed(1)}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              dari {withHpp.length} invoice ber-HPP
            </div>
          </div>
        </div>

        {bestInvoice && (
          <div className="summary-stat" style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.08) 100%)',
            borderColor: 'rgba(34,197,94,0.2)'
          }}>
            <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
              <FiAward />
            </div>
            <div>
              <div className="col-label">Margin Tertinggi</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{bestInvoice.marginPct?.toFixed(1)}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bestInvoice.invoiceNumber}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Cari invoice atau customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="form-select" style={{ width: 'auto' }} value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}>
          <option value="all">Semua Customer</option>
          {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FiCalendar style={{ color: 'var(--text-muted)', fontSize: 14 }} />
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto', fontSize: 13, padding: '6px 10px' }}
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            placeholder="Dari"
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>s/d</span>
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto', fontSize: 13, padding: '6px 10px' }}
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            placeholder="Sampai"
          />
        </div>

        <select className="form-select" style={{ width: 'auto' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date_desc">Terbaru</option>
          <option value="date_asc">Terlama</option>
          <option value="margin_desc">Margin Terbesar</option>
          <option value="margin_asc">Margin Terkecil</option>
          <option value="revenue_desc">Pendapatan Terbesar</option>
          <option value="profit_desc">Laba Terbesar</option>
        </select>
      </div>

      {/* Table Header */}
      {sorted.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 2fr 1.5fr 1.5fr 1.5fr 1fr 36px',
          gap: 12,
          padding: '8px 18px',
          fontSize: 11,
          color: 'var(--text-muted)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4
        }}>
          <div>Invoice</div>
          <div className="col-hide-mobile">Customer</div>
          <div>Pendapatan</div>
          <div className="col-hide-mobile">HPP</div>
          <div>Laba Kotor</div>
          <div>Margin</div>
          <div></div>
        </div>
      )}

      {/* Invoice Rows */}
      {sorted.length === 0 ? (
        <div className="card p-lg text-center">
          <div className="empty-state-icon"><FiFileText /></div>
          <h3>Tidak ada data ditemukan</h3>
          <p className="text-muted">Coba ubah filter atau buat invoice terlebih dahulu.</p>
        </div>
      ) : (
        <div>
          {sorted.map(item => {
            const isExpanded = expandedId === item.id;
            const barColor = getMarginBarColor(item.marginPct);

            return (
              <div key={item.id} className="invoice-row">
                {/* Row Header */}
                <div
                  className="invoice-row-header"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  {/* Invoice No + Date */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{item.invoiceNumber}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatDateShort(item.date || item.createdAt)}
                    </div>
                  </div>

                  {/* Customer */}
                  <div className="col-hide-mobile" style={{ fontSize: 13, fontWeight: 500 }}>
                    {item.customerName || '-'}
                    <div>
                      <span className={`badge ${item.paymentStatus === 'paid' ? 'badge-success' : item.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 10, marginTop: 3 }}>
                        {item.paymentStatus === 'paid' ? 'Lunas' : item.paymentStatus === 'partial' ? 'Sebagian' : 'Belum Bayar'}
                      </span>
                    </div>
                  </div>

                  {/* Revenue */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#22c55e' }}>
                      {formatCurrency(item.revenue)}
                    </div>
                  </div>

                  {/* HPP */}
                  <div className="col-hide-mobile">
                    {item.hasHpp ? (
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#ef4444' }}>
                        {formatCurrency(item.totalHpp)}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada</span>
                    )}
                  </div>

                  {/* Gross Profit */}
                  <div>
                    {item.hasHpp ? (
                      <div style={{ fontWeight: 700, fontSize: 14, color: item.grossProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                        {formatCurrency(item.grossProfit)}
                        <div style={{ marginTop: 4 }}>
                          <MiniBar pct={item.marginPct} color={barColor} />
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>-</span>
                    )}
                  </div>

                  {/* Margin % */}
                  <div>
                    <MarginBadge pct={item.marginPct} />
                  </div>

                  {/* Expand toggle */}
                  <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="invoice-row-detail">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                      {/* Revenue breakdown */}
                      <div className="detail-note-card">
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
                          📄 Rincian Invoice
                        </div>
                        {(item.items || []).length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(item.items || []).map((it, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 5 }}>
                                <span style={{ opacity: 0.85 }}>{it.productName} ({it.qty} {it.unit})</span>
                                <span style={{ fontWeight: 600, color: '#22c55e' }}>{formatCurrency(it.qty * it.unitPrice)}</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, paddingTop: 4 }}>
                              <span>Total Pendapatan</span>
                              <span style={{ color: '#22c55e' }}>{formatCurrency(item.revenue)}</span>
                            </div>
                          </div>
                        ) : (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tidak ada item detail.</p>
                        )}
                      </div>

                      {/* HPP / Purchase Notes */}
                      <div className="detail-note-card">
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
                          🛒 Nota Pembelian (HPP)
                        </div>
                        {item.linkedNotes.length > 0 ? (
                          <div>
                            {item.linkedNotes.map((note, idx) => (
                              <div key={idx} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: idx < item.linkedNotes.length - 1 ? '1px dashed rgba(255,255,255,0.07)' : 'none' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                                  <span>{note.supplierName || 'Supplier Umum'}</span>
                                  <span style={{ color: '#ef4444' }}>{formatCurrency(note.grandTotal)}</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {formatDateShort(note.date)} · {(note.items || []).length} item bahan
                                </div>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                              <span>Total HPP</span>
                              <span style={{ color: '#ef4444' }}>{formatCurrency(item.totalHpp)}</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                            Belum ada nota pembelian yang terhubung ke invoice ini.
                            <br />
                            <span style={{ fontSize: 11 }}>Link nota di menu "Pembelian Bahan"</span>
                          </div>
                        )}
                      </div>

                      {/* Margin Summary */}
                      <div className="detail-note-card" style={{
                        background: item.hasHpp
                          ? (item.marginPct >= 20 ? 'rgba(34,197,94,0.06)' : item.marginPct >= 10 ? 'rgba(251,191,36,0.06)' : 'rgba(239,68,68,0.06)')
                          : 'rgba(255,255,255,0.02)',
                        borderColor: item.hasHpp
                          ? (item.marginPct >= 20 ? 'rgba(34,197,94,0.15)' : item.marginPct >= 10 ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)')
                          : 'rgba(255,255,255,0.07)'
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>
                          📊 Ringkasan Margin
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ opacity: 0.75 }}>Pendapatan</span>
                            <span style={{ fontWeight: 600, color: '#22c55e' }}>{formatCurrency(item.revenue)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ opacity: 0.75 }}>Biaya Bahan (HPP)</span>
                            <span style={{ fontWeight: 600, color: item.hasHpp ? '#ef4444' : 'var(--text-muted)' }}>
                              {item.hasHpp ? `- ${formatCurrency(item.totalHpp)}` : 'Belum ada data'}
                            </span>
                          </div>
                          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800 }}>
                            <span>Laba Kotor</span>
                            <span style={{ color: item.hasHpp ? (item.grossProfit >= 0 ? '#22c55e' : '#ef4444') : 'var(--text-muted)' }}>
                              {item.hasHpp ? formatCurrency(item.grossProfit) : '-'}
                            </span>
                          </div>
                          {item.hasHpp && (
                            <div style={{ marginTop: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                                <span style={{ opacity: 0.75 }}>Margin</span>
                                <span style={{ fontWeight: 800, fontSize: 18, color: getMarginBarColor(item.marginPct) }}>
                                  {item.marginPct?.toFixed(2)}%
                                </span>
                              </div>
                              <div style={{ height: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                                <div style={{
                                  width: `${Math.min(Math.max(item.marginPct || 0, 0), 100)}%`,
                                  height: '100%',
                                  background: getMarginBarColor(item.marginPct),
                                  borderRadius: 6,
                                  transition: 'width 0.6s ease'
                                }} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                                <span>0%</span>
                                <span style={{ color: '#f59e0b' }}>15%</span>
                                <span style={{ color: '#22c55e' }}>30%+</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Summary */}
      {sorted.length > 0 && (
        <div style={{
          margin: '20px 0',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.08) 100%)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 14,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Pendapatan ({sorted.length} invoice)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>{formatCurrency(totalRevenue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total HPP / Biaya Bahan</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>{formatCurrency(totalHpp)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Laba Kotor</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: totalProfit >= 0 ? '#22c55e' : '#ef4444', marginTop: 4 }}>{formatCurrency(totalProfit)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Rata-rata Margin Keseluruhan</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: avgMargin >= 20 ? '#22c55e' : avgMargin >= 10 ? '#f59e0b' : '#ef4444', marginTop: 4 }}>
              {avgMargin.toFixed(1)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Import missing icon
function FiShoppingBasket(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  );
}
