import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiTrash2, FiEdit2, FiUsers, FiClock, FiDollarSign } from 'react-icons/fi';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { SalaryCosts as SCStore, Employees as EmployeeStore } from '../utils/storage';
import { formatCurrency, formatDateShort, parseNumberInput } from '../utils/formatter';

const SALARY_TYPES = [
  { value: 'per_jam', label: 'Per Jam' },
  { value: 'harian', label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
  { value: 'bulanan', label: 'Bulanan' },
  { value: 'borongan', label: 'Borongan' },
  { value: 'lembur', label: 'Lembur' },
];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  employeeId: '',
  employeeName: '',
  position: '',
  salaryType: 'per_jam',
  amount: '',
  clockIn: '08:00',
  clockOut: '17:00',
  hourlyRate: '',
  periodStart: '',
  periodEnd: '',
  notes: '',
};

export default function SalaryCostsPage() {
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyForm);
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
      const [data, employeesData] = await Promise.all([
        SCStore.getAll(),
        EmployeeStore.getAll()
      ]);
      setItems(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setEmployees(employeesData);
    } catch (err) {
      console.error('SalaryCosts reload error:', err);
      setError('Gagal memuat data gaji. Silakan periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  }

  function getHoursDelta(inTime, outTime) {
    if (!inTime || !outTime) return 0;
    const [h1, m1] = (inTime || '').split(':').map(Number);
    const [h2, m2] = (outTime || '').split(':').map(Number);
    const total1 = h1 + m1 / 60;
    const total2 = h2 + m2 / 60;
    let diff = total2 - total1;
    if (diff < 0) diff += 24; // Handle overnight shift
    return diff;
  }

  function calculateAutoAmount(updatedForm) {
    if (updatedForm.salaryType === 'per_jam') {
      let hours = getHoursDelta(updatedForm.clockIn, updatedForm.clockOut);
      // Pengurangan otomatis jam istirahat 1 jam
      const breakTime = 1;
      const effectiveHours = Math.max(0, hours - breakTime);
      const rate = Number(updatedForm.hourlyRate) || 0;
      return Math.round(effectiveHours * rate);
    }
    return updatedForm.amount;
  }

  function handleEmployeeChange(id) {
    const emp = employees.find(e => e.id === id);
    if (emp) {
      setForm(prev => {
        const updated = {
          ...prev,
          employeeId: id,
          employeeName: emp.name,
          position: emp.position || '',
          hourlyRate: emp.hourlyRate || '',
        };
        updated.amount = calculateAutoAmount(updated);
        return updated;
      });
    } else {
      setForm(prev => ({ ...prev, employeeId: '', employeeName: '', position: '', hourlyRate: '' }));
    }
  }

  function handleFormChange(field, value) {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (['salaryType', 'clockIn', 'clockOut', 'hourlyRate'].includes(field)) {
        updated.amount = calculateAutoAmount(updated);
      }
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
      employeeId: item.employeeId || '',
      employeeName: item.employeeName || '',
      position: item.position || '',
      salaryType: item.salaryType || 'per_jam',
      amount: item.amount || '',
      clockIn: item.clockIn || '08:00',
      clockOut: item.clockOut || '17:00',
      hourlyRate: item.hourlyRate || '',
      periodStart: item.periodStart || '',
      periodEnd: item.periodEnd || '',
      notes: item.notes || '',
    });
    setEditingId(item.id);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const amount = Number(form.amount) || 0;
    const payload = { 
      ...form, 
      amount,
      hourlyRate: Number(form.hourlyRate) || 0
    };

    if (editingId) {
      await SCStore.update(editingId, payload);
    } else {
      await SCStore.create(payload);
    }
    setModalOpen(false);
    await reload();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await SCStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  const filtered = items.filter(it =>
    (it.employeeName || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.position || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalMonth = items
    .filter(it => {
      const d = new Date(it.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, it) => s + (it.amount || 0), 0);

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Biaya Gaji</h1>
          <p>Pencatatan pembayaran gaji & jam kerja karyawan</p>
        </div>
        <button className="btn btn-primary shadow-glow" onClick={openAdd}>
          <FiPlus /> Tambah Gaji
        </button>
      </div>

      {loading && (
        <div className="card p-xl text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-secondary">Memuat data biaya gaji...</p>
        </div>
      )}

      {error && (
        <div className="card p-xl text-center animate-in" style={{ borderColor: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="stat-card-icon mb-md" style={{ margin: '0 auto', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)' }}>
            <FiDollarSign />
          </div>
          <h3 className="text-danger mb-sm">{error.includes('Permission Denied') ? 'Akses Database Terbatas' : 'Gagal Memuat Data'}</h3>
          <p className="text-secondary mb-lg">
            {error.includes('Permission Denied') 
              ? 'Data gaji ditemukan di database tapi diblokir oleh kebijakan keamanan (RLS) Supabase Anda.'
              : 'Terjadi kesalahan saat memuat data biaya gaji dari database.'}
          </p>
          <button className="btn btn-primary" onClick={reload}>Coba Lagi</button>
        </div>
      )}

      {(!loading && !error) && (
        <>
          <div className="stats-grid">
            <div className="stat-card purple">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiDollarSign /></div>
                <div className="stat-card-trend up">Bulan Ini</div>
              </div>
              <div className="stat-card-value font-mono">{formatCurrency(totalMonth)}</div>
              <div className="stat-card-label">Total Pengeluaran Gaji</div>
            </div>
            
            <div className="stat-card green">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiUsers /></div>
                <div className="stat-card-trend">Aktif</div>
              </div>
              <div className="stat-card-value">{employees.length}</div>
              <div className="stat-card-label">Jumlah Pekerja Terdaftar</div>
            </div>

            <div className="stat-card cyan">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiClock /></div>
              </div>
              <div className="stat-card-value">{items.length}</div>
              <div className="stat-card-label">Total Transaksi Gaji</div>
            </div>
          </div>

          <div className="toolbar bg-glass p-md rounded-lg mb-lg border border-white-05">
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input type="text" placeholder="Cari nama karyawan / jabatan..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="table-container shadow-lg">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nama Karyawan</th>
                  <th>Tipe</th>
                  <th>Detail Kerja</th>
                  <th className="text-right">Total Gaji</th>
                  <th>Catatan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="card p-xl text-center border-dashed" style={{ background: 'transparent' }}>
                        <div className="stat-card-icon mb-md" style={{ margin: '0 auto', background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>
                          <FiUsers />
                        </div>
                        <h3 className="text-secondary">Belum ada data biaya gaji</h3>
                        <p className="text-muted">Klik tombol "Tambah Gaji" untuk mencatat pengeluaran baru.</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(it => {
                  const typeLabel = SALARY_TYPES.find(t => t.value === it.salaryType)?.label || it.salaryType;
                  let detailText = '-';
                  if (it.salaryType === 'per_jam') {
                    detailText = `${it.clockIn} - ${it.clockOut} (${formatCurrency(it.hourlyRate)}/jam)`;
                  } else if (it.periodStart || it.periodEnd) {
                    detailText = `${formatDateShort(it.periodStart)} - ${formatDateShort(it.periodEnd)}`;
                  }

                  return (
                    <tr key={it.id} className="hover-bright transition-fast">
                      <td className="text-muted">{formatDateShort(it.date || it.createdAt)}</td>
                      <td>
                        <div className="font-bold text-primary">{it.employeeName}</div>
                        <div className="text-xs text-muted mt-xs uppercase tracking-wider">{it.position}</div>
                      </td>
                      <td>
                        <span className={`badge ${it.salaryType === 'per_jam' ? 'badge-purple' : 'badge-info'}`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="text-sm text-secondary">{detailText}</td>
                      <td className="text-right font-bold text-success font-mono">
                        {formatCurrency(it.amount)}
                      </td>
                      <td className="text-muted text-sm" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.notes || '-'}
                      </td>
                      <td className="text-right">
                        <div className="table-actions justify-end">
                          <button className="btn btn-ghost btn-sm text-primary" onClick={() => openEdit(it)} title="Edit"><FiEdit2 /></button>
                          <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleteId(it.id)} title="Hapus"><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Biaya Gaji' : 'Tambah Biaya Gaji'} size="md">
        <form onSubmit={handleSave} className="p-lg">
          <div className="grid gap-lg">
            <div className="form-group mb-0">
              <label className="form-label text-xs uppercase tracking-widest opacity-60">Pilih Pekerja</label>
              <select className="form-select bg-glass" value={form.employeeId} onChange={e => handleEmployeeChange(e.target.value)} required>
                <option value="">-- Pilih Nama Pekerja --</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.position || 'Staf'})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-2 gap-md">
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Tanggal</label>
                <input type="date" className="form-input bg-glass" value={form.date} onChange={e => handleFormChange('date', e.target.value)} required />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Tipe Pembayaran</label>
                <select className="form-select bg-glass" value={form.salaryType} onChange={e => handleFormChange('salaryType', e.target.value)}>
                  {SALARY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {form.salaryType === 'per_jam' ? (
              <div className="p-lg rounded-xl border border-white-05 bg-glass animate-in">
                <div className="grid grid-2 gap-md">
                  <div className="form-group">
                    <label className="form-label text-xs"><FiClock className="mr-xs" /> Jam Masuk</label>
                    <input type="time" className="form-input" value={form.clockIn} onChange={e => handleFormChange('clockIn', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label text-xs"><FiClock className="mr-xs" /> Jam Keluar</label>
                    <input type="time" className="form-input" value={form.clockOut} onChange={e => handleFormChange('clockOut', e.target.value)} />
                  </div>
                </div>
                <div className="form-group mb-0">
                  <label className="form-label text-xs"><FiDollarSign className="mr-xs" /> Upah Per Jam</label>
                  <input type="number" className="form-input font-bold" value={form.hourlyRate} onChange={e => handleFormChange('hourlyRate', e.target.value)} placeholder="0" />
                  
                  <div className="mt-md p-md bg-white-05 rounded-lg border border-white-05">
                     <div className="flex-between text-xs opacity-60 mb-xs"><span>Durasi Kerja</span><span>{getHoursDelta(form.clockIn, form.clockOut).toFixed(2)} jam</span></div>
                     <div className="flex-between text-xs text-danger mb-xs"><span>Potongan Istirahat</span><span>-1.00 jam</span></div>
                     <hr className="opacity-05 my-xs" />
                     <div className="flex-between text-sm font-bold text-success"><span>Total Jam Kerja</span><span>{Math.max(0, getHoursDelta(form.clockIn, form.clockOut) - 1).toFixed(2)} jam</span></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-2 gap-md p-md bg-glass rounded-lg border border-white-05">
                <div className="form-group mb-0">
                  <label className="form-label text-xs">Periode Mulai</label>
                  <input type="date" className="form-input" value={form.periodStart} onChange={e => handleFormChange('periodStart', e.target.value)} />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label text-xs">Periode Selesai</label>
                  <input type="date" className="form-input" value={form.periodEnd} onChange={e => handleFormChange('periodEnd', e.target.value)} />
                </div>
              </div>
            )}

            <div className="form-group mb-0">
              <label className="form-label text-xs uppercase tracking-widest opacity-60">Total Gaji (Rp)</label>
              <div className="relative">
                 <input 
                  className="form-input bg-glass p-lg text-2xl font-black text-success" 
                  type="number" 
                  value={form.amount} 
                  onChange={e => handleFormChange('amount', e.target.value)} 
                  placeholder="0" 
                  required 
                  readOnly={form.salaryType === 'per_jam'}
                  style={{ height: 'auto' }}
                />
                {form.salaryType === 'per_jam' && (
                  <div className="text-xxs text-info mt-xs flex items-center gap-xs">
                    <FiInfo /> Terhitung otomatis dari jam kerja
                  </div>
                )}
              </div>
            </div>

            <div className="form-group mb-0">
              <label className="form-label text-xs uppercase tracking-widest opacity-60">Catatan</label>
              <textarea className="form-input bg-glass" value={form.notes} onChange={e => handleFormChange('notes', e.target.value)} placeholder="Catatan tambahan..." rows={2} />
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
        title="Hapus Biaya Gaji"
        message="Apakah Anda yakin ingin menghapus catatan gaji ini?"
      />
    </div>
  );
}
