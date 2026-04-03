import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiShoppingBag, FiInfo, FiUsers } from 'react-icons/fi';
import { PurchaseNotes, SupportingMaterialItems as MasterItems, Invoices, Suppliers, Customers } from '../utils/storage';
import { formatCurrency } from '../utils/formatter';
import Modal from '../components/Modal';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import PurchaseNoteReportPdf from '../components/PurchaseNoteReportPdf';

const emptyItem = {
  materialId: '',
  materialName: '',
  unit: '',
  supplier: '',
  qtyNota: 0,
  invoiceQty: 0,
  pricePerUnit: 0,
  sellPrice: 0,
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
  const [groupInvoices, setGroupInvoices] = useState({}); // { groupName: [invoiceObjects] }
  const [currentGroupName, setCurrentGroupName] = useState('');
  const [sourceInvoiceIds, setSourceInvoiceIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
            qtyNota: q.toFixed(2),
            invoiceQty: iq.toFixed(2),
            pricePerUnit: basePrice, // Assume same price or distribute? Usually same for raw material cost.
            totalCost: (q * basePrice).toFixed(2),
            supplier: it.supplier || '',
            splits: {
              s5: { qty: q.toFixed(2), shrinkage: 0, netQty: q.toFixed(2) },
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
    const [master, invs, history, officialSuppliers] = await Promise.all([
      MasterItems.getAll(),
      Invoices.getAll(),
      PurchaseNotes.getAll(),
      Suppliers.getAll()
    ]);
    setMasterBahan(master);
    setInvoices(invs.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)));
    setPurchaseHistory(history);
    // Collect unique supplier names from official List and history for suggestions
    const supplierSet = new Set();
    
    // Add official suppliers first
    officialSuppliers.forEach(s => {
      if (s.name) supplierSet.add(s.name);
      if (s.company) supplierSet.add(s.company);
    });

    history.forEach(pn => {
      if (pn.supplierName) supplierSet.add(pn.supplierName);
      (pn.items || []).forEach(it => { if (it.supplier) supplierSet.add(it.supplier); });
    });
    setSupplierHistory(Array.from(supplierSet).sort());

    // Build group recap from today's invoices (for "Tarik dari Rekap Grup")
    const allCustomers = await Customers.getAll();
    const linkedIds = history.map(n => n.invoiceId).filter(Boolean);
    const todayStr = new Date().toISOString().slice(0, 10);
    const nameToGroup = {};
    allCustomers.forEach(c => {
      if (c.group && c.name) nameToGroup[c.name.toLowerCase()] = c.group;
    });
    const groupAgg = {};
    const groupInvs = {};
    invs.forEach(inv => {
      if (linkedIds.includes(inv.id)) return;
      const invDate = inv.date ? String(inv.date).slice(0, 10) : '';
      if (invDate !== todayStr) return;
      const grp = nameToGroup[(inv.customerName || '').toLowerCase()];
      if (!grp) return;
      
      if (!groupAgg[grp]) groupAgg[grp] = {};
      if (!groupInvs[grp]) groupInvs[grp] = [];
      groupInvs[grp].push(inv);

      (inv.items || []).forEach(it => {
        const key = (it.productName || '').trim();
        if (!key) return;
        if (!groupAgg[grp][key]) groupAgg[grp][key] = { name: key, totalQty: 0, unit: it.unit || 'kg' };
        groupAgg[grp][key].totalQty += (Number(it.qty) || 0);
      });
    });
    const grpResult = {};
    Object.keys(groupAgg).sort().forEach(grp => {
      grpResult[grp] = Object.values(groupAgg[grp]).sort((a, b) => a.name.localeCompare(b.name));
    });
    setGroupRecapData(grpResult);
    setGroupInvoices(groupInvs);

    if (isEditing) {
      const note = await PurchaseNotes.getById(id);
      if (note) {
        setDate(note.date);
        setSupplierName(note.supplierName || '');
        setItems(note.items || []);
        setNotes(note.notes || '');
        setInvoiceId(note.invoiceId || null);
        setInvoiceNumber(note.invoiceNumber || '');
        setCurrentGroupName(note.groupName || '');
        setSourceInvoiceIds(note.sourceInvoiceIds || []);
      }
    } else if (location.state?.invoiceId) {
      const invId = location.state.invoiceId;
      const inv = invs.find(i => i.id === invId);
      if (inv) {
        const materials = (inv.items || [])
          .filter(it => it.type === 'material')
          .map(it => ({
            materialId: it.productId,
            materialName: it.productName,
            unit: it.unit,
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
          }));

        const expanded = expandItems(materials, masterBahan);

        if (expanded.length > 0) {
          setItems(expanded);
          setSupplierName(inv.customerName || '');
          setInvoiceId(inv.id);
          setInvoiceNumber(inv.invoiceNumber);
          setNotes(n => `${n}${n ? '\n' : ''}Otomatis dari Invoice: ${inv.invoiceNumber}`);
        }
      }
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

      // Auto-calculate shrinkage if invoiceQty exists
      if (field === 'qtyNota' && newItems[index].invoiceQty > 0) {
        const invQty = newItems[index].invoiceQty;
        const diff = q - invQty;

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
      const grandTotal = items.reduce((sum, it) => sum + it.totalCost, 0);
      const payload = {
        date,
        supplierName,
        items,
        notes,
        grandTotal,
        invoiceId,
        invoiceNumber,
        groupName: currentGroupName,
        sourceInvoiceIds
      };

      if (isEditing) {
        const oldNote = await PurchaseNotes.getById(id);
        if (oldNote && oldNote.items) {
          for (const oldIt of oldNote.items) {
            if (oldIt.materialId) {
              const master = await MasterItems.getById(oldIt.materialId);
              if (master) {
                const oldTotalNet = (oldIt.splits.s5?.netQty || 0) + (oldIt.splits.s2?.netQty || 0) + (oldIt.splits.s3?.netQty || 0);
                await MasterItems.update(master.id, { stock: (master.stock || 0) - oldTotalNet });
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

  async function handlePrintPdf() {
    if (!currentGroupName) {
      alert('Pilih grup (Tarik dari Rekap Grup) terlebih dahulu untuk membuat laporan ini.');
      return;
    }
    setIsGeneratingPdf(true);
    await new Promise(r => setTimeout(r, 600)); // Give time for hidden template to render
    
    try {
      const element = document.getElementById('purchase-note-report-render');
      if (!element) throw new Error('Render element not found');

      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Laporan_Pembelian_${currentGroupName}_${date}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  const grandTotalValue = items.reduce((s, it) => s + (it.totalCost || 0), 0);

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
          {currentGroupName && (
            <button className="btn btn-secondary" onClick={handlePrintPdf} disabled={isGeneratingPdf} style={{ background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)', color: 'white' }}>
              {isGeneratingPdf ? '⏳...' : <><FiFileText /> Cetak PDF</>}
            </button>
          )}
        </div>
      </div>

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
                let selectableItems = masterBahan;
                const currentInvoice = invoices.find(inv => inv.id === invoiceId);
                if (currentInvoice) {
                  selectableItems = masterBahan.filter(m =>
                    (currentInvoice.items || []).some(it => it.productId === m.id || it.productName === m.name)
                  );
                }

                return items.map((item, idx) => (
                  <tr key={idx} className="animate-in">
                    <td className="text-center">
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
                      <div className="flex-center gap-xs">
                        {item.isSubItem && <span style={{ color: 'var(--primary)', fontWeight: 800, marginRight: 2 }}>↳ </span>}
                        <select className="form-select form-select-sm" value={item.materialId} onChange={e => updateItem(idx, 'materialId', e.target.value)} required style={{ paddingLeft: item.isSubItem ? '16px' : undefined, flex: 1 }}>
                          <option value="">-- {currentInvoice ? 'Invoice Item' : 'Pilih Bahan'} --</option>
                          {selectableItems.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                          {currentInvoice && selectableItems.length < masterBahan.length && (
                            <option value="all-master">Lainnya...</option>
                          )}
                        </select>
                        {item.isSubItem && <span className="badge badge-purple" style={{ fontSize: 10, padding: '2px 4px' }}>Sub-Mix</span>}
                      </div>
                    </td>
                    <td>
                      <div>
                        <div className="flex-center gap-xs">
                          <input type="number" className="form-input form-input-sm" value={item.qtyNota} onChange={e => updateItem(idx, 'qtyNota', e.target.value)} style={{ width: '60px' }} />
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
                        <input type="number" className="form-input form-input-sm" placeholder="Qty" value={item.splits.s5.qty} onChange={e => updateSplit(idx, 's5', 'qty', e.target.value)} />
                        <input type="number" className="form-input form-input-sm text-danger" placeholder="Sst" value={item.splits.s5.shrinkage} onChange={e => updateSplit(idx, 's5', 'shrinkage', e.target.value)} />
                      </div>
                      <div className="text-xs mt-xs text-primary font-bold">Net: {item.splits.s5.netQty}</div>
                    </td>
                    <td style={{ backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
                      <div className="flex gap-xs">
                        <input type="number" className="form-input form-input-sm" placeholder="Qty" value={item.splits.s2.qty} onChange={e => updateSplit(idx, 's2', 'qty', e.target.value)} />
                        <input type="number" className="form-input form-input-sm text-danger" placeholder="Sst" value={item.splits.s2.shrinkage} onChange={e => updateSplit(idx, 's2', 'shrinkage', e.target.value)} />
                      </div>
                      <div className="text-xs mt-xs text-success font-bold">Net: {item.splits.s2.netQty}</div>
                    </td>
                    <td style={{ backgroundColor: 'rgba(251, 146, 60, 0.02)' }}>
                      <div className="flex gap-xs">
                        <input type="number" className="form-input form-input-sm" placeholder="Qty" value={item.splits.s3.qty} onChange={e => updateSplit(idx, 's3', 'qty', e.target.value)} />
                        <input type="number" className="form-input form-input-sm text-danger" placeholder="Sst" value={item.splits.s3.shrinkage} onChange={e => updateSplit(idx, 's3', 'shrinkage', e.target.value)} />
                      </div>
                      <div className="text-xs mt-xs text-orange font-bold">Net: {item.splits.s3.netQty}</div>
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
                ));
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
          items.forEach(item => {
            const sup = (item.supplier || supplierName || '(Supplier Tidak Diisi)').trim();
            if (!supplierMap[sup]) supplierMap[sup] = [];
            supplierMap[sup].push(item);
          });
          const supplierGroups = Object.entries(supplierMap);
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
                      const supTotal = supItems.reduce((s, it) => s + (Number(it.totalCost) || 0), 0);
                      return (
                        <>
                          {supItems.map((item, si) => (
                            <tr key={`${sup}-${si}`}>
                              {si === 0 && (
                                <td rowSpan={supItems.length + 1} style={{ fontWeight: 700, color: 'var(--accent-primary-hover)', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
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
                          <tr style={{ background: 'rgba(99,102,241,0.06)', fontWeight: 700 }}>
                            <td colSpan={4} className="text-right text-sm">Total {sup}</td>
                            <td className="text-right" style={{ color: '#6366f1' }}>{formatCurrency(supTotal)}</td>
                          </tr>
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

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

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Tarik Item dari Invoice">
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <p className="text-muted text-sm mb-md">Pilih invoice untuk mengambil item kategori <strong>Bahan</strong>.</p>
          <div className="grid gap-sm">
            {(() => {
              const invoicesWithBahan = invoices.filter(inv => (inv.items || []).length > 0);

              if (invoicesWithBahan.length === 0) {
                return (
                  <div className="empty-state" style={{ padding: '40px 20px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12 }}>
                    <FiShoppingBag style={{ fontSize: 32, opacity: 0.3, marginBottom: 12 }} />
                    <p className="text-muted">Tidak ada invoice yang ditemukan.</p>
                  </div>
                );
              }

              return invoicesWithBahan.map(inv => {
                const materialsInInv = inv.items || [];

                return (
                  <button
                    key={inv.id}
                    className="btn btn-ghost"
                    style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}
                    onClick={async () => {
                      const currentMaster = [...masterBahan];
                      let masterUpdated = false;

                      const materials = [];
                      for (const it of materialsInInv) {
                        let mb = currentMaster.find(b => b.id === it.productId || b.name === it.productName);

                        if (!mb) {
                          // Auto-provision missing material
                          const newMaster = {
                            name: it.productName,
                            unit: it.unit || 'kg',
                            defaultPrice: Number(it.unitPrice) || 0,
                            stock: 0
                          };
                          const saved = await MasterItems.create(newMaster);
                          mb = saved;
                          currentMaster.push(saved);
                          masterUpdated = true;
                        }

                        const isSJ2 = (inv.customerName || '').toLowerCase().includes('sindangjaya 2');
                        const isSJ5 = (inv.customerName || '').toLowerCase().includes('sindangjaya 5');
                        const shouldSplit = isSJ2 || isSJ5;

                        let qtyS5 = Number(it.qty) || 0;
                        let qtyS2 = 0;

                        if (shouldSplit) {
                          const availS2 = mb.availableInS2 !== false;
                          const availS5 = mb.availableInS5 !== false;

                          if (availS2 && availS5) {
                            // Calculate proportional split from history
                            let totalS2 = 0;
                            let totalS5 = 0;
                            purchaseHistory.forEach(pn => {
                              (pn.items || []).forEach(item => {
                                if (item.materialId === mb.id) {
                                  totalS2 += Number(item.splits?.s2?.netQty || 0);
                                  totalS5 += Number(item.splits?.s5?.netQty || 0);
                                }
                              });
                            });

                            const total = totalS2 + totalS5;
                            if (total > 0) {
                              const ratioS2 = totalS2 / total;
                              const ratioS5 = totalS5 / total;
                              qtyS2 = (Number(it.qty) || 0) * ratioS2;
                              qtyS5 = (Number(it.qty) || 0) * ratioS5;
                            } else {
                              // Default 50/50 if no history
                              qtyS5 = (Number(it.qty) || 0) / 2;
                              qtyS2 = (Number(it.qty) || 0) / 2;
                            }
                          } else if (availS2) {
                            qtyS5 = 0;
                            qtyS2 = Number(it.qty) || 0;
                          } else if (availS5) {
                            qtyS5 = Number(it.qty) || 0;
                            qtyS2 = 0;
                          }
                        }

                        // Mix Vegetable Expansion Logic for Import
                        if (it.productName.toLowerCase().includes('mix vegetable') || it.productName.toLowerCase().includes('mix veg')) {
                          const expanded = expandItems([{
                            materialId: mb ? mb.id : '',
                            materialName: it.productName,
                            qtyNota: Number(it.qty) || 0,
                            invoiceQty: Number(it.qty) || 0,
                            pricePerUnit: Number(it.unitPrice) || 0,
                            supplier: supplierName || ''
                          }], currentMaster);
                          
                          materials.push(...expanded);
                          continue; // Jump to next item in materialsInInv
                        }

                        materials.push({
                          materialId: mb.id,
                          materialName: mb.name,
                          unit: mb.unit,
                          qtyNota: Number(it.qty) || 0,
                          invoiceQty: Number(it.qty) || 0,
                          pricePerUnit: Number(it.unitPrice) || 0,
                          sellPrice: Number(it.unitPrice) || 0,
                          splits: {
                            s5: { qty: qtyS5, shrinkage: 0, netQty: qtyS5 },
                            s2: { qty: qtyS2, shrinkage: 0, netQty: qtyS2 },
                            s3: { qty: 0, shrinkage: 0, netQty: 0 }
                          },
                          totalCost: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0)
                        });
                      }

                      if (masterUpdated) {
                        setMasterBahan(currentMaster);
                      }

                      if (materials.length > 0) {
                        setItems(materials);
                        setSupplierName(inv.customerName || '');
                        setInvoiceId(inv.id);
                        setInvoiceNumber(inv.invoiceNumber);
                        setNotes(n => `${n}${n ? '\n' : ''}Tarik dari Invoice: ${inv.invoiceNumber}`);
                      }
                      setIsImportModalOpen(false);
                    }}
                  >
                    <div>
                      <strong>{inv.invoiceNumber}</strong><br />
                      <span className="text-xs text-muted">{inv.customerName} - {new Date(inv.date || inv.createdAt).toLocaleDateString()}</span>
                      <span className="badge badge-primary ml-sm" style={{ marginLeft: 8 }}>{materialsInInv.length} Item</span>
                    </div>
                  </button>
                );
              });
            })()}
          </div>
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

      {/* PDF Rendering Area (Hidden) */}
      {currentGroupName && (
        <PurchaseNoteReportPdf 
          groupName={currentGroupName} 
          date={date}
          groupRecap={groupRecapData[currentGroupName] || []}
          purchaseItems={items}
          invoicesList={
            sourceInvoiceIds && sourceInvoiceIds.length > 0 
              ? invoices.filter(inv => sourceInvoiceIds.includes(inv.id))
              : (groupInvoices[currentGroupName] || [])
          }
          forPrint={false}
        />
      )}
    </div>
  );
}
