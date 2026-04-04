import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUsers, FiDownload, FiUpload, FiFileText } from 'react-icons/fi';
import Modal from '../components/Modal';
import { Employees as EmployeeStore } from '../utils/storage';
import { exportToExcel, triggerImportExcel, downloadImportTemplate } from '../utils/excel';
import ConfirmModal from '../components/ConfirmModal';
import { formatCurrency } from '../utils/formatter';

const emptyEmployee = { name: '', position: '', hourlyRate: 0, phone: '', notes: '' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyEmployee);
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
      setEmployees(await EmployeeStore.getAll());
    } catch (err) {
      console.error('Employees reload error:', err);
      setError('Gagal memuat data pekerja. Silakan periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setForm({ ...emptyEmployee });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(employee) {
    setForm({
      name: employee.name,
      position: employee.position || '',
      hourlyRate: employee.hourlyRate || 0,
      phone: employee.phone || '',
      notes: employee.notes || '',
    });
    setEditingId(employee.id);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const payload = { 
      ...form, 
      hourlyRate: Number(form.hourlyRate) || 0 
    };
    
    if (editingId) {
      await EmployeeStore.update(editingId, payload);
    } else {
      await EmployeeStore.create(payload);
    }
    setModalOpen(false);
    await reload();
  }

  async function handleDelete(id) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await EmployeeStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  function handleExport() {
    const columns = [
      { key: 'name', header: 'Nama Pekerja', width: 25 },
      { key: 'position', header: 'Jabatan', width: 20 },
      { key: 'hourlyRate', header: 'Upah/Jam', width: 15 },
      { key: 'phone', header: 'Telepon', width: 18 },
      { key: 'notes', header: 'Catatan', width: 30 },
    ];
    exportToExcel(filtered, 'employee_export', 'Pekerja', columns);
  }

  const filtered = employees.filter(e =>
    (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.position || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.phone || '').includes(search)
  );

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Daftar Pekerja</h1>
          <p>Kelola data karyawan dan upah per jam</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={handleExport}>
            <FiDownload /> Export Excel
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <FiPlus /> Tambah Pekerja
          </button>
        </div>
      </div>

      {loading && (
        <div className="card p-lg text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-muted">Memuat data pekerja...</p>
        </div>
      )}

      {error && (
        <div className="card p-lg text-center animate-in" style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="empty-state-icon" style={{ color: '#ef4444' }}><FiUsers /></div>
          <h3 className="text-danger">{error.includes('Permission Denied') ? 'Akses Database Terbatas (RLS)' : 'Gagal Memuat Data'}</h3>
          <p className="mb-md">
            {error.includes('Permission Denied') 
              ? 'Data pekerja ditemukan di database tapi diblokir oleh kebijakan keamanan (RLS) Supabase Anda.'
              : 'Terjadi kesalahan saat memuat data pekerja dari database.'}
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
          <div className="toolbar">
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input type="text" placeholder="Cari pekerja..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Pekerja</th>
                  <th>Jabatan</th>
                  <th>Upah / Jam</th>
                  <th>Telepon</th>
                  <th>Catatan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-state-icon"><FiUsers /></div>
                        <h3>Belum ada data pekerja</h3>
                        <p>Klik "Tambah Pekerja" untuk memasukkan data</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(e => (
                  <tr key={e.id}>
                    <td><strong>{e.name || '-'}</strong></td>
                    <td>{e.position || '-'}</td>
                    <td style={{ color: '#4ade80', fontWeight: 600 }}>{formatCurrency(e.hourlyRate)}</td>
                    <td>{e.phone || '-'}</td>
                    <td className="text-muted text-sm">{e.notes || '-'}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}><FiEdit2 /></button>
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(e.id)}><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Pekerja' : 'Tambah Pekerja'}>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Nama Pekerja</label>
              <input className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nama lengkap" />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Jabatan</label>
                <input className="form-input" value={form.position} onChange={e => setForm({...form, position: e.target.value})} placeholder="Misal: Operator Produksi" />
              </div>
              <div className="form-group">
                <label className="form-label">Upah Standar Per Jam (Rp)</label>
                <input className="form-input" type="number" value={form.hourlyRate} onChange={e => setForm({...form, hourlyRate: e.target.value})} placeholder="0" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nomor Telepon</label>
              <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="08xxxxxxxxxx" />
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
        title="Hapus Pekerja"
        message="Apakah Anda yakin ingin menghapus data pekerja ini?"
      />
    </div>
  );
}
