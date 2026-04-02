import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiTrash2, FiEdit2, FiDollarSign, FiTruck, FiPackage, FiUsers, FiAlertTriangle, FiChevronDown, FiChevronUp, FiDownload, FiPrinter } from 'react-icons/fi';
import Modal from '../components/Modal';
import { HppReports, Invoices as InvoiceStore, Purchases as PurchaseStore, Products as ProductStore, ProductionNeeds, Customers, PurchaseNotes, SupportingMaterialItems } from '../utils/storage';
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
    originalInvoiceQty: item.qty || 0, // Simpan kuantitas asli dari invoice
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
  totalBiayaOperasional: 0,
  catatan: '',
};

const SIMILAR_GROUPS = [
  ['SPPG SINDANGJAYA 5', 'SPPG2 SINDANGJAYA 2', 'SPPG3 SINDANGJAYA 3'], 
];

// Komponen internal untuk baris tabel invoice agar tidak terlalu ramai di HPP()
function ViewModeItem({ r, expandedRow, setExpandedRow, handleExportPdf, openEdit, handleDelete, printingId }) {
  const labaKotor = Number(r.labaKotor || 0);
  const margin = Number(r.margin || 0);

  return (
    <>
      <tr style={r.rugi ? { background: 'rgba(239,68,68,0.07)', borderLeft: '3px solid #ef4444' } : {}}>
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
        <td className="text-right" style={{ fontWeight: 700, color: labaKotor >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(labaKotor)}</td>
        <td className="text-right">
          <span style={{ fontWeight: 700, color: margin >= 20 ? '#34d399' : margin >= 10 ? '#fbbf24' : '#f87171' }}>
            {margin.toFixed(1)}%
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
      {expandedRow === r.id && (
        <tr>
          <td colSpan={11} style={{ padding: '0 24px 16px 40px', background: 'rgba(99,102,241,0.03)' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, marginTop: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rincian Modal per Item</div>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Produk</th>
                  <th style={{ textAlign: 'center', padding: '4px 8px' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Total Harga/Item</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Modal</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Margin Laba</th>
                </tr>
              </thead>
              <tbody>
                {(r.itemCosts || []).map((item, idx) => {
                  const modalItem = Number(item.totalModal || 0);
                  const itemLaba = Number(item.subtotalJual || 0) - modalItem;
                  return (
                    <React.Fragment key={idx}>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '5px 8px', fontWeight: 600 }}>{item.productName}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>{item.qty} {item.unit}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatCurrency(item.subtotalJual)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', color: '#fbbf24' }}>{formatCurrency(modalItem)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: itemLaba >= 0 ? '#34d399' : '#f87171' }}>
                          {itemLaba < 0 && <FiAlertTriangle style={{ marginRight: 3, fontSize: 10 }} />}
                          {formatCurrency(itemLaba)}
                        </td>
                      </tr>
                      {item.useSubItems && (item.subItems || []).map((b, si) => (
                        <tr key={`${idx}-${si}`} style={{ background: 'rgba(255,255,255,0.015)' }}>
                          <td style={{ padding: '3px 8px 3px 24px', color: '#64748b' }}>↳ {b.nama}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'center' }}>{b.qty}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>{formatCurrency(b.harga)}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>{formatCurrency(b.qty * b.harga)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {(r.extraVegetables || []).length > 0 && (
                   <>
                     <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                       <td colSpan={6} style={{ padding: '8px 8px 4px 8px', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sayuran Tambahan (Global)</td>
                     </tr>
                     {(r.extraVegetables || []).map((v, vi) => (
                       <tr key={`extra-${vi}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                         <td style={{ padding: '5px 8px', fontWeight: 600, color: '#fbbf24' }}>+ {v.nama}</td>
                         <td style={{ padding: '5px 8px', textAlign: 'center' }}>{v.qty}</td>
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
                    {r.totalBiayaOperasional > 0 && ` + Operasional (Shared): ${formatCurrency(r.totalBiayaOperasional)}`}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#fbbf24' }}>{formatCurrency(Number(r.totalBiayaInvoice || 0) + Number(r.totalExtraVeg || 0) + Number(r.totalBiayaOperasional || 0))}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCurrency(r.invoiceTotal)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: labaKotor >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(labaKotor)}</td>
                </tr>
              </tfoot>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

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
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'daily'

  const [deleteId, setDeleteId] = useState(null);
  const [activeTab, setActiveTab] = useState('Semua');

  useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);

  async function reload() {
    const allInvs = await InvoiceStore.getAll();
    const allCusts = await Customers.getAll();
    let allReports = await HppReports.getAll();
    const allPurchases = await PurchaseStore.getAll();
    const allPurchaseNotes = await PurchaseNotes.getAll();
    const allProducts = await ProductStore.getAll();
    const allMaterials = await SupportingMaterialItems.getAll();
    const allProductionNeeds = await ProductionNeeds.getAll();
    setProducts(allProducts);

    // Flatten purchase items untuk mempermudah pencarian
    const items = [];
    allPurchases.forEach(p => {
      (p.items || []).forEach(it => {
        items.push({
          supplier: p.supplier,
          createdAt: p.createdAt,
          purchaseId: p.id,
          costPerUnit: Number(it.costPerUnit) || Number(it.price) || 0,
          ...it
        });
      });
    });

    // Merge new PurchaseNotes (splitting model)
    allPurchaseNotes.forEach(pn => {
      (pn.items || []).forEach(it => {
        items.push({
          supplier: pn.supplierName,
          createdAt: pn.date,
          purchaseId: pn.id,
          productName: it.materialName,
          productId: it.materialId,
          qty: (it.splits?.s5?.netQty || 0) + (it.splits?.s2?.netQty || 0) + (it.splits?.s3?.netQty || 0),
          costPerUnit: Number(it.pricePerUnit) || 0,
          isNewModel: true,
          splits: it.splits
        });
      });
    });
    setPurchaseItems(items);

    // Auto-sync reports secretly on load in case parent invoice was modified
    let needsUpdate = false;
    allReports = await Promise.all(allReports.map(async r => {
      const parentInv = allInvs.find(i => i.id === r.invoiceId);
      if (!parentInv) return r;
      const customer = allCusts.find(c => c.id === parentInv.customerId);
      const categoryId = customer?.priceCategoryId;

      const invItems = parentInv.items || [];
      const currentItems = r.itemCosts || [];

      // Check if invoice was updated after the report was last saved
      const invUpdated = parentInv.updatedAt ? new Date(parentInv.updatedAt) : new Date(0);
      const repUpdated = r.updatedAt ? new Date(r.updatedAt) : new Date(0);
      
      // If report is newer than invoice, skip auto-sync of details to preserve manual edits
      // UNLESS the number of items changed (which means structural change)
      if (repUpdated > invUpdated && invItems.length === currentItems.length) {
        return r;
      }

      // Check if qty or items count changed
      let hasChange = false;
      
      // Calculate shared production needs costs
      const linkedNeeds = allProductionNeeds.filter(n => (n.invoiceIds || []).includes(r.invoiceId));
      const totalBiayaOperasional = linkedNeeds.reduce((s, n) => s + (Number(n.totalCost || 0) / (n.invoiceIds.length || 1)), 0);
      
      const oldBiayaOp = r.totalBiayaOperasional || 0;
      if (Math.abs(oldBiayaOp - totalBiayaOperasional) > 0.01) {
        hasChange = true;
      }

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
        const currentSisa = calculateSisa(r.id, allReports, r.customerName);
        const syncedItemCosts = autoLinkSubItems(
          invItems.map((invIt) => {
            const existing = currentItems.find((cIt) => cIt.productId === invIt.productId);
            const product = allProducts.find((p) => p.id === invIt.productId) || allMaterials.find(m => m.id === invIt.productId);
            const isMaterial = invIt.type === 'material' || allMaterials.some(m => m.id === invIt.productId);
            
            const categoryModal = categoryId && product?.categoryModals?.[categoryId];

            if (existing) {
              const baseModal = categoryModal ?? (isMaterial ? (product.defaultPrice || existing.hargaModalSatuan) : existing.hargaModalSatuan);
              return {
                ...existing,
                productName: invIt.productName,
                qty: invIt.qty,
                unit: invIt.unit,
                hargaJual: invIt.unitPrice,
                subtotalJual: invIt.subtotal,
                hargaModalSatuan: baseModal,
                originalInvoiceQty: invIt.qty,
                type: isMaterial ? 'material' : 'product',
                totalModal:
                  existing.useSubItems && existing.subItems?.length
                    ? existing.subItems.reduce((s, b) => s + Number(b.qty) * Number(b.harga), 0)
                    : Number(baseModal) * Number(invIt.qty),
              };
            }

            const newItem = emptyItemCost(invIt, allProducts);
            const baseModal = categoryModal ?? (isMaterial ? (product?.defaultPrice || 0) : newItem.hargaModalSatuan);
            return {
              ...newItem,
              hargaModalSatuan: baseModal,
              type: isMaterial ? 'material' : 'product',
              totalModal: Number(baseModal || 0) * Number(invIt.qty),
            };
          }),
          currentSisa
        );

        const totalModalBarang = syncedItemCosts.reduce((s, it) => s + (it.totalModal || 0), 0);
        const totalBiayaInvoice =
          Number(r.ongkosKirimBahan || 0) +
          Number(r.ongkosPengiriman || 0) +
          Number(r.biayaTenagaKerja || 0) +
          Number(r.biayaLainnya || 0);
        const totalHPP = totalModalBarang + totalBiayaInvoice + totalBiayaOperasional;
        const labaKotor = Number(parentInv.grandTotal || 0) - totalHPP;
        const margin = parentInv.grandTotal > 0 ? (labaKotor / parentInv.grandTotal) * 100 : 0;

        const updatedReport = {
          ...r,
          invoiceTotal: parentInv.grandTotal || 0,
          itemCosts: syncedItemCosts,
          totalModalBarang,
          totalBiayaInvoice,
          totalBiayaOperasional,
          totalHPP,
          labaKotor,
          margin: Number(margin.toFixed(2)),
          rugi: labaKotor < 0,
        };
        await HppReports.update(r.id, updatedReport);
        return updatedReport;
      } else {
        // Even if we don't sync everything (HPP is newer than invoice), 
        // we MUST always keep originalInvoiceQty in sync with current invoice data
        const currentItemsCopy = [...currentItems];
        let changedRef = false;
        invItems.forEach(invIt => {
          const idx = currentItemsCopy.findIndex(c => c.productId === invIt.productId);
          if (idx !== -1 && currentItemsCopy[idx].originalInvoiceQty !== invIt.qty) {
            currentItemsCopy[idx] = { ...currentItemsCopy[idx], originalInvoiceQty: invIt.qty };
            changedRef = true;
          }
        });
        if (changedRef) {
          const updated = { ...r, itemCosts: currentItemsCopy };
          await HppReports.update(r.id, updated);
          return updated;
        }
      }
      return r;
    }));

    setReports(allReports);
    setInvoices(allInvs);
  }

  // Hitung sisa qty pembelian dengan mengabaikan HPP yang sedang diedit (excludeId)
  function calculateSisa(excludeId, reportsList = reports, branch = 's5') {
    const usedMap = {};
    reportsList.forEach(r => {
      if (excludeId && r.id === excludeId) return;
      (r.itemCosts || []).forEach(item => {
        if (item.useSubItems) {
          (item.subItems || []).forEach(b => {
            if (b.purchaseId && b.nama) {
              const key = `${b.purchaseId}-${b.nama}`;
              usedMap[key] = (usedMap[key] || 0) + Number(b.qty || 0);
            }
          });
        } else {
          if (item.purchaseId && item.productName) {
            const key = `${item.purchaseId}-${item.productName}`;
            usedMap[key] = (usedMap[key] || 0) + Number(item.qty || 0);
          }
        }
      });
      
      (r.extraVegetables || []).forEach(v => {
        if (v.purchaseId && v.nama) {
          const key = `${v.purchaseId}-${v.nama}`;
          usedMap[key] = (usedMap[key] || 0) + Number(v.qty || 0);
        }
      });
    });

    const bLower = (branch || '').toLowerCase();
    const bKey = bLower.includes('3') ? 's3' : bLower.includes('2') ? 's2' : 's5';

    return purchaseItems.map(p => {
      const key = `${p.purchaseId}-${p.productName}`;
      const used = usedMap[key] || 0;
      
      // Calculate total source qty based on branch split if new model
      let sourceQty = Number(p.qty);
      if (p.isNewModel && p.splits) {
        sourceQty = Number(p.splits[bKey]?.netQty) || 0;
      }
      
      const sisaQty = sourceQty - used;
      return { ...p, sisaQty: sisaQty < 0 ? 0 : sisaQty };
    });
  }

  function autoLinkSubItems(itemsList, currentSisa) {
    return itemsList.map(item => {
      let updatedItem = { ...item };
      
      if (!item.useSubItems) {
        if (item.purchaseId) {
          const match = currentSisa.find(p => p.purchaseId === item.purchaseId && (p.productName || '').toLowerCase() === (item.productName || '').toLowerCase());
          if (match) {
            updatedItem.hargaModalSatuan = match.costPerUnit;
            updatedItem.purchasedQty = match.qty;
            updatedItem.maxQty = match.sisaQty;
          }
        } else {
          const matching = currentSisa
            .filter(p => (p.productName || '').toLowerCase() === (item.productName || '').toLowerCase())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (matching.length > 0 && matching[0].sisaQty > 0) {
            updatedItem.hargaModalSatuan = matching[0].costPerUnit;
            updatedItem.purchasedQty = matching[0].qty;
            updatedItem.maxQty = matching[0].sisaQty; // For first bind, max is current sisa
            updatedItem.purchaseId = matching[0].purchaseId;
          }
        }
        return updatedItem;
      }
      
      const subItems = (item.subItems || []).map(b => {
        if (b.purchaseId) {
          const match = currentSisa.find(p => p.purchaseId === b.purchaseId && (p.productName || '').toLowerCase() === (b.nama || '').toLowerCase());
          if (match) {
            return {
              ...b,
              harga: match.costPerUnit,
              purchasedQty: match.qty,
              maxQty: match.sisaQty
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
  }

  function autoLinkExtraVeg(extraVegs, currentSisa) {
    return extraVegs.map(v => {
      if (v.purchaseId) {
        const match = currentSisa.find(p => p.purchaseId === v.purchaseId && (p.productName || '').toLowerCase() === (v.nama || '').toLowerCase());
        if (match) {
          return {
            ...v,
            harga: match.costPerUnit,
            purchasedQty: match.qty,
            maxQty: match.sisaQty
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
  }

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
    const sisa = calculateSisa(r.id, reports, r.customerName);
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
      totalBiayaOperasional: r.totalBiayaOperasional || 0,
      catatan: r.catatan || '',
    });
    setSisaPurchases(sisa); // Hitung instan
    setModalOpen(true);
  }
  const copySimilarReport = async () => {
    if (!form.customerName) return;

    // 1. Cari grup kembaran (e.g. SINDANGJAYA 2 & 5)
    let similarNames = [form.customerName];
    for (const group of SIMILAR_GROUPS) {
      if (group.includes(form.customerName)) {
        similarNames = group;
        break;
      }
    }

    // 2. Ambil semua laporan HPP untuk grup ini
    const allReports = await HppReports.getAll();
    const sorted = allReports
      .filter(r => 
        r.id !== editId && 
        similarNames.some(name => r.customerName.toLowerCase().includes(name.toLowerCase()))
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (sorted.length === 0) {
      alert(`Tidak ditemukan laporan sebelumnya untuk ${form.customerName} atau grup kembarannya.`);
      return;
    }

    const template = sorted[0];

    // 3. Update form. Kita pertahankan produk invoice sekarang, tapi ambil rinciannya
    const newItems = form.itemCosts.map(it => {
      // Cari produk yang sama di template
      const templateItem = template.itemCosts.find(ti => ti.productName === it.productName);
      if (templateItem) {
        return {
          ...it,
          qty: templateItem.qty,
          hargaModalSatuan: templateItem.hargaModalSatuan,
          useSubItems: templateItem.useSubItems,
          subItems: (templateItem.subItems || []).map(s => ({ ...s })),
        };
      }
      return it;
    });

    setForm(prev => ({
      ...prev,
      itemCosts: newItems,
      extraVegetables: (template.extraVegetables || []).map(v => ({ ...v })),
      ongkosKirimBahan: template.ongkosKirimBahan || 0,
      ongkosPengiriman: template.ongkosPengiriman || 0,
      biayaTenagaKerja: template.biayaTenagaKerja || 0,
      biayaLainnya: template.biayaLainnya || 0,
      totalBiayaOperasional: template.totalBiayaOperasional || 0,
    }));

    alert(`Data disalin dari ${template.customerName} (${formatDateShort(template.createdAt)})`);
  };

  function handleInvoiceChange(invoiceId) {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) {
      setForm(f => ({ ...f, invoiceId, invoiceNumber: '', customerName: '', invoiceTotal: 0, itemCosts: [] }));
      return;
    }
    const sisa = calculateSisa(null, reports, inv.customerName);
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
    const totalBiayaOperasional = Number(form.totalBiayaOperasional || 0);
    const totalBiayaInvoice = Number(form.ongkosKirimBahan) + Number(form.ongkosPengiriman) + Number(form.biayaTenagaKerja) + Number(form.biayaLainnya);
    const totalHPP = totalModalBarang + totalExtraVeg + totalBiayaInvoice + totalBiayaOperasional;
    const labaKotor = Number(form.invoiceTotal) - totalHPP;
    const margin = Number(form.invoiceTotal) > 0 ? ((labaKotor / Number(form.invoiceTotal)) * 100) : 0;
    return { totalModalBarang, totalExtraVeg, totalBiayaInvoice, totalBiayaOperasional, totalHPP, labaKotor, margin };
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.invoiceId) {
      alert('Pilih invoice terlebih dahulu');
      return;
    }
    const { totalModalBarang, totalBiayaInvoice, totalBiayaOperasional, totalHPP, labaKotor, margin } = calcFormTotals();

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
      totalBiayaOperasional,
      totalHPP,
      labaKotor,
      margin: Number(margin.toFixed(2)),
      rugi: labaKotor < 0,
    };

    // 1. Calculate Stock Diffs for Ingredients (Products)
    const stockDiffs = {};
    const oldHpp = editId ? reports.find(r => r.id === editId) : null;

    // Restore old stock if editing
    if (oldHpp) {
      const restoreStock = (items) => {
        (items || []).forEach(it => {
          if (it.useSubItems) {
            (it.subItems || []).forEach(sub => {
              const pid = sub.productId || allProds.find(p => (p.name || '').toLowerCase() === (sub.nama || '').toLowerCase())?.id;
              if (pid) stockDiffs[pid] = (stockDiffs[pid] || 0) + (Number(sub.qty) || 0);
            });
          } else {
            const pid = it.productId;
            if (pid) stockDiffs[pid] = (stockDiffs[pid] || 0) + 0; // Usage based on modal, but wait...
            // Actually, usually it's the sub-items or extra vegetables that are the raw materials.
            // If it's a direct item cost (not mix veg), it's the finished product itself (HPP calculation).
            // Usually we don't reduce stock for the finished product here because InvoiceForm already does it.
            // We reduce stock for the INGREDIENTS used to make the finished product.
          }
        });
        (oldHpp.extraVegetables || []).forEach(ex => {
          const pid = ex.productId || allProds.find(p => (p.name || '').toLowerCase() === (ex.nama || '').toLowerCase())?.id;
          if (pid) stockDiffs[pid] = (stockDiffs[pid] || 0) + (Number(ex.qty) || 0);
        });
      };
      const allProds = await ProductStore.getAll();
      restoreStock(oldHpp.itemCosts);
    }

    // Subtract new stock
    const subtractStock = (items) => {
      (items || []).forEach(it => {
        if (it.useSubItems) {
          (it.subItems || []).forEach(sub => {
            const pid = sub.productId || allProds.find(p => (p.name || '').toLowerCase() === (sub.nama || '').toLowerCase())?.id;
            if (pid) stockDiffs[pid] = (stockDiffs[pid] || 0) - (Number(sub.qty) || 0);
          });
        }
      });
      (data.extraVegetables || []).forEach(ex => {
        const pid = ex.productId || allProds.find(p => (p.name || '').toLowerCase() === (ex.nama || '').toLowerCase())?.id;
        if (pid) stockDiffs[pid] = (stockDiffs[pid] || 0) - (Number(ex.qty) || 0);
      });
    };
    const allProds = await ProductStore.getAll();
    subtractStock(data.itemCosts);

    // Save To Store
    if (editId) {
      await HppReports.update(editId, data);
    } else {
      await HppReports.create(data);
    }

    // Apply Stock Changes to DB
    for (const pid of Object.keys(stockDiffs)) {
      if (stockDiffs[pid] === 0) continue;
      const product = await ProductStore.getById(pid);
      if (product) {
        await ProductStore.update(pid, { stock: (product.stock || 0) + stockDiffs[pid] });
      }
    }

    setModalOpen(false);
    await reload();
  }

  async function handleDelete(id) {
    setDeleteId(id);
  }

  async function confirmDelete() {
    const id = deleteId;
    if (!id) return;
    const oldHpp = reports.find(r => r.id === id);
    if (oldHpp) {
      const stockDiffs = {};
      const allProds = await ProductStore.getAll();
      
      const restoreStock = (items) => {
        (items || []).forEach(it => {
          if (it.useSubItems) {
            (it.subItems || []).forEach(sub => {
              const pid = sub.productId || allProds.find(p => (p.name || '').toLowerCase() === (sub.nama || '').toLowerCase())?.id;
              if (pid) stockDiffs[pid] = (stockDiffs[pid] || 0) + (Number(sub.qty) || 0);
            });
          }
        });
        (oldHpp.extraVegetables || []).forEach(ex => {
          const pid = ex.productId || allProds.find(p => (p.name || '').toLowerCase() === (ex.nama || '').toLowerCase())?.id;
          if (pid) stockDiffs[pid] = (stockDiffs[pid] || 0) + (Number(ex.qty) || 0);
        });
      };
      
      restoreStock(oldHpp.itemCosts);
      
      for (const pid of Object.keys(stockDiffs)) {
        if (stockDiffs[pid] === 0) continue;
        const product = await ProductStore.getById(pid);
        if (product) {
          await ProductStore.update(pid, { stock: (product.stock || 0) + stockDiffs[pid] });
        }
      }
    }

    await HppReports.delete(id);
    setDeleteId(null);
    await reload();
  }

  const filtered = reports
    .filter(r => {
      const q = search.toLowerCase();
      const matchSearch = (r.invoiceNumber || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q);
      
      const matchTab = activeTab === 'Semua' || r.customerName === activeTab;

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
      return matchSearch && matchDate && matchTab;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const uniqueCustomers = Array.from(new Set(reports.map(r => r.customerName))).sort();

  // --- REKAP HARIAN LOGIC ---
  const dailyRecap = (() => {
    const groups = {};
    filtered.forEach(r => {
      const dateKey = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'Unknown';
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          count: 0,
          revenue: 0,
          modalBarang: 0,
          biayaInvoice: 0,
          biayaOperasional: 0,
          totalHPP: 0,
          labaKotor: 0,
          rugiCount: 0
        };
      }
      groups[dateKey].count += 1;
      groups[dateKey].revenue += Number(r.invoiceTotal || 0);
      groups[dateKey].modalBarang += Number(r.totalModalBarang || 0);
      groups[dateKey].biayaInvoice += Number(r.totalBiayaInvoice || 0);
      groups[dateKey].biayaOperasional += (Number(r.totalBiayaOperasional || 0) + Number(r.totalExtraVeg || 0));
      groups[dateKey].totalHPP += Number(r.totalHPP || 0);
      groups[dateKey].labaKotor += Number(r.labaKotor || 0);
      if (r.rugi) groups[dateKey].rugiCount += 1;
    });
    return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  })();

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
      
      {/* Customer Tabs */}
      <div className="custom-tabs-container mb-md" style={{ 
        display: 'flex', 
        gap: 8, 
        overflowX: 'auto', 
        paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        marginBottom: 20
      }}>
        <button 
          className={`tab-item ${activeTab === 'Semua' ? 'active' : ''}`}
          onClick={() => setActiveTab('Semua')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            background: activeTab === 'Semua' ? 'rgba(129, 140, 248, 0.2)' : 'rgba(255,255,255,0.03)',
            color: activeTab === 'Semua' ? '#818cf8' : '#94a3b8',
            border: activeTab === 'Semua' ? '1px solid rgba(129, 140, 248, 0.3)' : '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Semua Pelanggan
        </button>
        {uniqueCustomers.map(cust => (
          <button 
            key={cust}
            className={`tab-item ${activeTab === cust ? 'active' : ''}`}
            onClick={() => setActiveTab(cust)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: activeTab === cust ? 'rgba(129, 140, 248, 0.2)' : 'rgba(255,255,255,0.03)',
              color: activeTab === cust ? '#818cf8' : '#94a3b8',
              border: activeTab === cust ? '1px solid rgba(129, 140, 248, 0.3)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {cust}
          </button>
        ))}
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-sm mb-md" style={{ background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        <button 
          className="btn btn-sm" 
          onClick={() => setViewMode('list')}
          style={{ 
            background: viewMode === 'list' ? 'rgba(129, 140, 248, 0.2)' : 'transparent',
            color: viewMode === 'list' ? '#818cf8' : '#94a3b8',
            border: 'none',
            padding: '6px 16px'
          }}
        >
          <FiPackage style={{ marginRight: 6 }} /> Daftar Invoice
        </button>
        <button 
          className="btn btn-sm" 
          onClick={() => setViewMode('daily')}
          style={{ 
            background: viewMode === 'daily' ? 'rgba(129, 140, 248, 0.2)' : 'transparent',
            color: viewMode === 'daily' ? '#818cf8' : '#94a3b8',
            border: 'none',
            padding: '6px 16px'
          }}
        >
          <FiDollarSign style={{ marginRight: 6 }} /> Rekap Harian
        </button>
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
        {viewMode === 'list' ? (
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
                <ViewModeItem key={r.id} r={r} expandedRow={expandedRow} setExpandedRow={setExpandedRow} handleExportPdf={handleExportPdf} openEdit={openEdit} handleDelete={handleDelete} printingId={printingId} />
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
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th style={{ textAlign: 'center' }}>Jumlah Invoice</th>
                <th style={{ textAlign: 'right' }}>Total Penjualan</th>
                <th style={{ textAlign: 'right' }}>Total HPP</th>
                <th style={{ textAlign: 'right' }}>Total Laba Kotor</th>
                <th style={{ textAlign: 'right' }}>Avg. Margin</th>
                <th style={{ textAlign: 'center' }}>Status Kerugian</th>
              </tr>
            </thead>
            <tbody>
              {dailyRecap.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><FiDollarSign /></div>
                      <h3>Data tidak ditemukan</h3>
                      <p>Sesuaikan filter periode atau pencarian</p>
                    </div>
                  </td>
                </tr>
              ) : dailyRecap.map((day, dIdx) => {
                const dayMargin = day.revenue > 0 ? (day.labaKotor / day.revenue) * 100 : 0;
                return (
                  <tr key={dIdx}>
                    <td><strong>{formatDateShort(day.date)}</strong></td>
                    <td style={{ textAlign: 'center' }}>{day.count}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(day.revenue)}</td>
                    <td style={{ textAlign: 'right', color: '#f87171' }}>{formatCurrency(day.totalHPP)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: day.labaKotor >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(day.labaKotor)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: dayMargin >= 20 ? '#34d399' : dayMargin >= 10 ? '#fbbf24' : '#f87171' }}>
                        {dayMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {day.rugiCount > 0 ? (
                        <span className="badge badge-danger">
                          <FiAlertTriangle style={{ marginRight: 4 }} /> {day.rugiCount} Rugi
                        </span>
                      ) : (
                        <span className="badge badge-success">Aman</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {dailyRecap.length > 0 && (
              <tfoot>
                <tr style={{ background: 'rgba(99,102,241,0.05)', fontWeight: 700 }}>
                  <td><strong>TOTAL ({dailyRecap.length} Hari)</strong></td>
                  <td style={{ textAlign: 'center' }}>{filtered.length} Inv</td>
                  <td className="text-right">{formatCurrency(totalRevenue)}</td>
                  <td className="text-right" style={{ color: '#f87171' }}>{formatCurrency(totalHPPAll)}</td>
                  <td className="text-right" style={{ color: totalLaba >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(totalLaba)}</td>
                  <td className="text-right">{avgMargin}%</td>
                  <td style={{ textAlign: 'center' }}>
                    {jumlahRugi > 0 ? (
                      <span style={{ color: '#f87171' }}>{jumlahRugi} Total Rugi</span>
                    ) : 'Semua Aman'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* Modal Form */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Laporan HPP' : 'Tambah Laporan HPP'} size="xl" persistent={true}>
        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ position: 'relative' }}>
            {openSubIndex !== null && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpenSubIndex(null)} />
            )}

            {/* Pilih Invoice */}
            <div className="form-group" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
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
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={copySimilarReport} 
                disabled={!form.customerName}
                title="Salin rincian dari laporan sebelumnya atau pelanggan serupa"
                style={{ height: 42 }}
              >
                <FiPackage style={{ marginRight: 6 }} /> Salin Data Serupa
              </button>
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                  className="form-input"
                                  type="number"
                                  min="0" 
                                  step="any"
                                  value={item.qty}
                                  onChange={e => {
                                    let val = e.target.value;
                                    if (item.maxQty && Number(val) > item.maxQty) {
                                      alert(`Kapasitas maksimal adalah ${item.maxQty} (sesuai pembelian)`);
                                      val = item.maxQty.toString();
                                    }
                                    updateItemCost(idx, 'qty', val);
                                  }}
                                  style={{ width: 80, textAlign: 'center' }}
                                />
                                {(() => {
                                  if (item.purchasedQty > 0) {
                                    return <span style={{ fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>(Sisa Stok: {item.maxQty - Number(item.qty || 0)})</span>;
                                  } else {
                                    const matching = sisaPurchases.filter(p => (p.productName || '').toLowerCase() === (item.productName || '').toLowerCase());
                                    const sisa = matching.reduce((s, p) => s + (p.sisaQty || 0), 0);
                                    if (sisa > 0) {
                                      return <span style={{ fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>(Sisa Stok: {sisa - Number(item.qty || 0)})</span>;
                                    } else if (item.maxQty) {
                                      return <span style={{ fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>(Sisa Stok: {item.maxQty - Number(item.qty || 0)})</span>;
                                    }
                                    return null;
                                  }
                                })()}
                              </div>
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
                                      return <div style={{ fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>(Sisa Stok: {b.maxQty - Number(b.qty || 0)})</div>;
                                    } else {
                                      const matching = sisaPurchases.filter(p => (p.productName || '').toLowerCase() === (b.nama || '').toLowerCase());
                                      const sisa = matching.reduce((s, p) => s + (p.sisaQty || 0), 0);
                                      if (sisa > 0) {
                                        return <div style={{ fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>(Sisa Stok: {sisa - Number(b.qty || 0)})</div>;
                                      } else if (b.maxQty) {
                                        return <div style={{ fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>(Sisa Stok: {b.maxQty - Number(b.qty || 0)})</div>;
                                      } else {
                                        return <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>(Stok Habis)</div>;
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
                          (Sisa Stok: {v.maxQty - Number(v.qty || 0)})
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>(Stok Habis)</div>
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
                  {form.totalBiayaOperasional > 0 && (
                    <>
                      <span className="text-muted">Biaya Operasional (Pro-rata)</span><span style={{ textAlign: 'right' }}>{formatCurrency(form.totalBiayaOperasional)}</span>
                    </>
                  )}
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
