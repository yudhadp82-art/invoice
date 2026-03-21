import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiBriefcase, FiDownload, FiUpload, FiFileText } from 'react-icons/fi';
import Modal from '../components/Modal';
import { Suppliers as SupplierStore } from '../utils/storage';
import { exportToExcel, triggerImportExcel, downloadImportTemplate } from '../utils/excel';

const emptySupplier = { name: '', company: '', phone: '', email: '', address: '', notes: '' };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptySupplier);

  useEffect(() => {
    reload();
  }, []);

  async function reload() {
    setSuppliers(await SupplierStore.getAll());
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
    if (confirm('Hapus supplier ini?')) {
      await SupplierStore.delete(id);
      await reload();
    }
  }

  function handleExport() {
    const columns = [
      { key: 'name', header: 'Nama Kontak', width: 25 },
      { key: 'company', header: 'Perusahaan', width: 25 },
      { key: 'phone', header: 'Telepon', width: 18 },
      { key: 'email', header: 'Email', width: 25 },
      { key: 'address', header: 'Alamat', width: 35 },
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
          <p>Kelola daftar supplier dan pemasok barang</p>
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
          <button className="btn btn-primary" onClick={openAdd}>
            <FiPlus /> Tambah Supplier
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input type="text" placeholder="Cari supplier..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nama / Kontak</th>
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
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiBriefcase /></div>
                    <h3>Belum ada supplier</h3>
                    <p>Klik "Tambah Supplier" untuk memasukkan data</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(s => (
              <tr key={s.id}>
                <td><strong>{s.name || '-'}</strong></td>
                <td>{s.company || '-'}</td>
                <td>{s.phone || '-'}</td>
                <td className="text-muted">{s.email || '-'}</td>
                <td className="text-muted text-sm" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address || '-'}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}><FiEdit2 /></button>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(s.id)}><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Supplier' : 'Tambah Supplier'}>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nama Kontak</label>
                <input className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nama penanggung jawab" name="name_1" />
              </div>
              <div className="form-group">
                <label className="form-label">Perusahaan</label>
                <input className="form-input" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Nama PT / CV / Toko" name="company_2" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Telepon</label>
                <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="08xxxxxxxxxx" name="phone_3" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@example.com" name="email_4" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Alamat</label>
              <textarea className="form-textarea" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Alamat lengkap supplier" name="address_6" />
            </div>

            <div className="form-group">
              <label className="form-label">Catatan Tambahan</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Catatan internal..." name="notes_7" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
