import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiTrash2, FiEdit2, FiTool } from 'react-icons/fi';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { ProductionNeeds as Store } from '../utils/storage';
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
};

export default function ProductionNeedsPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    const data = await Store.getAll();
    setItems(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
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
    });
    setEditingId(item.id);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const qty = parseFloat(String(form.qty).replace(/\./g, '').replace(',', '.')) || 0;
    const pricePerUnit = parseFloat(String(form.pricePerUnit).replace(/\./g, '').replace(',', '.')) || 0;
    const payload = { ...form, qty, pricePerUnit, totalCost: qty * pricePerUnit };

    if (editingId) {
      await Store.update(editingId, payload);
    } else {
      await Store.create(payload);
    }
    setModalOpen(false);
    await reload();
  }

  async function confirmDelete() {
    if (!deleteId) return;
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
