import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiTrash2, FiEdit2, FiTool, FiFileText } from 'react-icons/fi';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { ProductionNeeds as Store, Invoices, SupportingMaterialItems } from '../utils/storage';
import { formatCurrency, formatDateShort } from '../utils/formatter';

const CATEGORY_OPTIONS = [
  'Alat Produksi',
  'Bahan Bakar',
  'Kemasan',
  'Perawatan Mesin',
  'Utilitas (Listrik/Air)',
  'Lainnya',
];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  itemName: '',
  category: 'Lainnya',
  qty: '',
  unit: '',
  pricePerUnit: '',
  totalCost: 0,
  notes: '',
  invoiceIds: [], // Link ke satu atau beberapa invoice
};

export default function ProductionNeedsPage() {
  const [items, setItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    const data = await Store.getAll();
    const invs = await Invoices.getAll();
    setItems(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    setInvoices(invs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  function calcTotal(f = form) {
    const qty = parseFloat(String(f.qty).replace(/\./g, '').replace(',', '.')) || 0;
    const price = parseFloat(String(f.pricePerUnit).replace(/\./g, '').replace(',', '.')) || 0;
    return qty * price;
  }

  function handleFieldChange(field, value) {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      updated.totalCost = calcTotal(updated);
      return updated;
    });
  }

  function openAdd() {
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    setModalOpen(true);
    setInvoiceSearch('');
  }

  function openEdit(item) {
    setForm({
      date: item.date || new Date().toISOString().slice(0, 10),
      itemName: item.itemName || '',
      category: item.category || 'Lainnya',
      qty: item.qty || '',
      unit: item.unit || '',
      pricePerUnit: item.pricePerUnit || '',
      totalCost: item.totalCost || 0,
      notes: item.notes || '',
      invoiceIds: item.invoiceIds || [],
    });
    setEditingId(item.id);
    setModalOpen(true);
    setInvoiceSearch('');
  }

  async function handleSave(e) {
    e.preventDefault();
    const qty = parseFloat(String(form.qty).replace(/\./g, '').replace(',', '.')) || 0;
    const pricePerUnit = parseFloat(String(form.pricePerUnit).replace(/\./g, '').replace(',', '.')) || 0;
    const payload = { ...form, qty, pricePerUnit, totalCost: qty * pricePerUnit };

    // Stock Sync
    const allMats = await SupportingMaterialItems.getAll();
    const match = allMats.find(m => (m.name || '').toLowerCase() === (form.itemName || '').toLowerCase());
    
    if (editingId) {
      const oldItem = items.find(it => it.id === editingId);
      if (oldItem && match) {
        const oldQty = Number(oldItem.qty) || 0;
        const diff = oldQty - qty; // restore old, subtract new
        if (diff !== 0) {
          await SupportingMaterialItems.update(match.id, { stock: (match.stock || 0) + diff });
        }
      }
      await Store.update(editingId, payload);
    } else {
      if (match) {
        await SupportingMaterialItems.update(match.id, { stock: (match.stock || 0) - qty });
      }
      await Store.create(payload);
    }
    setModalOpen(false);
    await reload();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    
    // Restore Stock
    const oldItem = items.find(it => it.id === deleteId);
    if (oldItem) {
      const allMats = await SupportingMaterialItems.getAll();
      const match = allMats.find(m => (m.name || '').toLowerCase() === (oldItem.itemName || '').toLowerCase());
      if (match) {
        await SupportingMaterialItems.update(match.id, { stock: (match.stock || 0) + (Number(oldItem.qty) || 0) });
      }
    }

    await Store.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  const filtered = items.filter(it => {
    const q = search.toLowerCase();
    const matchSearch = (it.itemName || '').toLowerCase().includes(q) || (it.notes || '').toLowerCase().includes(q);
    const matchCat = filterCategory ? it.category === filterCategory : true;
    return matchSearch && matchCat;
  });

  const totalAll = items.reduce((s, it) => s + (it.totalCost || 0), 0);
  const totalMonth = items
    .filter(it => {
      const d = new Date(it.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, it) => s + (it.totalCost || 0), 0);

  const CATEGORY_COLORS = {
    'Alat Produksi': '#38bdf8',
    'Bahan Bakar': '#fb923c',
    'Kemasan': '#a78bfa',
    'Perawatan Mesin': '#facc15',
    'Utilitas (Listrik/Air)': '#4ade80',
    'Lainnya': '#94a3b8',
  };

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Kebutuhan Produksi</h1>
          <p>Barang &amp; pengeluaran kebutuhan operasional produksi</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <FiPlus /> Tambah Kebutuhan
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiTool /></div>
          </div>
          <div className="stat-card-value">{items.length}</div>
          <div className="stat-card-label">Total Transaksi</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-card-header">
            <div className="stat-card-icon">🔧</div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalMonth)}</div>
          <div className="stat-card-label">Pengeluaran Bulan Ini</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-header">
            <div className="stat-card-icon">💰</div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalAll)}</div>
          <div className="stat-card-label">Total Pengeluaran</div>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1 }}>
          <FiSearch className="search-icon" />
          <input type="text" placeholder="Cari item kebutuhan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="form-select"
          style={{ width: 200 }}
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">Semua Kategori</option>
          {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Nama Item</th>
              <th>Kategori</th>
              <th>Qty</th>
              <th style={{ textAlign: 'right' }}>Harga/Unit</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Ref. Invoice</th>
              <th>Catatan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiTool /></div>
                    <h3>Belum ada data kebutuhan produksi</h3>
                    <p>Klik tombol "Tambah Kebutuhan" untuk mencatat.</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(it => (
              <tr key={it.id}>
                <td className="text-muted">{formatDateShort(it.date || it.createdAt)}</td>
                <td><strong>{it.itemName}</strong></td>
                <td>
                  <span style={{
                    background: `${(CATEGORY_COLORS[it.category] || '#94a3b8')}22`,
                    color: CATEGORY_COLORS[it.category] || '#94a3b8',
                    padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600
                  }}>
                    {it.category}
                  </span>
                </td>
                <td>{it.qty} {it.unit}</td>
                <td className="text-right">{formatCurrency(it.pricePerUnit)}</td>
                <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(it.totalCost)}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {(it.invoiceIds || []).map(id => {
                      const inv = invoices.find(i => i.id === id);
                      return inv ? (
                        <span key={id} style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                          {inv.invoiceNumber}
                        </span>
                      ) : null;
                    })}
                    {(!it.invoiceIds || it.invoiceIds.length === 0) && <span style={{ color: '#64748b', fontSize: 11 }}>-</span>}
                  </div>
                </td>
                <td className="text-muted text-sm">{it.notes || '-'}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(it)}><FiEdit2 /></button>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleteId(it.id)}><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Kebutuhan Produksi' : 'Tambah Kebutuhan Produksi'} size="md">
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input type="date" className="form-input" value={form.date} onChange={e => handleFieldChange('date', e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Nama Item</label>
                <input className="form-input" value={form.itemName} onChange={e => handleFieldChange('itemName', e.target.value)} placeholder="Nama barang/kebutuhan" required />
              </div>
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select className="form-select" value={form.category} onChange={e => handleFieldChange('category', e.target.value)}>
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Qty</label>
                <input className="form-input" value={form.qty} onChange={e => handleFieldChange('qty', e.target.value)} placeholder="0" required />
              </div>
              <div className="form-group">
                <label className="form-label">Satuan</label>
                <input className="form-input" value={form.unit} onChange={e => handleFieldChange('unit', e.target.value)} placeholder="pcs, ltr, m..." />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Harga per Unit (Rp)</label>
              <input className="form-input" value={form.pricePerUnit} onChange={e => handleFieldChange('pricePerUnit', e.target.value)} placeholder="0" required />
            </div>
            <div style={{ textAlign: 'right', marginBottom: 12, fontSize: 15, fontWeight: 700, color: '#818cf8' }}>
              Total: {formatCurrency(calcTotal())}
            </div>
            <div className="form-group">
              <label className="form-label">Catatan</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => handleFieldChange('notes', e.target.value)} placeholder="Catatan tambahan..." rows={2} />
            </div>

            {/* Referensi Invoice */}
            <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.06)', margin: '16px 0' }} />
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiFileText /> Hubungkan ke Invoice (HPP)
              </label>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <FiSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 12 }} />
                <input 
                  className="form-input" 
                  style={{ paddingLeft: 30, fontSize: 13 }} 
                  placeholder="Cari no. invoice atau customer..." 
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                />
              </div>
              <div style={{ 
                maxHeight: 150, 
                overflowY: 'auto', 
                border: '1px solid rgba(255,255,255,0.06)', 
                borderRadius: 8,
                background: 'rgba(0,0,0,0.1)',
                padding: 4
              }}>
                {invoices
                  .filter(inv => {
                    const q = invoiceSearch.toLowerCase();
                    return inv.invoiceNumber?.toLowerCase().includes(q) || inv.customerName?.toLowerCase().includes(q);
                  })
                  .map(inv => {
                    const isSelected = (form.invoiceIds || []).includes(inv.id);
                    return (
                      <label key={inv.id} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 10, 
                        padding: '6px 10px', 
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(129,140,248,0.1)' : 'transparent',
                        marginBottom: 2
                      }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => {
                            const current = [...(form.invoiceIds || [])];
                            if (isSelected) {
                              handleFieldChange('invoiceIds', current.filter(id => id !== inv.id));
                            } else {
                              handleFieldChange('invoiceIds', [...current, inv.id]);
                            }
                          }}
                        />
                        <div style={{ fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{inv.invoiceNumber}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{inv.customerName}</div>
                        </div>
                      </label>
                    );
                  })}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                {form.invoiceIds?.length || 0} invoice terpilih. Biaya akan dibagi rata ke setiap invoice di Laporan HPP.
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Hapus Kebutuhan Produksi"
        message="Apakah Anda yakin ingin menghapus data ini?"
      />
    </div>
  );
}
