import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiTrash2, FiEdit2, FiUsers, FiClock, FiDollarSign } from 'react-icons/fi';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { SalaryCosts as Store, Employees as EmployeeStore } from '../utils/storage';
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

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    const data = await Store.getAll();
    setItems(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    setEmployees(await EmployeeStore.getAll());
  }

  function getHoursDelta(inTime, outTime) {
    if (!inTime || !outTime) return 0;
    const [h1, m1] = inTime.split(':').map(Number);
    const [h2, m2] = outTime.split(':').map(Number);
    const total1 = h1 + m1 / 60;
    const total2 = h2 + m2 / 60;
    let diff = total2 - total1;
    if (diff < 0) diff += 24; // Handle overnight shift
    return diff;
  }

  function calculateAutoAmount(updatedForm) {
    if (updatedForm.salaryType === 'per_jam') {
      const hours = getHoursDelta(updatedForm.clockIn, updatedForm.clockOut);
      const rate = Number(updatedForm.hourlyRate) || 0;
      return Math.round(hours * rate);
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
          <p>Pencatatan pembayaran gaji &amp; jam kerja karyawan</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <FiPlus /> Tambah Gaji
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card orange">
          <div className="stat-card-header">
            <div className="stat-card-icon">📅</div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalMonth)}</div>
          <div className="stat-card-label">Total Gaji Bulan Ini</div>
        </div>
        <div className="stat-card green">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiUsers /></div>
          </div>
          <div className="stat-card-value">{employees.length}</div>
          <div className="stat-card-label">Jumlah Pekerja Terdaftar</div>
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
              <th>Tipe</th>
              <th>Detail Kerja</th>
              <th style={{ textAlign: 'right' }}>Total Gaji</th>
              <th>Catatan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiUsers /></div>
                    <h3>Belum ada data biaya gaji</h3>
                    <p>Klik tombol "Tambah Gaji" untuk mencatat.</p>
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
                <tr key={it.id}>
                  <td className="text-muted">{formatDateShort(it.date || it.createdAt)}</td>
                  <td>
                    <strong>{it.employeeName}</strong>
                    <div className="text-xs text-muted">{it.position}</div>
                  </td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                      {typeLabel}
                    </span>
                  </td>
                  <td className="text-sm text-muted">{detailText}</td>
                  <td className="text-right" style={{ fontWeight: 600, color: '#4ade80' }}>
                    {formatCurrency(it.amount)}
                  </td>
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
              <label className="form-label">Pilih Pekerja</label>
              <select className="form-select" value={form.employeeId} onChange={e => handleEmployeeChange(e.target.value)} required>
                <option value="">-- Pilih Nama Pekerja --</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.position || 'Staf'})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Tanggal</label>
                <input type="date" className="form-input" value={form.date} onChange={e => handleFormChange('date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Tipe Pembayaran</label>
                <select className="form-select" value={form.salaryType} onChange={e => handleFormChange('salaryType', e.target.value)}>
                  {SALARY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {form.salaryType === 'per_jam' ? (
              <div className="animate-in" style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label"><FiClock /> Jam Masuk</label>
                    <input type="time" className="form-input" value={form.clockIn} onChange={e => handleFormChange('clockIn', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label"><FiClock /> Jam Keluar</label>
                    <input type="time" className="form-input" value={form.clockOut} onChange={e => handleFormChange('clockOut', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label"><FiDollarSign /> Upah Per Jam</label>
                  <input type="number" className="form-input" value={form.hourlyRate} onChange={e => handleFormChange('hourlyRate', e.target.value)} placeholder="0" />
                  <div className="text-xs text-muted mt-xs">
                    Durasi: {getHoursDelta(form.clockIn, form.clockOut).toFixed(2)} jam
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Periode Mulai</label>
                  <input type="date" className="form-input" value={form.periodStart} onChange={e => handleFormChange('periodStart', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Periode Selesai</label>
                  <input type="date" className="form-input" value={form.periodEnd} onChange={e => handleFormChange('periodEnd', e.target.value)} />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Total Gaji (Rp)</label>
              <input 
                className="form-input" 
                type="number" 
                value={form.amount} 
                onChange={e => handleFormChange('amount', e.target.value)} 
                placeholder="0" 
                required 
                style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4ade80' }}
                readOnly={form.salaryType === 'per_jam'}
              />
              {form.salaryType === 'per_jam' && <div className="text-xs text-muted mt-xs">* Terhitung otomatis dari jam kerja</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Catatan</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => handleFormChange('notes', e.target.value)} placeholder="Catatan tambahan..." rows={2} />
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
        message="Apakah Anda yakin ingin menghapus catatan gaji ini?"
      />
    </div>
  );
}
