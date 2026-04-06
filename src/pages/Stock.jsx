import { useState, useEffect } from 'react';
import { Products as ProductStore, SupportingMaterialItems as MasterItemStore, Purchases, Invoices as InvoiceStore, ProductionMaterials as MatStore, ProductionNeeds as NeedStore, HppReports as HppStore, PurchaseNotes as PNStore } from '../utils/storage';
import { formatCurrency, formatNumber } from '../utils/formatter';
import { exportToExcel } from '../utils/excel';
import { FiPackage, FiSearch, FiAlertTriangle, FiTrendingUp, FiDollarSign, FiDownload, FiArrowRight, FiRefreshCw, FiCheckCircle, FiTrash2 } from 'react-icons/fi';

export default function Stock() {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  
  // Data for Barang Keluar
  const [invoices, setInvoices] = useState([]);
  const [hppReports, setHppReports] = useState([]);
  const [productionNeeds, setProductionNeeds] = useState([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [allProds, allMats, allInvs, allHpps, allNeeds] = await Promise.all([
          ProductStore.getAll(),
          MasterItemStore.getAll(),
          InvoiceStore.getAll(),
          HppStore.getAll(),
          NeedStore.getAll()
        ]);
        setProducts(allProds);
        setMaterials(allMats);
        setInvoices(allInvs);
        setHppReports(allHpps);
        setProductionNeeds(allNeeds);
      } catch (err) {
        console.error('Stock load error:', err);
        setError(err.message || 'Gagal memuat data stok. Silakan periksa koneksi internet Anda.');
      } finally {
        setLoading(false);
      }
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

  // Process Barang Keluar
  const barangKeluarList = [];

  // 1. From Invoices (Product Sales)
  invoices.forEach(inv => {
    (inv.items || []).forEach(it => {
      barangKeluarList.push({
        id: `inv-${inv.id}-${it.productId || it.name}`,
        date: inv.date || inv.createdAt,
        type: 'Penjualan',
        itemName: it.name || 'Produk Tidak Terdeteksi',
        qty: it.qty,
        unit: it.unit || '',
        reference: inv.customerName || 'Pelanggan Umum',
        invoiceId: inv.id
      });
    });
  });

  // 2. From HPP Reports (Ingredients Usage)
  hppReports.forEach(hpp => {
    (hpp.itemCosts || []).forEach(it => {
      // Ingredients (Sub Items)
      if (it.useSubItems) {
        (it.subItems || []).forEach(sub => {
          barangKeluarList.push({
            id: `hpp-sub-${hpp.id}-${sub.nama}`,
            date: hpp.createdAt,
            type: 'Pemakaian HPP',
            itemName: sub.nama,
            qty: sub.qty,
            unit: sub.satuan || '',
            reference: `HPP: ${hpp.customerName || 'Umum'}`,
            hppId: hpp.id
          });
        });
      }
    });

    // Extra Vegetables
    (hpp.extraVegetables || []).forEach(ex => {
      barangKeluarList.push({
        id: `hpp-ex-${hpp.id}-${ex.nama}`,
        date: hpp.createdAt,
        type: 'Sayuran Tambahan',
        itemName: ex.nama,
        qty: ex.qty,
        unit: ex.satuan || '',
        reference: `HPP: ${hpp.customerName || 'Umum'}`,
        hppId: hpp.id
      });
    });
  });

  // 3. From Production Needs (Material Usage)
  productionNeeds.forEach(pn => {
    barangKeluarList.push({
      id: `pn-${pn.id}`,
      date: pn.createdAt,
      type: 'Produksi',
      itemName: pn.itemName,
      qty: pn.qty,
      unit: pn.unit || '',
      reference: pn.note || 'Pemakaian Bahan',
      needId: pn.id
    });
  });

  // Sort by date newest first
  const sortedBarangKeluar = barangKeluarList.sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredBarangKeluar = sortedBarangKeluar.filter(bk => 
    bk.itemName.toLowerCase().includes(search.toLowerCase()) ||
    bk.type.toLowerCase().includes(search.toLowerCase()) ||
    bk.reference.toLowerCase().includes(search.toLowerCase())
  );

  const totalProductValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.purchaseCost || 0)), 0);
  const totalMaterialValue = materials.reduce((sum, m) => sum + ((m.stock || 0) * (m.defaultPrice || 0)), 0);
  
  const lowStockProducts = products.filter(p => (p.stock || 0) <= 5);
  const lowStockMaterials = materials.filter(m => (m.stock || 0) <= 10);

  async function handleResetAll() {
    if (!window.confirm('PERINGATAN: Opsi ini akan mereset seluruh angka stok Master (Produk & Bahan) menjadi 0. Data riwayat transaksi (Invoice/Beli) TETAP ADA. Gunakan ini jika Anda ingin mengawali perhitungan stok baru. Lanjutkan?')) return;
    
    setIsSyncing(true);
    try {
      const [allProds, allMats] = await Promise.all([
        ProductStore.getAll(),
        MasterItemStore.getAll()
      ]);

      await Promise.all([
        ...allProds.map(p => ProductStore.update(p.id, { stock: 0 })),
        ...allMats.map(m => MasterItemStore.update(m.id, { stock: 0 }))
      ]);

      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
      
      setProducts(await ProductStore.getAll());
      setMaterials(await MasterItemStore.getAll());
      setInvoices(await InvoiceStore.getAll());
      setHppReports(await HppStore.getAll());
      setProductionNeeds(await NeedStore.getAll());
      alert('Seluruh angka stok Master telah di-reset menjadi 0.');

    } catch (error) {
       // logic handled
    }
  }

  async function handleSyncAll() {
    if (!window.confirm('Apakah Anda yakin ingin menyinkronkan seluruh stok? Sistem akan menghitung ulang saldo stok dari seluruh riwayat pembelian dan pemakaian.')) return;
    
    setIsSyncing(true);
    try {
      const [allProds, allMats, allPurchs, allInvs, allProdMats, allProdNeeds, allHpps, allPurchaseNotes] = await Promise.all([
        ProductStore.getAll(),
        MasterItemStore.getAll(),
        Purchases.getAll(),
        InvoiceStore.getAll(),
        MatStore.getAll(),
        NeedStore.getAll(),
        HppStore.getAll(),
        PNStore.getAll()
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
        ProductStore.update(p.id, { stock: prodStockMap[p.id] })
      ));

      // 2. Sync Supporting Materials
      const matStockMap = {};
      allMats.forEach(m => { matStockMap[m.id] = 0; });

      // In: Production Materials (Old Purchases model)
      allProdMats.forEach(pm => {
        if (pm.materialItemId && matStockMap[pm.materialItemId] !== undefined) {
          matStockMap[pm.materialItemId] += (Number(pm.qty) || 0);
        }
      });

      // In: Purchase Notes (New model with splits and shrinkage)
      allPurchaseNotes.forEach(pn => {
        (pn.items || []).forEach(it => {
          if (it.materialId && matStockMap[it.materialId] !== undefined) {
            const netS5 = Number(it.splits?.s5?.netQty) || 0;
            const netS2 = Number(it.splits?.s2?.netQty) || 0;
            matStockMap[it.materialId] += (netS5 + netS2);
          }
        });
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
        MasterItemStore.update(m.id, { stock: matStockMap[m.id] })
      ));

      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
      
      // Reload current local state
      setProducts(await ProductStore.getAll());
      setMaterials(await MasterItemStore.getAll());
      setInvoices(await InvoiceStore.getAll());
      setHppReports(await HppStore.getAll());
      setProductionNeeds(await NeedStore.getAll());

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
    } else if (activeTab === 'materials') {
      const columns = [
        { key: 'name', header: 'Nama Bahan', width: 25 },
        { key: 'stock', header: 'Stok', width: 10 },
        { key: 'unit', header: 'Satuan', width: 10 },
        { key: 'defaultPrice', header: 'Harga Standar', width: 15 },
      ];
      exportToExcel(materials, 'stok_bahan_export', 'Stok Bahan Pendukung', columns);
    } else if (activeTab === 'barang_keluar') {
      const columns = [
        { key: 'date', header: 'Tanggal', width: 20 },
        { key: 'type', header: 'Jenis', width: 15 },
        { key: 'itemName', header: 'Nama Barang', width: 25 },
        { key: 'qty', header: 'Qty', width: 10 },
        { key: 'unit', header: 'Satuan', width: 10 },
        { key: 'reference', header: 'Keterangan', width: 30 },
      ];
      // Format date for excel
      const exportData = filteredBarangKeluar.map(bk => ({
        ...bk,
        date: new Date(bk.date).toLocaleString('id-ID')
      }));
      exportToExcel(exportData, 'barang_keluar_export', 'Rincian Barang Keluar', columns);
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
          <button className="btn btn-ghost text-danger" onClick={handleResetAll} disabled={isSyncing} title="Reset semua angka stok menjadi 0">
            <FiTrash2 /> Reset Angka Stok
          </button>
          <button className={`btn ${syncSuccess ? 'btn-success' : 'btn-secondary'}`} onClick={handleSyncAll} disabled={isSyncing}>
            {isSyncing ? <FiRefreshCw className="spin" /> : syncSuccess ? <FiCheckCircle /> : <FiRefreshCw />}
            {isSyncing ? 'Menyinkronkan...' : syncSuccess ? 'Stok Sinkron!' : 'Sinkronisasi Stok'}
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            <FiDownload /> Export Excel
          </button>
        </div>
      </div>

      {loading && (
        <div className="card p-lg text-center animate-in">
          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
          <p className="text-muted">Memuat data inventaris...</p>
        </div>
      )}

      {error && (
        <div className="card p-lg text-center animate-in" style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <div className="empty-state-icon" style={{ color: '#ef4444' }}><FiAlertTriangle /></div>
          <h3 className="text-danger">{error.includes('Permission Denied') ? 'Akses Stok Terbatas (RLS)' : 'Gagal Memuat Stok'}</h3>
          <p className="mb-md text-muted">
            {error.includes('Permission Denied') 
              ? 'Data inventaris ditemukan di database tapi diblokir oleh kebijakan keamanan (RLS) Supabase Anda. Anda perlu mengaktifkan akses baca bagi role anon di dashboard Supabase.'
              : 'Terjadi kesalahan saat memuat data stok dari database.'}
          </p>
          <div className="flex-center gap-md">
            <button className="btn btn-primary" onClick={() => window.dispatchEvent(new Event('app-data-mutation'))}>Coba Lagi (Refresh)</button>
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
        <button className={`tab ${activeTab === 'barang_keluar' ? 'active' : ''}`} onClick={() => setActiveTab('barang_keluar')}>
          Rinci Barang Keluar
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input 
            type="text" 
            placeholder={`Cari ${activeTab === 'products' ? 'produk' : activeTab === 'materials' ? 'bahan' : 'transaksi'}...`} 
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
            ) : activeTab === 'barang_keluar' ? (
              <tr>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th>Nama Barang</th>
                <th style={{ textAlign: 'right' }}>Qty Keluar</th>
                <th>Satuan</th>
                <th>Keterangan</th>
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
            ) : activeTab === 'barang_keluar' ? (
              filteredBarangKeluar.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-xl text-muted">Data barang keluar tidak ditemukan</td>
                </tr>
              ) : (
                filteredBarangKeluar.map(bk => (
                  <tr key={bk.id}>
                    <td className="text-muted text-xs">
                      {new Date(bk.date).toLocaleDateString('id-ID')}
                      <br />
                      <span style={{ fontSize: 10 }}>{new Date(bk.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td>
                      <span className={`badge ${
                        bk.type === 'Penjualan' ? 'badge-info' : 
                        bk.type === 'Pemakaian HPP' ? 'badge-warning' : 
                        bk.type === 'Sayuran Tambahan' ? 'badge-warning' :
                        'badge-secondary'
                      }`}>
                        {bk.type}
                      </span>
                    </td>
                    <td><strong>{bk.itemName}</strong></td>
                    <td className="text-right">
                      <span style={{ fontWeight: 700, color: '#f87171' }}>-{formatNumber(bk.qty)}</span>
                    </td>
                    <td><span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>{bk.unit}</span></td>
                    <td className="text-muted text-xs">{bk.reference}</td>
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

      </>
      )}

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
