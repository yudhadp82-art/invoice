import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiSearch, FiFileText, FiPrinter, FiEdit2, FiTrash2, FiCheck, FiClock, FiDownload, FiTruck, FiSend } from 'react-icons/fi';
import { Invoices as InvoiceStore, DeliveryNotes as DNStore, TelegramOrders, HppReports } from '../utils/storage';
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
  const [printId, setPrintId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() { 
    setInvoices(await InvoiceStore.getAll()); 
    setDeliveryNotes(await DNStore.getAll());
  }

  async function handleSendTelegram(inv) {
    if (!inv) return;
    setSendingId(inv.id);

    try {
      const note = deliveryNotes.find(n => n.invoiceId === inv.id);
      if (!note) {
        alert('Surat Jalan untuk invoice ini tidak ditemukan. Silakan buat Surat Jalan terlebih dahulu.');
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
        alert('Telegram Chat ID tidak ditemukan untuk customer ini. Pesanan asal harus berasal dari Telegram.');
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
        alert('PDF Berhasil dikirim ke Telegram');
      } else {
        alert(`Gagal mengirim PDF ke Telegram: ${res.description || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat membuat PDF.');
    } finally {
      setSendingId(null);
    }
  }

  async function handleDelete(id) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    
    // Hapus HPP terkait jika ada
    const hpp = await HppReports.getByInvoiceId(deleteId);
    if (hpp) {
      await HppReports.delete(hpp.id);
    }
    
    await InvoiceStore.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  async function togglePaid(inv) {
    const newStatus = inv.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    await InvoiceStore.update(inv.id, { paymentStatus: newStatus });
    await reload();
  }

  const filtered = invoices
    .filter(inv => {
      if (statusFilter !== 'all' && inv.paymentStatus !== statusFilter) return false;
      const q = search.toLowerCase();
      return (inv.invoiceNumber || '').toLowerCase().includes(q) ||
        (inv.customerName || '').toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const printInvoice = printId ? invoices.find(i => i.id === printId) : null;

  if (printInvoice) {
    return (
      <div className="print-view" id="print-invoice">
        <div className="no-print" style={{ marginBottom: 20 }}>
          <button className="btn btn-primary" onClick={() => window.print()} style={{ marginRight: 10 }}>
            <FiPrinter /> Print / Download PDF
          </button>
          <button className="btn btn-secondary" onClick={() => setPrintId(null)}>Kembali</button>
        </div>
        
        {/* PRINTABLE AREA */}
        <div style={{ background: 'white', color: 'black', padding: '0px 20px', fontFamily: '"Arial", sans-serif', maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: 6, marginBottom: 10 }}>
            {/* Logo KDMP */}
            <div style={{ width: 55, height: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 15 }}>
              {/* Jika logo-kdmp.png belum ada, akan muncul alt text ini */}
              <img src="/logo-kdmp.png" alt="(Logo)" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            
            <div style={{ flex: 1, textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' }}>KOPERASI DESA MERAH PUTIH</h2>
              <h3 style={{ margin: 0, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>SINDANGJAYA KECAMATAN CIPANAS</h3>
              <p style={{ margin: '1px 0', fontSize: 9, fontWeight: 'bold' }}>NOMOR AHU-0025573.AH.01.29.TAHUN 2025</p>
              <p style={{ margin: 0, fontSize: 9, color: '#555' }}>Jl. Pakalongan No. 06 Desa Sindangjaya, Kecamatan Cipanas, Kabupaten Cianjur, Provinsi Jawa Barat, Indonesia, 43253.</p>
            </div>
          </div>

          {/* Invoice & Date Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <table style={{ fontSize: 11 }}>
              <tbody>
                <tr>
                  <td style={{ width: 80, paddingBottom: 2 }}>Invoice</td>
                  <td style={{ paddingBottom: 2 }}>: {printInvoice.invoiceNumber}</td>
                </tr>
                <tr>
                  <td>Tanggal</td>
                  <td>: {formatDateShort(printInvoice.date || printInvoice.createdAt)}</td>
                </tr>
              </tbody>
            </table>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
              <div style={{ background: '#e5e7eb', padding: '2px 40px', fontWeight: 'bold', fontSize: 12, textTransform: 'lowercase' }}>
                invoice
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div style={{ marginBottom: 10, fontSize: 11 }}>
            <div>Pelanggan</div>
            <table style={{ marginTop: 2 }}>
              <tbody>
                <tr>
                  <td style={{ width: 60, paddingBottom: 2 }}>Nama</td>
                  <td style={{ paddingBottom: 2 }}>: {printInvoice.customerName}</td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: 2 }}>Alamat</td>
                  <td style={{ paddingBottom: 2 }}>: {printInvoice.customerAddress || '-'}</td>
                </tr>
                <tr>
                  <td>Telp</td>
                  <td>: -</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 5, fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'center', background: '#f5f5f5', width: '5%' }}>No.</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'center', background: '#f5f5f5', width: '35%' }}>item</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'center', background: '#f5f5f5', width: '10%' }}>qty</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'center', background: '#f5f5f5', width: '10%' }}>unit</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'center', background: '#f5f5f5', width: '20%' }}>Harga Satuan<br/>(Rp)</th>
                <th style={{ border: '1px solid black', padding: '3px', textAlign: 'center', background: '#f5f5f5', width: '20%' }}>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {printInvoice.items.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>Kosong</td>
                </tr>
              )}
              {printInvoice.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ border: '1px solid black', padding: '3px' }}>{item.productName}</td>
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{formatNumber(item.qty)}</td>
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'center' }}>{item.unit}</td>
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                  <td style={{ border: '1px solid black', padding: '3px', textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Grand Total Row */}
          <div style={{ display: 'flex', width: '100%', fontSize: 11, marginBottom: 15 }}>
            <div style={{ flex: 1, textAlign: 'center', paddingRight: 20 }}>
              total
            </div>
            <div style={{ width: '20%', borderRight: '1px solid black', borderLeft: '1px solid black', borderBottom: '1px solid black', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>
              {formatCurrency(printInvoice.grandTotal)}
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 10 }}>
            <div style={{ width: '60%' }}>
              <table style={{ fontSize: 9 }}>
                <tbody>
                  <tr>
                    <td style={{ paddingBottom: 8, width: 120 }}>NAMA BANK</td>
                    <td style={{ paddingBottom: 8 }}>: BRI</td>
                  </tr>
                  <tr>
                    <td style={{ paddingBottom: 8 }}>CABANG UNIT</td>
                    <td style={{ paddingBottom: 8 }}>: CIPANAS</td>
                  </tr>
                  <tr>
                    <td style={{ paddingBottom: 8 }}>NOMOR AKUN BANK</td>
                    <td style={{ paddingBottom: 8, fontWeight: 'bold' }}>: 3453 - 01 - 000012 - 56 - 6</td>
                  </tr>
                  <tr>
                    <td style={{ paddingBottom: 8 }}>ATAS NAMA</td>
                    <td style={{ paddingBottom: 8 }}>: KOPERASI DESA MERAH PUTIH SINDANGJAYA</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ width: '40%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ marginBottom: 30 }}>Mengetahui</div>
              <div style={{ fontWeight: 'bold' }}>Ujang Rukmana</div>
              <div>ketua</div>
              <div>KDMP Sindangjaya kec.Cipanas</div>
            </div>
          </div>

        </div>
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
        message="Apakah Anda yakin ingin menghapus invoice ini? Laporan HPP terkait akan ikut terhapus, namun data Surat Jalan tetap dipertahankan."
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
