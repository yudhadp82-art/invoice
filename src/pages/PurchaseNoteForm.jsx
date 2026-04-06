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
  invoiceBreakdown: { s5: 0, s2: 0, s3: 0 },
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const master = await MasterItems.getAll();
      setMasterBahan(master);

      let actualItems = [...items]; 
      if (isEditing) {
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
          setAdditionalCosts(noteData.additionalCosts || { labor: 0, shipping: 0, productionMaterial: 0 });
          setItemsCount(actualItems.length);
        }
      }

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
          }
          newItem.isManuallyEdited = true;
          return newItem;
        });
        setItems(hydrated);
      } else {
        setItems(actualItems);
      }

      const [invs, history, supps, allCusts] = await Promise.all([
        Invoices.getAll(),
        PurchaseNotes.getAll(),
        Suppliers.getAll(),
        Customers.getAll()
      ]);

      setInvoices(invs.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)));
      setAllSuppliers(supps);
      setPurchaseHistory(history);
      
      const supplierSet = new Set();
      supps.forEach(s => { if (s.name) supplierSet.add(s.name); });
      history.forEach(pn => { if (pn.supplierName) supplierSet.add(pn.supplierName); });
      setSupplierHistory(Array.from(supplierSet).sort());

      const usedIds = new Set();
      history.forEach(pn => { 
        if (pn.id !== id && pn.invoiceId) usedIds.add(pn.invoiceId); 
        if (pn.id !== id && Array.isArray(pn.sourceInvoiceIds)) pn.sourceInvoiceIds.forEach(sid => usedIds.add(sid)); 
      });
      setUsedInvoiceIds(usedIds);

      // Pre-calculate group recap for the "Rekap Grup" modal
      const nameToGroup = {};
      allCusts.forEach(c => { if (c.group && c.name) nameToGroup[c.name.toLowerCase()] = c.group; });
      
      const groupAgg = {};
      const pendingInvs = invs.filter(inv => !usedIds.has(inv.id));
      pendingInvs.forEach(inv => {
        const grp = nameToGroup[(inv.customerName || '').toLowerCase()];
        if (!grp) return;
        if (!groupAgg[grp]) groupAgg[grp] = {};
        (inv.items || []).forEach(it => {
          const key = (it.productName || '').trim();
          if (!key) return;
          if (!groupAgg[grp][key]) groupAgg[grp][key] = { name: key, totalQty: 0, unit: it.unit || 'kg' };
          groupAgg[grp][key].totalQty += (Number(it.qty) || 0);
        });
      });
      
      const recapResult = {};
      Object.keys(groupAgg).forEach(grp => {
        recapResult[grp] = Object.values(groupAgg[grp]).sort((a, b) => a.name.localeCompare(b.name));
      });
      setGroupRecapData(recapResult);

      if (!isEditing && location.state?.invoiceId) {
        const invId = location.state.invoiceId;
        const inv = invs.find(i => i.id === invId);
        if (inv) {
          setInvoiceId(inv.id);
          setInvoiceNumber(inv.invoiceNumber);
          setSourceInvoiceIds([inv.id]);
          const materials = (inv.items || [])
            .map(it => {
              const pName = (it.productName || '').toLowerCase();
              const mb = master.find(m => (m.name || '').toLowerCase() === pName);
              return {
                ...emptyItem,
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
      console.error("PurchaseNoteForm load error:", err);
      setError(err.message || 'Gagal memuat data form pembelian.');
    } finally {
      setLoading(false);
    }
  }

  function expandItems(sourceItems, master) {
    const result = [];
    sourceItems.forEach(it => {
      const name = (it.materialName || '').toLowerCase();
      if (name.includes('mix vegetable') || name.includes('mix veg')) {
        const baseQty = Number(it.qtyNota) || 0;
        const basePrice = Number(it.pricePerUnit) || 0;
        MIX_VEG_INGREDIENTS.forEach(ingName => {
          const mb = master.find(b => b.name.toLowerCase() === ingName.toLowerCase());
          const q = (baseQty / 3);
          result.push({
            ...emptyItem,
            materialId: mb ? mb.id : '',
            materialName: ingName,
            isSubItem: true,
            parentName: it.materialName || 'Mix Vegetable',
            unit: mb ? mb.unit : 'kg',
            qtyNota: Number(q.toFixed(2)),
            pricePerUnit: basePrice,
            totalCost: Number((q * basePrice).toFixed(2)),
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

  async function handleImportSelectedInvoices(idsOverride = null) {
    const ids = Array.isArray(idsOverride) ? idsOverride : selectedInvoiceIds;
    if (ids.length === 0) return;
    
    const selectedInvs = invoices.filter(inv => ids.includes(inv.id));
    const newAggregatedItems = [];
    
    selectedInvs.forEach(inv => {
      (inv.items || []).forEach(it => {
        const pName = (it.productName || '').toLowerCase();
        const mb = masterBahan.find(m => (m.name || '').toLowerCase() === pName);
        
        newAggregatedItems.push({
          ...emptyItem,
          materialId: it.productId || (mb ? mb.id : ''),
          materialName: it.productName,
          unit: it.unit || (mb ? mb.unit : 'kg'),
          qtyNota: Number(it.qty) || 0,
          invoiceQty: Number(it.qty) || 0,
          pricePerUnit: Number(it.unitPrice) || 0,
          sellPrice: Number(it.unitPrice) || 0,
          splits: { 
            s5: { qty: Number(it.qty) || 0, shrinkage: 0, netQty: Number(it.qty) || 0 }, 
            s2: { qty: 0, shrinkage: 0, netQty: 0 }, 
            s3: { qty: 0, shrinkage: 0, netQty: 0 } 
          },
          totalCost: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0)
        });
      });
    });

    const expanded = expandItems(newAggregatedItems, masterBahan);
    
    if (expanded.length > 0) {
      setItems(prev => {
        if (prev.length === 1 && !prev[0].materialId && !prev[0].materialName) {
          return expanded;
        }
        return [...prev, ...expanded];
      });
      
      const invNumbers = selectedInvs.map(i => i.invoiceNumber).join(', ');
      setNotes(n => `${n}${n ? '\n' : ''}Otomatis dari Invoice: ${invNumbers}`);
      setSourceInvoiceIds(prev => [...new Set([...prev, ...ids])]);
      
      if (selectedInvs.length === 1) {
        if (!supplierName) setSupplierName(selectedInvs[0].customerName || '');
        setInvoiceNumber(selectedInvs[0].invoiceNumber);
        setInvoiceId(selectedInvs[0].id);
      }
    }
    
    setSelectedInvoiceIds([]);
    setIsImportModalOpen(false);
    setStatusMessage(`✅ Berhasil menarik ${expanded.length} item dari ${selectedInvs.length} invoice.`);
    setTimeout(() => setStatusMessage(''), 3000);
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
    if (field === 'materialId' || field === 'qtyNota') it.isManuallyEdited = true;

    if (field === 'qtyNota' && it.invoiceBreakdown && it.invoiceQty > 0) {
      const totalInv = it.invoiceQty;
      const newQty = Number(value) || 0;
      const ratioS5 = (it.invoiceBreakdown.s5 || 0) / totalInv;
      const ratioS2 = (it.invoiceBreakdown.s2 || 0) / totalInv;
      const ratioS3 = (it.invoiceBreakdown.s3 || 0) / totalInv;
      it.splits.s5 = { ...it.splits.s5, qty: newQty * ratioS5, netQty: newQty * ratioS5 - (it.splits.s5.shrinkage || 0) };
      it.splits.s2 = { ...it.splits.s2, qty: newQty * ratioS2, netQty: newQty * ratioS2 - (it.splits.s2.shrinkage || 0) };
      it.splits.s3 = { ...it.splits.s3, qty: newQty * ratioS3, netQty: newQty * ratioS3 - (it.splits.s3.shrinkage || 0) };
    }

    if (field === 'materialId') {
      const m = masterBahan.find(b => b.id === value);
      if (m) {
        it.materialId = value;
        it.materialName = m.name;
        it.unit = m.unit;
        it.sellPrice = m.defaultPrice || 0;
      }
    } else if (field === 'totalCost') {
      it.totalCost = Number(value) || 0;
      if (it.qtyNota > 0) it.pricePerUnit = (it.totalCost / it.qtyNota).toFixed(2);
    } else {
      it[field] = value;
    }

    if (field === 'qtyNota' || field === 'pricePerUnit' || field === 'totalCost') {
      if (field !== 'totalCost') it.totalCost = (Number(it.qtyNota) || 0) * (Number(it.pricePerUnit) || 0);
      if (field === 'qtyNota' && !it.invoiceBreakdown) {
        it.splits.s5.qty = Number(value) || 0;
        it.splits.s5.netQty = it.splits.s5.qty - (it.splits.s5.shrinkage || 0);
      }
    }
    newItems[index] = it;
    setItems(newItems);
  }

  function updateSplit(itemIndex, branch, field, value) {
    const newItems = [...items];
    const it = { ...newItems[itemIndex] };
    const val = Number(value) || 0;
    it.splits[branch] = { ...it.splits[branch], [field]: val };
    it.splits[branch].netQty = it.splits[branch].qty - it.splits[branch].shrinkage;
    newItems[itemIndex] = it;
    setItems(newItems);
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const grandTotal = items.reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);
      const totalDiscount = Object.values(supplierDiscounts).reduce((s, d) => s + (Number(d) || 0), 0);
      const totalAdditionalCosts = Object.values(additionalCosts).reduce((s, c) => s + (Number(c) || 0), 0);
      const finalTotal = Math.max(0, grandTotal - totalDiscount) + totalAdditionalCosts;
      
      const payload = {
        date, supplierName, items, notes, grandTotal,
        invoiceId, invoiceNumber, groupName: currentGroupName,
        sourceInvoiceIds, supplierDiscounts, additionalCosts, finalTotal
      };

      if (isEditing) {
        const oldNote = await PurchaseNotes.getById(id);
        if (oldNote?.items) {
          for (const oldIt of oldNote.items) {
            if (oldIt.materialId) {
              const m = await MasterItems.getById(oldIt.materialId);
              if (m) {
                const oldNet = (Number(oldIt.splits?.s5?.netQty) || 0) + (Number(oldIt.splits?.s2?.netQty) || 0) + (Number(oldIt.splits?.s3?.netQty) || 0);
                await MasterItems.update(m.id, { stock: (m.stock || 0) - oldNet });
              }
            }
          }
        }
        await PurchaseNotes.update(id, payload);
      } else {
        await PurchaseNotes.create(payload);
      }

      for (const it of items) {
        if (it.materialId) {
          const m = await MasterItems.getById(it.materialId);
          if (m) {
            const net = (Number(it.splits?.s5?.netQty) || 0) + (Number(it.splits?.s2?.netQty) || 0) + (Number(it.splits?.s3?.netQty) || 0);
            await MasterItems.update(m.id, { stock: (m.stock || 0) + net });
          }
        }
      }
      navigate('/purchase-notes');
    } catch (err) {
      console.error(err);
      setStatusMessage('❌ Gagal menyimpan: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function importFromGroup(grp) {
    const recap = groupRecapData[grp] || [];
    const newItems = recap.map(r => {
      const mb = masterBahan.find(b => b.name.toLowerCase() === r.name.toLowerCase());
      return {
        ...emptyItem, materialId: mb?.id || '', materialName: r.name, unit: r.unit || mb?.unit || 'kg',
        qtyNota: r.totalQty, pricePerUnit: mb?.defaultPrice || 0, totalCost: r.totalQty * (mb?.defaultPrice || 0),
        splits: { s5: { qty: r.totalQty, shrinkage: 0, netQty: r.totalQty }, s2: { qty: 0, shrinkage: 0, netQty: 0 }, s3: { qty: 0, shrinkage: 0, netQty: 0 } }
      };
    });
    setItems(expandItems(newItems, masterBahan));
    setCurrentGroupName(grp);
    setIsGroupImportModalOpen(false);
  }

  const totalItemCost = (items || []).reduce((s, it) => s + (Number(it.totalCost) || 0), 0);
  const totalDiscount = Object.values(supplierDiscounts).reduce((s, d) => s + (Number(d) || 0), 0);
  const totalAdditionalCosts = Object.values(additionalCosts).reduce((s, c) => s + (Number(c) || 0), 0);
  const grandTotalValue = Math.max(0, totalItemCost - totalDiscount) + totalAdditionalCosts;

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions" style={{ marginBottom: 20 }}>
        <div className="flex-center gap-md">
          <button onClick={() => navigate('/purchase-notes')} className="btn btn-ghost btn-sm"><FiArrowLeft /></button>
          <div>
            <h1 className="m-0">{isEditing ? 'Edit Nota Pembelian' : 'Input Nota Pembelian Baru'}</h1>
            <p className="text-muted text-sm">{isEditing ? `ID: ${id}` : 'Input data pembelian real dari supplier'}</p>
          </div>
        </div>
        <div className="flex gap-sm">
          {!isEditing && (
            <>
              <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}><FiShoppingBag /> Tarik Invoice</button>
              {Object.keys(groupRecapData).length > 0 && <button className="btn btn-secondary" onClick={() => setIsGroupImportModalOpen(true)}><FiUsers /> Rekap Grup</button>}
            </>
          )}
          <button onClick={handleSave} className="btn btn-primary" disabled={saving || loading}><FiSave /> {saving ? 'Menyimpan...' : 'Simpan Nota'}</button>
        </div>
      </div>

      {loading && <div className="card p-lg text-center"><div className="loading-spinner m-auto mb-md"></div><p>Memuat data...</p></div>}
      {error && <div className="card p-lg text-center border-danger bg-danger-pale"><h3 className="text-danger">Error</h3><p>{error}</p><button className="btn btn-primary mt-md" onClick={() => window.location.reload()}>Refresh</button></div>}

      {!loading && !error && (
        <>
          {statusMessage && <div className="alert alert-info mb-md">{statusMessage}</div>}
          <form className="grid gap-lg" onSubmit={handleSave}>
            <div className="card p-md grid grid-3 gap-md">
              <div className="form-group"><label className="form-label">Tanggal</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Supplier Utama</label><input className="form-input" list="sups" value={supplierName} onChange={e => setSupplierName(e.target.value)} /><datalist id="sups">{supplierHistory.map(s => <option key={s} value={s} />)}</datalist></div>
              <div className="form-group">
                <label className="form-label">Referensi Invoice</label>
                <input 
                  className="form-input" 
                  list="invList" 
                  value={invoiceNumber} 
                  onChange={e => {
                    const val = e.target.value;
                    setInvoiceNumber(val);
                    const inv = invoices.find(i => i.invoiceNumber === val);
                    if (inv) handleImportSelectedInvoices([inv.id]);
                  }} 
                  placeholder="Pilih No. Invoice..."
                />
                <datalist id="invList">
                  {invoices.filter(inv => !usedInvoiceIds.has(inv.id)).map(inv => (
                    <option key={inv.id} value={inv.invoiceNumber}>{inv.customerName}</option>
                  ))}
                </datalist>
              </div>
            </div>

            <div className="card overflow-x">
              <table className="table table-compact" style={{ minWidth: 1000 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>No</th>
                    <th>Supplier</th>
                    <th>Bahan Baku</th>
                    <th style={{ width: 100 }}>Qty Nota</th>
                    <th style={{ width: 120 }}>Harga</th>
                    <th style={{ width: 140, background: 'rgba(56,189,248,0.05)' }}>SJ 5</th>
                    <th style={{ width: 140, background: 'rgba(16,185,129,0.05)' }}>SJ 2</th>
                    <th style={{ width: 140, background: 'rgba(251,146,60,0.05)' }}>SJ 3</th>
                    <th style={{ width: 120 }}>Subtotal</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="text-center">{idx + 1}</td>
                      <td><input className="form-input form-input-sm" list="sups" value={item.supplier} onChange={e => updateItem(idx, 'supplier', e.target.value)} placeholder={supplierName} /></td>
                      <td>
                        <select className="form-select form-select-sm" value={item.materialId} onChange={e => updateItem(idx, 'materialId', e.target.value)} required>
                          <option value="">-- Pilih Bahan --</option>
                          {masterBahan.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </td>
                      <td><input type="number" step="any" className="form-input form-input-sm" value={item.qtyNota} onChange={e => updateItem(idx, 'qtyNota', e.target.value)} /></td>
                      <td><input type="number" className="form-input form-input-sm" value={item.pricePerUnit} onChange={e => updateItem(idx, 'pricePerUnit', e.target.value)} /></td>
                      <td style={{ background: 'rgba(56,189,248,0.02)' }}><div className="flex gap-xs"><input type="number" className="form-input form-input-sm" value={item.splits.s5.qty} onChange={e => updateSplit(idx, 's5', 'qty', e.target.value)} /><input type="number" className="form-input form-input-sm" value={item.splits.s5.shrinkage} onChange={e => updateSplit(idx, 's5', 'shrinkage', e.target.value)} /></div><div className="text-xs font-bold mt-xs">Net: {item.splits.s5.netQty.toFixed(2)}</div></td>
                      <td style={{ background: 'rgba(16,185,129,0.02)' }}><div className="flex gap-xs"><input type="number" className="form-input form-input-sm" value={item.splits.s2.qty} onChange={e => updateSplit(idx, 's2', 'qty', e.target.value)} /><input type="number" className="form-input form-input-sm" value={item.splits.s2.shrinkage} onChange={e => updateSplit(idx, 's2', 'shrinkage', e.target.value)} /></div><div className="text-xs font-bold mt-xs">Net: {item.splits.s2.netQty.toFixed(2)}</div></td>
                      <td style={{ background: 'rgba(251,146,60,0.02)' }}><div className="flex gap-xs"><input type="number" className="form-input form-input-sm" value={item.splits.s3.qty} onChange={e => updateSplit(idx, 's3', 'qty', e.target.value)} /><input type="number" className="form-input form-input-sm" value={item.splits.s3.shrinkage} onChange={e => updateSplit(idx, 's3', 'shrinkage', e.target.value)} /></div><div className="text-xs font-bold mt-xs">Net: {item.splits.s3.netQty.toFixed(2)}</div></td>
                      <td><input type="number" className="form-input form-input-sm font-bold" value={item.totalCost} onChange={e => updateItem(idx, 'totalCost', e.target.value)} /></td>
                      <td><button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removeItem(idx)}><FiTrash2 /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-md border-top"><button type="button" className="btn btn-ghost btn-sm" onClick={addItem}><FiPlus /> Tambah Item</button></div>
            </div>

            <div className="grid grid-2 gap-lg">
              <div className="card p-md">
                <h3 className="mb-md">Biaya Tambahan & Diskon</h3>
                <div className="grid grid-3 gap-sm mb-md">
                  <div className="form-group"><label className="text-xs">Labor</label><input type="number" className="form-input" value={additionalCosts.labor} onChange={e => setAdditionalCosts({...additionalCosts, labor: Number(e.target.value)})} /></div>
                  <div className="form-group"><label className="text-xs">Ongkir</label><input type="number" className="form-input" value={additionalCosts.shipping} onChange={e => setAdditionalCosts({...additionalCosts, shipping: Number(e.target.value)})} /></div>
                  <div className="form-group"><label className="text-xs">Lainnya</label><input type="number" className="form-input" value={additionalCosts.productionMaterial} onChange={e => setAdditionalCosts({...additionalCosts, productionMaterial: Number(e.target.value)})} /></div>
                </div>
                <div className="form-group"><label className="form-label">Diskon Supplier</label>{Array.from(new Set(items.map(it => it.supplier || supplierName))).filter(Boolean).map(s => (<div key={s} className="flex-between mb-xs"><span>{s}</span><input type="number" className="form-input" style={{ width: 140 }} value={supplierDiscounts[s] || 0} onChange={e => setSupplierDiscounts({...supplierDiscounts, [s]: Number(e.target.value)})} /></div>))}</div>
              </div>
              <div className="card p-md bg-dark-elegant flex flex-col justify-center">
                <div className="flex-between mb-sm"><span>Subtotal Item</span><span>{formatCurrency(totalItemCost)}</span></div>
                <div className="flex-between mb-sm text-danger"><span>Potongan Diskon</span><span>-{formatCurrency(totalDiscount)}</span></div>
                <div className="flex-between mb-md text-info"><span>Biaya Tambahan</span><span>+{formatCurrency(totalAdditionalCosts)}</span></div>
                <hr className="opacity-10 mb-md" />
                <div className="flex-between"><h2 className="m-0">Grand Total</h2><h2 className="text-primary m-0">{formatCurrency(grandTotalValue)}</h2></div>
              </div>
            </div>

            <div className="card p-md">
              <label className="form-label">Catatan</label>
              <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
            </div>
          </form>

          <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Tarik dari Invoice">
            <div className="p-md overflow-y" style={{ maxHeight: 400 }}>
              {invoices.filter(inv => !usedInvoiceIds.has(inv.id)).map(inv => (
                <div key={inv.id} className="flex-between p-sm border-bottom hover-bright pointer" onClick={() => setSelectedInvoiceIds(prev => prev.includes(inv.id) ? prev.filter(i => i !== inv.id) : [...prev, inv.id])}>
                  <div className="flex gap-md items-center"><input type="checkbox" checked={selectedInvoiceIds.includes(inv.id)} readOnly /><div><strong>{inv.invoiceNumber}</strong><div className="text-xs opacity-50">{inv.customerName}</div></div></div>
                  <div className="text-xs opacity-50">{new Date(inv.date || inv.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
            <div className="p-md flex gap-sm border-top" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <button type="button" className="btn btn-ghost flex-1" onClick={() => setIsImportModalOpen(false)}>Batal</button>
              <button 
                type="button"
                className="btn btn-primary flex-1" 
                disabled={selectedInvoiceIds.length === 0} 
                onClick={() => handleImportSelectedInvoices()}
              >
                Tarik {selectedInvoiceIds.length} Invoice
              </button>
            </div>
          </Modal>

          <Modal isOpen={isGroupImportModalOpen} onClose={() => setIsGroupImportModalOpen(false)} title="Rekap Grup">
            <div className="p-md grid gap-sm">
              {Object.keys(groupRecapData).length === 0 && <p className="text-center text-muted p-lg">Tidak ada data rekap grup yang tersedia.</p>}
              {Object.keys(groupRecapData).map(grp => (
                <button type="button" key={grp} className="btn btn-ghost p-md text-left flex-between" onClick={() => importFromGroup(grp)}>
                  <div className="flex-center gap-sm"><FiUsers /> {grp}</div>
                  <span className="badge badge-secondary">{groupRecapData[grp].length} item</span>
                </button>
              ))}
            </div>
            <div className="p-md border-top">
              <button type="button" className="btn btn-ghost w-full" onClick={() => setIsGroupImportModalOpen(false)}>Batal</button>
            </div>
          </Modal>

          {isGeneratingPdf && <PurchaseNoteReportPdf groupName={currentGroupName || invoiceNumber || 'Nota'} date={date} purchaseItems={items} supplierName={supplierName} supplierDiscounts={supplierDiscounts} additionalCosts={additionalCosts} forPrint={false} />}
        </>
      )}
    </div>
  );
}
