import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiShoppingBag, FiInfo, FiUsers, FiFileText } from 'react-icons/fi';
import { PurchaseNotes, SupportingMaterialItems as MasterItems, Invoices, Suppliers, Customers } from '../utils/storage';
import { formatCurrency } from '../utils/formatter';
import Modal from '../components/Modal';
import PurchaseNoteReportPdf from '../components/PurchaseNoteReportPdf';

const emptyItem = {
  materialId: '',
  materialName: '',
  unit: '',
  supplier: '',
  isManuallyEdited: false,
  qtyNota: 0,
  invoiceQty: 0,
  pricePerUnit: 0,
  sellPrice: 0,
  invoiceBreakdown: { s5: 0, s2: 0, s1: 0, s3: 0 },
  splits: {
    s5: { qty: 0, shrinkage: 0, netQty: 0 },
    s2: { qty: 0, shrinkage: 0, netQty: 0 },
    s3: { qty: 0, shrinkage: 0, netQty: 0 }
  },
  totalCost: 0
};

const MIX_VEG_INGREDIENTS = ['Wortel', 'Buncis', 'Jagung'];

export default function PurchaseNoteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = !!id;

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierName, setSupplierName] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [notes, setNotes] = useState('');
  const [invoiceId, setInvoiceId] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [masterBahan, setMasterBahan] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [supplierHistory, setSupplierHistory] = useState([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isGroupImportModalOpen, setIsGroupImportModalOpen] = useState(false);
  const [groupRecapData, setGroupRecapData] = useState({}); // { groupName: [{ name, totalQty, unit }] }
  const [currentGroupName, setCurrentGroupName] = useState('');
  const [sourceInvoiceIds, setSourceInvoiceIds] = useState([]);
  const [usedInvoiceIds, setUsedInvoiceIds] = useState(new Set());
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [groupInvoices, setGroupInvoices] = useState({});
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [supplierDiscounts, setSupplierDiscounts] = useState({}); // { supplierName: amount }
  const [additionalCosts, setAdditionalCosts] = useState({ labor: 0, shipping: 0, productionMaterial: 0 });
  const [saving, setSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [itemsCount, setItemsCount] = useState(0);

  useEffect(() => {
    loadData();
  }, [id]);

  function expandItems(sourceItems, master) {
    const result = [];
    sourceItems.forEach(it => {
      const name = (it.materialName || '').toLowerCase();
      if (name.includes('mix vegetable') || name.includes('mix veg')) {
        const baseQty = Number(it.qtyNota) || 0;
        const baseInvQty = Number(it.invoiceQty) || 0;
        const basePrice = Number(it.pricePerUnit) || 0;

        MIX_VEG_INGREDIENTS.forEach(ingName => {
          const mb = master.find(b => b.name.toLowerCase() === ingName.toLowerCase());
          const q = (baseQty / 3);
          const iq = (baseInvQty / 3);
          
          result.push({
            ...emptyItem,
            materialId: mb ? mb.id : '',
            materialName: ingName,
            isSubItem: true,
            parentName: it.materialName || 'Mix Vegetable',
            unit: mb ? mb.unit : 'kg',
            qtyNota: Number(q.toFixed(2)),
            invoiceQty: Number(iq.toFixed(2)),
            pricePerUnit: basePrice,
            totalCost: Number((q * basePrice).toFixed(2)),
            supplier: it.supplier || '',
            splits: {
              s5: { qty: Number(q.toFixed(2)), shrinkage: 0, netQty: Number(q.toFixed(2)) },
              s2: { qty: 0, shrinkage: 0, netQty: 0 },
              s3: { qty: 0, shrinkage: 0, netQty: 0 }
            }
          });
        });
      } else {
        result.push(it);
      }
    });
    return result;
  }

  async function loadData() {
    try {
      setStatusMessage(`🔄 Mencari Nota ID: ${id || 'New'}...`);
      
      // 1. Fetch the Note FIRST if editing
      let actualItems = [...items]; 
      if (isEditing) {
        try {
          const noteData = await PurchaseNotes.getById(id);
          if (noteData) {
            setDate(noteData.date || new Date().toISOString().slice(0, 10));
            setSupplierName(noteData.supplierName || '');
            actualItems = (noteData.items || []).length > 0 ? noteData.items : [{ ...emptyItem }];
            setNotes(noteData.notes || '');
            setInvoiceId(noteData.invoiceId || null);
            setInvoiceNumber(noteData.invoiceNumber || '');
            setCurrentGroupName(noteData.groupName || '');
            setSourceInvoiceIds(noteData.sourceInvoiceIds || []);
            setSupplierDiscounts(noteData.supplierDiscounts || {});
            setStatusMessage(`✅ Berhasil menarik ${actualItems.length} barang dari database.`);
            setItemsCount(actualItems.length);
            setAdditionalCosts(noteData.additionalCosts || { labor: 0, shipping: 0, productionMaterial: 0 });
          } else {
            setStatusMessage(`⚠️ Nota ID "${id}" TIDAK DITEMUKAN.`);
          }
        } catch (err) {
          console.error("Error fetching individual note:", err);
          setStatusMessage(`❌ Error mencari nota: ${err.message}`);
        }
      }

      // 2. Fetch Master Bahan
      let master = [];
      try { master = await MasterItems.getAll(); setMasterBahan(master); } catch (err) {}

      // 3. Rehydrate (using actualItems local variable, NOT items state)
      if (isEditing && actualItems.length > 0) {
        const hydrated = actualItems.map(it => {
          let newItem = { ...it };
          const mName = (newItem.materialName || '').toLowerCase();
          if (!newItem.materialId && mName && master.length > 0) {
            const mb = master.find(m => (m.name || '').toLowerCase() === mName);
            if (mb) newItem.materialId = mb.id;
          }
          if (!newItem.splits) {
            newItem.splits = { s5: { qty: 0, shrinkage: 0, netQty: 0 }, s2: { qty: 0, shrinkage: 0, netQty: 0 }, s3: { qty: 0, shrinkage: 0, netQty: 0 } };
          } else {
            if (!newItem.splits.s5) newItem.splits.s5 = { qty: 0, shrinkage: 0, netQty: 0 };
            if (!newItem.splits.s2) newItem.splits.s2 = { qty: 0, shrinkage: 0, netQty: 0 };
            if (!newItem.splits.s3) newItem.splits.s3 = { qty: 0, shrinkage: 0, netQty: 0 };
          }
          newItem.isManuallyEdited = true; // Existing note items are already checked
          return newItem;
        });
        setItems(hydrated);
      } else {
        setItems(actualItems);
      }

      // 4. Fetch Background Data (Invoices, History, etc.)
      try {
        const [invs, history, officialSuppliers, allCustomers] = await Promise.all([
          Invoices.getAll(),
          PurchaseNotes.getAll(),
          Suppliers.getAll(),
          Customers.getAll()
        ]);
        setInvoices(invs.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)));
        setAllSuppliers(officialSuppliers);
        setPurchaseHistory(history);
        
        // Supplier suggestions
        const supplierSet = new Set();
        officialSuppliers.forEach(s => { if (s.name) supplierSet.add(s.name); if (s.company) supplierSet.add(s.company); });
        history.forEach(pn => { if (pn.supplierName) supplierSet.add(pn.supplierName); (pn.items || []).forEach(it => { if (it.supplier) supplierSet.add(it.supplier); }); });
        setSupplierHistory(Array.from(supplierSet).sort());

        // Invoice usage
        const usedIds = new Set();
        history.forEach(pn => { if (pn.invoiceId) usedIds.add(pn.invoiceId); if (Array.isArray(pn.sourceInvoiceIds)) pn.sourceInvoiceIds.forEach(sid => usedIds.add(sid)); });
        setUsedInvoiceIds(usedIds);

        // Group recap building
        const nameToGroup = {};
        (allCustomers || []).forEach(c => { 
          if (c && c.group && c.name) {
            nameToGroup[c.name.toLowerCase()] = c.group; 
          }
        });
        const groupAgg = {};
        const groupInvs = {};
        (invs || []).forEach(inv => {
          if (!inv || usedIds.has(inv.id)) return;
          const grp = nameToGroup[(inv.customerName || '').toLowerCase()];
          if (!grp) return;
          if (!groupAgg[grp]) groupAgg[grp] = {};
          if (!groupInvs[grp]) groupInvs[grp] = [];
          groupInvs[grp].push(inv);
          (inv.items || []).forEach(it => {
            const key = (it?.productName || '').trim();
            if (!key) return;
            if (!groupAgg[grp][key]) groupAgg[grp][key] = { name: key, totalQty: 0, unit: it.unit || 'kg' };
            groupAgg[grp][key].totalQty += (Number(it.qty) || 0);
          });
        });
        const grpResult = {};
        Object.keys(groupAgg).sort().forEach(grp => { grpResult[grp] = Object.values(groupAgg[grp]).sort((a, b) => a.name.localeCompare(b.name)); });
        setGroupRecapData(grpResult);
        setGroupInvoices(groupInvs);
      } catch (err) {
        console.error("Error loading secondary/background data:", err);
      }

      // Handle direct invoice import from route state if NEW
      if (!isEditing && location.state?.invoiceId) {
        const invId = location.state.invoiceId;
        // invs isn't available here as we didn't wait for it. We'll fetch it individually.
        const inv = await Invoices.getById(invId);
        if (inv) {
          setInvoiceId(inv.id);
          setInvoiceNumber(inv.invoiceNumber);
          setSourceInvoiceIds([inv.id]);
          const materials = (inv.items || [])
            .map(it => {
              const pName = (it.productName || '').toLowerCase();
              const mb = master.find(m => (m.name || '').toLowerCase() === pName);
              return {
                materialId: it.productId || (mb ? mb.id : ''),
                materialName: it.productName,
                unit: it.unit || (mb ? mb.unit : 'kg'),
                qtyNota: Number(it.qty) || 0,
                invoiceQty: Number(it.qty) || 0,
                pricePerUnit: Number(it.unitPrice) || 0,
                sellPrice: Number(it.unitPrice) || 0,
                splits: { s5: { qty: Number(it.qty) || 0, shrinkage: 0, netQty: Number(it.qty) || 0 }, s2: { qty: 0, shrinkage: 0, netQty: 0 }, s3: { qty: 0, shrinkage: 0, netQty: 0 } },
                totalCost: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0)
              };
            });
          const expanded = expandItems(materials, master);
          if (expanded.length > 0) {
            setItems(expanded);
            setSupplierName(inv.customerName || '');
            setNotes(n => `${n}${n ? '\n' : ''}Otomatis dari Invoice: ${inv.invoiceNumber}`);
          }
        }
      }
    } catch (err) {
      console.error("Global Error loading data:", err);
      setStatusMessage(`❌ Error Fatal: ${err.message}`);
    }
  }

  function addItem() {
    setItems([...items, { ...emptyItem }]);
  }

  function removeItem(index) {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index, field, value) {
    const newItems = [...items];
    const it = { ...newItems[index] };
    
    // Mark as manually edited if Material or Qty changed
    if (field === 'materialId' || field === 'qtyNota') {
      it.isManuallyEdited = true;
    }

    // Proportional Split Logic for S5/S2/S3 (Gabung Nota)
    if (field === 'qtyNota' && it.invoiceBreakdown && it.invoiceQty > 0) {
      const totalInv = it.invoiceQty;
      const newQty = Number(value) || 0;
      
      const ratioS5 = (it.invoiceBreakdown.s5 || 0) / totalInv;
      const ratioS2 = (it.invoiceBreakdown.s2 || 0) / totalInv;
      const ratioS3 = (it.invoiceBreakdown.s3 || 0) / totalInv;

      // Update Qty and NetQty for all branches proportionally
      it.splits.s5 = { ...it.splits.s5, qty: newQty * ratioS5, netQty: newQty * ratioS5 - (it.splits.s5.shrinkage || 0) };
      it.splits.s2 = { ...it.splits.s2, qty: newQty * ratioS2, netQty: newQty * ratioS2 - (it.splits.s2.shrinkage || 0) };
      it.splits.s3 = { ...it.splits.s3, qty: newQty * ratioS3, netQty: newQty * ratioS3 - (it.splits.s3.shrinkage || 0) };
      
      newItems[index] = it;
    }

    if (field === 'materialId') {
      if (value === 'all-master') {
        setInvoiceId(null);
        setInvoiceNumber('');
        return;
      }
      const m = masterBahan.find(b => b.id === value);
      if (m) {
        // Use generalized expansion logic if it's Mix Veg
        if (m.name.toLowerCase().includes('mix vegetable') || m.name.toLowerCase().includes('mix veg')) {
          const baseItem = {
            ...newItems[index],
            materialId: m.id,
            materialName: m.name,
            unit: m.unit,
            qtyNota: Number(newItems[index].qtyNota) || 1,
            invoiceQty: Number(newItems[index].invoiceQty) || 0,
            pricePerUnit: m.defaultPrice || 0,
          };

          const expanded = expandItems([baseItem], masterBahan);
          newItems.splice(index, 1, ...expanded);
          setItems(newItems);
          return;
        }

        // Normal Selection
        newItems[index].materialId = value;
        newItems[index].materialName = m.name;
        newItems[index].unit = m.unit;
        newItems[index].sellPrice = m.defaultPrice || 0;
      } else {
        newItems[index].materialId = '';
      }
    } else if (field === 'totalCost') {
      const subtotal = Number(value) || 0;
      const q = Number(newItems[index].qtyNota) || 0;
      newItems[index].totalCost = subtotal;
      if (q > 0) {
        newItems[index].pricePerUnit = (subtotal / q).toFixed(2);
      }
    } else {
      newItems[index][field] = value;
    }

    if (field === 'qtyNota' || field === 'pricePerUnit' || field === 'totalCost') {
      const q = Number(newItems[index].qtyNota) || 0;
      const p = Number(newItems[index].pricePerUnit) || 0;
      
      if (field !== 'totalCost') {
        newItems[index].totalCost = q * p;
      }

      // Shrinkage Auto-Calculation (Only if it hasn't been split proportionally)
      if (field === 'qtyNota' && newItems[index].invoiceQty > 0 && !newItems[index].invoiceBreakdown) {
        const invQty = newItems[index].invoiceQty;
        const diff = q - invQty;

        // Default to S5 for non-merged single invoices (Legacy fallback)
        newItems[index].splits.s5.qty = q;
        newItems[index].splits.s5.shrinkage = diff;
        newItems[index].splits.s5.netQty = q - diff;
      }

      // Auto-calculate split based on history if qtyNota is entered and splits are empty
      if (field === 'qtyNota' && q > 0) {
        const matId = newItems[index].materialId;
        if (matId) {
          const curS2 = Number(newItems[index].splits?.s2?.qty) || 0;
          const curS5 = Number(newItems[index].splits?.s5?.qty) || 0;

          if (curS2 === 0 && curS5 === 0) {
            let histS2 = 0;
            let histS5 = 0;
            purchaseHistory.forEach(pn => {
              (pn.items || []).forEach(hItem => {
                if (hItem.materialId === matId) {
                  histS2 += Number(hItem.splits?.s2?.netQty || 0);
                  histS5 += Number(hItem.splits?.s5?.netQty || 0);
                }
              });
            });

            const totalHist = histS2 + histS5;
            if (totalHist > 0) {
              const ratioS2 = histS2 / totalHist;
              const ratioS5 = histS5 / totalHist;
              newItems[index].splits = {
                ...newItems[index].splits,
                s2: { ...newItems[index].splits.s2, qty: (q * ratioS2).toFixed(2), netQty: (q * ratioS2).toFixed(2) },
                s5: { ...newItems[index].splits.s5, qty: (q * ratioS5).toFixed(2), netQty: (q * ratioS5).toFixed(2) }
              };
            }
          }
        }
      }
    }

    setItems(newItems);
  }

  function updateSplit(itemIndex, branch, field, value) {
    const newItems = [...items];
    const item = newItems[itemIndex];
    const val = Number(value) || 0;
    const split = { ...item.splits[branch], [field]: val };

    if (field === 'qty' || field === 'shrinkage') {
      if (field === 'qty' && item.invoiceQty > 0) {
        // Auto-calculate shrinkage to match the invoice for this branch
        const otherBranches = Object.keys(item.splits).filter(b => b !== branch);
        const othersNet = otherBranches.reduce((sum, b) => sum + (item.splits[b].netQty || 0), 0);
        const targetNetForThis = Math.max(0, item.invoiceQty - othersNet);

        split.shrinkage = Math.max(0, val - targetNetForThis);
        split.netQty = val - split.shrinkage;
      } else {
        split.netQty = split.qty - split.shrinkage;
      }
    }

    item.splits[branch] = split;
    setItems(newItems);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const grandTotal = items.reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);
      const totalDiscount = Object.values(supplierDiscounts).reduce((s, d) => s + (Number(d) || 0), 0);
      const totalAdditionalCosts = Object.values(additionalCosts).reduce((s, c) => s + (Number(c) || 0), 0);
      const finalTotal = Math.max(0, grandTotal - totalDiscount) + totalAdditionalCosts;
      
      const payload = {
        date,
        supplierName,
        items,
        notes,
        grandTotal,
        invoiceId,
        invoiceNumber,
        groupName: currentGroupName,
        sourceInvoiceIds,
        supplierDiscounts,
        additionalCosts,
        finalTotal
      };

      if (isEditing) {
        const oldNote = await PurchaseNotes.getById(id);
        if (oldNote && oldNote.items) {
          for (const oldIt of oldNote.items) {
            if (oldIt.materialId) {
              const master = await MasterItems.getById(oldIt.materialId);
              if (master) {
                const oldTotalNet = (Number(oldIt.splits.s5?.netQty) || 0) + (Number(oldIt.splits.s2?.netQty) || 0) + (Number(oldIt.splits.s3?.netQty) || 0);
                await MasterItems.update(master.id, { stock: (master.stock || 0) - oldTotalNet });
              }
            }
          }
        }
        const result = await PurchaseNotes.update(id, payload);
        if (!result) throw new Error('Gagal mengupdate nota di Database');
      } else {
        const result = await PurchaseNotes.create(payload);
        if (!result) throw new Error('Gagal menyimpan nota baru ke Database');
      }

      for (const it of items) {
        if (it.materialId) {
          const master = await MasterItems.getById(it.materialId);
          if (master) {
            const totalNet = (it.splits.s5?.netQty || 0) + (it.splits.s2?.netQty || 0) + (it.splits.s3?.netQty || 0);
            await MasterItems.update(master.id, { stock: (master.stock || 0) + totalNet });
          }
        }
      }

      navigate('/purchase-notes');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }
  function importFromGroup(grp) {
    const recapItems = groupRecapData[grp] || [];
    if (recapItems.length === 0) return;
    const newItems = recapItems.map(recap => {
      const mb = masterBahan.find(b => b.name.toLowerCase() === recap.name.toLowerCase());
      return {
        ...emptyItem,
        materialId: mb ? mb.id : '',
        materialName: recap.name,
        unit: recap.unit || (mb ? mb.unit : 'kg'),
        qtyNota: recap.totalQty,
        invoiceQty: recap.totalQty,
        pricePerUnit: mb ? (mb.defaultPrice || 0) : 0,
        sellPrice: mb ? (mb.defaultPrice || 0) : 0,
        totalCost: recap.totalQty * (mb ? (mb.defaultPrice || 0) : 0),
        splits: {
          s5: { qty: 0, shrinkage: 0, netQty: 0 },
          s2: { qty: 0, shrinkage: 0, netQty: 0 },
          s3: { qty: 0, shrinkage: 0, netQty: 0 }
        }
      };
    });
    const expanded = expandItems(newItems, masterBahan);
    if (expanded.length > 0) {
      setItems(expanded);
      setNotes(n => `${n}${n ? '\n' : ''}Rekap Grup: ${grp}`);
    }
    setCurrentGroupName(grp);
    setSourceInvoiceIds((groupInvoices[grp] || []).map(inv => inv.id));
    setIsGroupImportModalOpen(false);
  }

  function handlePrintPdf() {
    window.print();
  }

  const totalItemCost = (items || []).reduce((s, it) => s + (Number(it.totalCost) || 0), 0);
  const totalDiscount = Object.values(supplierDiscounts).reduce((s, d) => s + (Number(d) || 0), 0);
  const totalAdditionalCosts = Object.values(additionalCosts).reduce((s, c) => s + (Number(c) || 0), 0);
  const grandTotalValue = Math.max(0, totalItemCost - totalDiscount) + totalAdditionalCosts;

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div className="flex-center gap-md">
          <Link to="/purchase-notes" className="btn btn-ghost btn-sm btn-icon-only">
            <FiArrowLeft />
          </Link>
          <div>
            <h1>{isEditing ? 'Edit Pembelian' : 'Pencatatan Pembelian Bahan'}</h1>
            <p>Input detail pembelian dan split S5 / S2 / S3</p>
          </div>
        </div>
        <div className="flex gap-sm">
          {!isEditing && (
            <>
              {Object.keys(groupRecapData).length > 0 && (
                <button className="btn btn-secondary" onClick={() => setIsGroupImportModalOpen(true)}>
                  <FiUsers /> Tarik dari Rekap Grup
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}>
                <FiShoppingBag /> Tarik dari Invoice
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <FiSave /> {saving ? 'Menyimpan...' : 'Simpan Nota'}
          </button>
          
          <button className="btn btn-secondary" onClick={handlePrintPdf} disabled={isGeneratingPdf} style={{ background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)', color: 'white' }}>
            {isGeneratingPdf ? '⏳...' : <><FiFileText /> Cetak PDF</>}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{ padding: '12px', background: statusMessage.includes('❌') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)', border: `1px solid ${statusMessage.includes('❌') ? '#ef4444' : '#6366f1'}`, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>{statusMessage.includes('❌') ? '⚠️' : 'ℹ️'}</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{statusMessage}</span>
          {isEditing && itemsCount > 0 && <span className="badge badge-success">OK ({itemsCount} item)</span>}
        </div>
      )}

      <form className="grid gap-lg" onSubmit={handleSave}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Informasi Utama</h3></div>
          <div className="grid grid-2 gap-md p-md">
            <div className="form-group">
              <label className="form-label">Tanggal Pembelian</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier Default
                <span className="text-xs text-muted" style={{ fontWeight: 400, marginLeft: 8 }}>(Akan dipakai untuk baris baru)</span>
              </label>
              <input
                className="form-input"
                list="supplier-list-default"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                placeholder="Misal: Toko Sinar Jaya"
              />
              <datalist id="supplier-list-default">
                {supplierHistory.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="table table-compact" style={{ width: '100%', minWidth: '950px' }}>
            <thead>
              <tr>
                <th style={{ width: '40px', padding: '10px 4px' }}>No</th>
                <th style={{ width: '130px', minWidth: '120px', padding: '10px 4px' }}>Supplier</th>
                <th style={{ width: 'auto', minWidth: '160px' }}>Bahan Baku</th>
                <th style={{ width: '85px', padding: '10px 4px' }}>Qty Nota</th>
                <th style={{ width: '110px', padding: '10px 4px' }}>Harga Beli</th>
                <th style={{ width: '135px', padding: '10px 4px', backgroundColor: 'rgba(56, 189, 248, 0.05)' }}>S5 (SJ 5)</th>
                <th style={{ width: '135px', padding: '10px 4px', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>S2 (SJ 2)</th>
                <th style={{ width: '135px', padding: '10px 4px', backgroundColor: 'rgba(251, 146, 60, 0.05)' }}>S3 (SJ 3)</th>
                <th style={{ width: '110px', padding: '10px 4px' }}>Harga Jual</th>
                <th style={{ width: '120px', padding: '10px 8px' }}>Subtotal</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const currentInvoice = (invoices || []).find(inv => inv.id === invoiceId);
                
                return (items || []).map((item, idx) => {
                  let selectable = masterBahan;
                  if (currentInvoice) {
                    selectable = masterBahan.filter(m =>
                      m.id === item.materialId || // Always include current selection
                      (currentInvoice.items || []).some(it => it.productId === m.id || it.productName === m.name)
                    );
                  }

                  return (
                    <tr key={idx} className="animate-in" style={{ backgroundColor: !item.isManuallyEdited ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
                      <td className="text-center" style={{ verticalAlign: 'middle' }}>
                        <span className="badge badge-primary">{idx + 1}</span>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input form-input-sm"
                          list={`supplier-list-${idx}`}
                          value={item.supplier || ''}
                          onChange={e => updateItem(idx, 'supplier', e.target.value)}
                          placeholder={supplierName || 'Supplier...'}
                          style={{ minWidth: 110 }}
                        />
                        <datalist id={`supplier-list-${idx}`}>
                          {supplierHistory.map(s => <option key={s} value={s} />)}
                        </datalist>
                      </td>
                      <td>
                        <div className="flex-center gap-xs" style={{ flex: 1 }}>
                          {item.isSubItem && <span style={{ color: 'var(--primary)', fontWeight: 800, marginRight: 2 }}>↳ </span>}
                          <select 
                            className="form-select form-select-sm" 
                            value={item.materialId} 
                            onChange={e => updateItem(idx, 'materialId', e.target.value)} 
                            required 
                            style={{ 
                              paddingLeft: item.isSubItem ? '16px' : undefined, 
                              flex: 1,
                              borderColor: !item.isManuallyEdited ? '#ef4444' : undefined,
                              borderWidth: !item.isManuallyEdited ? '2px' : undefined,
                              boxShadow: !item.isManuallyEdited ? '0 0 0 1px rgba(239, 68, 68, 0.1)' : undefined
                            }}
                          >
                            <option value="">-- {currentInvoice ? 'Invoice Item' : 'Pilih Bahan'} --</option>
                            {selectable.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                            {item.materialId && !selectable.some(m => m.id === item.materialId) && (
                              <option value={item.materialId}>{item.materialName || 'Unknown Material'}</option>
                            )}
                            {!item.materialId && item.materialName && (
                              <option value="">{item.materialName} (Belum di Master)</option>
                            )}
                            {currentInvoice && selectable.length < masterBahan.length && (
                              <option value="all-master">Lainnya...</option>
                            )}
                          </select>
                          {item.isSubItem && <span className="badge badge-purple" style={{ fontSize: 10, padding: '2px 4px' }}>Sub-Mix</span>}
                          {!item.isManuallyEdited && (
                            <span className="badge" style={{ backgroundColor: '#ef4444', color: 'white', fontSize: 10, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                              ⚠️ Belum Dicek
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="flex-center gap-xs">
                            <input 
                              type="number" 
                              className="form-input form-input-sm" 
                              value={item.qtyNota} 
                              onChange={e => updateItem(idx, 'qtyNota', e.target.value)} 
                              style={{ 
                                width: '65px', 
                                borderColor: !item.isManuallyEdited ? '#ef4444' : undefined, 
                                borderWidth: !item.isManuallyEdited ? '2px' : undefined 
                              }} 
                            />
                            <span className="text-xs text-muted">{item.unit || ''}</span>
                          </div>
                          {item.invoiceQty > 0 && (
                            <div className="text-xs text-muted mt-xs" style={{ whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                              {item.isSubItem ? `Inv: ${item.parentName}` : 'Inv'}: <strong>{item.invoiceQty}</strong>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <input type="number" className="form-input form-input-sm" value={item.pricePerUnit} onChange={e => updateItem(idx, 'pricePerUnit', e.target.value)} />
                      </td>
                      <td style={{ backgroundColor: 'rgba(56, 189, 248, 0.02)' }}>
                        <div className="flex gap-xs">
                          <input type="number" className="form-input form-input-sm" placeholder="Qty" value={item.splits?.s5?.qty || 0} onChange={e => updateSplit(idx, 's5', 'qty', e.target.value)} />
                          <input type="number" className="form-input form-input-sm text-danger" placeholder="Sst" value={item.splits?.s5?.shrinkage || 0} onChange={e => updateSplit(idx, 's5', 'shrinkage', e.target.value)} />
                        </div>
                        <div className="text-xs mt-xs text-primary font-bold">Net: {item.splits?.s5?.netQty || 0}</div>
                      </td>
                      <td style={{ backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
                        <div className="flex gap-xs">
                          <input type="number" className="form-input form-input-sm" placeholder="Qty" value={item.splits?.s2?.qty || 0} onChange={e => updateSplit(idx, 's2', 'qty', e.target.value)} />
                          <input type="number" className="form-input form-input-sm text-danger" placeholder="Sst" value={item.splits?.s2?.shrinkage || 0} onChange={e => updateSplit(idx, 's2', 'shrinkage', e.target.value)} />
                        </div>
                        <div className="text-xs mt-xs text-success font-bold">Net: {item.splits?.s2?.netQty || 0}</div>
                      </td>
                      <td style={{ backgroundColor: 'rgba(251, 146, 60, 0.02)' }}>
                        <div className="flex gap-xs">
                          <input type="number" className="form-input form-input-sm" placeholder="Qty" value={item.splits?.s3?.qty || 0} onChange={e => updateSplit(idx, 's3', 'qty', e.target.value)} />
                          <input type="number" className="form-input form-input-sm text-danger" placeholder="Sst" value={item.splits?.s3?.shrinkage || 0} onChange={e => updateSplit(idx, 's3', 'shrinkage', e.target.value)} />
                        </div>
                        <div className="text-xs mt-xs text-orange font-bold">Net: {item.splits?.s3?.netQty || 0}</div>
                      </td>
                      <td>
                        <input type="number" className="form-input form-input-sm" value={item.sellPrice} onChange={e => updateItem(idx, 'sellPrice', e.target.value)} />
                      </td>
                      <td>
                        <input 
                          type="number" 
                          className="form-input form-input-sm font-bold text-success" 
                          value={item.totalCost} 
                          onChange={e => updateItem(idx, 'totalCost', e.target.value)} 
                          style={{ textAlign: 'right' }}
                        />
                      </td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm text-danger btn-icon-only" onClick={() => removeItem(idx)}>
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
          <div className="p-md" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button type="button" className="btn btn-ghost btn-sm text-primary w-full" onClick={addItem} style={{ border: '1px dashed rgba(99,102,241,0.3)' }}>
              <FiPlus /> Tambah Baris Baru
            </button>
          </div>
        </div>

        {/* Rekap per Supplier */}
        {(() => {
          const supplierMap = {};
          const displayNames = {};
          (items || []).forEach(item => {
            if (!item) return;
            const rawSup = (item.supplier || supplierName || '(Supplier Tidak Diisi)').trim();
            const key = rawSup.toUpperCase();
            if (!supplierMap[key]) {
              supplierMap[key] = [];
              displayNames[key] = rawSup;
            }
            supplierMap[key].push(item);
          });
          const supplierGroups = Object.keys(supplierMap).sort().map(key => [displayNames[key], supplierMap[key]]);
          if (supplierGroups.length === 0) return null;
          return (
            <div className="card" style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
              <div className="card-header">
                <h3 className="card-title">Rekap Pembelian per Supplier</h3>
              </div>
              <div className="table-container" style={{ border: 'none', overflowX: 'auto' }}>
                <table className="table table-compact" style={{ whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Nama Bahan</th>
                      <th className="text-right">Qty</th>
                      <th>Satuan</th>
                      <th className="text-right">Harga Satuan</th>
                      <th className="text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierGroups.map(([sup, supItems]) => {
                      const supSubtotal = supItems.reduce((s, it) => s + (Number(it.totalCost) || 0), 0);
                      const discount = Number(supplierDiscounts[sup]) || 0;
                      const supNet = Math.max(0, supSubtotal - discount);

                      return (
                        <React.Fragment key={sup}>
                          {supItems.map((item, si) => (
                            <tr key={`${sup}-${si}`}>
                              {si === 0 && (
                                <td rowSpan={supItems.length + 2} style={{ fontWeight: 700, color: 'var(--accent-primary-hover)', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
                                  {sup}
                                </td>
                              )}
                              <td>{item.isSubItem ? <span className="text-muted" style={{ fontSize: 12 }}>↳ {item.materialName}</span> : item.materialName}</td>
                              <td className="text-right">{Number(item.qtyNota).toLocaleString('id-ID')}</td>
                              <td className="text-muted">{item.unit}</td>
                              <td className="text-right">{formatCurrency(item.pricePerUnit)}</td>
                              <td className="text-right font-medium">{formatCurrency(item.totalCost)}</td>
                            </tr>
                          ))}
                          <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <td colSpan={4} className="text-right text-sm">Potongan Diskon (Rp)</td>
                            <td className="text-right">
                              <input 
                                type="number" 
                                className="form-input form-input-sm" 
                                value={supplierDiscounts[sup] || 0}
                                onChange={e => setSupplierDiscounts(prev => ({ ...prev, [sup]: Number(e.target.value) || 0 }))}
                                style={{ width: '120px', textAlign: 'right', border: '1px dashed rgba(99,102,241,0.3)', background: 'transparent' }} 
                              />
                            </td>
                          </tr>
                          <tr style={{ background: 'rgba(99,102,241,0.06)', fontWeight: 700 }}>
                            <td colSpan={4} className="text-right text-sm">Total {sup} (Net)</td>
                            <td className="text-right" style={{ color: '#6366f1' }}>{formatCurrency(supNet)}</td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        <div className="card shadow-lg" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          <div className="card-header">
            <h3 className="card-title">Biaya Tambahan</h3>
          </div>
          <div className="grid grid-3 gap-md p-md">
            <div className="form-group">
              <label className="form-label">Biaya Tenaga Kerja (Rp)</label>
              <input 
                type="number" 
                className="form-input" 
                value={additionalCosts.labor || 0}
                onChange={e => setAdditionalCosts(prev => ({ ...prev, labor: Number(e.target.value) || 0 }))}
                min="0"
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Biaya Pengiriman (Rp)</label>
              <input 
                type="number" 
                className="form-input" 
                value={additionalCosts.shipping || 0}
                onChange={e => setAdditionalCosts(prev => ({ ...prev, shipping: Number(e.target.value) || 0 }))}
                min="0"
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Biaya Bahan Produksi (Rp)</label>
              <input 
                type="number" 
                className="form-input" 
                value={additionalCosts.productionMaterial || 0}
                onChange={e => setAdditionalCosts(prev => ({ ...prev, productionMaterial: Number(e.target.value) || 0 }))}
                min="0"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="card shadow-lg" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          <div className="p-lg flex-between">
            <div>
              <h3 style={{ margin: 0 }}>Total Nota</h3>
              <p className="text-muted text-sm">Akumulasi seluruh item pembelian</p>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1' }}>
              {formatCurrency(grandTotalValue)}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Catatan Tambahan</label>
          <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan mengenai nota ini, misal: 'Bayar tempo 2 minggu'" rows={3} />
        </div>
      </form>

      <div style={{ marginTop: 40, padding: 20, borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          <FiSave /> {saving ? 'Menyimpan...' : 'Simpan Seluruh Nota'}
        </button>
      </div>

      {isEditing && (
        <div style={{ padding: '4px 12px', background: 'rgba(99,102,241,0.1)', borderRadius: 4, display: 'inline-block', fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
          Debug: {items.length} items loaded for note ID {id}
        </div>
      )}
      <div style={{ height: 100 }}></div>

      <style>{`
        .table-compact th, .table-compact td { padding: 8px 4px; font-size: 13px; }
        .table-compact .form-input-sm, .table-compact .form-select-sm { padding: 4px; font-size: 13px; height: 32px; }
        .table-compact .badge { padding: 2px 4px; font-size: 11px; }
        .table-compact input[type="number"] { -moz-appearance: textfield; }
        .table-compact input::-webkit-outer-spin-button, .table-compact input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        @media (max-width: 1366px) {
          .table-compact { font-size: 12px; }
          .table-compact .form-input-sm { padding: 2px; }
        }
      `}</style>

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Gabung & Tarik dari Invoice">
        <div style={{ maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
          <div className="flex-between mb-md">
            <p className="text-muted text-sm">Pilih satu atau beberapa invoice kategori <strong>Bahan</strong>.</p>
            <button 
              className="btn btn-sm btn-ghost" 
              onClick={() => setSelectedInvoiceIds([])}
              style={{ padding: '4px 12px' }}
            >Batal Pilih Semua</button>
          </div>
          
          <div className="grid gap-xs">
            {(() => {
              const invoicesWithBahan = (invoices || []).filter(inv => {
                if (usedInvoiceIds.has(inv.id)) return false;
                return (inv.items || []).some(it => 
                  it.type === 'material' || 
                  masterBahan.some(m => (m.name || '').toLowerCase() === (it.productName || '').toLowerCase())
                );
              });

              if (invoicesWithBahan.length === 0) {
                return (
                  <div className="empty-state" style={{ padding: '40px 20px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12 }}>
                    <FiShoppingBag style={{ fontSize: 32, opacity: 0.3, marginBottom: 12 }} />
                    <p className="text-muted">Tidak ada invoice yang ditemukan.</p>
                  </div>
                );
              }

              return invoicesWithBahan.map(inv => {
                const isSelected = selectedInvoiceIds.includes(inv.id);
                return (
                  <div 
                    key={inv.id}
                    className={`btn btn-ghost hover-bright`}
                    style={{ 
                      justifyContent: 'flex-start', 
                      textAlign: 'left', 
                      padding: '12px 16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 16,
                      background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)'}`,
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedInvoiceIds(prev => prev.filter(iid => iid !== inv.id));
                      } else {
                        setSelectedInvoiceIds(prev => [...prev, inv.id]);
                      }
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => {}} // Controlled by parent div click
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div className="flex-between">
                        <strong>{inv.invoiceNumber}</strong>
                        <span className="text-xs text-muted">{new Date(inv.date || inv.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-muted mt-xs">{inv.customerName} • {(inv.items || []).length} Item</div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
        <div className="modal-footer" style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost flex-1" onClick={() => setIsImportModalOpen(false)}>Batal</button>
          <button 
            className="btn btn-primary flex-1" 
            disabled={selectedInvoiceIds.length === 0}
            onClick={async () => {
              const currentMaster = [...masterBahan];
              const matMap = {}; // Aggregate by material name
              const invNumbers = [];
              const chosenCusts = new Set();
              
              for (const iid of selectedInvoiceIds) {
                const inv = invoices.find(i => i.id === iid);
                if (!inv) continue;
                invNumbers.push(inv.invoiceNumber);
                if (inv.customerName) chosenCusts.add(inv.customerName);

                const isSJ2 = (inv.customerName || '').toLowerCase().includes('sindangjaya 2');
                const isSJ5 = (inv.customerName || '').toLowerCase().includes('sindangjaya 5');
                const isSJ3 = (inv.customerName || '').toLowerCase().includes('sindangjaya 3');

                for (const it of (inv.items || [])) {
                  let mb = currentMaster.find(b => b.id === it.productId || (b.name || '').toLowerCase() === (it.productName || '').toLowerCase());
                  if (!mb) {
                    const saved = await MasterItems.create({ name: it.productName, unit: it.unit || 'kg', defaultPrice: Number(it.unitPrice) || 0, stock: 0 });
                    mb = saved; currentMaster.push(saved);
                  }
                  
                  const key = mb.name.toLowerCase();
                  if (!matMap[key]) {
                    matMap[key] = {
                      materialId: mb.id, materialName: mb.name, unit: mb.unit,
                      isManuallyEdited: false,
                      qtyNota: 0, invoiceQty: 0, pricePerUnit: Number(it.unitPrice) || 0,
                      sellPrice: Number(it.unitPrice) || 0,
                      invoiceBreakdown: { s5: 0, s2: 0, s3: 0 },
                      splits: { s5: { qty: 0, shrinkage: 0, netQty: 0 }, s2: { qty: 0, shrinkage: 0, netQty: 0 }, s3: { qty: 0, shrinkage: 0, netQty: 0 } }
                    };
                  }
                  
                  const qty = Number(it.qty) || 0;
                  matMap[key].qtyNota += qty;
                  matMap[key].invoiceQty += qty;
                  if (it.unitPrice) matMap[key].pricePerUnit = Number(it.unitPrice); // use latest price
                  
                  if (isSJ5) matMap[key].invoiceBreakdown.s5 += qty;
                  else if (isSJ2) matMap[key].invoiceBreakdown.s2 += qty;
                  else if (isSJ3) matMap[key].invoiceBreakdown.s3 += qty;
                  else matMap[key].invoiceBreakdown.s5 += qty; // Default to S5
                }
              }

              const materials = Object.values(matMap).map(m => {
                // Initialize splits from aggregate qty
                m.splits.s5.qty = Number(m.invoiceBreakdown.s5) || 0; m.splits.s5.netQty = m.splits.s5.qty;
                m.splits.s2.qty = Number(m.invoiceBreakdown.s2) || 0; m.splits.s2.netQty = m.splits.s2.qty;
                m.splits.s3.qty = Number(m.invoiceBreakdown.s3) || 0; m.splits.s3.netQty = m.splits.s3.qty;
                m.totalCost = (Number(m.qtyNota) || 0) * (Number(m.pricePerUnit) || 0);
                return m;
              });

              setMasterBahan(currentMaster);
              if (materials.length > 0) {
                setItems(expandItems(materials, currentMaster));
                if (chosenCusts.size === 1) setSupplierName(Array.from(chosenCusts)[0]);
                setInvoiceId(null); // Multi
                setSourceInvoiceIds(selectedInvoiceIds);
                setNotes(n => `${n}${n ? '\n' : ''}Gabung Invoice: ${invNumbers.join(', ')}`);
              }
              setIsImportModalOpen(false);
            }}
          >Tarik {selectedInvoiceIds.length} Invoice</button>
        </div>
      </Modal>

      {/* Group Recap Import Modal */}
      <Modal isOpen={isGroupImportModalOpen} onClose={() => setIsGroupImportModalOpen(false)} title="Tarik dari Rekap Grup">
        <div className="modal-body">
          <p className="text-muted text-sm mb-md">Pilih grup untuk mengisi baris pembelian dari rekap invoice hari ini.</p>
          <div className="grid gap-sm">
            {Object.entries(groupRecapData).map(([grp, recapItems]) => (
              <button
                key={grp}
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '14px 16px', border: '1px solid rgba(99,102,241,0.3)' }}
                onClick={() => importFromGroup(grp)}
              >
                <div style={{ width: '100%' }}>
                  <div className="flex-between mb-xs">
                    <strong style={{ color: 'var(--accent-primary-hover)', fontSize: 15 }}>{grp}</strong>
                    <span className="badge badge-primary">{recapItems.length} produk</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {recapItems.map((item, i) => (
                      <span key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>
                        {item.name}: <strong>{Number(item.totalQty).toLocaleString('id-ID')}</strong> {item.unit}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* PDF Rendering Area (Hidden) - Always render for capture */}
      <PurchaseNoteReportPdf 
        groupName={currentGroupName || invoiceNumber || 'Pembelian Umum'} 
        date={date}
        groupRecap={groupRecapData[currentGroupName] || []}
        purchaseItems={items}
        supplierName={supplierName}
        supplierDiscounts={supplierDiscounts}
        invoicesList={
          sourceInvoiceIds && sourceInvoiceIds.length > 0 
            ? invoices.filter(inv => sourceInvoiceIds.includes(inv.id))
            : invoiceId 
              ? invoices.filter(inv => inv.id === invoiceId)
              : (groupInvoices[currentGroupName] || [])
        }
        suppliersData={allSuppliers}
        additionalCosts={additionalCosts}
        forPrint={false}
      />
    </div>
  );
}
