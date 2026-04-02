import { useState, useEffect } from 'react';
import { FiBarChart2, FiCalendar, FiDownload, FiShoppingCart, FiFileText } from 'react-icons/fi';
import { Invoices, PurchaseNotes } from '../utils/storage';
import { formatCurrency, formatNumber, formatDateShort, isToday, isThisMonth } from '../utils/formatter';

export default function Recap() {
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter] = useState('month'); // 'today', 'month', 'all'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    const [invs, notes] = await Promise.all([
      Invoices.getAll(),
      PurchaseNotes.getAll()
    ]);
    setInvoices(invs);
    setPurchaseNotes(notes);
    setLoading(false);
  }

  const filterData = (data) => {
    return data.filter(item => {
      const date = item.date || item.createdAt;
      if (filter === 'today') return isToday(date);
      if (filter === 'month') return isThisMonth(date);
      return true;
    });
  };

  const [purchaseNotes, setPurchaseNotes] = useState([]);
  
  const filteredInvoices = filterData(invoices);
  const filteredPurchases = filterData(purchaseNotes);

  // Aggregasi Penjualan (Invoices)
  const salesSummary = {};
  filteredInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const key = item.productName || 'Tanpa Nama';
      if (!salesSummary[key]) {
        salesSummary[key] = { qty: 0, total: 0, unit: item.unit || '' };
      }
      salesSummary[key].qty += Number(item.qty) || 0;
      salesSummary[key].total += Number(item.subtotal) || 0;
    });
  });

  // Aggregasi Pembelian (Purchase Notes)
  const purchaseSummary = {};
  filteredPurchases.forEach(pn => {
    (pn.items || []).forEach(item => {
      const key = item.materialName || 'Tanpa Nama';
      if (!purchaseSummary[key]) {
        purchaseSummary[key] = { qty: 0, total: 0, unit: item.unit || '' };
      }
      purchaseSummary[key].qty += Number(item.qtyNota) || 0;
      purchaseSummary[key].total += Number(item.totalCost) || 0;
    });
  });

  const totalSalesRevenue = Object.values(salesSummary).reduce((sum, item) => sum + item.total, 0);
  const totalPurchaseCost = Object.values(purchaseSummary).reduce((sum, item) => sum + item.total, 0);
  const balance = totalSalesRevenue - totalPurchaseCost;

  if (loading) return <div className="p-lg text-center">Memuat data...</div>;

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Rekap Penjualan</h1>
          <p>Ringkasan pergerakan barang terjual</p>
        </div>
        <div className="flex gap-sm">
          <div className="btn-group">
            <button 
              className={`btn btn-sm ${filter === 'today' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('today')}
            >
              Hari Ini
            </button>
            <button 
              className={`btn btn-sm ${filter === 'month' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('month')}
            >
              Bulan Ini
            </button>
            <button 
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
            >
              Semua
            </button>
          </div>
        </div>
      </div>

      <div className="stats-grid mb-lg">
        <div className="stat-card blue">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiFileText /></div>
            <div className="stat-card-label">Total Penjualan</div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalSalesRevenue)}</div>
          <div className="stat-card-footer text-sm">
            {filteredInvoices.length} Invoice ditemukan
          </div>
        </div>

        <div className="stat-card orange">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiShoppingCart /></div>
            <div className="stat-card-label">Total Pembelian</div>
          </div>
          <div className="stat-card-value">{formatCurrency(totalPurchaseCost)}</div>
          <div className="stat-card-footer text-sm">
            {filteredPurchases.length} Nota ditemukan
          </div>
        </div>

        <div className={balance >= 0 ? 'stat-card green' : 'stat-card red'}>
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiBarChart2 /></div>
            <div className="stat-card-label">Net Balance</div>
          </div>
          <div className="stat-card-value">{formatCurrency(balance)}</div>
          <div className="stat-card-footer text-sm">
            {balance >= 0 ? 'Surplus' : 'Defisit'} Periode Ini
          </div>
        </div>
      </div>

      <div className="grid grid-2 gap-lg">
        {/* Tabel Penjualan */}
        <div className="card shadow-sm">
          <div className="card-header flex-between">
            <h3 className="flex-center gap-sm"><FiFileText className="text-primary" /> Penjualan per Barang</h3>
          </div>
          <div className="table-container p-0">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Nama Barang</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Total Nilai</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(salesSummary).length === 0 ? (
                  <tr><td colSpan="3" className="text-center text-muted p-md">Tidak ada data penjualan</td></tr>
                ) : (
                  Object.entries(salesSummary)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([name, data]) => (
                      <tr key={name}>
                        <td><strong>{name}</strong></td>
                        <td className="text-right">{formatNumber(data.qty)} {data.unit}</td>
                        <td className="text-right font-medium">{formatCurrency(data.total)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel Pembelian */}
        <div className="card shadow-sm">
          <div className="card-header flex-between">
            <h3 className="flex-center gap-sm"><FiShoppingCart className="text-primary" /> Pembelian Bahan Baku</h3>
          </div>
          <div className="table-container p-0">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Nama Bahan</th>
                  <th className="text-right">Qty Beli</th>
                  <th className="text-right">Total Biaya</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(purchaseSummary).length === 0 ? (
                  <tr><td colSpan="3" className="text-center text-muted p-md">Tidak ada data pembelian</td></tr>
                ) : (
                  Object.entries(purchaseSummary)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([name, data]) => (
                      <tr key={name}>
                        <td><strong>{name}</strong></td>
                        <td className="text-right">{formatNumber(data.qty)} {data.unit}</td>
                        <td className="text-right font-medium">{formatCurrency(data.total)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 992px) {
          .grid-2 {
            grid-template-columns: 1fr;
          }
        }
        .btn-group {
          display: flex;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px;
          border-radius: 8px;
        }
        .btn-group .btn {
          border-radius: 6px;
          border: none;
        }
        .font-medium {
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
