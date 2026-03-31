import { useState, useEffect } from 'react';
import { FiPackage, FiSearch, FiAlertTriangle, FiTrendingUp, FiDollarSign, FiDownload, FiArrowRight } from 'react-icons/fi';
import { Products, SupportingMaterialItems, Purchases, ProductionMaterials } from '../utils/storage';
import { formatCurrency, formatNumber } from '../utils/formatter';
import { exportToExcel } from '../utils/excel';

export default function Stock() {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setProducts(await Products.getAll());
      setMaterials(await SupportingMaterialItems.getAll());
      setLoading(false);
    }
    loadData();
    window.addEventListener('app-data-mutation', loadData);
    return () => window.removeEventListener('app-data-mutation', loadData);
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.sku || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalProductValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.purchaseCost || 0)), 0);
  const totalMaterialValue = materials.reduce((sum, m) => sum + ((m.stock || 0) * (m.defaultPrice || 0)), 0);
  
  const lowStockProducts = products.filter(p => (p.stock || 0) <= 5);
  const lowStockMaterials = materials.filter(m => (m.stock || 0) <= 10);

  function handleExport() {
    if (activeTab === 'products') {
      const columns = [
        { key: 'name', header: 'Nama Produk', width: 25 },
        { key: 'sku', header: 'SKU', width: 15 },
        { key: 'stock', header: 'Stok', width: 10 },
        { key: 'unit', header: 'Satuan', width: 10 },
        { key: 'purchaseCost', header: 'Harga Beli', width: 15 },
      ];
      exportToExcel(products, 'stok_produk_export', 'Stok Produk Jadi', columns);
    } else {
      const columns = [
        { key: 'name', header: 'Nama Bahan', width: 25 },
        { key: 'stock', header: 'Stok', width: 10 },
        { key: 'unit', header: 'Satuan', width: 10 },
        { key: 'defaultPrice', header: 'Harga Standar', width: 15 },
      ];
      exportToExcel(materials, 'stok_bahan_export', 'Stok Bahan Pendukung', columns);
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>Stok Barang</h1>
          <p>Monitoring persediaan produk dan bahan pendukung</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={handleExport}>
            <FiDownload /> Export Excel
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiPackage /></div>
          </div>
          <div className="stat-card-value">{activeTab === 'products' ? products.length : materials.length}</div>
          <div className="stat-card-label">Total Item {activeTab === 'products' ? 'Produk' : 'Bahan'}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiAlertTriangle /></div>
          </div>
          <div className="stat-card-value">{activeTab === 'products' ? lowStockProducts.length : lowStockMaterials.length}</div>
          <div className="stat-card-label">Item Stok Menipis</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-header">
            <div className="stat-card-icon"><FiDollarSign /></div>
          </div>
          <div className="stat-card-value">{formatCurrency(activeTab === 'products' ? totalProductValue : totalMaterialValue)}</div>
          <div className="stat-card-label">Total Nilai Aset Stok</div>
        </div>
      </div>

      <div className="tabs mb-lg">
        <button className={`tab ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
          Produk Jadi
        </button>
        <button className={`tab ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
          Bahan Pendukung
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input 
            type="text" 
            placeholder={`Cari ${activeTab === 'products' ? 'produk' : 'bahan'}...`} 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            {activeTab === 'products' ? (
              <tr>
                <th>Nama Produk</th>
                <th>SKU</th>
                <th style={{ textAlign: 'right' }}>Stok</th>
                <th>Satuan</th>
                <th style={{ textAlign: 'right' }}>Harga Beli</th>
                <th style={{ textAlign: 'right' }}>Total Nilai</th>
                <th>Status</th>
              </tr>
            ) : (
              <tr>
                <th>Nama Bahan</th>
                <th style={{ textAlign: 'right' }}>Stok</th>
                <th>Satuan</th>
                <th style={{ textAlign: 'right' }}>Harga Standar</th>
                <th style={{ textAlign: 'right' }}>Total Nilai</th>
                <th>Status</th>
              </tr>
            )}
          </thead>
          <tbody>
            {activeTab === 'products' ? (
              filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-xl text-muted">Data produk tidak ditemukan</td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td className="text-muted text-xs">{p.sku || '-'}</td>
                    <td className="text-right">
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{formatNumber(p.stock)}</span>
                    </td>
                    <td><span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>{p.unit}</span></td>
                    <td className="text-right">{formatCurrency(p.purchaseCost)}</td>
                    <td className="text-right" style={{ fontWeight: 600, color: '#38bdf8' }}>{formatCurrency((p.stock || 0) * (p.purchaseCost || 0))}</td>
                    <td>
                      {(p.stock || 0) <= 0 ? (
                        <span className="badge badge-danger">Habis</span>
                      ) : (p.stock || 0) <= 5 ? (
                        <span className="badge badge-warning">Menipis</span>
                      ) : (
                        <span className="badge badge-success">Aman</span>
                      )}
                    </td>
                  </tr>
                ))
              )
            ) : (
              filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-xl text-muted">Data bahan tidak ditemukan</td>
                </tr>
              ) : (
                filteredMaterials.map(m => (
                  <tr key={m.id}>
                    <td><strong>{m.name}</strong></td>
                    <td className="text-right">
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{formatNumber(m.stock)}</span>
                    </td>
                    <td><span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>{m.unit}</span></td>
                    <td className="text-right">{formatCurrency(m.defaultPrice)}</td>
                    <td className="text-right" style={{ fontWeight: 600, color: '#38bdf8' }}>{formatCurrency((m.stock || 0) * (m.defaultPrice || 0))}</td>
                    <td>
                      {(m.stock || 0) <= 0 ? (
                        <span className="badge badge-danger">Habis</span>
                      ) : (m.stock || 0) <= 10 ? (
                        <span className="badge badge-warning">Menipis</span>
                      ) : (
                        <span className="badge badge-success">Aman</span>
                      )}
                    </td>
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .animate-in {
          animation: slideUp 0.4s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
