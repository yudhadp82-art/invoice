import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiPlus, FiSearch, FiFileText, FiPrinter, FiEdit2, FiTrash2, FiCheck, FiClock, FiDownload, FiTruck, FiSend } from 'react-icons/fi';
import { Invoices as InvoiceStore, DeliveryNotes as DNStore, TelegramOrders, HppReports, Products } from '../utils/storage';
import { formatCurrency, formatDateShort, formatNumber } from '../utils/formatter';
import { exportInvoicesToExcel } from '../utils/excel';
import { sendDocument } from '../utils/telegram';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import CombinedPdfTemplates from '../components/CombinedPdfTemplates';
import ConfirmModal from '../components/ConfirmModal';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [printId, setPrintId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
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
      const [allInvs, allDNs] = await Promise.all([
        InvoiceStore.getAll(),
        DNStore.getAll()
      ]);
      setInvoices(allInvs);
      setDeliveryNotes(allDNs);
    } catch (err) {
      console.error('Invoices reload error:', err);
      setError(err.message || 'Gagal memuat data invoice. Silakan periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTelegram(inv) {
    if (!inv) return;
    setSendingId(inv.id);

    try {
      const note = deliveryNotes.find(n => n.invoiceId === inv.id);
      if (!note) {
        toast.error('Surat Jalan untuk invoice ini tidak ditemukan. Silakan buat Surat Jalan terlebih dahulu.');
        setSendingId(null);
        return;
      }

      let chatId = inv.telegramChatId;
      if (!chatId) {
        const orders = await TelegramOrders.getAll();
        const linkedOrder = orders.find(o => o.matchedCustomerId === inv.customerId);
        if (linkedOrder) chatId = linkedOrder.telegramChatId;
      }

      if (!chatId) {
        toast.error('Telegram Chat ID tidak ditemukan untuk customer ini. Pesanan asal harus berasal dari Telegram.');
        setSendingId(null);
        return;
      }

      await new Promise(r => setTimeout(r, 600)); // Allow render

      const canvas1 = await html2canvas(document.getElementById('pdf-invoice-page'), { scale: 3, useCORS: true });
      const img1 = canvas1.toDataURL('image/jpeg', 0.8);
      
      const doc = new jsPDF('p', 'mm', 'a4');
      doc.addImage(img1, 'JPEG', 0, 0, 210, 297);

      doc.addPage();
      const canvas2 = await html2canvas(document.getElementById('pdf-note-page'), { scale: 3, useCORS: true });
      const img2 = canvas2.toDataURL('image/jpeg', 0.8);
      doc.addImage(img2, 'JPEG', 0, 0, 210, 297);

      const blob = doc.output('blob');
      const filename = `Invoice_${inv.invoiceNumber}.pdf`;

      const res = await sendDocument(chatId, blob, filename);
      console.log('sendDocument Response:', res);
      
      if (res.ok) {
        toast.success('PDF Berhasil dikirim ke Telegram');
      } else {
        toast.error(`Gagal mengirim PDF ke Telegram: ${res.description || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan saat membuat dan mengirim PDF: ' + err.message);
    } finally {
      setSendingId(null);
    }
  }

  async function handleDelete(id) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    const id = deleteId;
    if (!id) return;
    
    // Hapus HPP terkait jika ada
    const hpp = await HppReports.getByInvoiceId(id);
    if (hpp) {
      await HppReports.delete(hpp.id);
    }

    // Hapus Surat Jalan terkait jika ada
    const note = deliveryNotes.find(n => n.invoiceId === id);
    if (note) {
      await DNStore.delete(note.id);
    }
    
    // Rollback Stok sebelum invoice dihapus
    const inv = invoices.find(i => i.id === id);
    if (inv && inv.items) {
      for (const it of inv.items) {
        if (it.productId) {
          const product = await Products.getById(it.productId);
          if (product) {
            await Products.update(it.productId, { stock: (product.stock || 0) + (Number(it.qty) || 0) });
          }
        }
      }
    }

    await InvoiceStore.delete(id);
    setDeleteId(null);
    await reload();
  }

  async function togglePaid(inv) {
    const newStatus = inv.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    await InvoiceStore.update(inv.id, { paymentStatus: newStatus });
    await reload();
  }

  const uniqueCustomers = Array.from(new Set(invoices.map(inv => inv.customerName).filter(Boolean))).sort();

  const filtered = invoices
    .filter(inv => {
      if (statusFilter !== 'all' && inv.paymentStatus !== statusFilter) return false;
      if (customerFilter !== 'all' && inv.customerName !== customerFilter) return false;
      const q = search.toLowerCase();
      return (inv.invoiceNumber || '').toLowerCase().includes(q) ||
        (inv.customerName || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const db = b.date || b.createdAt || 0;
      const da = a.date || a.createdAt || 0;
      const tb = db.seconds ? db.seconds * 1000 : new Date(db).getTime();
      const ta = da.seconds ? da.seconds * 1000 : new Date(da).getTime();
      return tb - ta;
    });

  const printInvoice = printId ? invoices.find(i => i.id === printId) : null;

  if (printInvoice) {
    const note = deliveryNotes.find(n => n.invoiceId === printInvoice.id);
    return (
      <div className="print-view">
        <div className="no-print" style={{ marginBottom: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <FiPrinter /> Print / Download PDF
          </button>
          <button className="btn btn-secondary" onClick={() => setPrintId(null)}>Kembali</button>
        </div>
        
        <CombinedPdfTemplates inv={printInvoice} note={note} forPrint={true} />
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Invoice</h1>
          <p>Kelola invoice penjualan</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={() => exportInvoicesToExcel(filtered)}>
            <FiDownload /> Export Excel
          </button>
          <Link to="/invoices/new" className="btn btn-primary">
            <FiPlus /> Buat Invoice
          </Link>
        </div>
      </div>

      {loading && (
        <div className="card p-lg text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-muted">Memuat data invoice...</p>
        </div>
      )}

      {error && (
        <div className="card p-lg text-center animate-in" style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="empty-state-icon" style={{ color: '#ef4444' }}><FiFileText /></div>
          <h3 className="text-danger">{error.includes('Permission Denied') ? 'Akses Database Terbatas (RLS)' : 'Gagal Memuat Data'}</h3>
          <p className="mb-md text-muted">
            {error.includes('Permission Denied') 
              ? 'Data invoice ditemukan di database tapi diblokir oleh kebijakan keamanan (RLS) Supabase Anda. Anda perlu mengaktifkan akses baca bagi role anon di dashboard Supabase.'
              : 'Terjadi kesalahan saat memuat data invoice dari database.'}
          </p>
          <div className="flex-center gap-md">
            <button className="btn btn-primary" onClick={reload}>Coba Lagi (Refresh)</button>
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
          <input name="input_1_2" type="text" placeholder="Cari invoice..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select name="select_3_4" className="form-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Semua Status</option>
          <option value="paid">Lunas</option>
          <option value="unpaid">Belum Bayar</option>
          <option value="partial">Sebagian</option>
        </select>
      </div>

      <div className="tabs-container" style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
        <button 
          className={`btn ${customerFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCustomerFilter('all')}
          style={{ whiteSpace: 'nowrap' }}
        >
          Semua Customer
        </button>
        {uniqueCustomers.map(customer => {
          const isHighlighted = customer === 'SPPG SINDANGJAYA 5' || customer === 'SPPG SINDANGJAYA 2';
          
          let btnClass = 'btn-secondary';
          if (customerFilter === customer) {
            btnClass = isHighlighted ? 'btn-success' : 'btn-primary';
          }
          
          let btnStyle = { whiteSpace: 'nowrap' };
          if (!btnClass.includes('btn-success') && !btnClass.includes('btn-primary') && isHighlighted) {
            btnStyle = { ...btnStyle, borderColor: 'var(--accent-success)', color: 'var(--accent-success)' };
          }

          return (
            <button 
              key={customer}
              className={`btn ${btnClass}`}
              onClick={() => setCustomerFilter(customer)}
              style={btnStyle}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {customer}
                {(() => {
                  const unpaidCount = invoices.filter(inv => inv.customerName === customer && inv.paymentStatus !== 'paid').length;
                  return unpaidCount > 0 ? (
                    <span style={{ background: '#ef4444', color: 'white', padding: '2px 5px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>
                      {unpaidCount}
                    </span>
                  ) : null;
                })()}
              </div>
            </button>
          );
        })}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>No. Invoice</th>
              <th>Customer</th>
              <th>Tanggal</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiFileText /></div>
                    <h3>Belum ada invoice</h3>
                    <p>Klik "Buat Invoice" untuk membuat invoice baru</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(inv => (
              <tr key={inv.id}>
                <td><strong>{inv.invoiceNumber}</strong></td>
                <td>{inv.customerName}</td>
                <td className="text-muted">{formatDateShort(inv.date || inv.createdAt)}</td>
                <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(inv.grandTotal)}</td>
                <td>
                  <span className={`badge ${inv.paymentStatus === 'paid' ? 'badge-success' : inv.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                    {inv.paymentStatus === 'paid' ? 'Lunas' : inv.paymentStatus === 'partial' ? 'Sebagian' : 'Belum Bayar'}
                  </span>
                </td>
                <td className="text-right">
                  <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => togglePaid(inv)} title={inv.paymentStatus === 'paid' ? 'Tandai belum bayar' : 'Tandai lunas'}>
                      {inv.paymentStatus === 'paid' ? <FiClock /> : <FiCheck />}
                    </button>
                    <button className="btn btn-ghost btn-sm text-info" onClick={() => handleSendTelegram(inv)} disabled={!!sendingId} title="Kirim ke Telegram">
                      <FiSend style={{ animation: sendingId === inv.id ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                    <Link to={`/delivery-notes/new?invoiceId=${inv.id}`} className="btn btn-ghost btn-sm" title="Buat Surat Jalan"><FiTruck /></Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPrintId(inv.id)} title="Print"><FiPrinter /></button>
                    <Link to={`/invoices/${inv.id}/edit`} className="btn btn-ghost btn-sm text-primary"><FiEdit2 /></Link>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(inv.id)}><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
      
      {sendingId && (() => {
        const inv = invoices.find(i => i.id === sendingId);
        const note = deliveryNotes.find(n => n.invoiceId === sendingId);
        return <CombinedPdfTemplates inv={inv} note={note} />;
      })()}

      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Hapus Invoice"
        message="Apakah Anda yakin ingin menghapus invoice ini? Laporan HPP dan Surat Jalan terkait akan ikut terhapus otomatis."
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
