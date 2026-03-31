import { useState, useEffect } from 'react';
import { Products, SupportingMaterialItems, Purchases, Invoices, ProductionMaterials, ProductionNeeds, HppReports } from '../utils/storage';
import { formatCurrency, formatNumber } from '../utils/formatter';
import { exportToExcel } from '../utils/excel';
import { FiPackage, FiSearch, FiAlertTriangle, FiTrendingUp, FiDollarSign, FiDownload, FiArrowRight, FiRefreshCw, FiCheckCircle } from 'react-icons/fi';

export default function Stock() {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

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

  async function handleSyncAll() {
    if (!window.confirm('Apakah Anda yakin ingin menyinkronkan seluruh stok? Sistem akan menghitung ulang saldo stok dari seluruh riwayat pembelian dan pemakaian.')) return;
    
    setIsSyncing(true);
    try {
      const [allProds, allMats, allPurchs, allInvs, allProdMats, allProdNeeds, allHpps] = await Promise.all([
        Products.getAll(),
        SupportingMaterialItems.getAll(),
        Purchases.getAll(),
        Invoices.getAll(),
        ProductionMaterials.getAll(),
        ProductionNeeds.getAll(),
        HppReports.getAll()
      ]);

      // 1. Sync Products (Finished Goods / Ingredients)
      const prodStockMap = {};
      allProds.forEach(p => { prodStockMap[p.id] = 0; });

      // In: Purchases
      allPurchs.forEach(p => {
        (p.items || []).forEach(it => {
          if (it.productId && prodStockMap[it.productId] !== undefined) {
            prodStockMap[it.productId] += (Number(it.qty) || 0);
          }
        });
      });

      // Out: Invoices (Sales)
      allInvs.forEach(inv => {
        (inv.items || []).forEach(it => {
          if (it.productId && prodStockMap[it.productId] !== undefined) {
            prodStockMap[it.productId] -= (Number(it.qty) || 0);
          }
        });
      });

      // Out: HPP (Usage as ingredients)
      allHpps.forEach(hpp => {
        (hpp.itemCosts || []).forEach(it => {
          if (it.useSubItems) {
            // Mix veg items
            (it.subItems || []).forEach(sub => {
              // Note: Match by name if productId is missing in subItems
              const pMatch = allProds.find(p => p.id === sub.productId || (p.name || '').toLowerCase() === (sub.nama || '').toLowerCase());
              if (pMatch && prodStockMap[pMatch.id] !== undefined) {
                prodStockMap[pMatch.id] -= (Number(sub.qty) || 0);
              }
            });
          }
          // Extra Vegetables in HPP
          (hpp.extraVegetables || []).forEach(ex => {
            const pMatch = allProds.find(p => p.id === ex.productId || (p.name || '').toLowerCase() === (ex.nama || '').toLowerCase());
            if (pMatch && prodStockMap[pMatch.id] !== undefined) {
              prodStockMap[pMatch.id] -= (Number(ex.qty) || 0);
            }
          });
        });
      });

      // Update Products DB
      await Promise.all(allProds.map(p => 
        Products.update(p.id, { stock: prodStockMap[p.id] })
      ));

      // 2. Sync Supporting Materials
      const matStockMap = {};
      allMats.forEach(m => { matStockMap[m.id] = 0; });

      // In: Production Materials (Purchases)
      allProdMats.forEach(pm => {
        if (pm.materialItemId && matStockMap[pm.materialItemId] !== undefined) {
          matStockMap[pm.materialItemId] += (Number(pm.qty) || 0);
        }
      });

      // Out: Production Needs (Usage)
      allProdNeeds.forEach(pn => {
        const mMatch = allMats.find(m => (m.name || '').toLowerCase() === (pn.itemName || '').toLowerCase());
        if (mMatch && matStockMap[mMatch.id] !== undefined) {
          matStockMap[mMatch.id] -= (Number(pn.qty) || 0);
        }
      });

      // Update Materials DB
      await Promise.all(allMats.map(m => 
        SupportingMaterialItems.update(m.id, { stock: matStockMap[m.id] })
      ));

      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
      
      // Reload current local state
      setProducts(await Products.getAll());
      setMaterials(await SupportingMaterialItems.getAll());

    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat sinkronisasi stok.');
    } finally {
      setIsSyncing(false);
    }
  }

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
          <h1>Daftar Stock</h1>
          <p>Monitoring persediaan produk dan bahan pendukung</p>
        </div>
        <div className="flex gap-sm">
          <button className={`btn ${syncSuccess ? 'btn-success' : 'btn-secondary'}`} onClick={handleSyncAll} disabled={isSyncing}>
            {isSyncing ? <FiRefreshCw className="spin" /> : syncSuccess ? <FiCheckCircle /> : <FiRefreshCw />}
            {isSyncing ? 'Menyinkronkan...' : syncSuccess ? 'Stok Sinkron!' : 'Sinkronisasi Stok'}
          </button>
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
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
