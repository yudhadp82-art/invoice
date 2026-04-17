import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiFileText, FiPrinter, FiRefreshCw } from 'react-icons/fi';
import { Invoices as InvoiceStore } from '../utils/storage';
import { formatCurrency, formatDate, formatDateShort } from '../utils/formatter';

const CUSTOMER_NAME = 'SPPG SINDANGJAYA 3';

function getInvoiceDateValue(inv) {
  const rawDate = inv?.date || inv?.createdAt;
  if (!rawDate) return '';

  if (typeof rawDate === 'string') {
    return rawDate.slice(0, 10);
  }

  if (rawDate?.seconds) {
    return new Date(rawDate.seconds * 1000).toISOString().slice(0, 10);
  }

  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function numberToWordsId(value) {
  const num = Math.floor(Math.abs(Number(value) || 0));
  const words = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

  function convert(n) {
    if (n < 12) return words[n];
    if (n < 20) return `${convert(n - 10)} belas`;
    if (n < 100) return `${convert(Math.floor(n / 10))} puluh${n % 10 ? ` ${convert(n % 10)}` : ''}`;
    if (n < 200) return `seratus${n % 100 ? ` ${convert(n - 100)}` : ''}`;
    if (n < 1000) return `${convert(Math.floor(n / 100))} ratus${n % 100 ? ` ${convert(n % 100)}` : ''}`;
    if (n < 2000) return `seribu${n % 1000 ? ` ${convert(n - 1000)}` : ''}`;
    if (n < 1000000) return `${convert(Math.floor(n / 1000))} ribu${n % 1000 ? ` ${convert(n % 1000)}` : ''}`;
    if (n < 1000000000) return `${convert(Math.floor(n / 1000000))} juta${n % 1000000 ? ` ${convert(n % 1000000)}` : ''}`;
    if (n < 1000000000000) return `${convert(Math.floor(n / 1000000000))} miliar${n % 1000000000 ? ` ${convert(n % 1000000000)}` : ''}`;
    return `${convert(Math.floor(n / 1000000000000))} triliun${n % 1000000000000 ? ` ${convert(n % 1000000000000)}` : ''}`;
  }

  if (num === 0) return 'nol rupiah';
  return `${convert(num).replace(/\s+/g, ' ').trim()} rupiah`;
}

function buildReceiptNumber(dateFrom, dateTo) {
  const fromPart = dateFrom ? dateFrom.replaceAll('-', '') : 'ALL';
  const toPart = dateTo ? dateTo.replaceAll('-', '') : 'OPEN';
  return `KW-SPPG3/${fromPart}-${toPart}`;
}

export default function SppgSindangjaya3Receipt() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const allInvoices = await InvoiceStore.getAll();
      setInvoices(allInvoices);
    } catch (err) {
      console.error('SppgSindangjaya3Receipt reload error:', err);
      setError(err.message || 'Gagal memuat data invoice untuk kwitansi.');
    } finally {
      setLoading(false);
    }
  }

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(inv => inv.customerName === CUSTOMER_NAME)
      .filter(inv => {
        const invoiceDate = getInvoiceDateValue(inv);
        if (dateFrom && (!invoiceDate || invoiceDate < dateFrom)) return false;
        if (dateTo && (!invoiceDate || invoiceDate > dateTo)) return false;
        if (paymentStatus !== 'all' && (inv.paymentStatus || 'unpaid') !== paymentStatus) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = getInvoiceDateValue(a);
        const dateB = getInvoiceDateValue(b);
        return dateA.localeCompare(dateB) || String(a.invoiceNumber || '').localeCompare(String(b.invoiceNumber || ''));
      });
  }, [dateFrom, dateTo, invoices, paymentStatus]);

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
  const receiptNumber = buildReceiptNumber(dateFrom, dateTo);
  const dateLabel = dateTo
    ? `${formatDateShort(dateFrom)} s/d ${formatDateShort(dateTo)}`
    : (dateFrom ? formatDateShort(dateFrom) : 'Semua tanggal');
  const referenceText = filteredInvoices.length > 0
    ? filteredInvoices.map(inv => inv.invoiceNumber).join(', ')
    : '-';
  const amountSentence = `Telah diterima uang sejumlah ${formatCurrency(totalAmount)} (${numberToWordsId(totalAmount)}).`;

  if (printMode) {
    return (
      <div className="print-view">
        <div className="no-print" style={{ marginBottom: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <FiPrinter /> Print / Download PDF
          </button>
          <button className="btn btn-secondary" onClick={() => setPrintMode(false)}>Kembali</button>
        </div>

        <div
          style={{
            background: 'white',
            color: 'black',
            maxWidth: 820,
            margin: '0 auto',
            border: '2px solid black',
            padding: '24px 28px',
            fontFamily: '"Times New Roman", serif',
            lineHeight: 1.35
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>Koperasi Desa Merah Putih</div>
              <div style={{ fontSize: 22, fontWeight: 700, textTransform: 'uppercase' }}>Sindangjaya Kecamatan Cipanas</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Jl. Pakalongan No. 06 Desa Sindangjaya, Kecamatan Cipanas, Kabupaten Cianjur</div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 200 }}>
              <div style={{ fontSize: 12 }}>No. Kwitansi</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{receiptNumber}</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>{formatDate(dateTo || dateFrom || new Date().toISOString())}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>Kwitansi</div>
            <div style={{ fontSize: 12, letterSpacing: 1 }}>Bukti Penerimaan Pembayaran</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, marginBottom: 20 }}>
            <tbody>
              <tr>
                <td style={{ width: 170, padding: '6px 0', verticalAlign: 'top' }}>Sudah terima dari</td>
                <td style={{ width: 10, padding: '6px 0', verticalAlign: 'top' }}>:</td>
                <td style={{ padding: '6px 0', borderBottom: '1px dotted black', fontWeight: 700 }}>{CUSTOMER_NAME}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', verticalAlign: 'top' }}>Banyaknya uang</td>
                <td style={{ padding: '8px 0', verticalAlign: 'top' }}>:</td>
                <td style={{ padding: '8px 0' }}>
                  <div style={{ border: '1px solid black', padding: '10px 12px', minHeight: 44, fontStyle: 'italic' }}>
                    {amountSentence}
                  </div>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', verticalAlign: 'top' }}>Untuk pembayaran</td>
                <td style={{ padding: '8px 0', verticalAlign: 'top' }}>:</td>
                <td style={{ padding: '8px 0' }}>
                  <div style={{ borderBottom: '1px dotted black', paddingBottom: 4 }}>Pembayaran invoice</div>
                  <div style={{ borderBottom: '1px dotted black', paddingTop: 4 }}>{CUSTOMER_NAME}</div>
                  <div style={{ borderBottom: '1px dotted black', paddingTop: 4 }}>Periode {dateLabel}</div>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', verticalAlign: 'top' }}>Referensi invoice</td>
                <td style={{ padding: '8px 0', verticalAlign: 'top' }}>:</td>
                <td style={{ padding: '8px 0', borderBottom: '1px dotted black' }}>{referenceText}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: 20, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Rincian Invoice</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid black', padding: 6, width: 34 }}>No</th>
                    <th style={{ border: '1px solid black', padding: 6 }}>No. Invoice</th>
                    <th style={{ border: '1px solid black', padding: 6, width: 110 }}>Tanggal</th>
                    <th style={{ border: '1px solid black', padding: 6, width: 150, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ border: '1px solid black', padding: 10, textAlign: 'center' }}>Tidak ada invoice pada filter ini</td>
                    </tr>
                  ) : filteredInvoices.map((inv, index) => (
                    <tr key={inv.id}>
                      <td style={{ border: '1px solid black', padding: 6, textAlign: 'center' }}>{index + 1}</td>
                      <td style={{ border: '1px solid black', padding: 6 }}>{inv.invoiceNumber || '-'}</td>
                      <td style={{ border: '1px solid black', padding: 6, textAlign: 'center' }}>{formatDateShort(inv.date || inv.createdAt)}</td>
                      <td style={{ border: '1px solid black', padding: 6, textAlign: 'right', fontWeight: 700 }}>{formatCurrency(inv.grandTotal)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} style={{ border: '1px solid black', padding: 8, textAlign: 'right', fontWeight: 700 }}>Total</td>
                    <td style={{ border: '1px solid black', padding: 8, textAlign: 'right', fontWeight: 700 }}>{formatCurrency(totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ width: 220, flexShrink: 0 }}>
              <div style={{ border: '2px solid black', padding: '14px 12px', minHeight: 110 }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', marginBottom: 8 }}>Jumlah</div>
                <div style={{ fontSize: 30, fontWeight: 700, textAlign: 'right' }}>{formatCurrency(totalAmount)}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 36, fontSize: 14 }}>
            <div style={{ width: 260, textAlign: 'center' }}>
              <div>Penyetor</div>
              <div style={{ height: 72 }} />
              <div style={{ borderTop: '1px solid black', paddingTop: 6 }}>{CUSTOMER_NAME}</div>
            </div>
            <div style={{ width: 260, textAlign: 'center' }}>
              <div>Penerima</div>
              <div style={{ height: 72 }} />
              <div style={{ borderTop: '1px solid black', paddingTop: 6 }}>Koperasi Desa Merah Putih Sindangjaya</div>
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
          <h1>Kwitansi SPPG 3</h1>
          <p>Filter invoice {CUSTOMER_NAME} lalu cetak kwitansi gabungan sesuai periode.</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={reload}>
            <FiRefreshCw /> Refresh
          </button>
          <button className="btn btn-primary" disabled={filteredInvoices.length === 0} onClick={() => setPrintMode(true)}>
            <FiPrinter /> Cetak Kwitansi
          </button>
        </div>
      </div>

      {loading && (
        <div className="card p-lg text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-muted">Memuat invoice {CUSTOMER_NAME}...</p>
        </div>
      )}

      {error && (
        <div className="card p-lg text-center animate-in" style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="empty-state-icon" style={{ color: '#ef4444' }}><FiFileText /></div>
          <h3 className="text-danger">Gagal Memuat Data</h3>
          <p className="mb-md text-muted">{error}</p>
          <button className="btn btn-primary" onClick={reload}>Coba Lagi</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="toolbar" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <label className="form-label">Dari Tanggal</label>
              <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Sampai Tanggal</label>
              <input type="date" className="form-input" min={dateFrom || undefined} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Status Pembayaran</label>
              <select className="form-select" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                <option value="all">Semua</option>
                <option value="paid">Lunas</option>
                <option value="partial">Sebagian</option>
                <option value="unpaid">Belum Bayar</option>
              </select>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setPaymentStatus('all');
              }}
            >
              Reset Filter
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card cyan">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiFileText /></div>
              </div>
              <div className="stat-card-value">{filteredInvoices.length}</div>
              <div className="stat-card-label">Invoice Terpilih</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-card-header">
                <div className="stat-card-icon"><FiCalendar /></div>
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.8rem' }}>{formatCurrency(totalAmount)}</div>
              <div className="stat-card-label">Total Kwitansi</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3 className="card-title">Preview Kwitansi</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>No. Kwitansi</div>
                <div style={{ fontWeight: 700 }}>{receiptNumber}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>Periode</div>
                <div style={{ fontWeight: 700 }}>{dateLabel}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>Penerima Dana</div>
                <div style={{ fontWeight: 700 }}>{CUSTOMER_NAME}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>Terbilang</div>
                <div>{amountSentence}</div>
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>No. Invoice</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">
                        <div className="empty-state-icon"><FiFileText /></div>
                        <h3>Tidak ada invoice yang cocok</h3>
                        <p>Ubah filter tanggal atau status pembayaran untuk menampilkan data kwitansi.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td><strong>{inv.invoiceNumber || '-'}</strong></td>
                    <td>{formatDateShort(inv.date || inv.createdAt)}</td>
                    <td>
                      <span className={`badge ${(inv.paymentStatus || 'unpaid') === 'paid' ? 'badge-success' : (inv.paymentStatus || 'unpaid') === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                        {(inv.paymentStatus || 'unpaid') === 'paid' ? 'Lunas' : (inv.paymentStatus || 'unpaid') === 'partial' ? 'Sebagian' : 'Belum Bayar'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(inv.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
