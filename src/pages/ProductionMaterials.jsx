import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiTrash2, FiEdit2, FiPackage } from 'react-icons/fi';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { ProductionMaterials as Store } from '../utils/storage';
import { formatCurrency, formatDateShort, formatNumberInput } from '../utils/formatter';

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  supplierName: '',
  materialName: '',
  qty: '',
  unit: '',
  pricePerUnit: '',
  totalCost: 0,
  notes: '',
};

export default function ProductionMaterialsPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
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
      supplierName: item.supplierName || '',
      materialName: item.materialName || '',
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

  const filtered = items.filter(it =>
    (it.materialName || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.supplierName || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalAll = items.reduce((s, it) => s + (it.totalCost || 0), 0);
  const totalMonth = items
    .filter(it => {
      const d = new Date(it.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, it) => s + (it.totalCost || 0), 0);

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Bahan Pendukung</h1>
          <p>Pembelian bahan pendukung produksi</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <FiPlus /> Tambah Pembelian
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiPackage /></div>
          </div>
          <div className="stat-card-value">{items.length}</div>
          <div className="stat-card-label">Total Transaksi</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-card-header">
            <div className="stat-card-icon">📦</div>
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

      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input type="text" placeholder="Cari bahan pendukung..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Nama Bahan</th>
              <th>Supplier</th>
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
                    <div className="empty-state-icon"><FiPackage /></div>
                    <h3>Belum ada data bahan pendukung</h3>
                    <p>Klik tombol "Tambah Pembelian" untuk mencatat.</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(it => (
              <tr key={it.id}>
                <td className="text-muted">{formatDateShort(it.date || it.createdAt)}</td>
                <td><strong>{it.materialName}</strong></td>
                <td>{it.supplierName || '-'}</td>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Bahan Pendukung' : 'Tambah Bahan Pendukung'} size="md">
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input type="date" className="form-input" value={form.date} onChange={e => handleFieldChange('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Nama Bahan</label>
              <input className="form-input" value={form.materialName} onChange={e => handleFieldChange('materialName', e.target.value)} placeholder="Contoh: Tepung Terigu, Plastik kemasan..." required />
            </div>
            <div className="form-group">
              <label className="form-label">Nama Supplier / Toko</label>
              <input className="form-input" value={form.supplierName} onChange={e => handleFieldChange('supplierName', e.target.value)} placeholder="Nama supplier atau toko" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Qty</label>
                <input className="form-input" value={form.qty} onChange={e => handleFieldChange('qty', e.target.value)} placeholder="0" required />
              </div>
              <div className="form-group">
                <label className="form-label">Satuan</label>
                <input className="form-input" value={form.unit} onChange={e => handleFieldChange('unit', e.target.value)} placeholder="kg, ltr, pcs..." />
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
        title="Hapus Bahan Pendukung"
        message="Apakah Anda yakin ingin menghapus data ini?"
      />
    </div>
  );
}
