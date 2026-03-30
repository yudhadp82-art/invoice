import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiTrash2, FiEdit2, FiDollarSign, FiTruck, FiPackage, FiUsers, FiAlertTriangle, FiChevronDown, FiChevronUp, FiDownload, FiPrinter } from 'react-icons/fi';
import Modal from '../components/Modal';
import { HppReports, Invoices as InvoiceStore, Purchases as PurchaseStore, Products as ProductStore } from '../utils/storage';
import { formatCurrency, formatDateShort, formatNumber, formatNumberInput } from '../utils/formatter';
import { exportHppToExcel } from '../utils/excel';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import HppPdfTemplate from '../components/HppPdfTemplate';
import ConfirmModal from '../components/ConfirmModal';

// Bahan default untuk mix vegetable
const MIX_VEG_DEFAULTS = [
  { nama: 'Wortel', qty: 0, harga: 0 },
  { nama: 'Buncis', qty: 0, harga: 0 },
  { nama: 'Jagung', qty: 0, harga: 0 },
  { nama: 'Kol', qty: 0, harga: 0 },
  { nama: 'Daun Bawang', qty: 0, harga: 0 },
];

function isMixVeg(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('mix veg') || n.includes('sayur campuran') || n.includes('mixed veg');
}

function emptyItemCost(item, productsList = []) {
  const prod = productsList.find(p => p.id === item.productId);
  const hp = prod && prod.purchaseCost ? prod.purchaseCost : item.purchaseCost;

  return {
    productId: item.productId || '',
    productName: item.productName || '',
    qty: item.qty || 0,
    unit: item.unit || '',
    hargaJual: item.unitPrice || 0,
    subtotalJual: item.subtotal || 0,
    // biaya modal per item
    hargaModalSatuan: hp || 0,
    subItems: isMixVeg(item.productName)
      ? MIX_VEG_DEFAULTS.map(b => ({ ...b }))
      : [],
    useSubItems: isMixVeg(item.productName),
  };
}

const emptyForm = {
  invoiceId: '',
  invoiceNumber: '',
  customerName: '',
  invoiceTotal: 0,
  itemCosts: [],
  extraVegetables: [], // Sayuran tambahan (tidak terhubung ke item tunggal)
  // Biaya level invoice (bukan per item)
  ongkosKirimBahan: 0,
  ongkosPengiriman: 0,
  biayaTenagaKerja: 0,
  biayaLainnya: 0,
  catatan: '',
};

export default function HPP() {
  const [reports, setReports] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [printingId, setPrintingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedRow, setExpandedRow] = useState(null);
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [sisaPurchases, setSisaPurchases] = useState([]); // state baru
  const [openSubIndex, setOpenSubIndex] = useState(null);
  const [subQuery, setSubQuery] = useState('');

  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    const allInvs = await InvoiceStore.getAll();
    let allReports = await HppReports.getAll();
    const allPurchases = await PurchaseStore.getAll();
    const allProducts = await ProductStore.getAll();
    setProducts(allProducts);

    // Flatten purchase items untuk mempermudah pencarian
    const items = [];
    allPurchases.forEach(p => {
      (p.items || []).forEach(it => {
        items.push({
          supplier: p.supplier,
          createdAt: p.createdAt,
          purchaseId: p.id, // simpan ID
          ...it
        });
      });
    });
    setPurchaseItems(items);

    // Auto-sync reports secretly on load in case parent invoice was modified
    let needsUpdate = false;
    allReports = await Promise.all(allReports.map(async r => {
      const parentInv = allInvs.find(i => i.id === r.invoiceId);
      if (!parentInv) return r;

      const invItems = parentInv.items || [];
      const currentItems = r.itemCosts || [];

      // Check if qty or items count changed
      let hasChange = false;
      if (invItems.length !== currentItems.length || parentInv.grandTotal !== r.invoiceTotal) {
        hasChange = true;
      } else {
        invItems.forEach(invIt => {
          const match = currentItems.find(cIt => cIt.productId === invIt.productId);
          if (
            !match || 
            match.qty !== invIt.qty || 
            match.subtotalJual !== invIt.subtotal ||
            match.productName !== invIt.productName ||
            match.unit !== invIt.unit
          ) {
            hasChange = true;
          }
        });
      }

      if (hasChange) {
        needsUpdate = true;
        // Sync mapping
        const syncedItemCosts = invItems.map(invIt => {
          const existing = currentItems.find(cIt => cIt.productId === invIt.productId);
          if (existing) {
            return {
              ...existing,
              productName: invIt.productName,
              qty: invIt.qty,
              unit: invIt.unit,
              hargaJual: invIt.unitPrice,
              subtotalJual: invIt.subtotal,
              // Update totalModal just in case qty changed
              totalModal: existing.useSubItems && existing.subItems?.length 
                          ? existing.subItems.reduce((s,b)=>s+(Number(b.qty)*Number(b.harga)),0)
                          : Number(existing.hargaModalSatuan) * Number(invIt.qty)
            };
          }
          const newItem = emptyItemCost(invIt, allProducts);
          return {
            ...newItem,
            totalModal: Number(newItem.hargaModalSatuan || 0) * Number(invIt.qty)
          };
        });

        const totalModalBarang = syncedItemCosts.reduce((s, it) => s + (it.totalModal || 0), 0);
        const totalBiayaInvoice = Number(r.ongkosKirimBahan||0) + Number(r.ongkosPengiriman||0) + Number(r.biayaTenagaKerja||0) + Number(r.biayaLainnya||0);
        const totalHPP = totalModalBarang + totalBiayaInvoice;
        const labaKotor = Number(parentInv.grandTotal||0) - totalHPP;
        const margin = parentInv.grandTotal > 0 ? ((labaKotor / parentInv.grandTotal) * 100) : 0;

        const updatedReport = {
          ...r,
          invoiceTotal: parentInv.grandTotal || 0,
          itemCosts: syncedItemCosts,
          totalModalBarang,
          totalBiayaInvoice,
          totalHPP,
          labaKotor,
          margin: Number(margin.toFixed(2)),
          rugi: labaKotor < 0,
        };
        await HppReports.update(r.id, updatedReport);
        return updatedReport;
      }
      return r;
    }));

    setReports(allReports);
    setInvoices(allInvs);
  }

  // Hitung sisa qty pembelian dengan mengabaikan HPP yang sedang diedit (excludeId)
  function calculateSisa(excludeId) {
    const usedMap = {};
    reports.forEach(r => {
      if (excludeId && r.id === excludeId) return;
      (r.itemCosts || []).forEach(item => {
        if (item.useSubItems) {
          (item.subItems || []).forEach(b => {
            if (b.purchaseId && b.nama) {
              const key = `${b.purchaseId}-${b.nama}`;
              usedMap[key] = (usedMap[key] || 0) + Number(b.qty || 0);
            }
          });
        }
      });
      
      // Hitung juga pemakaian dari sayuran tambahan
      (r.extraVegetables || []).forEach(v => {
        if (v.purchaseId && v.nama) {
          const key = `${v.purchaseId}-${v.nama}`;
          usedMap[key] = (usedMap[key] || 0) + Number(v.qty || 0);
        }
      });
    });

    return purchaseItems.map(p => {
      const key = `${p.purchaseId}-${p.productName}`;
      const used = usedMap[key] || 0;
      const sisaQty = Number(p.qty) - used;
      return { ...p, sisaQty: sisaQty < 0 ? 0 : sisaQty };
    });
  }

  const autoLinkSubItems = (itemsList, currentSisa) => {
    return itemsList.map(item => {
      if (!item.useSubItems) return item;
      const subItems = (item.subItems || []).map(b => {
        if (b.purchaseId) {
          const match = currentSisa.find(p => p.purchaseId === b.purchaseId && (p.productName || '').toLowerCase() === (b.nama || '').toLowerCase());
          if (match) {
            return {
              ...b,
              harga: match.costPerUnit,
              purchasedQty: match.qty,
              maxQty: match.sisaQty + (Number(b.qty) || 0)
            };
          }
        }

        const matching = currentSisa
          .filter(p => (p.productName || '').toLowerCase() === (b.nama || '').toLowerCase())
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (matching.length > 0 && matching[0].sisaQty > 0) {
          return {
            ...b,
            harga: matching[0].costPerUnit,
            purchasedQty: matching[0].qty,
            maxQty: matching[0].sisaQty,
            purchaseId: matching[0].purchaseId
          };
        }
        return b;
      });
      return { ...item, subItems };
    });
  };

  const autoLinkExtraVeg = (extraVegs, currentSisa) => {
    return extraVegs.map(v => {
      if (v.purchaseId) {
        const match = currentSisa.find(p => p.purchaseId === v.purchaseId && (p.productName || '').toLowerCase() === (v.nama || '').toLowerCase());
        if (match) {
          return {
            ...v,
            harga: match.costPerUnit,
            purchasedQty: match.qty,
            maxQty: match.sisaQty + (Number(v.qty) || 0)
          };
        }
      }
      
      const matching = currentSisa
        .filter(p => (p.productName || '').toLowerCase() === (v.nama || '').toLowerCase())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (matching.length > 0 && matching[0].sisaQty > 0) {
        return {
          ...v,
          harga: matching[0].costPerUnit,
          purchasedQty: matching[0].qty,
          maxQty: matching[0].sisaQty,
          purchaseId: matching[0].purchaseId
        };
      }
      return v;
    });
  };

  async function handleExportPdf(r) {
    if (!r) return;
    setPrintingId(r.id);
    
    try {
      await new Promise(res => setTimeout(res, 600)); // Allow render
      const element = document.getElementById(`pdf-hpp-${r.id}`);
      if (!element) throw new Error('Render element not found');
      
      const canvas = await html2canvas(element, { scale: 3, useCORS: true });
      const img = canvas.toDataURL('image/jpeg', 0.8);
      const doc = new jsPDF('p', 'mm', 'a4');
      doc.addImage(img, 'JPEG', 0, 0, 210, 297);
      doc.save(`HPP_${r.invoiceNumber}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor PDF.');
    } finally {
      setPrintingId(null);
    }
  }

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setSisaPurchases(calculateSisa(null)); // Hitung instan
    setModalOpen(true);
  }

  function openEdit(r) {
    setEditId(r.id);
    const sisa = calculateSisa(r.id);
    const linkedItems = autoLinkSubItems(r.itemCosts || [], sisa);
    const linkedExtra = autoLinkExtraVeg(r.extraVegetables || [], sisa);
    setForm({
      invoiceId: r.invoiceId || '',
      invoiceNumber: r.invoiceNumber || '',
      customerName: r.customerName || '',
      invoiceTotal: r.invoiceTotal || 0,
      itemCosts: linkedItems,
      extraVegetables: linkedExtra,
      ongkosKirimBahan: r.ongkosKirimBahan || 0,
      ongkosPengiriman: r.ongkosPengiriman || 0,
      biayaTenagaKerja: r.biayaTenagaKerja || 0,
      biayaLainnya: r.biayaLainnya || 0,
      catatan: r.catatan || '',
    });
    setSisaPurchases(sisa); // Hitung instan
    setModalOpen(true);
  }

  function handleInvoiceChange(invoiceId) {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) {
      setForm(f => ({ ...f, invoiceId, invoiceNumber: '', customerName: '', invoiceTotal: 0, itemCosts: [] }));
      return;
    }
    const sisa = calculateSisa(null);
    const itemCosts = (inv.items || []).map(item => emptyItemCost(item, products));
    const linkedItems = autoLinkSubItems(itemCosts, sisa);
    setForm(f => ({
      ...f,
      invoiceId,
      invoiceNumber: inv.invoiceNumber || '',
      customerName: inv.customerName || '',
      invoiceTotal: inv.grandTotal || 0,
      itemCosts: linkedItems,
    }));
  }

  // Update field di item cost
  function updateItemCost(idx, field, value) {
    setForm(f => {
      const itemCosts = [...f.itemCosts];
      itemCosts[idx] = { ...itemCosts[idx], [field]: value };
      return { ...f, itemCosts };
    });
  }

  // Toggle mode sub-items
  function toggleSubItems(idx) {
    setForm(f => {
      const itemCosts = [...f.itemCosts];
      const item = { ...itemCosts[idx] };
      item.useSubItems = !item.useSubItems;
      if (item.useSubItems && item.subItems.length === 0) {
        const defaults = MIX_VEG_DEFAULTS.map(b => ({ ...b }));
        const currentSisa = calculateSisa(editId);
        const linked = autoLinkSubItems([{ useSubItems: true, subItems: defaults }], currentSisa);
        item.subItems = linked[0].subItems;
      }
      itemCosts[idx] = item;
      return { ...f, itemCosts };
    });
  }

  // Update sub-item bahan
  function updateSubItem(itemIdx, subIdx, field, value) {
    setForm(f => {
      const itemCosts = [...f.itemCosts];
      const item = { ...itemCosts[itemIdx] };
      const subItems = [...item.subItems];
      subItems[subIdx] = { ...subItems[subIdx], [field]: value };
      item.subItems = subItems;
      itemCosts[itemIdx] = item;
      return { ...f, itemCosts };
    });
  }

  function addSubItem(itemIdx) {
    setForm(f => {
      const itemCosts = [...f.itemCosts];
      const item = { ...itemCosts[itemIdx] };
      item.subItems = [...item.subItems, { nama: '', qty: 0, harga: 0 }];
      itemCosts[itemIdx] = item;
      return { ...f, itemCosts };
    });
  }

  function removeSubItem(itemIdx, subIdx) {
    setForm(f => {
      const itemCosts = [...f.itemCosts];
      const item = { ...itemCosts[itemIdx] };
      item.subItems = item.subItems.filter((_, i) => i !== subIdx);
      itemCosts[itemIdx] = item;
      return { ...f, itemCosts };
    });
  }

  // --- SAYURAN TAMBAHAN (GLOBAL INVOICE) ---
  function addExtraVeg() {
    setForm(f => ({
      ...f,
      extraVegetables: [...(f.extraVegetables || []), { nama: '', qty: 0, harga: 0, purchasedQty: 0, maxQty: 0, purchaseId: '' }]
    }));
  }

  function removeExtraVeg(idx) {
    setForm(f => ({
      ...f,
      extraVegetables: f.extraVegetables.filter((_, i) => i !== idx)
    }));
  }

  function updateExtraVeg(idx, field, value) {
    setForm(f => {
      const extraVegetables = [...(f.extraVegetables || [])];
      extraVegetables[idx] = { ...extraVegetables[idx], [field]: value };
      return { ...f, extraVegetables };
    });
  }

  // Hitung modal per item berdasarkan sub-items ATAU harga satuan langsung
  function calcItemModal(item) {
    if (item.useSubItems && item.subItems.length > 0) {
      return item.subItems.reduce((s, b) => s + (Number(b.qty) * Number(b.harga)), 0);
    }
    return Number(item.hargaModalSatuan) * Number(item.qty);
  }

  // Hitung semua untuk form saat ini
  function calcFormTotals() {
    const totalModalBarang = form.itemCosts.reduce((s, item) => s + calcItemModal(item), 0);
    const totalExtraVeg = (form.extraVegetables || []).reduce((s, v) => s + (Number(v.qty) * Number(v.harga)), 0);
    const totalBiayaInvoice = Number(form.ongkosKirimBahan) + Number(form.ongkosPengiriman) + Number(form.biayaTenagaKerja) + Number(form.biayaLainnya);
    const totalHPP = totalModalBarang + totalExtraVeg + totalBiayaInvoice;
    const labaKotor = Number(form.invoiceTotal) - totalHPP;
    const margin = Number(form.invoiceTotal) > 0 ? ((labaKotor / Number(form.invoiceTotal)) * 100) : 0;
    return { totalModalBarang, totalExtraVeg, totalBiayaInvoice, totalHPP, labaKotor, margin };
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.invoiceId) {
      alert('Pilih invoice terlebih dahulu');
      return;
    }
    const { totalModalBarang, totalBiayaInvoice, totalHPP, labaKotor, margin } = calcFormTotals();

    // Build itemCosts with computed totals
    const itemCosts = form.itemCosts.map(item => ({
      ...item,
      qty: Number(item.qty) || 0,
      hargaModalSatuan: Number(item.hargaModalSatuan) || 0,
      subItems: (item.subItems || []).map(b => ({
        ...b,
        qty: Number(b.qty) || 0,
        harga: Number(b.harga) || 0
      })),
      totalModal: calcItemModal(item),
    }));

    const data = {
      ...form,
      itemCosts,
      extraVegetables: (form.extraVegetables || []).map(v => ({
        ...v,
        qty: Number(v.qty) || 0,
        harga: Number(v.harga) || 0
      })),
      ongkosKirimBahan: Number(form.ongkosKirimBahan),
      ongkosPengiriman: Number(form.ongkosPengiriman),
      biayaTenagaKerja: Number(form.biayaTenagaKerja),
      biayaLainnya: Number(form.biayaLainnya),
      invoiceTotal: Number(form.invoiceTotal),
      totalModalBarang,
      totalExtraVeg,
      totalBiayaInvoice,
      totalHPP,
      labaKotor,
      margin: Number(margin.toFixed(2)),
      rugi: labaKotor < 0,
    };

    if (editId) {
      await HppReports.update(editId, data);
    } else {
      await HppReports.create(data);
    }
    setModalOpen(false);
    await reload();
  }

  async function handleDelete(id) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await HppReports.delete(deleteId);
    setDeleteId(null);
    await reload();
  }

  const filtered = reports
    .filter(r => {
      const q = search.toLowerCase();
      const matchSearch = (r.invoiceNumber || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q);
      
      let matchDate = true;
      if (r.createdAt) {
        const rDate = new Date(r.createdAt);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0,0,0,0);
          matchDate = matchDate && rDate >= start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23,59,59,999);
          matchDate = matchDate && rDate <= end;
        }
      }
      return matchSearch && matchDate;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalRevenue = filtered.reduce((s, r) => s + (r.invoiceTotal || 0), 0);
  const totalHPPAll = filtered.reduce((s, r) => s + (r.totalHPP || 0), 0);
  const totalLaba = filtered.reduce((s, r) => s + (r.labaKotor || 0), 0);
  const jumlahRugi = filtered.filter(r => r.rugi).length;
  const avgMargin = filtered.length > 0
    ? (filtered.reduce((s, r) => s + (r.margin || 0), 0) / filtered.length).toFixed(1)
    : 0;

  const existingIds = new Set(reports.map(r => r.invoiceId));
  const unlinkedInvoices = invoices.filter(inv => !existingIds.has(inv.id));

  const { totalModalBarang, totalExtraVeg, totalBiayaInvoice, totalHPP, labaKotor, margin } = calcFormTotals();

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>HPP</h1>
          <p>Harga Pokok Penjualan – Rincian modal per item &amp; biaya invoice</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={() => exportHppToExcel(filtered)}>
            <FiDownload /> Export Excel
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <FiPlus /> Tambah Laporan HPP
          </button>
        </div>
      </div>

      {/* Warning banner jika ada yang rugi */}
      {jumlahRugi > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <FiAlertTriangle style={{ color: '#f87171', fontSize: 22, flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#f87171' }}>Peringatan: {jumlahRugi} invoice mengalami kerugian!</strong>
            <div style={{ fontSize: 13, color: '#fca5a5', marginTop: 2 }}>Cek baris berwarna merah di bawah dan sesuaikan harga jual atau turunkan biaya HPP.</div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-card-header"><div className="stat-card-icon"><FiDollarSign /></div></div>
          <div className="stat-card-value">{formatCurrency(totalRevenue)}</div>
          <div className="stat-card-label">Total Penjualan</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-card-header"><div className="stat-card-icon"><FiPackage /></div></div>
          <div className="stat-card-value">{formatCurrency(totalHPPAll)}</div>
          <div className="stat-card-label">Total HPP</div>
        </div>
        <div className={`stat-card ${totalLaba >= 0 ? 'green' : 'orange'}`}>
          <div className="stat-card-header"><div className="stat-card-icon">{totalLaba >= 0 ? '📈' : <FiAlertTriangle />}</div></div>
          <div className="stat-card-value" style={{ color: totalLaba >= 0 ? undefined : '#f87171' }}>{formatCurrency(totalLaba)}</div>
          <div className="stat-card-label">Total Laba Kotor</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-card-header"><div className="stat-card-icon"><FiTruck /></div></div>
          <div className="stat-card-value">{avgMargin}%</div>
          <div className="stat-card-label">Rata-rata Margin</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input type="text" placeholder="Cari no. invoice atau pelanggan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-sm" style={{ alignItems: 'center', marginLeft: 'auto' }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Periode:</span>
          <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} />
          <span style={{ color: '#94a3b8' }}>–</span>
          <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} />
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No. Invoice</th>
              <th>Pelanggan</th>
              <th style={{ textAlign: 'right' }}>Total Penjualan</th>
              <th style={{ textAlign: 'right' }}>Modal Barang</th>
              <th style={{ textAlign: 'right' }}>Biaya Invoice</th>
              <th style={{ textAlign: 'right' }}>Total HPP</th>
              <th style={{ textAlign: 'right' }}>Laba Kotor</th>
              <th style={{ textAlign: 'right' }}>Margin</th>
              <th>Detail</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FiDollarSign /></div>
                    <h3>Belum ada laporan HPP</h3>
                    <p>Klik "Tambah Laporan HPP" untuk memulai</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(r => (
              <>
                <tr key={r.id} style={r.rugi ? { background: 'rgba(239,68,68,0.07)', borderLeft: '3px solid #ef4444' } : {}}>
                  <td className="text-muted">{formatDateShort(r.createdAt)}</td>
                  <td>
                    <strong>{r.invoiceNumber}</strong>
                    {r.rugi && <span style={{ marginLeft: 8, color: '#f87171', fontSize: 12 }}><FiAlertTriangle style={{ marginRight: 3 }} />RUGI</span>}
                  </td>
                  <td>{r.customerName}</td>
                  <td className="text-right">{formatCurrency(r.invoiceTotal)}</td>
                  <td className="text-right text-warning">{formatCurrency(r.totalModalBarang)}</td>
                  <td className="text-right">{formatCurrency(r.totalBiayaInvoice)}</td>
                  <td className="text-right" style={{ fontWeight: 700, color: '#f87171' }}>{formatCurrency(r.totalHPP)}</td>
                  <td className="text-right" style={{ fontWeight: 700, color: r.labaKotor >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(r.labaKotor)}</td>
                  <td className="text-right">
                    <span style={{ fontWeight: 700, color: r.margin >= 20 ? '#34d399' : r.margin >= 10 ? '#fbbf24' : '#f87171' }}>
                      {r.margin?.toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}>
                      {expandedRow === r.id ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm text-info" onClick={() => handleExportPdf(r)} disabled={!!printingId} title="Download PDF"><FiDownload /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><FiEdit2 /></button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(r.id)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
                {/* Expanded: rincian per item */}
                {expandedRow === r.id && (
                  <tr key={`${r.id}-detail`}>
                    <td colSpan={11} style={{ padding: '0 24px 16px 40px', background: 'rgba(99,102,241,0.03)' }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, marginTop: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rincian Modal per Item</div>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Produk</th>
                            <th style={{ textAlign: 'center', padding: '4px 8px' }}>Qty</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Harga Jual/unit</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Modal</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Subtotal Jual</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Laba Item</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(r.itemCosts || []).map((item, idx) => {
                            const labaItem = (item.subtotalJual || 0) - (item.totalModal || 0);
                            return (
                              <>
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td style={{ padding: '5px 8px', fontWeight: 600 }}>{item.productName}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>{formatNumber(item.qty)} {item.unit}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatCurrency(item.hargaJual)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#fbbf24' }}>{formatCurrency(item.totalModal)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatCurrency(item.subtotalJual)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: labaItem >= 0 ? '#34d399' : '#f87171' }}>
                                    {labaItem < 0 && <FiAlertTriangle style={{ marginRight: 3, fontSize: 10 }} />}
                                    {formatCurrency(labaItem)}
                                  </td>
                                </tr>
                                {/* Sub items bahan */}
                                {item.useSubItems && (item.subItems || []).map((b, si) => (
                                  <tr key={`${idx}-${si}`} style={{ background: 'rgba(255,255,255,0.015)' }}>
                                    <td style={{ padding: '3px 8px 3px 24px', color: '#64748b' }}>↳ {b.nama}</td>
                                    <td style={{ padding: '3px 8px', textAlign: 'center', color: '#64748b' }}>{formatNumber(b.qty)}</td>
                                    <td style={{ padding: '3px 8px', textAlign: 'right', color: '#64748b' }}>{formatCurrency(b.harga)}</td>
                                    <td style={{ padding: '3px 8px', textAlign: 'right', color: '#64748b' }}>{formatCurrency(b.qty * b.harga)}</td>
                                    <td colSpan={2}></td>
                                  </tr>
                                ))}
                               </>
                             );
                           })}
                           {/* Sayuran Tambahan */}
                           {(r.extraVegetables || []).length > 0 && (
                             <>
                               <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                 <td colSpan={6} style={{ padding: '8px 8px 4px 8px', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sayuran Tambahan (Global)</td>
                               </tr>
                               {(r.extraVegetables || []).map((v, vi) => (
                                 <tr key={`extra-${vi}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                   <td style={{ padding: '5px 8px', fontWeight: 600, color: '#fbbf24' }}>+ {v.nama}</td>
                                   <td style={{ padding: '5px 8px', textAlign: 'center' }}>{formatNumber(v.qty)}</td>
                                   <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatCurrency(v.harga)}</td>
                                   <td style={{ padding: '5px 8px', textAlign: 'right', color: '#fbbf24' }}>{formatCurrency(v.qty * v.harga)}</td>
                                   <td colSpan={2}></td>
                                 </tr>
                               ))}
                             </>
                           )}
                         </tbody>
                         <tfoot>
                           <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)', fontWeight: 700 }}>
                             <td colSpan={3} style={{ padding: '6px 8px', color: '#94a3b8' }}>
                               Biaya Invoice (kirim: {formatCurrency(r.ongkosKirimBahan)}, delivery: {formatCurrency(r.ongkosPengiriman)}, TK: {formatCurrency(r.biayaTenagaKerja)}, lain: {formatCurrency(r.biayaLainnya)})
                               {r.totalExtraVeg > 0 && ` + Sayuran Tambahan: ${formatCurrency(r.totalExtraVeg)}`}
                             </td>
                             <td style={{ padding: '6px 8px', textAlign: 'right', color: '#fbbf24' }}>{formatCurrency(Number(r.totalBiayaInvoice || 0) + Number(r.totalExtraVeg || 0))}</td>
                             <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCurrency(r.invoiceTotal)}</td>
                             <td style={{ padding: '6px 8px', textAlign: 'right', color: r.labaKotor >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(r.labaKotor)}</td>
                           </tr>
                         </tfoot>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: 'rgba(99,102,241,0.05)', fontWeight: 700 }}>
                <td colSpan={3}><strong>TOTAL ({filtered.length} invoice)</strong></td>
                <td className="text-right">{formatCurrency(totalRevenue)}</td>
                <td className="text-right" style={{ color: '#fbbf24' }}>{formatCurrency(filtered.reduce((s, r) => s + (r.totalModalBarang || 0), 0))}</td>
                <td className="text-right">{formatCurrency(filtered.reduce((s, r) => s + (r.totalBiayaInvoice || 0), 0))}</td>
                <td className="text-right" style={{ color: '#f87171' }}>{formatCurrency(totalHPPAll)}</td>
                <td className="text-right" style={{ color: totalLaba >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(totalLaba)}</td>
                <td className="text-right">{avgMargin}%</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Modal Form */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Laporan HPP' : 'Tambah Laporan HPP'} size="xl" persistent={true}>
        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ position: 'relative' }}>
            {openSubIndex !== null && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpenSubIndex(null)} />
            )}

            {/* Pilih Invoice */}
            <div className="form-group">
              <label className="form-label">Invoice <span style={{ color: '#ef4444' }}>*</span></label>
              {editId ? (
                <input className="form-input" value={`${form.invoiceNumber} – ${form.customerName}`} disabled />
              ) : (
                <select className="form-select" value={form.invoiceId} onChange={e => handleInvoiceChange(e.target.value)} required>
                  <option value="">-- Pilih Invoice --</option>
                  {unlinkedInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} – {inv.customerName} ({formatCurrency(inv.grandTotal)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* ===== TABEL MODAL PER ITEM ===== */}
            {form.itemCosts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h4 style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Harga Modal per Item
                  </h4>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Total Penjualan: <strong style={{ color: '#818cf8' }}>{formatCurrency(form.invoiceTotal)}</strong></span>
                </div>

                {form.itemCosts.map((item, idx) => {
                  const modalItem = calcItemModal(item);
                  const labaItem = (item.subtotalJual || 0) - modalItem;
                  return (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${labaItem < 0 ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                      {/* Item header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{item.productName}</span>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatNumber(item.qty)} {item.unit}</span>
                        <span style={{ fontSize: 12 }}>Jual: <strong style={{ color: '#818cf8' }}>{formatCurrency(item.subtotalJual)}</strong></span>
                        <span style={{ fontSize: 12 }}>Modal: <strong style={{ color: '#fbbf24' }}>{formatCurrency(modalItem)}</strong></span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: labaItem >= 0 ? '#34d399' : '#f87171' }}>
                          {labaItem < 0 && <FiAlertTriangle style={{ marginRight: 3 }} />}
                          Laba: {formatCurrency(labaItem)}
                        </span>
                      </div>

                      {/* Mode toggle: langsung atau sub-items */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        {!item.useSubItems ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                            <div>
                              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Harga Modal / {item.unit} (Rp)</label>
                              <input
                                className="form-input"
                                type="number"
                                min="0"
                                value={item.hargaModalSatuan}
                                onChange={e => updateItemCost(idx, 'hargaModalSatuan', Number(e.target.value))}
                                style={{ width: 140 }}
                              />
                            </div>
                            <div style={{ paddingBottom: 8, color: '#64748b', fontSize: 12 }}>×</div>
                            <div>
                              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 3 }}>Qty</label>
                              <input
                                className="form-input"
                                type="number"
                                min="0" 
                                step="any"
                                value={item.qty}
                                onChange={e => updateItemCost(idx, 'qty', e.target.value)}
                                style={{ width: 80, textAlign: 'center' }}
                              />
                            </div>
                            <div style={{ paddingBottom: 8, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                              = {formatCurrency(Number(item.hargaModalSatuan) * Number(item.qty))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <label style={{ fontSize: 11, color: '#94a3b8' }}>Rincian Bahan (qty × harga)</label>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => addSubItem(idx)} style={{ fontSize: 11 }}>
                                <FiPlus /> Tambah Bahan
                              </button>
                            </div>
                            {item.subItems.map((b, si) => (
                              <div key={si} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, position: 'relative' }}>
                                <div style={{ flex: 2, position: 'relative' }}>
                                  <input
                                    className="form-input"
                                    placeholder="Nama bahan"
                                    value={b.nama}
                                    onChange={e => {
                                      updateSubItem(idx, si, 'nama', e.target.value);
                                      setSubQuery(e.target.value);
                                      setOpenSubIndex(`${idx}-${si}`);
                                    }}
                                    onFocus={() => {
                                      setOpenSubIndex(`${idx}-${si}`);
                                      setSubQuery(b.nama || '');
                                    }}
                                  />
                                  {openSubIndex === `${idx}-${si}` && (
                                    <div className="dropdown-panel" style={{ 
                                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, 
                                      background: '#1e293b', border: '1px solid #334155', borderRadius: 8, 
                                      maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', 
                                      marginTop: 4 
                                    }}>
                                      {sisaPurchases
                                        .filter(p => (p.productName || '').toLowerCase().includes(subQuery.toLowerCase()))
                                        .map((p, pi) => (
                                          <div
                                            key={pi}
                                            className="dropdown-item"
                                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '12px' }}
                                            onClick={() => {
                                              updateSubItem(idx, si, 'nama', p.productName);
                                              updateSubItem(idx, si, 'harga', p.costPerUnit);
                                              updateSubItem(idx, si, 'purchasedQty', p.qty);
                                              updateSubItem(idx, si, 'maxQty', p.sisaQty); // max limit per sisa
                                              updateSubItem(idx, si, 'purchaseId', p.purchaseId); // simpan link!
                                              setOpenSubIndex(null);
                                            }}
                                            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                                            onMouseLeave={e => e.target.style.background = 'transparent'}
                                          >
                                            {p.productName} - {p.supplier} (Beli: {p.qty} | <strong style={{ color: '#34d399' }}>Sisa: {p.sisaQty}</strong> | Rp {p.costPerUnit})
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                                <div style={{ flex: 1.4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input
                                    className="form-input"
                                    type="text"
                                    style={{ width: 65 }}
                                    placeholder="Qty"
                                    value={formatNumberInput(b.qty)}
                                    onChange={e => {
                                      let val = e.target.value.replace(/\./g, '').replace(',', '.');
                                      if (/^\d*\.?\d*$/.test(val) || val === '') {
                                        if (b.maxQty && Number(val) > b.maxQty) {
                                          alert(`Kapasitas maksimal adalah ${b.maxQty} (sesuai pembelian)`);
                                          val = b.maxQty.toString();
                                        }
                                        updateSubItem(idx, si, 'qty', val);
                                      }
                                    }}
                                  />
                                  {(() => {
                                    if (b.purchasedQty > 0) {
                                      return <div style={{ fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>(Stock: {b.maxQty})</div>;
                                    } else {
                                      const matching = sisaPurchases.filter(p => (p.productName || '').toLowerCase() === (b.nama || '').toLowerCase());
                                      const sisa = matching.reduce((s, p) => s + (p.sisaQty || 0), 0);
                                      if (sisa > 0) {
                                        return <div style={{ fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>(Stock: {sisa})</div>;
                                      } else if (b.maxQty) {
                                        return <div style={{ fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>(Stock: {b.maxQty})</div>;
                                      } else {
                                        return <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>(Stock: 0)</div>;
                                      }
                                    }
                                  })()}
                                </div>
                                <span style={{ color: '#64748b', fontSize: 12 }}>×</span>
                                <input
                                  className="form-input"
                                  type="text"
                                  placeholder="Harga/kg"
                                  value={formatNumberInput(b.harga)}
                                  onChange={e => {
                                    const val = e.target.value.replace(/\./g, '').replace(',', '.');
                                    if (/^\d*\.?\d*$/.test(val) || val === '') {
                                      updateSubItem(idx, si, 'harga', val);
                                    }
                                  }}
                                  style={{ flex: 2 }}
                                />
                                <span style={{ fontSize: 12, color: '#64748b', minWidth: 90, textAlign: 'right' }}>{formatCurrency(b.qty * b.harga)}</span>
                                <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removeSubItem(idx, si)}><FiTrash2 /></button>
                              </div>
                            ))}
                            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#fbbf24', marginTop: 4 }}>
                              Total Bahan: {formatCurrency(item.subItems.reduce((s, b) => s + b.qty * b.harga, 0))}
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleSubItems(idx)}
                          style={{ fontSize: 11, whiteSpace: 'nowrap', alignSelf: 'flex-end' }}
                          title={item.useSubItems ? 'Kembali ke input langsung' : 'Rinci per bahan (cocok untuk Mix Vegetable)'}
                        >
                          {item.useSubItems ? '📦 Mode Langsung' : '🥦 Rinci Bahan'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#fbbf24', marginTop: 4 }}>
                   Total Modal Barang: {formatCurrency(totalModalBarang)}
                 </div>
               </div>
             )}

             {/* ===== SAYURAN TAMBAHAN (GLOBAL) ===== */}
             <div style={{ marginBottom: 20 }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                 <h4 style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                   🥦 Sayuran &amp; Bahan Tambahan
                 </h4>
                 <button type="button" className="btn btn-ghost btn-sm" onClick={addExtraVeg}>
                   <FiPlus /> Tambah Sayuran
                 </button>
               </div>
               
               {(form.extraVegetables || []).map((v, vi) => (
                 <div key={vi} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, position: 'relative' }}>
                   <div style={{ flex: 3, position: 'relative' }}>
                     <input
                       className="form-input"
                       placeholder="Nama sayuran/bahan..."
                       value={v.nama}
                       onChange={e => {
                         updateExtraVeg(vi, 'nama', e.target.value);
                         setSubQuery(e.target.value);
                         setOpenSubIndex(`extra-${vi}`);
                       }}
                       onFocus={() => {
                         setOpenSubIndex(`extra-${vi}`);
                         setSubQuery(v.nama || '');
                       }}
                     />
                     {openSubIndex === `extra-${vi}` && (
                       <div className="dropdown-panel" style={{ 
                         position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, 
                         background: '#1e293b', border: '1px solid #334155', borderRadius: 8, 
                         maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', 
                         marginTop: 4 
                       }}>
                         {sisaPurchases
                           .filter(p => (p.productName || '').toLowerCase().includes(subQuery.toLowerCase()))
                           .map((p, pi) => (
                             <div
                               key={pi}
                               className="dropdown-item"
                               style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '12px' }}
                               onClick={() => {
                                 updateExtraVeg(vi, 'nama', p.productName);
                                 updateExtraVeg(vi, 'harga', p.costPerUnit);
                                 updateExtraVeg(vi, 'purchasedQty', p.qty);
                                 updateExtraVeg(vi, 'maxQty', p.sisaQty);
                                 updateExtraVeg(vi, 'purchaseId', p.purchaseId);
                                 setOpenSubIndex(null);
                               }}
                               onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                               onMouseLeave={e => e.target.style.background = 'transparent'}
                             >
                               {p.productName} - {p.supplier} (Beli: {p.qty} | <strong style={{ color: '#34d399' }}>Sisa: {p.sisaQty}</strong> | Rp {p.costPerUnit})
                             </div>
                           ))}
                       </div>
                     )}
                    </div>
                    <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        className="form-input"
                        type="text"
                        style={{ width: 65 }}
                        placeholder="Qty"
                        value={formatNumberInput(v.qty)}
                        onChange={e => {
                          let val = e.target.value.replace(/\./g, '').replace(',', '.');
                          if (/^\d*\.?\d*$/.test(val) || val === '') {
                             if (v.maxQty && Number(val) > v.maxQty) {
                               alert(`Kapasitas maksimal adalah ${v.maxQty} (sesuai sisa pembelian)`);
                               val = v.maxQty.toString();
                             }
                             updateExtraVeg(vi, 'qty', val);
                          }
                        }}
                      />
                      {v.purchasedQty > 0 ? (
                        <div style={{ fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>
                          (Stock: {v.maxQty})
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>(Stock: 0)</div>
                      )}
                    </div>
                   <div style={{ flex: 2 }}>
                     <input
                       className="form-input"
                       type="text"
                       placeholder="Harga"
                       value={formatNumberInput(v.harga)}
                       onChange={e => {
                         const val = e.target.value.replace(/\./g, '').replace(',', '.');
                         if (/^\d*\.?\d*$/.test(val) || val === '') {
                           updateExtraVeg(vi, 'harga', val);
                         }
                       }}
                     />
                   </div>
                   <div style={{ minWidth: 80, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#fbbf24' }}>
                     {formatCurrency(v.qty * v.harga)}
                   </div>
                   <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removeExtraVeg(vi)}>
                     <FiTrash2 />
                   </button>
                 </div>
               ))}

                {form.extraVegetables && form.extraVegetables.length > 0 && (
                 <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#fbbf24', marginTop: 4 }}>
                   Total Sayuran Tambahan: {formatCurrency(totalExtraVeg)}
                 </div>
               )}
             </div>

            {/* ===== BIAYA LEVEL INVOICE ===== */}
            <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '16px 0' }} />
            <h4 style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Biaya Keseluruhan Invoice
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8, fontWeight: 400, textTransform: 'none' }}>— dibagi rata ke semua item secara otomatis</span>
            </h4>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">🚚 Ongkos Kirim Bahan (Rp)</label>
                <input className="form-input" type="number" min="0" value={form.ongkosKirimBahan} onChange={e => setForm(f => ({ ...f, ongkosKirimBahan: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">🛵 Ongkos Pengiriman ke Customer (Rp)</label>
                <input className="form-input" type="number" min="0" value={form.ongkosPengiriman} onChange={e => setForm(f => ({ ...f, ongkosPengiriman: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">👷 Biaya Tenaga Kerja (Rp)</label>
                <input className="form-input" type="number" min="0" value={form.biayaTenagaKerja} onChange={e => setForm(f => ({ ...f, biayaTenagaKerja: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">💸 Biaya Lainnya (Rp)</label>
                <input className="form-input" type="number" min="0" value={form.biayaLainnya} onChange={e => setForm(f => ({ ...f, biayaLainnya: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Catatan</label>
              <textarea className="form-textarea" value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} placeholder="Catatan tambahan..." />
            </div>

            {/* ===== RINGKASAN KALKULASI ===== */}
            {form.invoiceId && (
              <div style={{ background: labaKotor < 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.05)', border: `1px solid ${labaKotor < 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.2)'}`, borderRadius: 8, padding: '14px 16px', marginTop: 8 }}>
                {labaKotor < 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#f87171', fontWeight: 700 }}>
                    <FiAlertTriangle /> PERINGATAN: Invoice ini mengalami kerugian sebesar {formatCurrency(Math.abs(labaKotor))}!
                  </div>
                )}
                 <h4 style={{ marginBottom: 10, fontSize: 13, color: labaKotor < 0 ? '#f87171' : '#34d399' }}>📊 Ringkasan HPP</h4>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px', fontSize: 13 }}>
                   <span className="text-muted">Modal Barang</span><span style={{ textAlign: 'right' }}>{formatCurrency(totalModalBarang)}</span>
                   {totalExtraVeg > 0 && (
                     <>
                       <span className="text-muted">Sayuran Tambahan</span><span style={{ textAlign: 'right' }}>{formatCurrency(totalExtraVeg)}</span>
                     </>
                   )}
                   <span className="text-muted">Biaya Kirim Bahan</span><span style={{ textAlign: 'right' }}>{formatCurrency(Number(form.ongkosKirimBahan))}</span>
                  <span className="text-muted">Biaya Pengiriman</span><span style={{ textAlign: 'right' }}>{formatCurrency(Number(form.ongkosPengiriman))}</span>
                  <span className="text-muted">Biaya Tenaga Kerja</span><span style={{ textAlign: 'right' }}>{formatCurrency(Number(form.biayaTenagaKerja))}</span>
                  <span className="text-muted">Biaya Lainnya</span><span style={{ textAlign: 'right' }}>{formatCurrency(Number(form.biayaLainnya))}</span>
                  <div style={{ gridColumn: '1/-1', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />
                  <strong>Total HPP</strong><strong style={{ textAlign: 'right', color: '#f87171' }}>{formatCurrency(totalHPP)}</strong>
                  <strong>Total Penjualan</strong><strong style={{ textAlign: 'right', color: '#818cf8' }}>{formatCurrency(Number(form.invoiceTotal))}</strong>
                  <div style={{ gridColumn: '1/-1', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />
                  <strong style={{ fontSize: 14 }}>Laba Kotor</strong>
                  <strong style={{ textAlign: 'right', fontSize: 16, color: labaKotor >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(labaKotor)}</strong>
                  <span className="text-muted">Margin</span>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: labaKotor >= 0 ? '#34d399' : '#f87171' }}>
                    {Number(form.invoiceTotal) > 0 ? ((labaKotor / Number(form.invoiceTotal)) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan HPP</button>
          </div>
        </form>
      </Modal>
      {printingId && (() => {
        const report = reports.find(r => r.id === printingId);
        return <HppPdfTemplate report={report} />;
      })()}

      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Hapus Laporan HPP"
        message="Apakah Anda yakin ingin menghapus laporan HPP ini? Data ini tidak dapat dikembalikan."
      />
    </div>
  );
}
