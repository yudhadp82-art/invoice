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
          <p>Kelola data karyawan dan upah per jam kerja</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={handleExport}>
            <FiDownload /> Export Excel
          </button>
          <button className="btn btn-primary shadow-glow" onClick={openAdd}>
            <FiPlus /> Tambah Pekerja
          </button>
        </div>
      </div>

      {loading && (
        <div className="card p-xl text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-secondary">Memuat data pekerja...</p>
        </div>
      )}

      {error && (
        <div className="card p-xl text-center animate-in" style={{ borderColor: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="stat-card-icon mb-md" style={{ margin: '0 auto', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)' }}>
            <FiUsers />
          </div>
          <h3 className="text-danger mb-sm">Gagal Memuat Data</h3>
          <p className="text-secondary mb-lg">{error}</p>
          <button className="btn btn-primary" onClick={reload}>Coba Lagi</button>
        </div>
      )}

      {(!loading && !error) && (
        <>
          <div className="stats-grid">
            <div className="stat-card blue">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiUsers /></div>
              </div>
              <div className="stat-card-value">{employees.length}</div>
              <div className="stat-card-label">Total Pekerja</div>
            </div>
            
            <div className="stat-card cyan">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiSearch /></div>
              </div>
              <div className="stat-card-value">{filtered.length}</div>
              <div className="stat-card-label">Pekerja Terfilter</div>
            </div>
          </div>

          <div className="toolbar bg-glass p-md rounded-lg mb-lg border border-white-05">
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input type="text" placeholder="Cari nama, jabatan, atau telepon..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="table-container shadow-lg">
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
                      <div className="card p-xl text-center border-dashed" style={{ background: 'transparent' }}>
                        <div className="stat-card-icon mb-md" style={{ margin: '0 auto', background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>
                          <FiUsers />
                        </div>
                        <h3 className="text-secondary">Belum ada data pekerja</h3>
                        <p className="text-muted">Klik tombol "Tambah Pekerja" untuk memasukkan data baru.</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(e => (
                  <tr key={e.id} className="hover-bright transition-fast">
                    <td>
                      <div className="font-bold text-primary">{e.name || '-'}</div>
                    </td>
                    <td>
                      <span className="badge badge-purple">{e.position || 'Staf'}</span>
                    </td>
                    <td className="font-bold text-success font-mono">
                      {formatCurrency(e.hourlyRate)}
                    </td>
                    <td className="text-secondary">{e.phone || '-'}</td>
                    <td className="text-muted text-sm" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.notes || '-'}
                    </td>
                    <td className="text-right">
                      <div className="table-actions justify-end">
                        <button className="btn btn-ghost btn-sm text-primary" onClick={() => openEdit(e)} title="Edit"><FiEdit2 /></button>
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(e.id)} title="Hapus"><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Pekerja' : 'Tambah Pekerja'} size="md" closeOnOverlay={false} closeOnEsc={true}>
        <form onSubmit={handleSave} className="p-lg">
          <div className="grid gap-lg">
            <div className="form-group mb-0">
              <label className="form-label text-xs uppercase tracking-widest opacity-60">Nama Pekerja</label>
              <input className="form-input bg-glass" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nama lengkap karyawan" />
            </div>
            
            <div className="grid grid-2 gap-md">
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Jabatan</label>
                <input className="form-input bg-glass" value={form.position} onChange={e => setForm({...form, position: e.target.value})} placeholder="Misal: Produksi, Admin" />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Upah Standar / Jam (Rp)</label>
                <input className="form-input bg-glass font-bold text-success" type="number" value={form.hourlyRate} onChange={e => setForm({...form, hourlyRate: e.target.value})} placeholder="0" />
              </div>
            </div>

            <div className="form-group mb-0">
              <label className="form-label text-xs uppercase tracking-widest opacity-60">Nomor Telepon</label>
              <input className="form-input bg-glass" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="08xxxxxxxxxx" />
            </div>

            <div className="form-group mb-0">
              <label className="form-label text-xs uppercase tracking-widest opacity-60">Catatan</label>
              <textarea className="form-input bg-glass" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Catatan tambahan..." rows={3} />
            </div>
          </div>
          <div className="modal-footer mt-xl pt-lg border-top border-white-05">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary shadow-glow px-xl">Simpan Data</button>
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
