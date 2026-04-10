'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency, formatDateShort } from '../utils/formatter';
import ConfirmModal from '../components/ConfirmModal';
import { pdf } from '@react-pdf/renderer';
import PurchaseNoteReportPdfDocument from '../components/PurchaseNoteReportPdfDocument';
import { saveAs } from 'file-saver';
import { FiPlus, FiSearch, FiFileText, FiCalendar, FiArrowRight, FiTrash2, FiEdit2, FiPrinter, FiSend } from 'react-icons/fi';
import { PurchaseNotes as PNStore, Invoices, SupportingMaterialItems as MasterItems, Customers, Suppliers, TelegramOrders } from '../utils/storage';
import { sendDocument } from '../utils/telegram';
import { getInvoicesForPurchaseNote } from '../utils/purchaseReportModel';
import SupplierPaymentRecapPdfDocument from '../components/SupplierPaymentRecapPdfDocument';

export default function PurchaseNotes() {
  const [notes, setNotes] = useState([]);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [groupRecap, setGroupRecap] = useState({}); // { groupName: [{ name, qty, unit }] }
  const [groupInvoices, setGroupInvoices] = useState({}); // { groupName: [inv1, inv2] }
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  
  const [fullInvoices, setFullInvoices] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [masterBahan, setMasterBahan] = useState([]);
  const [pdfBusyNoteId, setPdfBusyNoteId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debug, setDebug] = useState({ url: '', notesCount: 0, legacyCount: 0 });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isGeneratingRecap, setIsGeneratingRecap] = useState(false);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [allNotes, allInvoices, allCustomers, allSupps, master] = await Promise.all([
        PNStore.getAll(),
        Invoices.getAll(),
        Customers.getAll(),
        Suppliers.getAll(),
        MasterItems.getAll()
      ]);
    
    const sortFn = (a, b) => {
      const db = b.date || b.createdAt || 0;
      const da = a.date || a.createdAt || 0;
      const tb = db.seconds ? db.seconds * 1000 : (db ? new Date(db).getTime() : 0);
      const ta = da.seconds ? da.seconds * 1000 : (da ? new Date(da).getTime() : 0);
      
      const tbValid = isNaN(tb) ? 0 : tb;
      const taValid = isNaN(ta) ? 0 : ta;
      
      return tbValid - taValid;
    };

      console.log(`📦 PurchaseNotes: Loaded ${allNotes.length} notes, ${allInvoices.length} invoices, ${master.length} master items.`);
      
      setDebug({
        url: import.meta.env.VITE_SUPABASE_URL || 'Missing',
        notesCount: allNotes.filter(n => !n.isLegacy).length, // approximate if we had a flag
        total: allNotes.length
      });

      setNotes(allNotes.sort(sortFn));
      setFullInvoices(allInvoices);
      setAllCustomers(allCustomers);
      setAllSuppliers(allSupps);
      setMasterBahan(master);

    // Build material names set for faster lookup
    const masterNamesLocal = new Set(master.map(m => (m.name || '').toLowerCase()));

    // Filter pending invoices (those with materials that aren't linked to a Purchase Note)
    const linkedInvoiceIds = new Set();
    allNotes.forEach(n => {
      if (n.invoiceId) linkedInvoiceIds.add(n.invoiceId);
      if (Array.isArray(n.sourceInvoiceIds)) {
        n.sourceInvoiceIds.forEach(id => linkedInvoiceIds.add(id));
      }
    });

    const pending = allInvoices.filter(inv => {
      if (linkedInvoiceIds.has(inv.id)) return false;
      const hasMaterials = (inv.items || []).some(it => 
        it.type === 'material' || 
        masterNamesLocal.has((it.productName || '').toLowerCase())
      );
      return hasMaterials;
    });
    
    // All non-linked invoices (for group recap — broader scope, not limited to material type)
    const allPending = allInvoices.filter(inv => {
      if (linkedInvoiceIds.has(inv.id)) return false;
      // We no longer strictly filter by todayStr here to allow all pending
      // invoices for the group to be seen in the recap card.
      return true;
    });

    setPendingInvoices(pending.sort(sortFn));

    // Build customer name → group mapping (case-insensitive match)
    const nameToGroup = {};
    allCustomers.forEach(c => {
      if (c.group && c.name) {
        nameToGroup[c.name.toLowerCase()] = c.group;
      }
    });

    // Aggregate ALL items per group from ALL non-linked invoices whose customer has a group
    const groupAgg = {}; // { groupName: { productName: { totalQty, unit } } }
    const groupInvs = {}; // { groupName: [invoices] }
    allPending.forEach(inv => {
      const custGroup = nameToGroup[(inv.customerName || '').toLowerCase()];
      if (!custGroup) return; // skip customers with no group
      
      if (!groupAgg[custGroup]) groupAgg[custGroup] = {};
      if (!groupInvs[custGroup]) groupInvs[custGroup] = [];
      groupInvs[custGroup].push(inv);

      (inv.items || []).forEach(it => {
        // Include ALL item types (product, material, etc.)
        const key = (it.productName || '').trim();
        if (!key) return;
        if (!groupAgg[custGroup][key]) {
          groupAgg[custGroup][key] = { name: key, totalQty: 0, unit: it.unit || 'kg' };
        }
        groupAgg[custGroup][key].totalQty += (Number(it.qty) || 0);
      });
    });

    // Convert to sorted arrays
    const result = {};
    Object.keys(groupAgg).sort().forEach(grp => {
      result[grp] = Object.values(groupAgg[grp]).sort((a, b) => a.name.localeCompare(b.name));
    });
    setGroupRecap(result);
    setGroupInvoices(groupInvs);
    } catch (err) {
      console.error('Failed to load purchase notes data:', err);
      setError('Gagal memuat data dari database. Silakan periksa koneksi internet Anda atau hubungi admin.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePrintPdf(note) {
    if (!note.groupName) {
      if (!window.confirm('Nota ini tidak memiliki data grup tersimpan (nota lama). Ingin tetap mencetak laporan hanya rincian pembelian?')) return;
    }
    
    setPdfBusyNoteId(note.id);
    try {
      const { invsForGroup, grp, noteDateStr } = getInvoicesForPurchaseNote(note, fullInvoices, allCustomers);
      const logoSrc = `${window.location.origin}/logo-kdmp.png`;
      const instance = pdf(
        <PurchaseNoteReportPdfDocument
          groupName={grp}
          date={note.date}
          purchaseItems={note.items || []}
          supplierName={note.supplierName || ''}
          supplierDiscounts={note.supplierDiscounts || {}}
          invoicesList={invsForGroup}
          suppliersData={allSuppliers}
          additionalCosts={note.additionalCosts || {}}
          logoSrc={logoSrc}
        />
      );
      const blob = await instance.toBlob();
      saveAs(blob, `Laporan_Pembelian_${grp}_${noteDateStr}.pdf`);
      toast.success('PDF Laporan Pembelian berhasil didownload!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mencetak PDF: ' + err.message);
    } finally {
      setPdfBusyNoteId(null);
    }
  }

  async function handleSendTelegramPdf(note) {
    if (!note) return;
    
    let chatId = null;
    const ids = note.sourceInvoiceIds || (note.invoiceId ? [note.invoiceId] : []);
    const matchedInvs = fullInvoices.filter(inv => ids.includes(inv.id));
    
    for (const inv of matchedInvs) {
      if (inv.telegramChatId) {
        chatId = inv.telegramChatId;
        break;
      }
    }

    if (!chatId) {
      try {
        const orders = await TelegramOrders.getAll();
        for (const inv of matchedInvs) {
          const linkedOrder = orders.find(o => o.matchedCustomerId === inv.customerId);
          if (linkedOrder && linkedOrder.telegramChatId) {
            chatId = linkedOrder.telegramChatId;
            break;
          }
        }
      } catch(err) { console.error('TelegramOrders check error:', err); }
    }

    if (!chatId) {
      toast.error('Telegram Chat ID tidak ditemukan. Pesanan grup/pembeli ini mungkin tidak berasal dari Telegram.');
      return;
    }

    setSendingId(note.id);

    try {
      const { invsForGroup, grp, noteDateStr } = getInvoicesForPurchaseNote(note, fullInvoices, allCustomers);
      const logoSrc = `${window.location.origin}/logo-kdmp.png`;
      const instance = pdf(
        <PurchaseNoteReportPdfDocument
          groupName={grp}
          date={note.date}
          purchaseItems={note.items || []}
          supplierName={note.supplierName || ''}
          supplierDiscounts={note.supplierDiscounts || {}}
          invoicesList={invsForGroup}
          suppliersData={allSuppliers}
          additionalCosts={note.additionalCosts || {}}
          logoSrc={logoSrc}
        />
      );
      const blob = await instance.toBlob();
      const filename = `Laporan_Pembelian_${grp}_${noteDateStr}.pdf`;

      const res = await sendDocument(chatId, blob, filename);
      if (res.ok) {
        toast.success('PDF Laporan Pembelian Berhasil dikirim ke Telegram');
      } else {
        toast.error(`Gagal mengirim PDF ke Telegram: ${res.description || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan saat memproses dan mengirim PDF: ' + err.message);
    } finally {
      setSendingId(null);
    }
  }


  async function confirmDelete() {
    if (!deleteId) return;
    await PNStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSyncInvoices() {
    if (!window.confirm('Sinkronkan Master Bahan dari seluruh data Invoice? Ini akan menambahkan item baru ke Master Bahan secara otomatis.')) return;
    setIsSyncing(true);
    try {
      const [allInvs, allMaster] = await Promise.all([
        Invoices.getAll(),
        MasterItems.getAll()
      ]);

      let addedCount = 0;
      for (const inv of allInvs) {
        for (const item of (inv.items || [])) {
          // Identify material by type or by being in the "Bahan" category names
          const isMaterial = item.type === 'material';
          if (!isMaterial) continue;

          const exists = allMaster.some(m =>
            (item.productId && m.id === item.productId) ||
            (m.name || '').toLowerCase() === (item.productName || '').toLowerCase()
          );

          if (!exists) {
            const newItem = {
              name: item.productName,
              unit: item.unit || 'kg',
              defaultPrice: Number(item.unitPrice) || 0,
              stock: 0
            };
            await MasterItems.create(newItem);
            allMaster.push(newItem); // avoid duplicates in same sync
            addedCount++;
          }
        }
      }
      alert(`Berhasil sinkronisasi. ${addedCount} item bahan baru ditambahkan ke Master Bahan.`);
      await reload();
    } catch (err) {
      console.error(err);
      alert('Gagal melakukan sinkronisasi.');
    } finally {
      setIsSyncing(false);
    }
  }

  async function handlePrintRecapPdf() {
    setIsGeneratingRecap(true);
    try {
      const logoSrc = `${window.location.origin}/logo-kdmp.png`;
      const instance = pdf(
        <SupplierPaymentRecapPdfDocument
          filteredNotes={filtered}
          startDate={startDate}
          endDate={endDate}
          suppliersData={allSuppliers}
          logoSrc={logoSrc}
        />
      );
      const blob = await instance.toBlob();
      saveAs(blob, `Rekap_Pembayaran_Supplier${startDate ? '_'+startDate : ''}.pdf`);
      toast.success('PDF Rekap berhasil didownload!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mencetak rekap: ' + err.message);
    } finally {
      setIsGeneratingRecap(false);
    }
  }

  const filtered = notes.filter(n => {
    let match = true;
    if (startDate) {
      const d = n.date || n.createdAt;
      if (!d || d < startDate) match = false;
    }
    if (endDate) {
      const d = n.date || n.createdAt;
      if (!d || d > endDate) match = false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!(n.supplierName || '').toLowerCase().includes(q) && !(n.notes || '').toLowerCase().includes(q)) match = false;
    }
    return match;
  });

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Pembelian Bahan</h1>
          <p>Daftar nota pembelian bahan baku dan split S5/S2</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={handleSyncInvoices} disabled={isSyncing || loading}>
            <FiPlus /> {isSyncing ? 'Sinkron Selesai...' : 'Sinkronisasi Bahan'}
          </button>
          <Link to="/purchase-notes/new" className="btn btn-primary disabled-link" disabled={loading}>
            <FiPlus /> Buat Nota Baru
          </Link>
        </div>
      </div>

      {loading && (
        <div className="card p-lg text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-muted">Memuat data dari database...</p>
        </div>
      )}

      {error && (
        <div className="card p-lg text-center animate-in" style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="empty-state-icon" style={{ color: '#ef4444' }}><FiFileText /></div>
          <h3 className="text-danger">{error.includes('Permission Denied') ? 'Akses Database Terbatas (RLS)' : 'Gagal Memuat Data'}</h3>
          <p className="mb-md">
            {error.includes('Permission Denied') 
              ? 'Data ditemukan di database tapi diblokir oleh kebijakan keamanan (RLS) Supabase Anda. Anda perlu mengaktifkan akses baca di dashboard Supabase.'
              : 'Terjadi kesalahan saat mencoba menarik data dari Supabase.'}
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
          <style>{`
        .group-invoice-list {
          margin-top: 15px;
          border-top: 1px dashed rgba(255,255,255,0.1);
          padding-top: 15px;
        }
        .group-invoice-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          margin-bottom: 8px;
          font-size: 13px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .group-invoice-item:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(99,102,241,0.2);
        }
        .btn-link-sm {
          font-size: 12px;
          color: var(--accent-primary);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
        }
        .btn-link-sm:hover {
          color: var(--accent-primary-hover);
        }
      `}</style>

      {Object.keys(groupRecap).length > 0 && (
        <div className="grid gap-md mb-lg">
          {Object.entries(groupRecap).map(([grp, items]) => {
            const invs = groupInvoices[grp] || [];
            const isThisGroupCollapsed = collapsedGroups[grp];
            return (
              <div key={grp} className="card animate-in" style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(168,85,247,0.06) 100%)',
                border: '1px solid rgba(99,102,241,0.15)',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
              }}>
                <div className="card-header flex-between" style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid rgba(99,102,241,0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <FiFileText style={{ color: 'var(--accent-primary-hover)', fontSize: '18px' }} />
                    <h3 className="card-title text-primary" style={{ fontSize: 17, margin: 0 }}>
                      Rekap Kebutuhan: <span style={{
                        fontWeight: 800,
                        marginLeft: '8px',
                        color: 'var(--accent-primary-hover)'
                      }}>{grp}</span>
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-primary" style={{ fontSize: '12', padding: '4px 8px' }}>{items.length} produk</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setCollapsedGroups(prev => ({ ...prev, [grp]: !prev[grp] }))}
                      style={{ padding: '6px 12px', borderRadius: '6px' }}
                    >
                      {isThisGroupCollapsed ? 'Tampilkan Detail' : 'Sembunyikan'}
                    </button>
                  </div>
                </div>
                {!isThisGroupCollapsed && (
                  <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {items.map((item, idx) => (
                        <div key={idx} style={{
                          background: 'rgba(255,255,255,0.04)',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s ease'
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.95 }}>{item.name}</span>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                             <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-primary-hover)' }}>{Number(item.totalQty).toLocaleString('id-ID')}</span>
                             <span style={{ fontSize: 12, opacity: 0.6, fontWeight: 500 }}>{item.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="group-invoice-list" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(99,102,241,0.1)' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                        paddingBottom: '8px'
                      }}>
                        <div className="text-xs font-bold text-muted uppercase tracking-wider">
                          Daftar Invoice Terkait ({invs.length})
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary-hover)' }}></div>
                            {invs.length} invoice tersedia
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                        {invs.map(inv => (
                          <div key={inv.id} style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '8px',
                            padding: '12px',
                            transition: 'all 0.2s ease'
                          }}>
                            <div style={{ marginBottom: '8px' }}>
                              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{inv.invoiceNumber}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{inv.customerName}</div>
                            </div>
                            <Link
                              to="/purchase-notes/new"
                              state={{ invoiceId: inv.id }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                background: 'var(--accent-primary-hover)',
                                color: 'white',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Buat Nota <FiArrowRight style={{ fontSize: '14px' }} />
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-md flex gap-sm" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(99,102,241,0.1)' }}>
                      <Link to="/purchase-notes/new" state={{ groupName: grp }} className="btn btn-primary btn-sm flex-1" style={{
                        padding: '10px 20px',
                        fontSize: '13px',
                        fontWeight: '600',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.2)'
                      }}>
                        <FiPlus style={{ fontSize: '16px' }} /> Buat Nota Borongan dari Grup Ini
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="toolbar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Cari supplier atau catatan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'rgba(99,102,241,0.05)',
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(99,102,241,0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiCalendar style={{ color: 'var(--accent-primary-hover)', fontSize: '16px' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Periode:</span>
            </div>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px 12px', minWidth: '130px' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>—</span>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '8px 12px', minWidth: '130px' }} />
          </div>
          <button className="btn btn-secondary" disabled={isGeneratingRecap || filtered.length === 0} onClick={handlePrintRecapPdf} style={{ marginLeft: '8px' }}>
            {isGeneratingRecap ? <span style={{display: 'inline-block', animation: 'spin 1s linear infinite'}}><FiPrinter/></span> : <FiPrinter />}
            Cetak Rekap ({filtered.length})
          </button>
        </div>
      </div>

      {pendingInvoices.length > 0 && (
        <div className="card mb-lg animate-in" style={{ borderColor: 'var(--primary)', borderLeftWidth: 4 }}>
          <div className="card-header flex-between">
            <h3 className="card-title text-primary"><FiFileText /> Invoice Menunggu Nota Pembelian ({pendingInvoices.length})</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>No. Invoice</th>
                  <th>Customer</th>
                  <th>Materials</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="text-muted">{formatDateShort(inv.date)}</td>
                    <td><strong>{inv.invoiceNumber}</strong></td>
                    <td>{inv.customerName}</td>
                    <td>
                      <span className="badge badge-primary">
                        {(inv.items || []).filter(it => {
                          if (it.type === 'material') return true;
                          try {
                            const name = (it.productName || '').toLowerCase();
                            return masterBahan.some(m => (m.name || '').toLowerCase() === name);
                          } catch (e) {
                            console.error('Error filtering item:', it, e);
                            return false;
                          }
                        }).length} Item
                      </span>
                    </td>
                    <td className="text-right">
                      <Link 
                        to="/purchase-notes/new" 
                        state={{ invoiceId: inv.id }} 
                        className="btn btn-primary btn-sm"
                      >
                        <FiPlus /> Buat Nota Pembelian
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Supplier</th>
              <th>Customer</th>
              <th className="text-right">Total Biaya</th>
              <th>Status Split</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiFileText /></div>
                    <h3>{search ? 'Tidak ada hasil pencarian' : 'Belum ada nota pembelian'}</h3>
                    <p>{search ? `Tidak ditemukan hasil untuk "${search}"` : 'Klik "Buat Nota Baru" untuk mencatat pembelian pertama Anda.'}</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(note => {
              // Resolve customer names from linked invoices
              const ids = note.sourceInvoiceIds || (note.invoiceId ? [note.invoiceId] : []);
              const matchedInvs = fullInvoices.filter(inv => ids.includes(inv.id));
              const customerNames = Array.from(new Set(matchedInvs.map(inv => inv.customerName).filter(Boolean)));
              const displayCustomer = customerNames.length > 0 ? customerNames.join(', ') : (note.customerName || '-');

              return (
                <tr key={note.id}>
                  <td className="text-muted"><FiCalendar style={{marginRight: 4}} /> {formatDateShort(note.date)}</td>
                  <td><strong>{note.supplierName || 'General Supplier'}</strong></td>
                  <td>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary-hover)' }}>
                      {displayCustomer}
                    </div>
                  </td>
                  <td className="text-right font-medium">{formatCurrency(note.grandTotal)}</td>
                  <td>
                    <span className="badge badge-cyan">Split S5 & S2</span>
                  </td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost btn-sm text-info" onClick={() => handlePrintPdf(note)} disabled={pdfBusyNoteId === note.id}>
                      <FiPrinter style={{ animation: (pdfBusyNoteId === note.id) ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleSendTelegramPdf(note)} disabled={sendingId === note.id} title="Kirim PDF ke Telegram">
                      <FiSend style={{ animation: (sendingId === note.id) ? 'spin 1s linear infinite' : 'none', color: '#8b5cf6' }} />
                    </button>
                    <Link to={`/purchase-notes/${note.id}/edit`} className="btn btn-ghost btn-sm">
                      <FiEdit2 />
                    </Link>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleteId(note.id)}>
                      <FiTrash2 />
                    </button>
                    <Link to={`/purchase-notes/${note.id}/edit`} className="btn btn-primary btn-sm btn-icon-only" style={{marginLeft: 8}}>
                      <FiArrowRight />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Hapus Nota Pembelian"
        message="Menghapus nota ini tidak akan mengoreksi stok secara otomatis. Apakah Anda yakin?"
      />

      </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Debug Info (Only shows if empty or error) */}
      {(notes.length === 0 || error) && (
        <div style={{ marginTop: 40, padding: 12, fontSize: 10, color: '#475569', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <details>
            <summary style={{ cursor: 'pointer', opacity: 0.5 }}>Info Debug Database</summary>
            <div style={{ marginTop: 8, fontFamily: 'monospace' }}>
              <div>Supabase URL: {debug.url === 'Missing' ? '❌ MISSING' : `${debug.url.substring(0, 20)}...`}</div>
              <div>Notes Loaded: {debug.total || 0}</div>
              <div>Database Status: {error ? '❌ Error' : '✅ Connected'}</div>
              <div style={{ marginTop: 4, color: '#94a3b8' }}>
                Jika data di atas 0 tapi tabel tetap kosong, periksa filter pencarian Anda.
                Jika data 0 tapi di DB ada isinya, periksa .env di Vercel.
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
