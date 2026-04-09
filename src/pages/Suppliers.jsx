import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiBriefcase, FiDownload, FiUpload, FiFileText } from 'react-icons/fi';
import Modal from '../components/Modal';
import { Suppliers as SupplierStore } from '../utils/storage';
import { exportToExcel, triggerImportExcel, downloadImportTemplate } from '../utils/excel';
import ConfirmModal from '../components/ConfirmModal';

const emptySupplier = { name: '', company: '', phone: '', email: '', address: '', notes: '', bankName: '', accountName: '', accountNumber: '' };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptySupplier);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    reload();
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setSuppliers(await SupplierStore.getAll());
    } catch (err) {
      console.error('Suppliers reload error:', err);
      setError(err.message || 'Gagal memuat data supplier.');
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setForm({ ...emptySupplier });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(supplier) {
    setForm({
      name: supplier.name,
      company: supplier.company || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      bankName: supplier.bankName || '',
      accountName: supplier.accountName || '',
      accountNumber: supplier.accountNumber || '',
    });
    setEditingId(supplier.id);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (editingId) {
      await SupplierStore.update(editingId, form);
    } else {
      await SupplierStore.create(form);
    }
    setModalOpen(false);
    await reload();
  }

  async function handleDelete(id) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await SupplierStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  function handleExport() {
    const columns = [
      { key: 'name', header: 'Nama Kontak', width: 25 },
      { key: 'company', header: 'Perusahaan', width: 25 },
      { key: 'phone', header: 'Telepon', width: 18 },
      { key: 'email', header: 'Email', width: 25 },
      { key: 'address', header: 'Alamat', width: 35 },
      { key: 'bankName', header: 'Bank', width: 15 },
      { key: 'accountName', header: 'Atas Nama', width: 20 },
      { key: 'accountNumber', header: 'No Rekening', width: 20 },
      { key: 'notes', header: 'Catatan', width: 30 },
    ];
    exportToExcel(filtered, 'supplier_export', 'Supplier', columns);
  }

  function handleImport() {
    const columnMap = {
      'Nama Kontak': 'name',
      'Perusahaan': 'company',
      'Telepon': 'phone',
      'Email': 'email',
      'Alamat': 'address',
      'Catatan': 'notes',
    };
    triggerImportExcel(async (data) => {
      let count = 0;
      for (const item of data) {
        if (item.name || item.company) {
          await SupplierStore.create({
            name: item.name || '',
            company: item.company || '',
            phone: String(item.phone || ''),
            email: item.email || '',
            address: item.address || '',
            notes: item.notes || '',
          });
          count++;
        }
      }
      alert(`Berhasil import ${count} supplier`);
      await reload();
    }, columnMap);
  }

  const filtered = suppliers.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').includes(search)
  );

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Supplier</h1>
          <p>Kelola daftar supplier dan pemasok bahan baku</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-ghost" onClick={() => downloadImportTemplate('suppliers')} title="Download Template Excel">
            <FiFileText /> Template
          </button>
          <button className="btn btn-secondary" onClick={handleImport}>
            <FiUpload /> Import Excel
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            <FiDownload /> Export Excel
          </button>
          <button className="btn btn-primary shadow-glow" onClick={openAdd}>
            <FiPlus /> Tambah Supplier
          </button>
        </div>
      </div>

      {loading && (
        <div className="card p-xl text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-secondary">Memuat data supplier...</p>
        </div>
      )}

      {error && (
        <div className="card p-xl text-center animate-in" style={{ borderColor: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="stat-card-icon mb-md" style={{ margin: '0 auto', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)' }}>
            <FiBriefcase />
          </div>
          <h3 className="text-danger mb-sm">Gagal Memuat Data</h3>
          <p className="text-secondary mb-lg">{error}</p>
          <button className="btn btn-primary" onClick={reload}>Coba Lagi</button>
        </div>
      )}

      {(!loading && !error) && (
        <>
          <div className="stats-grid">
            <div className="stat-card purple">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiBriefcase /></div>
              </div>
              <div className="stat-card-value">{suppliers.length}</div>
              <div className="stat-card-label">Total Supplier</div>
            </div>
            
            <div className="stat-card cyan">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiSearch /></div>
              </div>
              <div className="stat-card-value">{filtered.length}</div>
              <div className="stat-card-label">Jumlah Terfilter</div>
            </div>
          </div>

          <div className="toolbar bg-glass p-md rounded-lg mb-lg border border-white-05">
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input type="text" placeholder="Cari supplier atau kontak..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="table-container shadow-lg">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Kontak</th>
                  <th>Perusahaan</th>
                  <th>Telepon</th>
                  <th>Email</th>
                  <th>Alamat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="card p-xl text-center border-dashed" style={{ background: 'transparent' }}>
                        <div className="stat-card-icon mb-md" style={{ margin: '0 auto', background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>
                          <FiBriefcase />
                        </div>
                        <h3 className="text-secondary">Belum ada supplier</h3>
                        <p className="text-muted">Klik tombol "Tambah Supplier" untuk memasukkan data baru.</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(s => (
                  <tr key={s.id} className="hover-bright transition-fast">
                    <td>
                      <div className="font-bold text-primary">{s.name || '-'}</div>
                    </td>
                    <td>
                      <span className="badge badge-info">{s.company || '-'}</span>
                    </td>
                    <td className="text-secondary font-mono">{s.phone || '-'}</td>
                    <td className="text-muted text-sm">{s.email || '-'}</td>
                    <td className="text-muted text-sm" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.address || '-'}
                    </td>
                    <td className="text-right">
                      <div className="table-actions justify-end">
                        <button className="btn btn-ghost btn-sm text-primary" onClick={() => openEdit(s)} title="Edit"><FiEdit2 /></button>
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(s.id)} title="Hapus"><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Supplier' : 'Tambah Supplier'} size="md">
        <form onSubmit={handleSave} className="p-lg">
          <div className="grid gap-lg">
            <div className="grid grid-2 gap-md">
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Nama Kontak</label>
                <input className="form-input bg-glass" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Penanggung jawab" />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Perusahaan</label>
                <input className="form-input bg-glass" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Nama PT/CV/Toko" />
              </div>
            </div>

            <div className="grid grid-2 gap-md">
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Telepon</label>
                <input className="form-input bg-glass font-mono" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="08xxxxxxxxxx" />
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-xs uppercase tracking-widest opacity-60">Email</label>
                <input className="form-input bg-glass" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="supplier@example.com" />
              </div>
            </div>

            <div className="form-group mb-0">
              <label className="form-label text-xs uppercase tracking-widest opacity-60">Alamat</label>
              <textarea className="form-input bg-glass" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Alamat lengkap..." rows={2} />
            </div>

            <div className="p-lg rounded-xl border border-indigo-500-20 bg-indigo-500-05 shadow-sm">
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-md flex items-center gap-xs">
                <FiBriefcase /> Informasi Rekening Bank
              </div>
              <div className="form-group mb-md">
                <label className="form-label text-xs opacity-60">Nama Bank</label>
                <input className="form-input bg-white-05 border-white-10" value={form.bankName} onChange={e => setForm({...form, bankName: e.target.value})} placeholder="Contoh: BCA, Mandiri, BRI" />
              </div>
              <div className="grid grid-2 gap-md">
                <div className="form-group mb-0">
                  <label className="form-label text-xs opacity-60">Nama Pemilik Akun</label>
                  <input className="form-input bg-white-05 border-white-10" value={form.accountName} onChange={e => setForm({...form, accountName: e.target.value})} placeholder="Nama di buku tabungan" />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label text-xs opacity-60">Nomor Rekening</label>
                  <input className="form-input bg-white-05 border-white-10 font-bold" value={form.accountNumber} onChange={e => setForm({...form, accountNumber: e.target.value})} placeholder="Digit rekening" />
                </div>
              </div>
            </div>

            <div className="form-group mb-0">
              <label className="form-label text-xs uppercase tracking-widest opacity-60">Catatan Interal</label>
              <textarea className="form-input bg-glass" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Catatan tambahan (opsional)..." rows={2} />
            </div>
          </div>
          <div className="modal-footer mt-xl pt-lg border-top border-white-05">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary shadow-glow px-xl">Simpan Supplier</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Hapus Supplier"
        message="Menghapus supplier tidak akan menghapus riwayat transaksi pembelian terkait."
      />
    </div>
  );
}
