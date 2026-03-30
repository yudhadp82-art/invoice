import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiTrash2, FiEdit2, FiUsers } from 'react-icons/fi';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { SalaryCosts as Store } from '../utils/storage';
import { formatCurrency, formatDateShort } from '../utils/formatter';

const SALARY_TYPES = [
  { value: 'harian', label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
  { value: 'bulanan', label: 'Bulanan' },
  { value: 'borongan', label: 'Borongan' },
  { value: 'lembur', label: 'Lembur' },
];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  employeeName: '',
  position: '',
  salaryType: 'bulanan',
  amount: '',
  periodStart: '',
  periodEnd: '',
  notes: '',
};

export default function SalaryCostsPage() {
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

  function openAdd() {
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(item) {
    setForm({
      date: item.date || new Date().toISOString().slice(0, 10),
      employeeName: item.employeeName || '',
      position: item.position || '',
      salaryType: item.salaryType || 'bulanan',
      amount: item.amount || '',
      periodStart: item.periodStart || '',
      periodEnd: item.periodEnd || '',
      notes: item.notes || '',
    });
    setEditingId(item.id);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const amount = parseFloat(String(form.amount).replace(/\./g, '').replace(',', '.')) || 0;
    const payload = { ...form, amount };

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
    (it.employeeName || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.position || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalAll = items.reduce((s, it) => s + (it.amount || 0), 0);
  const totalMonth = items
    .filter(it => {
      const d = new Date(it.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, it) => s + (it.amount || 0), 0);

  // Unique employee count
  const uniqueEmployees = [...new Set(items.map(it => it.employeeName).filter(Boolean))].length;

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Biaya Gaji</h1>
          <p>Pencatatan pembayaran gaji karyawan produksi</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <FiPlus /> Tambah Gaji
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiUsers /></div>
          </div>
          <div className="stat-card-value">{uniqueEmployees}</div>
          <div className="stat-card-label">Jumlah Karyawan</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-card-header">
            <div className="stat-card-icon">📅</div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalMonth)}</div>
          <div className="stat-card-label">Gaji Bulan Ini</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-header">
            <div className="stat-card-icon">💸</div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalAll)}</div>
          <div className="stat-card-label">Total Pembayaran Gaji</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input type="text" placeholder="Cari nama karyawan / jabatan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Nama Karyawan</th>
              <th>Jabatan</th>
              <th>Tipe Gaji</th>
              <th>Periode</th>
              <th style={{ textAlign: 'right' }}>Jumlah</th>
              <th>Catatan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiUsers /></div>
                    <h3>Belum ada data biaya gaji</h3>
                    <p>Klik tombol "Tambah Gaji" untuk mencatat.</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(it => {
              const typeLabel = SALARY_TYPES.find(t => t.value === it.salaryType)?.label || it.salaryType;
              const period = it.periodStart && it.periodEnd
                ? `${formatDateShort(it.periodStart)} – ${formatDateShort(it.periodEnd)}`
                : it.periodStart ? formatDateShort(it.periodStart) : '-';
              return (
                <tr key={it.id}>
                  <td className="text-muted">{formatDateShort(it.date || it.createdAt)}</td>
                  <td><strong>{it.employeeName}</strong></td>
                  <td>{it.position || '-'}</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>
                      {typeLabel}
                    </span>
                  </td>
                  <td className="text-sm text-muted">{period}</td>
                  <td className="text-right" style={{ fontWeight: 600, color: '#4ade80' }}>{formatCurrency(it.amount)}</td>
                  <td className="text-muted text-sm">{it.notes || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(it)}><FiEdit2 /></button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleteId(it.id)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Biaya Gaji' : 'Tambah Biaya Gaji'} size="md">
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Tanggal Pembayaran</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Nama Karyawan</label>
                <input className="form-input" value={form.employeeName} onChange={e => setForm(f => ({ ...f, employeeName: e.target.value }))} placeholder="Nama karyawan" required />
              </div>
              <div className="form-group">
                <label className="form-label">Jabatan / Posisi</label>
                <input className="form-input" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Operator, Mandor..." />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Tipe Gaji</label>
                <select className="form-select" value={form.salaryType} onChange={e => setForm(f => ({ ...f, salaryType: e.target.value }))}>
                  {SALARY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Jumlah (Rp)</label>
                <input className="form-input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Periode Mulai</label>
                <input type="date" className="form-input" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Periode Selesai</label>
                <input type="date" className="form-input" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Catatan</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Catatan tambahan..." rows={2} />
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
        title="Hapus Biaya Gaji"
        message="Apakah Anda yakin ingin menghapus data ini?"
      />
    </div>
  );
}
