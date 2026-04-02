import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiShoppingBag, FiInfo } from 'react-icons/fi';
import { PurchaseNotes, SupportingMaterialItems as MasterItems, Invoices } from '../utils/storage';
import { formatCurrency } from '../utils/formatter';
import Modal from '../components/Modal';

const emptyItem = {
  materialId: '',
  materialName: '',
  unit: '',
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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    const [master, invs] = await Promise.all([
      MasterItems.getAll(),
      Invoices.getAll()
    ]);
    setMasterBahan(master);
    setInvoices(invs.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)));

    if (isEditing) {
      const note = await PurchaseNotes.getById(id);
      if (note) {
        setDate(note.date);
        setSupplierName(note.supplierName || '');
        setItems(note.items || []);
        setNotes(note.notes || '');
        setInvoiceId(note.invoiceId || null);
        setInvoiceNumber(note.invoiceNumber || '');
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

        if (materials.length > 0) {
          setItems(materials);
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
        newItems[index].materialId = value;
        newItems[index].materialName = m.name;
        newItems[index].unit = m.unit;
        newItems[index].sellPrice = m.defaultPrice || 0;
      } else {
        newItems[index].materialId = '';
      }
    } else {
      newItems[index][field] = value;
    }

    if (field === 'qtyNota' || field === 'pricePerUnit') {
      const q = Number(newItems[index].qtyNota) || 0;
      const p = Number(newItems[index].pricePerUnit) || 0;
      newItems[index].totalCost = q * p;

      // Auto-calculate shrinkage if invoiceQty exists
      if (field === 'qtyNota' && newItems[index].invoiceQty > 0) {
        const invQty = newItems[index].invoiceQty;
        const diff = q - invQty;

        // Default to assigning the note qty to S5 and the difference to shrinkage
        // This makes netQty match invoiceQty automatically
        newItems[index].splits.s5.qty = q;
        newItems[index].splits.s5.shrinkage = diff;
        newItems[index].splits.s5.netQty = q - diff;
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
        invoiceNumber
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
            <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}>
              <FiShoppingBag /> Tarik dari Invoice
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <FiSave /> {saving ? 'Menyimpan...' : 'Simpan Nota'}
          </button>
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
              <label className="form-label">Nama Supplier / Toko</label>
              <input className="form-input" value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Misal: Toko Sinar Jaya" />
            </div>
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: '1200px' }}>
            <thead>
              <tr>
                <th style={{ width: '50px' }}>No</th>
                <th style={{ width: '220px' }}>Bahan Baku</th>
                <th style={{ width: '100px' }}>Qty Nota</th>
                <th style={{ width: '130px' }}>Harga Beli</th>
                <th style={{ width: '150px', backgroundColor: 'rgba(56, 189, 248, 0.05)' }}>S5 (SINDANGJAYA 5)</th>
                <th style={{ width: '150px', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>S2 (SJ 2)</th>
                <th style={{ width: '150px', backgroundColor: 'rgba(251, 146, 60, 0.05)' }}>S3 (SJ 3)</th>
                <th style={{ width: '130px' }}>Harga Jual</th>
                <th style={{ width: '130px' }}>Subtotal</th>
                <th style={{ width: '50px' }}></th>
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
                      <select className="form-select form-select-sm" value={item.materialId} onChange={e => updateItem(idx, 'materialId', e.target.value)} required>
                        <option value="">-- {currentInvoice ? 'Invoice Item' : 'Pilih Bahan'} --</option>
                        {selectableItems.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                        {currentInvoice && selectableItems.length < masterBahan.length && (
                          <option value="all-master">Lainnya...</option>
                        )}
                      </select>
                    </td>
                    <td>
                      <div>
                        <div className="flex-center gap-xs">
                          <input type="number" className="form-input form-input-sm" value={item.qtyNota} onChange={e => updateItem(idx, 'qtyNota', e.target.value)} style={{ width: '70px' }} />
                          <span className="text-xs text-muted">{item.unit || ''}</span>
                        </div>
                        {item.invoiceQty > 0 && (
                          <div className="text-xs text-muted mt-xs" style={{ whiteSpace: 'nowrap' }}>
                            Inv: <strong>{item.invoiceQty}</strong>
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
                    <td className="text-right font-bold text-success">
                      {formatCurrency(item.totalCost)}
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

                        materials.push({
                          materialId: mb.id,
                          materialName: mb.name,
                          unit: mb.unit,
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
    </div>
  );
}
