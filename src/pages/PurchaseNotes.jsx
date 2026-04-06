import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDateShort } from '../utils/formatter';
import ConfirmModal from '../components/ConfirmModal';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import PurchaseNoteReportPdf from '../components/PurchaseNoteReportPdf';
import { FiPlus, FiSearch, FiFileText, FiCalendar, FiArrowRight, FiTrash2, FiEdit2, FiPrinter } from 'react-icons/fi';
import { PurchaseNotes as PNStore, Invoices, SupportingMaterialItems as MasterItems, Customers, Suppliers } from '../utils/storage';

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
  const [printData, setPrintData] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debug, setDebug] = useState({ url: '', notesCount: 0, legacyCount: 0 });

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
    const masterNamesLocal = new Set(master.map(m => m.name.toLowerCase()));

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
    
    setIsGeneratingPdf(true);
    
    // Prepare data for the PDF template
    const noteDateStr = note.date ? String(note.date).slice(0, 10) : '';
    const grp = note.groupName || '(Tanpa Grup)';
    
    // Build the invoices list: 3-layer check
    let invsForGroup = [];
    if (note.sourceInvoiceIds && note.sourceInvoiceIds.length > 0) {
      invsForGroup = fullInvoices.filter(inv => note.sourceInvoiceIds.includes(inv.id));
    } else if (note.invoiceId) {
      invsForGroup = fullInvoices.filter(inv => inv.id === note.invoiceId);
    } else {
      // Fallback for old notes
      const nameToGroup = {};
      allCustomers.forEach(c => { if (c.group && c.name) nameToGroup[c.name.toLowerCase()] = c.group; });
      invsForGroup = fullInvoices.filter(inv => {
        const dateObj = inv.date ? new Date(inv.date) : (inv.createdAt ? new Date(inv.createdAt) : null);
        if (!dateObj) return false;
        const invDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        return invDateStr === noteDateStr && nameToGroup[(inv.customerName || '').toLowerCase()] === grp;
      });
    }

    // Reconstruct group recap aggregates
    const groupAgg = {};
    invsForGroup.forEach(inv => {
      (inv.items || []).forEach(it => {
        const key = (it.productName || '').trim();
        if (!key) return;
        if (!groupAgg[key]) groupAgg[key] = { name: key, totalQty: 0, unit: it.unit || 'kg' };
        groupAgg[key].totalQty += (Number(it.qty) || 0);
      });
    });
    const recapArray = Object.values(groupAgg).sort((a, b) => a.name.localeCompare(b.name));

    setPrintData({
      groupName: grp,
      date: note.date,
      groupRecap: recapArray,
      purchaseItems: note.items || [],
      supplierDiscounts: note.supplierDiscounts || {},
      invoicesList: invsForGroup,
      additionalCosts: note.additionalCosts || {}
    });

    // Generate PDF
    await new Promise(r => setTimeout(r, 600)); // Allow render
    let element = null;
    let originalDisplay = '';
    try {
      element = document.getElementById('purchase-note-report-render');
      if (!element) throw new Error('Render element not found');

      originalDisplay = element.style.display;
      element.style.display = 'block';

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // Wait for render to complete
      await new Promise(r => setTimeout(r, 300));
      
      // Capture element to canvas with A4 width constraint
      const pageWidth = 210; // A4 width in mm
      const dpi = 96;
      const pixelWidth = Math.round((pageWidth / 25.4) * dpi); // Convert mm to pixels at 96 DPI
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: pixelWidth,
        allowTaint: true
      });
      
      const pageHeight = 297; // A4 height in mm
      const marginTop = 15;
      const marginBottom = 15;
      const marginLeft = 15;
      const marginRight = 15;
      
      // Calculate usable height per page
      const usableHeight = pageHeight - marginTop - marginBottom; // 267mm
      const imgWidth = pageWidth - marginLeft - marginRight; // 180mm
      
      // Calculate image dimensions
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const totalPages = Math.ceil(imgHeight / usableHeight);
      
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      
      // Add pages with proper offset calculation
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();
        // Position each page's image with proper margin offset
        const yOffset = marginTop - (i * usableHeight);
        pdf.addImage(imgData, 'JPEG', marginLeft, yOffset, imgWidth, imgHeight);
      }
      
      pdf.save(`Laporan_Pembelian_${grp}_${noteDateStr}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Gagal mencetak PDF: ' + err.message);
    } finally {
      if (element) {
        element.style.display = originalDisplay;
      }
      setIsGeneratingPdf(false);
      setPrintData(null);
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
            m.name.toLowerCase() === item.productName.toLowerCase()
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

  const filtered = notes.filter(n => 
    (n.supplierName || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.notes || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Pembelian Bahan</h1>
          <p>Daftar nota pembelian bahan baku dan split S5/S3</p>
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
              <div key={grp} className="card animate-in" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.08) 100%)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div className="card-header flex-between" style={{ padding: '12px 20px' }}>
                  <h3 className="card-title text-primary flex-center gap-sm" style={{ fontSize: 16 }}>
                    <FiFileText />
                    Rekap Kebutuhan: <span style={{ fontWeight: 800, marginLeft: 6, color: 'var(--accent-primary-hover)' }}>{grp}</span>
                    <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: 11 }}>{items.length} produk</span>
                  </h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setCollapsedGroups(prev => ({ ...prev, [grp]: !prev[grp] }))}>
                    {isThisGroupCollapsed ? 'Tampilkan Detail' : 'Sembunyikan'}
                  </button>
                </div>
                {!isThisGroupCollapsed && (
                  <div style={{ padding: '0 20px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {items.map((item, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>{item.name}</span>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                             <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-primary-hover)' }}>{Number(item.totalQty).toLocaleString('id-ID')}</span>
                             <span style={{ fontSize: 11, opacity: 0.5 }}>{item.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="group-invoice-list">
                      <div className="text-xs font-bold text-muted uppercase tracking-wider mb-sm">Daftar Invoice Terkait ({invs.length})</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                        {invs.map(inv => (
                          <div key={inv.id} className="group-invoice-item">
                            <div>
                              <div style={{ fontWeight: 700 }}>{inv.invoiceNumber}</div>
                              <div className="text-xs text-muted">{inv.customerName}</div>
                            </div>
                            <Link 
                              to="/purchase-notes/new" 
                              state={{ invoiceId: inv.id }} 
                              className="btn-link-sm"
                            >
                              Buat Nota <FiArrowRight />
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-md flex gap-sm">
                      <Link to="/purchase-notes/new" state={{ groupName: grp }} className="btn btn-primary btn-sm flex-1">
                        <FiPlus /> Buat Nota Borongan dari Grup Ini
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input 
            type="text" 
            placeholder="Cari supplier atau catatan..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
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
                          const name = (it.productName || '').toLowerCase();
                          return masterBahan.some(m => (m.name || '').toLowerCase() === name);
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
              <th>Items</th>
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
            ) : filtered.map(note => (
              <tr key={note.id}>
                <td className="text-muted"><FiCalendar style={{marginRight: 4}} /> {formatDateShort(note.date)}</td>
                <td><strong>{note.supplierName || 'General Supplier'}</strong></td>
                <td>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(note.items || []).slice(0, 3).map((it, i) => (
                      <span key={i} className="badge badge-secondary" style={{ fontSize: '10px', opacity: 0.8 }}>
                        {it.materialName}
                      </span>
                    ))}
                    {(note.items || []).length > 3 && (
                      <span className="text-xs text-muted" style={{ padding: '2px 4px' }}>
                        +{note.items.length - 3} lainnya
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-right font-medium">{formatCurrency(note.grandTotal)}</td>
                <td>
                  <span className="badge badge-cyan">Split S5 & S3</span>
                </td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost btn-sm text-info" onClick={() => handlePrintPdf(note)} disabled={isGeneratingPdf && printData?.groupName === note.groupName}>
                      <FiPrinter style={{ animation: (isGeneratingPdf && printData?.groupName === note.groupName) ? 'spin 1s linear infinite' : 'none' }} />
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
            ))}
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

      {/* PDF Rendering Area (Hidden) */}
      {printData && (
        <PurchaseNoteReportPdf
          groupName={printData.groupName || printData.invoiceNumber || 'Pembelian Umum'}
          date={printData.date}
          groupRecap={printData.groupRecap}
          purchaseItems={printData.purchaseItems}
          supplierDiscounts={printData.supplierDiscounts}
          invoicesList={printData.invoicesList}
          suppliersData={allSuppliers}
          additionalCosts={printData.additionalCosts}
          forPrint={false}
        />
      )}
      
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
