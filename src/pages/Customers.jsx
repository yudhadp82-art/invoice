import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUsers, FiDownload, FiUpload, FiFileText } from 'react-icons/fi';
import Modal from '../components/Modal';
import { Customers as CustomerStore, PriceCategories as CategoryStore } from '../utils/storage';
import { exportToExcel, triggerImportExcel, downloadImportTemplate } from '../utils/excel';
import ConfirmModal from '../components/ConfirmModal';

const emptyCustomer = { name: '', company: '', phone: '', email: '', address: '', priceCategoryId: 'cat-retail' };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [priceCategories, setPriceCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyCustomer);

  useEffect(() => {
    reload();
  }, []);

  async function reload() {
    setCustomers(await CustomerStore.getAll());
    setPriceCategories(await CategoryStore.getAll());
  }

  function getCategoryName(id) {
    const cat = priceCategories.find(c => c.id === id);
    return cat ? cat.name : 'Retail (Default)';
  }

  function openAdd() {
    setForm({ ...emptyCustomer, priceCategoryId: priceCategories.length > 0 ? priceCategories[0].id : 'cat-retail' });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(customer) {
    setForm({
      name: customer.name,
      company: customer.company || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      priceCategoryId: customer.priceCategoryId || 'cat-retail',
    });
    setEditingId(customer.id);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (editingId) {
      await CustomerStore.update(editingId, form);
    } else {
      await CustomerStore.create(form);
    }
    setModalOpen(false);
    await reload();
  }

  async function handleDelete(id) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await CustomerStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  function handleExport() {
    const columns = [
      { key: 'name', header: 'Nama', width: 25 },
      { key: 'company', header: 'Perusahaan', width: 25 },
      { key: 'phone', header: 'Telepon', width: 18 },
      { key: 'email', header: 'Email', width: 25 },
      { key: 'address', header: 'Alamat', width: 35 },
      { key: 'priceCategoryId', header: 'Kategori Harga', width: 20, format: (v) => getCategoryName(v) },
    ];
    exportToExcel(filtered, 'customer_export', 'Customer', columns);
  }

  function handleImport() {
    const columnMap = {
      'Nama': 'name',
      'Perusahaan': 'company',
      'Telepon': 'phone',
      'Email': 'email',
      'Alamat': 'address',
      'Kategori Harga': 'categoryName',
    };
    triggerImportExcel(async (data) => {
      let count = 0;
      for (const item of data) {
        if (item.name) {
          // Find category ID by name (case insensitive), fallback to cat-retail
          let matchCatId = 'cat-retail';
          if (item.categoryName) {
            const match = priceCategories.find(c => c.name.toLowerCase() === item.categoryName.toLowerCase());
            if (match) matchCatId = match.id;
          }

          await CustomerStore.create({
            name: item.name || '',
            company: item.company || '',
            phone: String(item.phone || ''),
            email: item.email || '',
            address: item.address || '',
            priceCategoryId: matchCatId,
          });
          count++;
        }
      }
      alert(`Berhasil import ${count} customer`);
      await reload();
    }, columnMap);
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Customer</h1>
          <p>Kelola customer dan tetapkan list kategori harga</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-ghost" onClick={() => downloadImportTemplate('customers')} title="Download Template Excel">
            <FiFileText /> Template
          </button>
          <button className="btn btn-secondary" onClick={handleImport}>
            <FiUpload /> Import Excel
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            <FiDownload /> Export Excel
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <FiPlus /> Tambah Customer
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input type="text" placeholder="Cari customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Perusahaan</th>
              <th>Telepon</th>
              <th>Kategori Harga</th>
              <th>Alamat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiUsers /></div>
                    <h3>Belum ada customer</h3>
                  </div>
                </td>
              </tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td className="text-muted">{c.company || '-'}</td>
                <td>{c.phone || '-'}</td>
                <td><span className="badge badge-purple">{getCategoryName(c.priceCategoryId)}</span></td>
                <td className="text-muted text-sm" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || '-'}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}><FiEdit2 /></button>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(c.id)}><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Customer' : 'Tambah Customer'}>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nama</label>
                <input className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nama customer" name="name_1" />
              </div>
              <div className="form-group">
                <label className="form-label">Perusahaan</label>
                <input className="form-input" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Nama perusahaan" name="company_2" />
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
              <label className="form-label">Kategori Harga (Price List)</label>
              <select className="form-select" value={form.priceCategoryId} onChange={e => setForm({...form, priceCategoryId: e.target.value})} name="priceCategoryId_5">
                {priceCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <p className="text-sm text-muted mt-sm">Harga produk otomatis mengikuti daftar harga di kategori ini.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Alamat</label>
              <textarea className="form-textarea" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Alamat lengkap" name="address_6" />
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
        title="Hapus Customer"
        message="Apakah Anda yakin ingin menghapus customer ini?"
      />
    </div>
  );
}
