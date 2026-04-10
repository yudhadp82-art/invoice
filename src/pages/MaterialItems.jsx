import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiPackage, FiDownload } from 'react-icons/fi';
import Modal from '../components/Modal';
import { SupportingMaterialItems as MasterItemStore } from '../utils/storage';
import { exportToExcel } from '../utils/excel';
import ConfirmModal from '../components/ConfirmModal';
import { formatCurrency } from '../utils/formatter';

const emptyItem = { name: '', unit: '', defaultPrice: 0, stock: 0, notes: '', availableInS2: true, availableInS5: true };

export default function MaterialItems() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyItem);
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
      setItems(await MasterItemStore.getAll());
    } catch (err) {
      console.error('Failed to load material items:', err);
      setError('Gagal memuat data master bahan. Silakan periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setForm({ ...emptyItem });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(item) {
    setForm({
      name: item.name,
      unit: item.unit || '',
      defaultPrice: item.defaultPrice || 0,
      stock: item.stock || 0,
      notes: item.notes || '',
      availableInS2: item.availableInS2 !== false,
      availableInS5: item.availableInS5 !== false,
    });
    setEditingId(item.id);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const payload = { 
      ...form, 
      defaultPrice: Number(form.defaultPrice) || 0,
      stock: Number(form.stock) || 0
    };
    
    if (editingId) {
      await MasterItemStore.update(editingId, payload);
    } else {
      await MasterItemStore.create(payload);
    }
    setModalOpen(false);
    await reload();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await MasterItemStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  function handleExport() {
    const columns = [
      { key: 'name', header: 'Nama Bahan', width: 25 },
      { key: 'unit', header: 'Satuan', width: 15 },
      { key: 'defaultPrice', header: 'Harga Standar', width: 20 },
      { key: 'notes', header: 'Catatan', width: 30 },
    ];
    exportToExcel(filtered, 'master_bahan_export', 'Master Bahan', columns);
  }

  const filtered = items.filter(it =>
    (it.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.unit || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Master Bahan Pendukung</h1>
          <p>Kelola daftar item bahan pendukung produksi</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={handleExport}>
            <FiDownload /> Export Excel
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <FiPlus /> Tambah Item
          </button>
        </div>
      </div>

      {loading && (
        <div className="card p-lg text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-muted">Memuat data master bahan...</p>
        </div>
      )}

      {error && (
        <div className="card p-lg text-center animate-in" style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="empty-state-icon" style={{ color: '#ef4444' }}><FiPackage /></div>
          <h3 className="text-danger">{error.includes('Permission Denied') ? 'Akses Database Terbatas (RLS)' : 'Gagal Memuat Data'}</h3>
          <p className="mb-md">
            {error.includes('Permission Denied') 
              ? 'Data master bahan ditemukan di database tapi diblokir oleh kebijakan keamanan (RLS) Supabase Anda.'
              : 'Terjadi kesalahan saat memuat data master bahan dari database.'}
          </p>
          <div className="flex-center gap-md">
            <button className="btn btn-primary" onClick={reload}>Coba Lagi</button>
            {error.includes('Permission Denied') && (
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                Buka Supabase Dashboard
              </a>
            )}
          </div>
        </div>
      )}

      {(!loading && !error) && (
        <>
          <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nama Bahan</th>
              <th>Satuan Standar</th>
              <th style={{ textAlign: 'right' }}>Stok</th>
              <th style={{ textAlign: 'right' }}>Harga Standar</th>
              <th>Catatan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiPackage /></div>
                    <h3>Belum ada master bahan</h3>
                    <p>Klik "Tambah Item" untuk memasukkan data</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(it => (
              <tr key={it.id}>
                <td><strong>{it.name || '-'}</strong></td>
                <td><span className="badge" style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8' }}>{it.unit || '-'}</span></td>
                <td className="text-right"><span style={{ fontWeight: 600, color: (it.stock || 0) <= 0 ? 'var(--accent-danger)' : 'inherit' }}>{it.stock || 0}</span></td>
                <td className="text-right" style={{ color: '#fb923c', fontWeight: 600 }}>{formatCurrency(it.defaultPrice)}</td>
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
      </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Master Bahan' : 'Tambah Master Bahan'} persistent={true}>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Nama Bahan</label>
              <input className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Misal: Plastik PE 5kg" />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Satuan Standar</label>
                <input className="form-input" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="Misal: kg, pack, pcs" />
              </div>
              <div className="form-group">
                <label className="form-label">Harga Perkiraan (Rp)</label>
                <input className="form-input" type="number" value={form.defaultPrice} onChange={e => setForm({...form, defaultPrice: e.target.value})} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Stok Awal</label>
                <input className="form-input" type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} placeholder="0" />
              </div>
            </div>
            
            <div className="form-group mb-md" style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
              <label className="form-label" style={{ marginBottom: '8px' }}>Ketersediaan di Cabang (Auto-Split)</label>
              <div className="flex gap-lg">
                <label className="flex-center gap-xs cursor-pointer">
                  <input type="checkbox" checked={form.availableInS2} onChange={e => setForm({...form, availableInS2: e.target.checked})} />
                  <span>Sedia di S2 (SJ 2)</span>
                </label>
                <label className="flex-center gap-xs cursor-pointer">
                  <input type="checkbox" checked={form.availableInS5} onChange={e => setForm({...form, availableInS5: e.target.checked})} />
                  <span>Sedia di S5 (SJ 5)</span>
                </label>
              </div>
              <p className="text-xs text-muted mt-sm">Mempengaruhi pembagian otomatis qty saat import dari invoice SJ2/SJ5.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Catatan</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Catatan tambahan (opsional)..." rows={3} />
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
        title="Hapus Master Bahan"
        message="Apakah Anda yakin ingin menghapus data master bahan ini?"
      />
    </div>
  );
}
