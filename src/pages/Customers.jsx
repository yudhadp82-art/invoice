import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUsers, FiDownload, FiUpload, FiFileText, FiGitMerge, FiEdit3, FiRefreshCw } from 'react-icons/fi';
import Modal from '../components/Modal';
import { Customers as CustomerStore, PriceCategories as CategoryStore, Invoices, PurchaseNotes, TelegramOrders } from '../utils/storage';
import { exportToExcel, triggerImportExcel, downloadImportTemplate } from '../utils/excel';
import ConfirmModal from '../components/ConfirmModal';

const emptyCustomer = { name: '', company: '', phone: '', email: '', address: '', priceCategoryId: 'cat-retail', group: '' };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [priceCategories, setPriceCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Merge customer state
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [sourceCustomer, setSourceCustomer] = useState(null);
  const [targetCustomer, setTargetCustomer] = useState(null);
  const [mergeContactInfo, setMergeContactInfo] = useState(true);
  const [isMerging, setIsMerging] = useState(false);

  // Rename customer state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [customerToRename, setCustomerToRename] = useState(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Fix SPPG names state
  const [isFixingSppg, setIsFixingSppg] = useState(false);

  useEffect(() => {
    reload();
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [allCusts, allCats] = await Promise.all([
        CustomerStore.getAll(),
        CategoryStore.getAll()
      ]);
      setCustomers(allCusts);
      setPriceCategories(allCats);
    } catch (err) {
      console.error('Customers reload error:', err);
      setError('Gagal memuat data pelanggan. Silakan periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  }

  // Collect existing group names for datalist suggestions
  const groupNames = [...new Set(customers.map(c => c.group).filter(Boolean))].sort();

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
      group: customer.group || '',
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

  // Merge customer functions
  function openMergeModal() {
    setSourceCustomer(null);
    setTargetCustomer(null);
    setMergeModalOpen(true);
  }

  async function handleMerge() {
    if (!sourceCustomer || !targetCustomer) {
      alert('Pilih customer sumber dan target!');
      return;
    }

    if (sourceCustomer.id === targetCustomer.id) {
      alert('Customer sumber dan target tidak boleh sama!');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menggabungkan:\n\n"${sourceCustomer.name}" ke "${targetCustomer.name}"?\n\nIni akan:\n- Update semua invoice yang menggunakan customer sumber\n- Update semua nota pembelian yang menggunakan customer sumber\n- Update semua telegram order yang menggunakan customer sumber\n- Hapus customer sumber\n- ${mergeContactInfo ? 'Menggabungkan informasi kontak' : 'Menjaga informasi kontak target'}`)) {
      return;
    }

    setIsMerging(true);
    try {
      // 1. Gabungkan informasi kontak jika diaktifkan
      if (mergeContactInfo) {
        const updatedContact = {
          ...targetCustomer,
          phone: targetCustomer.phone || sourceCustomer.phone,
          email: targetCustomer.email || sourceCustomer.email,
          address: targetCustomer.address || sourceCustomer.address,
          company: targetCustomer.company || sourceCustomer.company,
          notes: [
            targetCustomer.notes || '',
            sourceCustomer.notes || '',
            `Digabungkan dari "${sourceCustomer.name}" pada ${new Date().toLocaleDateString('id-ID')}`
          ].filter(Boolean).join('\n\n---\n\n')
        };
        await CustomerStore.update(targetCustomer.id, updatedContact);
      }

      // 2. Update semua invoice
      const allInvoices = await Invoices.getAll();
      const invoicesToUpdate = allInvoices.filter(inv =>
        inv.customerName === sourceCustomer.name || inv.customerId === sourceCustomer.id
      );

      for (const invoice of invoicesToUpdate) {
        await Invoices.update(invoice.id, {
          customerName: targetCustomer.name,
          customerId: targetCustomer.id
        });
      }

      // 3. Update semua purchase notes
      const allPurchaseNotes = await PurchaseNotes.getAll();
      const purchaseNotesToUpdate = allPurchaseNotes.filter(note =>
        note.customerName === sourceCustomer.name
      );

      for (const note of purchaseNotesToUpdate) {
        await PurchaseNotes.update(note.id, {
          customerName: targetCustomer.name
        });
      }

      // 4. Update semua telegram orders
      const allTelegramOrders = await TelegramOrders.getAll();
      const telegramOrdersToUpdate = allTelegramOrders.filter(order =>
        order.matchedCustomerName === sourceCustomer.name || order.matchedCustomerId === sourceCustomer.id
      );

      for (const order of telegramOrdersToUpdate) {
        await TelegramOrders.update(order.id, {
          matchedCustomerName: targetCustomer.name,
          matchedCustomerId: targetCustomer.id
        });
      }

      // 5. Hapus customer sumber
      await CustomerStore.delete(sourceCustomer.id);

      const totalAffected = invoicesToUpdate.length + purchaseNotesToUpdate.length + telegramOrdersToUpdate.length;
      alert(`✅ Berhasil menggabungkan ${totalAffected} record:\n- ${invoicesToUpdate.length} invoice\n- ${purchaseNotesToUpdate.length} nota pembelian\n- ${telegramOrdersToUpdate.length} telegram order\n\ndari customer "${sourceCustomer.name}" ke "${targetCustomer.name}"`);

      setMergeModalOpen(false);
      await reload();
    } catch (error) {
      console.error('Error merging customers:', error);
      alert(`Gagal menggabungkan customer: ${error.message}`);
    } finally {
      setIsMerging(false);
    }
  }

  // Rename customer functions
  function openRenameModal(customer) {
    setCustomerToRename(customer);
    setNewCustomerName(customer.name);
    setRenameModalOpen(true);
  }

  async function handleRename() {
    if (!customerToRename || !newCustomerName.trim()) {
      alert('Pilih customer dan masukkan nama baru!');
      return;
    }

    const trimmedName = newCustomerName.trim();

    if (trimmedName === customerToRename.name) {
      alert('Nama baru tidak boleh sama dengan nama lama!');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin mengubah nama customer:\n\n"${customerToRename.name}" → "${trimmedName}"?\n\nIni akan mengupdate:\n- Nama customer\n- Semua invoice yang menggunakan customer ini\n- Semua nota pembelian yang menggunakan customer ini\n- Semua telegram order yang menggunakan customer ini`)) {
      return;
    }

    setIsRenaming(true);
    try {
      // 1. Update nama customer
      await CustomerStore.update(customerToRename.id, {
        name: trimmedName,
        notes: [
          customerToRename.notes || '',
          `Nama diubah dari "${customerToRename.name}" menjadi "${trimmedName}" pada ${new Date().toLocaleDateString('id-ID')}`
        ].filter(Boolean).join('\n\n---\n\n')
      });

      // 2. Update semua invoice
      const allInvoices = await Invoices.getAll();
      const invoicesToUpdate = allInvoices.filter(inv =>
        inv.customerName === customerToRename.name || inv.customerId === customerToRename.id
      );

      for (const invoice of invoicesToUpdate) {
        await Invoices.update(invoice.id, {
          customerName: trimmedName
        });
      }

      // 3. Update semua purchase notes
      const allPurchaseNotes = await PurchaseNotes.getAll();
      const purchaseNotesToUpdate = allPurchaseNotes.filter(note =>
        note.customerName === customerToRename.name
      );

      for (const note of purchaseNotesToUpdate) {
        await PurchaseNotes.update(note.id, {
          customerName: trimmedName
        });
      }

      // 4. Update semua telegram orders
      const allTelegramOrders = await TelegramOrders.getAll();
      const telegramOrdersToUpdate = allTelegramOrders.filter(order =>
        order.matchedCustomerName === customerToRename.name || order.matchedCustomerId === customerToRename.id
      );

      for (const order of telegramOrdersToUpdate) {
        await TelegramOrders.update(order.id, {
          matchedCustomerName: trimmedName
        });
      }

      const totalAffected = invoicesToUpdate.length + purchaseNotesToUpdate.length + telegramOrdersToUpdate.length;
      alert(`✅ Berhasil mengubah nama customer!\n\nNama: "${customerToRename.name}" → "${trimmedName}"\n\nTotal ${totalAffected} record diupdate:\n- ${invoicesToUpdate.length} invoice\n- ${purchaseNotesToUpdate.length} nota pembelian\n- ${telegramOrdersToUpdate.length} telegram order`);

      setRenameModalOpen(false);
      await reload();
    } catch (error) {
      console.error('Error renaming customer:', error);
      alert(`Gagal mengubah nama customer: ${error.message}`);
    } finally {
      setIsRenaming(false);
    }
  }

  // Fix SPPG names function
  async function handleFixSppgNames() {
    if (!confirm('Apakah Anda yakin ingin memperbaiki nama SPPG SINDANGJAYA 3?\n\nIni akan:\n1. Mengubah nama customer "SPPG SINDANGJAYA 3" menjadi "SPPG SINDANGJAYA 3 (LOTUS)"\n2. Mengupdate semua invoice ke nama baru\n3. Mengupdate semua purchase notes ke nama baru\n4. Mengupdate semua telegram order ke nama baru "SPPG SINDANGJAYA 3 (LOTUS)"\n\n**Tindakan ini tidak dapat dibatalkan!**')) {
      return;
    }

    setIsFixingSppg(true);
    try {
      // Import dan jalankan fixSppgNames script
      const fixSppgNames = (await import('../utils/fixSppgNames.js')).default;

      await fixSppgNames();

      alert('✅ Berhasil memperbaiki nama SPPG SINDANGJAYA 3!\n\nNama customer: "SPPG SINDANGJAYA 3" → "SPPG SINDANGJAYA 3 (LOTUS)"\n\nSemua referensi telah diupdate sesuai instruksi Anda.');

      await reload();
    } catch (error) {
      console.error('Error fixing SPPG names:', error);
      alert(`Gagal memperbaiki nama SPPG: ${error.message}`);
    } finally {
      setIsFixingSppg(false);
    }
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
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
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
          <button className="btn btn-warning" onClick={handleFixSppgNames} disabled={isFixingSppg} title="Perbaiki Nama SPPG SINDANGJAYA 3">
            <FiRefreshCw /> {isFixingSppg ? 'Memperbaiki...' : 'Perbaiki SPPG Names'}
          </button>
          <button className="btn btn-info" onClick={openMergeModal} title="Gabungkan Customer">
            <FiGitMerge /> Merge Customer
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <FiPlus /> Tambah Customer
          </button>
        </div>
      </div>

      {loading && (
        <div className="card p-lg text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-muted">Memuat data pelanggan...</p>
        </div>
      )}

      {error && (
        <div className="card p-lg text-center animate-in" style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="empty-state-icon" style={{ color: '#ef4444' }}><FiUsers /></div>
          <h3 className="text-danger">{error.includes('Permission Denied') ? 'Akses Database Terbatas (RLS)' : 'Gagal Memuat Data'}</h3>
          <p className="mb-md">
            {error.includes('Permission Denied') 
              ? 'Data pelanggan ditemukan di database tapi diblokir oleh kebijakan keamanan (RLS) Supabase Anda.'
              : 'Terjadi kesalahan saat memuat data pelanggan dari database.'}
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
          <input type="text" placeholder="Cari customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Grup</th>
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
                <td>
                  {c.group
                    ? <span className="badge badge-cyan">{c.group}</span>
                    : <span className="text-muted text-xs">-</span>}
                </td>
                <td className="text-muted">{c.company || '-'}</td>
                <td>{c.phone || '-'}</td>
                <td><span className="badge badge-purple">{getCategoryName(c.priceCategoryId)}</span></td>
                <td className="text-muted text-sm" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || '-'}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost btn-sm text-info" onClick={() => openRenameModal(c)} title="Ganti Nama"><FiEdit3 /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)} title="Edit"><FiEdit2 /></button>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(c.id)} title="Hapus"><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Customer' : 'Tambah Customer'} closeOnOverlay={false} closeOnEsc={true}>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nama</label>
                <input className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nama customer" name="name_1" />
              </div>
              <div className="form-group">
                <label className="form-label">Grup / Sub-Customer
                  <span className="text-xs text-muted" style={{ fontWeight: 400, marginLeft: 6 }}>(opsional)</span>
                </label>
                <input
                  className="form-input"
                  list="group-datalist"
                  value={form.group}
                  onChange={e => setForm({...form, group: e.target.value})}
                  placeholder="Contoh: DC, HOREKA, SPPG..."
                />
                <datalist id="group-datalist">
                  {groupNames.map(g => <option key={g} value={g} />)}
                </datalist>
              </div>
            </div>
            <div className="form-row">
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

      {/* Merge Customer Modal */}
      <Modal isOpen={mergeModalOpen} onClose={() => setMergeModalOpen(false)} title="Gabungkan Customer" size="lg" closeOnOverlay={true} closeOnEsc={true}>
        <div className="p-lg">
          <div className="mb-lg">
            <p className="text-secondary mb-md">
              Pilih dua customer yang ingin digabungkan. Customer sumber akan dihapus dan semua data terkait akan dipindahkan ke customer target.
            </p>

            <div className="grid grid-2 gap-lg mb-lg">
              {/* Source Customer */}
              <div className="card p-md border-dashed">
                <h4 className="text-primary font-bold mb-sm">Customer Sumber (akan dihapus)</h4>
                <select
                  className="form-input bg-glass"
                  value={sourceCustomer?.id || ''}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === e.target.value);
                    setSourceCustomer(customer || null);
                  }}
                >
                  <option value="">Pilih customer sumber...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company && c.company !== c.name ? `(${c.company})` : ''}
                    </option>
                  ))}
                </select>
                {sourceCustomer && (
                  <div className="mt-md text-sm text-secondary">
                    <div><strong>Nama:</strong> {sourceCustomer.name}</div>
                    <div><strong>Grup:</strong> {sourceCustomer.group || '-'}</div>
                    <div><strong>Telepon:</strong> {sourceCustomer.phone || '-'}</div>
                    <div><strong>Perusahaan:</strong> {sourceCustomer.company || '-'}</div>
                  </div>
                )}
              </div>

              {/* Target Customer */}
              <div className="card p-md border-dashed">
                <h4 className="text-info font-bold mb-sm">Customer Target (akan tetap ada)</h4>
                <select
                  className="form-input bg-glass"
                  value={targetCustomer?.id || ''}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === e.target.value);
                    setTargetCustomer(customer || null);
                  }}
                >
                  <option value="">Pilih customer target...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company && c.company !== c.name ? `(${c.company})` : ''}
                    </option>
                  ))}
                </select>
                {targetCustomer && (
                  <div className="mt-md text-sm text-secondary">
                    <div><strong>Nama:</strong> {targetCustomer.name}</div>
                    <div><strong>Grup:</strong> {targetCustomer.group || '-'}</div>
                    <div><strong>Telepon:</strong> {targetCustomer.phone || '-'}</div>
                    <div><strong>Perusahaan:</strong> {targetCustomer.company || '-'}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Merge Options */}
            <div className="card p-md mb-lg">
              <label className="flex items-center gap-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={mergeContactInfo}
                  onChange={(e) => setMergeContactInfo(e.target.checked)}
                  className="form-checkbox"
                />
                <div>
                  <div className="font-bold">Gabungkan Informasi Kontak</div>
                  <div className="text-sm text-secondary">
                    Jika customer target tidak memiliki info kontak, gunakan info dari customer sumber
                  </div>
                </div>
              </label>
            </div>

            {/* Warning */}
            {sourceCustomer && targetCustomer && (
              <div className="card p-md mb-lg" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div className="flex items-start gap-sm">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <div className="font-bold text-warning mb-sm">Tindakan ini tidak dapat dibatalkan!</div>
                    <div className="text-sm text-secondary">
                      Customer <strong>"{sourceCustomer.name}"</strong> akan dihapus permanen.
                      Semua invoice, nota pembelian, dan telegram order yang menggunakan customer ini akan dipindahkan ke <strong>"{targetCustomer.name}"</strong>.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer pt-lg border-top border-white-05 flex gap-sm">
            <button type="button" className="btn btn-ghost" onClick={() => setMergeModalOpen(false)}>
              Batal
            </button>
            <button
              type="button"
              className="btn btn-info flex-1"
              onClick={handleMerge}
              disabled={!sourceCustomer || !targetCustomer || isMerging}
            >
              {isMerging ? 'Menggabungkan...' : <><FiGitMerge /> Gabungkan Customer</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Rename Customer Modal */}
      <Modal isOpen={renameModalOpen} onClose={() => setRenameModalOpen(false)} title="Ganti Nama Customer" size="md" closeOnOverlay={true} closeOnEsc={true}>
        <div className="p-lg">
          <div className="mb-lg">
            <p className="text-secondary mb-md">
              Ganti nama customer. Ini akan mengupdate nama customer dan semua referensi di invoice, nota pembelian, dan telegram order.
            </p>

            {customerToRename && (
              <div className="card p-md mb-lg">
                <h4 className="text-primary font-bold mb-sm">Customer Yang Akan Diganti</h4>
                <div className="text-sm text-secondary">
                  <div><strong>Nama:</strong> {customerToRename.name}</div>
                  <div><strong>Grup:</strong> {customerToRename.group || '-'}</div>
                  <div><strong>Telepon:</strong> {customerToRename.phone || '-'}</div>
                  <div><strong>Perusahaan:</strong> {customerToRename.company || '-'}</div>
                </div>
              </div>
            )}

            <div className="form-group mb-lg">
              <label className="form-label font-bold">Nama Baru</label>
              <input
                className="form-input bg-glass"
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Masukkan nama baru..."
                autoFocus
              />
            </div>

            {/* Warning */}
            {customerToRename && newCustomerName.trim() && newCustomerName.trim() !== customerToRename.name && (
              <div className="card p-md mb-lg" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <div className="flex items-start gap-sm">
                  <span className="text-2xl">ℹ️</span>
                  <div>
                    <div className="font-bold text-info mb-sm">Akan mengupdate semua referensi</div>
                    <div className="text-sm text-secondary">
                      Semua invoice, nota pembelian, dan telegram order yang menggunakan nama customer <strong>"{customerToRename.name}"</strong> akan diubah menjadi <strong>"{newCustomerName.trim()}"</strong>.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer pt-lg border-top border-white-05 flex gap-sm">
            <button type="button" className="btn btn-ghost" onClick={() => setRenameModalOpen(false)}>
              Batal
            </button>
            <button
              type="button"
              className="btn btn-info flex-1"
              onClick={handleRename}
              disabled={!newCustomerName.trim() || isRenaming}
            >
              {isRenaming ? 'Mengganti Nama...' : 'Ganti Nama'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
