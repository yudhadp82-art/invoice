import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiTrash2, FiEdit2, FiDollarSign, FiTruck, FiPackage, FiUsers, FiAlertTriangle, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import Modal from '../components/Modal';
import { HppReports, Invoices as InvoiceStore } from '../utils/storage';
import { formatCurrency, formatDateShort } from '../utils/formatter';

// Bahan default untuk mix vegetable
const MIX_VEG_DEFAULTS = [
  { nama: 'Wortel', qty: 0, harga: 0 },
  { nama: 'Buncis', qty: 0, harga: 0 },
  { nama: 'Jagung', qty: 0, harga: 0 },
  { nama: 'Kol', qty: 0, harga: 0 },
  { nama: 'Daun Bawang', qty: 0, harga: 0 },
];

function isMixVeg(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('mix veg') || n.includes('sayur campuran') || n.includes('mixed veg');
}

function emptyItemCost(item) {
  return {
    productId: item.productId || '',
    productName: item.productName || '',
    qty: item.qty || 0,
    unit: item.unit || '',
    hargaJual: item.unitPrice || 0,
    subtotalJual: item.subtotal || 0,
    // biaya modal per item
    hargaModalSatuan: item.purchaseCost || 0,
    subItems: isMixVeg(item.productName)
      ? MIX_VEG_DEFAULTS.map(b => ({ ...b }))
      : [],
    useSubItems: isMixVeg(item.productName),
  };
}

const emptyForm = {
  invoiceId: '',
  invoiceNumber: '',
  customerName: '',
  invoiceTotal: 0,
  itemCosts: [],
  // Biaya level invoice (bukan per item)
  ongkosKirimBahan: 0,
  ongkosPengiriman: 0,
  biayaTenagaKerja: 0,
  biayaLainnya: 0,
  catatan: '',
};

export default function HPP() {
  const [reports, setReports] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const allInvs = await InvoiceStore.getAll();
    let allReports = await HppReports.getAll();

    // Auto-sync reports secretly on load in case parent invoice was modified
    let needsUpdate = false;
    allReports = await Promise.all(allReports.map(async r => {
      const parentInv = allInvs.find(i => i.id === r.invoiceId);
      if (!parentInv) return r;

      const invItems = parentInv.items || [];
      const currentItems = r.itemCosts || [];

      // Check if qty or items count changed
      let hasChange = false;
      if (invItems.length !== currentItems.length || parentInv.grandTotal !== r.invoiceTotal) {
        hasChange = true;
      } else {
        invItems.forEach(invIt => {
          const match = currentItems.find(cIt => cIt.productId === invIt.productId);
          if (!match || match.qty !== invIt.qty || match.subtotalJual !== invIt.subtotal) {
            hasChange = true;
          }
        });
      }

      if (hasChange) {
        needsUpdate = true;
        // Sync mapping
        const syncedItemCosts = invItems.map(invIt => {
          const existing = currentItems.find(cIt => cIt.productId === invIt.productId);
          if (existing) {
            return {
              ...existing,
              productName: invIt.productName,
              qty: invIt.qty,
              unit: invIt.unit,
              hargaJual: invIt.unitPrice,
              subtotalJual: invIt.subtotal,
              // Update totalModal just in case qty changed
              totalModal: existing.useSubItems && existing.subItems?.length 
                          ? existing.subItems.reduce((s,b)=>s+(Number(b.qty)*Number(b.harga)),0)
                          : Number(existing.hargaModalSatuan) * Number(invIt.qty)
            };
          }
          return {
            ...emptyItemCost(invIt),
            totalModal: Number(invIt.purchaseCost || 0) * Number(invIt.qty)
          };
        });

        const totalModalBarang = syncedItemCosts.reduce((s, it) => s + (it.totalModal || 0), 0);
        const totalBiayaInvoice = Number(r.ongkosKirimBahan||0) + Number(r.ongkosPengiriman||0) + Number(r.biayaTenagaKerja||0) + Number(r.biayaLainnya||0);
        const totalHPP = totalModalBarang + totalBiayaInvoice;
        const labaKotor = Number(parentInv.grandTotal||0) - totalHPP;
        const margin = parentInv.grandTotal > 0 ? ((labaKotor / parentInv.grandTotal) * 100) : 0;

        const updatedReport = {
          ...r,
          invoiceTotal: parentInv.grandTotal || 0,
          itemCosts: syncedItemCosts,
          totalModalBarang,
          totalBiayaInvoice,
          totalHPP,
          labaKotor,
          margin: Number(margin.toFixed(2)),
          rugi: labaKotor < 0,
        };
        await HppReports.update(r.id, updatedReport);
        return updatedReport;
      }
      return r;
    }));

    setReports(allReports);
    setInvoices(allInvs);
  }

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(r) {
    setEditId(r.id);
    setForm({
      invoiceId: r.invoiceId || '',
      invoiceNumber: r.invoiceNumber || '',
      customerName: r.customerName || '',
      invoiceTotal: r.invoiceTotal || 0,
      itemCosts: r.itemCosts || [],
      ongkosKirimBahan: r.ongkosKirimBahan || 0,
      ongkosPengiriman: r.ongkosPengiriman || 0,
      biayaTenagaKerja: r.biayaTenagaKerja || 0,
      biayaLainnya: r.biayaLainnya || 0,
      catatan: r.catatan || '',
    });
    setModalOpen(true);
  }

  function handleInvoiceChange(invoiceId) {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) {
      setForm(f => ({ ...f, invoiceId, invoiceNumber: '', customerName: '', invoiceTotal: 0, itemCosts: [] }));
      return;
    }
    const itemCosts = (inv.items || []).map(item => emptyItemCost(item));
    setForm(f => ({
      ...f,
      invoiceId,
      invoiceNumber: inv.invoiceNumber || '',
      customerName: inv.customerName || '',
      invoiceTotal: inv.grandTotal || 0,
      itemCosts,
    }));
  }

  // Update field di item cost
  function updateItemCost(idx, field, value) {
    setForm(f => {
      const itemCosts = [...f.itemCosts];
      itemCosts[idx] = { ...itemCosts[idx], [field]: value };
      return { ...f, itemCosts };
    });
  }

  // Toggle mode sub-items
  function toggleSubItems(idx) {
    setForm(f => {
      const itemCosts = [...f.itemCosts];
      const item = { ...itemCosts[idx] };
      item.useSubItems = !item.useSubItems;
      if (item.useSubItems && item.subItems.length === 0) {
        item.subItems = MIX_VEG_DEFAULTS.map(b => ({ ...b }));
      }
      itemCosts[idx] = item;
      return { ...f, itemCosts };
    });
  }

  // Update sub-item bahan
  function updateSubItem(itemIdx, subIdx, field, value) {
    setForm(f => {
      const itemCosts = [...f.itemCosts];
      const item = { ...itemCosts[itemIdx] };
      const subItems = [...item.subItems];
      subItems[subIdx] = { ...subItems[subIdx], [field]: value };
      item.subItems = subItems;
      itemCosts[itemIdx] = item;
      return { ...f, itemCosts };
    });
  }

  function addSubItem(itemIdx) {
    setForm(f => {
      const itemCosts = [...f.itemCosts];
      const item = { ...itemCosts[itemIdx] };
      item.subItems = [...item.subItems, { nama: '', qty: 0, harga: 0 }];
      itemCosts[itemIdx] = item;
      return { ...f, itemCosts };
    });
  }

  function removeSubItem(itemIdx, subIdx) {
    setForm(f => {
      const itemCosts = [...f.itemCosts];
      const item = { ...itemCosts[itemIdx] };
      item.subItems = item.subItems.filter((_, i) => i !== subIdx);
      itemCosts[itemIdx] = item;
      return { ...f, itemCosts };
    });
  }

  // Hitung modal per item berdasarkan sub-items ATAU harga satuan langsung
  function calcItemModal(item) {
    if (item.useSubItems && item.subItems.length > 0) {
      return item.subItems.reduce((s, b) => s + (Number(b.qty) * Number(b.harga)), 0);
    }
    return Number(item.hargaModalSatuan) * Number(item.qty);
  }

  // Hitung semua untuk form saat ini
  function calcFormTotals() {
    const totalModalBarang = form.itemCosts.reduce((s, item) => s + calcItemModal(item), 0);
    const totalBiayaInvoice = Number(form.ongkosKirimBahan) + Number(form.ongkosPengiriman) + Number(form.biayaTenagaKerja) + Number(form.biayaLainnya);
    const totalHPP = totalModalBarang + totalBiayaInvoice;
    const labaKotor = Number(form.invoiceTotal) - totalHPP;
    const margin = Number(form.invoiceTotal) > 0 ? ((labaKotor / Number(form.invoiceTotal)) * 100) : 0;
    return { totalModalBarang, totalBiayaInvoice, totalHPP, labaKotor, margin };
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.invoiceId) {
      alert('Pilih invoice terlebih dahulu');
      return;
    }
    const { totalModalBarang, totalBiayaInvoice, totalHPP, labaKotor, margin } = calcFormTotals();

    // Build itemCosts with computed totals
    const itemCosts = form.itemCosts.map(item => ({
      ...item,
      totalModal: calcItemModal(item),
    }));

    const data = {
      ...form,
      itemCosts,
      ongkosKirimBahan: Number(form.ongkosKirimBahan),
      ongkosPengiriman: Number(form.ongkosPengiriman),
      biayaTenagaKerja: Number(form.biayaTenagaKerja),
      biayaLainnya: Number(form.biayaLainnya),
      invoiceTotal: Number(form.invoiceTotal),
      totalModalBarang,
      totalBiayaInvoice,
      totalHPP,
      labaKotor,
      margin: Number(margin.toFixed(2)),
      rugi: labaKotor < 0,
    };

    if (editId) {
      await HppReports.update(editId, data);
    } else {
      await HppReports.create(data);
    }
    setModalOpen(false);
    await reload();
  }

  async function handleDelete(id) {
    if (confirm('Hapus laporan HPP ini?')) {
      await HppReports.delete(id);
      await reload();
    }
  }

  const filtered = reports
    .filter(r => {
      const q = search.toLowerCase();
      return (r.invoiceNumber || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalRevenue = filtered.reduce((s, r) => s + (r.invoiceTotal || 0), 0);
  const totalHPPAll = filtered.reduce((s, r) => s + (r.totalHPP || 0), 0);
  const totalLaba = filtered.reduce((s, r) => s + (r.labaKotor || 0), 0);
  const jumlahRugi = filtered.filter(r => r.rugi).length;
  const avgMargin = filtered.length > 0
    ? (filtered.reduce((s, r) => s + (r.margin || 0), 0) / filtered.length).toFixed(1)
    : 0;

  const existingIds = new Set(reports.map(r => r.invoiceId));
  const unlinkedInvoices = invoices.filter(inv => !existingIds.has(inv.id));

  const { totalModalBarang, totalBiayaInvoice, totalHPP, labaKotor, margin } = calcFormTotals();

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>HPP</h1>
          <p>Harga Pokok Penjualan – Rincian modal per item &amp; biaya invoice</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <FiPlus /> Tambah Laporan HPP
        </button>
      </div>

      {/* Warning banner jika ada yang rugi */}
      {jumlahRugi > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <FiAlertTriangle style={{ color: '#f87171', fontSize: 22, flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#f87171' }}>Peringatan: {jumlahRugi} invoice mengalami kerugian!</strong>
            <div style={{ fontSize: 13, color: '#fca5a5', marginTop: 2 }}>Cek baris berwarna merah di bawah dan sesuaikan harga jual atau turunkan biaya HPP.</div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-card-header"><div className="stat-card-icon"><FiDollarSign /></div></div>
          <div className="stat-card-value">{formatCurrency(totalRevenue)}</div>
          <div className="stat-card-label">Total Penjualan</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-card-header"><div className="stat-card-icon"><FiPackage /></div></div>
          <div className="stat-card-value">{formatCurrency(totalHPPAll)}</div>
          <div className="stat-card-label">Total HPP</div>
        </div>
        <div className={`stat-card ${totalLaba >= 0 ? 'green' : 'orange'}`}>
          <div className="stat-card-header"><div className="stat-card-icon">{totalLaba >= 0 ? '📈' : <FiAlertTriangle />}</div></div>
          <div className="stat-card-value" style={{ color: totalLaba >= 0 ? undefined : '#f87171' }}>{formatCurrency(totalLaba)}</div>
          <div className="stat-card-label">Total Laba Kotor</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-card-header"><div className="stat-card-icon"><FiTruck /></div></div>
          <div className="stat-card-value">{avgMargin}%</div>
          <div className="stat-card-label">Rata-rata Margin</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input type="text" placeholder="Cari no. invoice atau pelanggan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No. Invoice</th>
              <th>Pelanggan</th>
              <th style={{ textAlign: 'right' }}>Total Penjualan</th>
              <th style={{ textAlign: 'right' }}>Modal Barang</th>
              <th style={{ textAlign: 'right' }}>Biaya Invoice</th>
              <th style={{ textAlign: 'right' }}>Total HPP</th>
              <th style={{ textAlign: 'right' }}>Laba Kotor</th>
              <th style={{ textAlign: 'right' }}>Margin</th>
              <th>Detail</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiDollarSign /></div>
                    <h3>Belum ada laporan HPP</h3>
                    <p>Klik "Tambah Laporan HPP" untuk memulai</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(r => (
              <>
                <tr key={r.id} style={r.rugi ? { background: 'rgba(239,68,68,0.07)', borderLeft: '3px solid #ef4444' } : {}}>
                  <td className="text-muted">{formatDateShort(r.createdAt)}</td>
                  <td>
                    <strong>{r.invoiceNumber}</strong>
                    {r.rugi && <span style={{ marginLeft: 8, color: '#f87171', fontSize: 12 }}><FiAlertTriangle style={{ marginRight: 3 }} />RUGI</span>}
                  </td>
                  <td>{r.customerName}</td>
                  <td className="text-right">{formatCurrency(r.invoiceTotal)}</td>
                  <td className="text-right text-warning">{formatCurrency(r.totalModalBarang)}</td>
                  <td className="text-right">{formatCurrency(r.totalBiayaInvoice)}</td>
                  <td className="text-right" style={{ fontWeight: 700, color: '#f87171' }}>{formatCurrency(r.totalHPP)}</td>
                  <td className="text-right" style={{ fontWeight: 700, color: r.labaKotor >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(r.labaKotor)}</td>
                  <td className="text-right">
                    <span style={{ fontWeight: 700, color: r.margin >= 20 ? '#34d399' : r.margin >= 10 ? '#fbbf24' : '#f87171' }}>
                      {r.margin?.toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}>
                      {expandedRow === r.id ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><FiEdit2 /></button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(r.id)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
                {/* Expanded: rincian per item */}
                {expandedRow === r.id && (
                  <tr key={`${r.id}-detail`}>
                    <td colSpan={11} style={{ padding: '0 24px 16px 40px', background: 'rgba(99,102,241,0.03)' }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, marginTop: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rincian Modal per Item</div>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Produk</th>
                            <th style={{ textAlign: 'center', padding: '4px 8px' }}>Qty</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Harga Jual/unit</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Modal</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Subtotal Jual</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Laba Item</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(r.itemCosts || []).map((item, idx) => {
                            const labaItem = (item.subtotalJual || 0) - (item.totalModal || 0);
                            return (
                              <>
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '5px 8px', fontWeight: 600 }}>{item.productName}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>{item.qty} {item.unit}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatCurrency(item.hargaJual)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#fbbf24' }}>{formatCurrency(item.totalModal)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatCurrency(item.subtotalJual)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: labaItem >= 0 ? '#34d399' : '#f87171' }}>
                                    {labaItem < 0 && <FiAlertTriangle style={{ marginRight: 3, fontSize: 10 }} />}
                                    {formatCurrency(labaItem)}
                                  </td>
                                </tr>
                                {/* Sub items bahan */}
                                {item.useSubItems && (item.subItems || []).map((b, si) => (
                                  <tr key={`${idx}-${si}`} style={{ background: 'rgba(255,255,255,0.015)' }}>
                                    <td style={{ padding: '3px 8px 3px 24px', color: '#64748b' }}>↳ {b.nama}</td>
                                    <td style={{ padding: '3px 8px', textAlign: 'center', color: '#64748b' }}>{b.qty}</td>
                                    <td style={{ padding: '3px 8px', textAlign: 'right', color: '#64748b' }}>{formatCurrency(b.harga)}</td>
                                    <td style={{ padding: '3px 8px', textAlign: 'right', color: '#64748b' }}>{formatCurrency(b.qty * b.harga)}</td>
                                    <td colSpan={2}></td>
                                  </tr>
                                ))}
                              </>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)', fontWeight: 700 }}>
                            <td colSpan={3} style={{ padding: '6px 8px', color: '#94a3b8' }}>Biaya Invoice (kirim bahan: {formatCurrency(r.ongkosKirimBahan)}, pengiriman: {formatCurrency(r.ongkosPengiriman)}, TK: {formatCurrency(r.biayaTenagaKerja)}, lain: {formatCurrency(r.biayaLainnya)})</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', color: '#fbbf24' }}>{formatCurrency(r.totalBiayaInvoice)}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCurrency(r.invoiceTotal)}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', color: r.labaKotor >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(r.labaKotor)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: 'rgba(99,102,241,0.05)', fontWeight: 700 }}>
                <td colSpan={3}><strong>TOTAL ({filtered.length} invoice)</strong></td>
                <td className="text-right">{formatCurrency(totalRevenue)}</td>
                <td className="text-right" style={{ color: '#fbbf24' }}>{formatCurrency(filtered.reduce((s, r) => s + (r.totalModalBarang || 0), 0))}</td>
                <td className="text-right">{formatCurrency(filtered.reduce((s, r) => s + (r.totalBiayaInvoice || 0), 0))}</td>
                <td className="text-right" style={{ color: '#f87171' }}>{formatCurrency(totalHPPAll)}</td>
                <td className="text-right" style={{ color: totalLaba >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(totalLaba)}</td>
                <td className="text-right">{avgMargin}%</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Modal Form */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Laporan HPP' : 'Tambah Laporan HPP'} size="xl">
        <form onSubmit={handleSave}>
          <div className="modal-body">

            {/* Pilih Invoice */}
            <div className="form-group">
              <label className="form-label">Invoice <span style={{ color: '#ef4444' }}>*</span></label>
              {editId ? (
                <input className="form-input" value={`${form.invoiceNumber} – ${form.customerName}`} disabled />
              ) : (
                <select className="form-select" value={form.invoiceId} onChange={e => handleInvoiceChange(e.target.value)} required>
                  <option value="">-- Pilih Invoice --</option>
                  {unlinkedInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} – {inv.customerName} ({formatCurrency(inv.grandTotal)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* ===== TABEL MODAL PER ITEM ===== */}
            {form.itemCosts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h4 style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Harga Modal per Item
                  </h4>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Total Penjualan: <strong style={{ color: '#818cf8' }}>{formatCurrency(form.invoiceTotal)}</strong></span>
                </div>

                {form.itemCosts.map((item, idx) => {
                  const modalItem = calcItemModal(item);
                  const labaItem = (item.subtotalJual || 0) - modalItem;
                  return (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${labaItem < 0 ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                      {/* Item header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{item.productName}</span>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.qty} {item.unit}</span>
                        <span style={{ fontSize: 12 }}>Jual: <strong style={{ color: '#818cf8' }}>{formatCurrency(item.subtotalJual)}</strong></span>
                        <span style={{ fontSize: 12 }}>Modal: <strong style={{ color: '#fbbf24' }}>{formatCurrency(modalItem)}</strong></span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: labaItem >= 0 ? '#34d399' : '#f87171' }}>
                          {labaItem < 0 && <FiAlertTriangle style={{ marginRight: 3 }} />}
                          Laba: {formatCurrency(labaItem)}
                        </span>
                      </div>

                      {/* Mode toggle: langsung atau sub-items */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        {!item.useSubItems ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                            <div>
                              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Harga Modal / {item.unit} (Rp)</label>
                              <input
                                className="form-input"
                                type="number"
                                min="0"
                                value={item.hargaModalSatuan}
                                onChange={e => updateItemCost(idx, 'hargaModalSatuan', Number(e.target.value))}
                                style={{ width: 140 }}
                              />
                            </div>
                            <div style={{ paddingBottom: 8, color: '#64748b', fontSize: 12 }}>×</div>
                            <div>
                              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Qty</label>
                              <input
                                className="form-input"
                                type="number"
                                min="0" 
                                step="any"
                                value={item.qty}
                                onChange={e => updateItemCost(idx, 'qty', Number(e.target.value))}
                                style={{ width: 80, textAlign: 'center' }}
                              />
                            </div>
                            <div style={{ paddingBottom: 8, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                              = {formatCurrency(Number(item.hargaModalSatuan) * Number(item.qty))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <label style={{ fontSize: 11, color: '#94a3b8' }}>Rincian Bahan (qty × harga)</label>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => addSubItem(idx)} style={{ fontSize: 11 }}>
                                <FiPlus /> Tambah Bahan
                              </button>
                            </div>
                            {item.subItems.map((b, si) => (
                              <div key={si} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                                <input
                                  className="form-input"
                                  placeholder="Nama bahan"
                                  value={b.nama}
                                  onChange={e => updateSubItem(idx, si, 'nama', e.target.value)}
                                  style={{ flex: 2 }}
                                />
                                <input
                                  className="form-input"
                                  type="number"
                                  placeholder="Qty"
                                  min="0"
                                  step="0.1"
                                  value={b.qty}
                                  onChange={e => updateSubItem(idx, si, 'qty', Number(e.target.value))}
                                  style={{ flex: 1 }}
                                />
                                <span style={{ color: '#64748b', fontSize: 12 }}>×</span>
                                <input
                                  className="form-input"
                                  type="number"
                                  placeholder="Harga/kg"
                                  min="0"
                                  value={b.harga}
                                  onChange={e => updateSubItem(idx, si, 'harga', Number(e.target.value))}
                                  style={{ flex: 2 }}
                                />
                                <span style={{ fontSize: 12, color: '#64748b', minWidth: 90, textAlign: 'right' }}>{formatCurrency(b.qty * b.harga)}</span>
                                <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removeSubItem(idx, si)}><FiTrash2 /></button>
                              </div>
                            ))}
                            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#fbbf24', marginTop: 4 }}>
                              Total Bahan: {formatCurrency(item.subItems.reduce((s, b) => s + b.qty * b.harga, 0))}
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleSubItems(idx)}
                          style={{ fontSize: 11, whiteSpace: 'nowrap', alignSelf: 'flex-end' }}
                          title={item.useSubItems ? 'Kembali ke input langsung' : 'Rinci per bahan (cocok untuk Mix Vegetable)'}
                        >
                          {item.useSubItems ? '📦 Mode Langsung' : '🥦 Rinci Bahan'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#fbbf24', marginTop: 4 }}>
                  Total Modal Barang: {formatCurrency(totalModalBarang)}
                </div>
              </div>
            )}

            {/* ===== BIAYA LEVEL INVOICE ===== */}
            <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '16px 0' }} />
            <h4 style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Biaya Keseluruhan Invoice
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8, fontWeight: 400, textTransform: 'none' }}>— dibagi rata ke semua item secara otomatis</span>
            </h4>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">🚚 Ongkos Kirim Bahan (Rp)</label>
                <input className="form-input" type="number" min="0" value={form.ongkosKirimBahan} onChange={e => setForm(f => ({ ...f, ongkosKirimBahan: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">🛵 Ongkos Pengiriman ke Customer (Rp)</label>
                <input className="form-input" type="number" min="0" value={form.ongkosPengiriman} onChange={e => setForm(f => ({ ...f, ongkosPengiriman: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">👷 Biaya Tenaga Kerja (Rp)</label>
                <input className="form-input" type="number" min="0" value={form.biayaTenagaKerja} onChange={e => setForm(f => ({ ...f, biayaTenagaKerja: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">💸 Biaya Lainnya (Rp)</label>
                <input className="form-input" type="number" min="0" value={form.biayaLainnya} onChange={e => setForm(f => ({ ...f, biayaLainnya: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Catatan</label>
              <textarea className="form-textarea" value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} placeholder="Catatan tambahan..." />
            </div>

            {/* ===== RINGKASAN KALKULASI ===== */}
            {form.invoiceId && (
              <div style={{ background: labaKotor < 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.05)', border: `1px solid ${labaKotor < 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.2)'}`, borderRadius: 8, padding: '14px 16px', marginTop: 8 }}>
                {labaKotor < 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#f87171', fontWeight: 700 }}>
                    <FiAlertTriangle /> PERINGATAN: Invoice ini mengalami kerugian sebesar {formatCurrency(Math.abs(labaKotor))}!
                  </div>
                )}
                <h4 style={{ marginBottom: 10, fontSize: 13, color: labaKotor < 0 ? '#f87171' : '#34d399' }}>📊 Ringkasan HPP</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px', fontSize: 13 }}>
                  <span className="text-muted">Modal Barang</span><span style={{ textAlign: 'right' }}>{formatCurrency(totalModalBarang)}</span>
                  <span className="text-muted">Biaya Kirim Bahan</span><span style={{ textAlign: 'right' }}>{formatCurrency(Number(form.ongkosKirimBahan))}</span>
                  <span className="text-muted">Biaya Pengiriman</span><span style={{ textAlign: 'right' }}>{formatCurrency(Number(form.ongkosPengiriman))}</span>
                  <span className="text-muted">Biaya Tenaga Kerja</span><span style={{ textAlign: 'right' }}>{formatCurrency(Number(form.biayaTenagaKerja))}</span>
                  <span className="text-muted">Biaya Lainnya</span><span style={{ textAlign: 'right' }}>{formatCurrency(Number(form.biayaLainnya))}</span>
                  <div style={{ gridColumn: '1/-1', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />
                  <strong>Total HPP</strong><strong style={{ textAlign: 'right', color: '#f87171' }}>{formatCurrency(totalHPP)}</strong>
                  <strong>Total Penjualan</strong><strong style={{ textAlign: 'right', color: '#818cf8' }}>{formatCurrency(Number(form.invoiceTotal))}</strong>
                  <div style={{ gridColumn: '1/-1', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />
                  <strong style={{ fontSize: 14 }}>Laba Kotor</strong>
                  <strong style={{ textAlign: 'right', fontSize: 16, color: labaKotor >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(labaKotor)}</strong>
                  <span className="text-muted">Margin</span>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: labaKotor >= 0 ? '#34d399' : '#f87171' }}>
                    {Number(form.invoiceTotal) > 0 ? ((labaKotor / Number(form.invoiceTotal)) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan HPP</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
