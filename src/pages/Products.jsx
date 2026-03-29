import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiPackage, FiDownload, FiUpload, FiFileText, FiFilter } from 'react-icons/fi';
import Modal from '../components/Modal';
import { Products as ProductStore, Customers } from '../utils/storage';
import { formatCurrency, formatNumber, calculateMargin, formatNumberInput } from '../utils/formatter';
import { exportToExcel, triggerImportExcel, downloadImportTemplate } from '../utils/excel';
import ConfirmModal from '../components/ConfirmModal';

const emptyProduct = { name: '', sku: '', category: '', purchaseCost: '', sellPrice: '', stock: '', unit: 'kg', customerId: '' };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState(''); // '' = all, 'global' = global only
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCustomerId, setImportCustomerId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [isCustomUnit, setIsCustomUnit] = useState(false);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    setProducts(await ProductStore.getAll());
    setCustomers(await Customers.getAll());
  }

  function openAdd() {
    setForm(emptyProduct);
    setEditingId(null);
    setIsCustomUnit(false);
    setModalOpen(true);
  }

  function openEdit(product) {
    const safeUnit = product.unit || 'pcs';
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      purchaseCost: product.purchaseCost || 0,
      sellPrice: product.sellPrice || 0,
      stock: product.stock || 0,
      unit: safeUnit,
      customerId: product.customerId || ''
    });
    setEditingId(product.id);
    
    // Check if it's a known unit or custom
    const standardUnits = ['kg', 'gram', 'ons', 'pcs', 'ikat', 'bungkus', 'pack', 'liter', 'ml', 'kardus', 'karung', 'botol', 'renteng'];
    const allKnownUnits = Array.from(new Set([...standardUnits, ...products.map(p => p.unit).filter(u => typeof u === 'string' && u.trim() !== '')]));
    setIsCustomUnit(!allKnownUnits.includes(safeUnit));

    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const data = {
      ...form,
      purchaseCost: Number(form.purchaseCost) || 0,
      sellPrice: Number(form.sellPrice) || 0,
      stock: Number(form.stock) || 0,
      customerId: form.customerId === 'global' ? '' : form.customerId
    };
    if (editingId) {
      await ProductStore.update(editingId, data);
    } else {
      await ProductStore.create(data);
    }
    setModalOpen(false);
    await reload();
  }

  async function handleDelete(id) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await ProductStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  function handleExport() {
    const columns = [
      { key: 'name', header: 'Nama Produk', width: 25 },
      { key: 'sku', header: 'SKU', width: 15 },
      { key: 'category', header: 'Kategori', width: 18 },
      { key: 'purchaseCost', header: 'Modal (Rp)', width: 18 },
      { key: 'sellPrice', header: 'Harga Jual (Rp)', width: 18 },
      { key: 'stock', header: 'Stok', width: 10 },
      { key: 'unit', header: 'Satuan', width: 10 },
      { 
        key: 'customerId', 
        header: 'Untuk Customer', 
        width: 25,
        format: (val) => val ? (customers.find(c => c.id === val)?.name || 'Unknown') : 'Global (Semua Customer)'
      },
    ];
    exportToExcel(filtered, 'produk_export', 'Produk', columns);
  }

  function executeImport() {
    setImportModalOpen(false);
    const columnMap = {
      'Nama Produk': 'name',
      'SKU': 'sku',
      'Kategori': 'category',
      'Modal (Rp)': 'purchaseCost',
      'Harga Jual (Rp)': 'sellPrice',
      'Stok': 'stock',
      'Satuan': 'unit',
    };
    triggerImportExcel(async (data) => {
      let count = 0;
      for (const item of data) {
        if (item.name) {
          await ProductStore.create({
            name: item.name || '',
            sku: item.sku || '',
            category: item.category || '',
            purchaseCost: Number(item.purchaseCost) || 0,
            sellPrice: Number(item.sellPrice) || 0,
            stock: Number(item.stock) || 0,
            unit: item.unit || 'pcs',
            customerId: importCustomerId === 'global' ? '' : importCustomerId
          });
          count++;
        }
      }
      alert(`Berhasil meng-import ${count} produk ke ${importCustomerId && importCustomerId !== 'global' ? 'Customer Terpilih' : 'Daftar Global'}`);
      await reload();
    }, columnMap);
  }

  const filtered = products.filter(p => {
    const safeName = p.name || '';
    const safeSku = p.sku || '';
    const safeCat = p.category || '';
    const matchSearch = safeName.toLowerCase().includes(search.toLowerCase()) ||
                        safeSku.toLowerCase().includes(search.toLowerCase()) ||
                        safeCat.toLowerCase().includes(search.toLowerCase());
    
    let matchCust = true;
    if (filterCustomerId === 'global') {
      matchCust = !p.customerId;
    } else if (filterCustomerId) {
      matchCust = p.customerId === filterCustomerId;
    }
    return matchSearch && matchCust;
  });

  const standardUnits = ['kg', 'gram', 'ons', 'pcs', 'ikat', 'bungkus', 'pack', 'liter', 'ml', 'kardus', 'karung', 'botol', 'renteng'];
  const uniqueUnits = Array.from(new Set([...standardUnits, ...products.map(p => p.unit).filter(u => typeof u === 'string' && u.trim() !== '')]));

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Produk</h1>
          <p>Kelola produk, modal pembelian, harga jual, dan spesifikasi customer</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-ghost" onClick={() => downloadImportTemplate('products')} title="Download Template Excel">
            <FiFileText /> Template
          </button>
          <button className="btn btn-secondary" onClick={() => { setImportCustomerId(''); setImportModalOpen(true); }}>
            <FiUpload /> Import Excel
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            <FiDownload /> Export Excel
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <FiPlus /> Tambah Produk
          </button>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'grid', gridTemplateColumns: '1fr 250px', gap: 'var(--space-md)' }}>
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input 
            type="text"
            placeholder="Cari produk berdasarkan nama, SKU, atau kategori..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-inline gap-sm">
          <div className="search-box" style={{ width: '100%' }}>
            <select className="form-select" value={filterCustomerId} onChange={e => setFilterCustomerId(e.target.value)}>
              <option value="">Semua (Global & Customer)</option>
              <option value="global">Hanya Global</option>
              <option disabled>--- Filter Customer ---</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>Khusus: {c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Produk</th>
              <th style={{ width: '15%' }}>Customer</th>
              <th>SKU</th>
              <th>Kategori</th>
              <th style={{ textAlign: 'right' }}>Harga Jual</th>
              <th style={{ textAlign: 'right', minWidth: '100px' }}>Stok</th>
              <th style={{ textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiPackage /></div>
                    <h3>Belum ada produk</h3>
                    <p>Ubah filter atau klik "Tambah Produk" untuk menambahkan</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(p => {
              const custName = p.customerId ? (customers.find(c => c.id === p.customerId)?.name || 'Unknown') : null;
              return (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="text-muted" style={{ fontSize: 11 }}>{p.unit}</div>
                  </td>
                  <td>
                     {p.customerId ? (
                       <span className="badge badge-info">{custName}</span>
                     ) : (
                       <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>Global</span>
                     )}
                  </td>
                  <td className="text-muted">{p.sku || '-'}</td>
                  <td><span className="badge badge-purple">{p.category || 'Umum'}</span></td>
                  <td className="text-right">
                    <strong>{formatCurrency(p.sellPrice)}</strong>
                    <div className="text-muted" style={{ fontSize: 11 }}>Modal: {formatCurrency(p.purchaseCost)}</div>
                  </td>
                  <td className="text-right">
                    <span style={{ fontWeight: 600, color: p.stock <= 0 ? 'var(--accent-danger)' : 'inherit' }}>
                      {formatNumber(p.stock)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="table-actions" style={{ justifyContent: 'center' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}><FiEdit2 /></button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(p.id)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Editor Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Produk' : 'Tambah Produk'}>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Atribusi Customer
                <span className="text-muted" style={{ fontWeight: 400, fontSize: 11 }}>(Opsional: Biarkan Kosong Untuk Produk Global)</span>
              </label>
              <select className="form-select" value={form.customerId || ''} onChange={e => setForm({...form, customerId: e.target.value})}>
                <option value="">-- [Produk Global] --</option>
                {customers.map(c => <option key={c.id} value={c.id}>Khusus: {c.name}</option>)}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nama Produk</label>
                <input className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nama produk" />
              </div>
              <div className="form-group">
                <label className="form-label">SKU</label>
                <input className="form-input" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} placeholder="Kode SKU" />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <input className="form-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="Kategori" />
              </div>
              <div className="form-group">
                <label className="form-label">Satuan</label>
                {isCustomUnit ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" required autoFocus value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="Ketik satuan baru" />
                    <button type="button" className="btn btn-ghost" onClick={() => { setIsCustomUnit(false); setForm({...form, unit: 'kg'}); }}>Batal</button>
                  </div>
                ) : (
                  <select className="form-select" value={form.unit} onChange={e => {
                    if (e.target.value === 'custom') {
                      setIsCustomUnit(true);
                      setForm({...form, unit: ''});
                    } else {
                      setForm({...form, unit: e.target.value});
                    }
                  }}>
                    {uniqueUnits.map(u => (
                      <option key={u} value={u}>{String(u).charAt(0).toUpperCase() + String(u).slice(1)}</option>
                    ))}
                    <option value="custom">+ Tambah Satuan Baru...</option>
                  </select>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Modal (Rp)</label>
                <input className="form-input" type="text" required value={formatNumberInput(form.purchaseCost)} onChange={e => {
                  const val = e.target.value.replace(/\./g, '').replace(',', '.');
                  if (/^\d*\.?\d*$/.test(val) || val === '') {
                    setForm({...form, purchaseCost: val});
                  }
                }} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Harga Jual (Rp)</label>
                <input className="form-input" type="text" required value={formatNumberInput(form.sellPrice)} onChange={e => {
                  const val = e.target.value.replace(/\./g, '').replace(',', '.');
                  if (/^\d*\.?\d*$/.test(val) || val === '') {
                    setForm({...form, sellPrice: val});
                  }
                }} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Stok</label>
                <input className="form-input" type="text" value={formatNumberInput(form.stock)} onChange={e => {
                  const val = e.target.value.replace(/\./g, '').replace(',', '.');
                  if (/^\d*\.?\d*$/.test(val) || val === '') {
                    setForm({...form, stock: val});
                  }
                }} placeholder="0" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan Produk</button>
          </div>
        </form>
      </Modal>

      {/* Import Settings Modal */}
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title="Import Produk (Excel)">
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: 16 }}>Pilih Atribusi Customer (Untuk semua item di file Excel)</label>
            <label className="flex gap-sm" style={{ marginBottom: 12, cursor: 'pointer', padding: 12, background: 'var(--bg-input)', borderRadius: 8 }}>
              <input type="radio" 
                name="importType" 
                checked={importCustomerId === '' || importCustomerId === 'global'} 
                onChange={() => setImportCustomerId('global')} 
              />
              <div>
                <strong>Daftar Global</strong>
                <p className="text-muted text-sm" style={{ marginTop: 2 }}>Produk tersedia untuk semua customer</p>
              </div>
            </label>
            <label className="flex gap-sm" style={{ cursor: 'pointer', padding: 12, background: 'var(--bg-input)', borderRadius: 8 }}>
              <input type="radio" 
                name="importType" 
                checked={importCustomerId !== '' && importCustomerId !== 'global'} 
                onChange={() => {
                  if (customers.length > 0) setImportCustomerId(customers[0].id);
                }} 
              />
              <div style={{ width: '100%' }}>
                <strong>Khusus Customer</strong>
                <p className="text-muted text-sm" style={{ marginTop: 2, marginBottom: 8 }}>Hanya tersedia saat membuat invoice / pesanan untuk customer ini</p>
                {importCustomerId !== '' && importCustomerId !== 'global' && (
                  <select className="form-select" value={importCustomerId} onChange={e => setImportCustomerId(e.target.value)}>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setImportModalOpen(false)}>Batal</button>
          <button className="btn btn-primary" onClick={executeImport}>
            <FiUpload /> Lanjut Pilih File
          </button>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Hapus Produk"
        message="Apakah Anda yakin ingin menghapus produk ini? Data transaksi yang menggunakan produk ini mungkin akan terpengaruh."
      />
    </div>
  );
}
