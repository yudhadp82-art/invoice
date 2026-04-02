import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiShoppingBag, FiInfo } from 'react-icons/fi';
import { PurchaseNotes, SupportingMaterialItems as MasterItems, Invoices } from '../utils/storage';
import { formatCurrency } from '../utils/formatter';
import Modal from '../components/Modal';

const emptyItem = {
  materialId: '',
  materialName: '',
  unit: '',
  qtyNota: 0,
  pricePerUnit: 0,
  sellPrice: 0,
  splits: {
    s5: { qty: 0, shrinkage: 0, netQty: 0 },
    s3: { qty: 0, shrinkage: 0, netQty: 0 }
  },
  totalCost: 0
};

export default function PurchaseNoteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierName, setSupplierName] = useState('');
  const [items, setItems] = useState([ { ...emptyItem } ]);
  const [notes, setNotes] = useState('');
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
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'qtyNota' || field === 'pricePerUnit') {
      newItems[index].totalCost = (Number(newItems[index].qtyNota) || 0) * (Number(newItems[index].pricePerUnit) || 0);
    }

    if (field === 'materialId') {
      const m = masterBahan.find(b => b.id === value);
      if (m) {
        newItems[index].materialName = m.name;
        newItems[index].unit = m.unit;
        newItems[index].sellPrice = m.defaultPrice || 0;
      }
    }
    
    setItems(newItems);
  }

  function updateSplit(itemIndex, branch, field, value) {
    const newItems = [...items];
    const item = newItems[itemIndex];
    const split = { ...item.splits[branch], [field]: Number(value) || 0 };
    
    if (field === 'qty' || field === 'shrinkage') {
      split.netQty = split.qty - split.shrinkage;
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
        grandTotal
      };

      if (isEditing) {
        // Reverse old stock impacts before applying new ones
        const oldNote = await PurchaseNotes.getById(id);
        if (oldNote && oldNote.items) {
          for (const oldIt of oldNote.items) {
            if (oldIt.materialId) {
              const master = await MasterItems.getById(oldIt.materialId);
              if (master) {
                const oldTotalNet = (oldIt.splits.s5?.netQty || 0) + (oldIt.splits.s3?.netQty || 0);
                await MasterItems.update(master.id, { stock: (master.stock || 0) - oldTotalNet });
              }
            }
          }
        }
        await PurchaseNotes.update(id, payload);
      } else {
        await PurchaseNotes.create(payload);
      }
      
      // Apply new stock impacts
      for (const it of items) {
        if (it.materialId) {
          const master = await MasterItems.getById(it.materialId);
          if (master) {
            const totalNet = (it.splits.s5?.netQty || 0) + (it.splits.s3?.netQty || 0);
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

  const grandTotal = items.reduce((s, it) => s + (it.totalCost || 0), 0);

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div className="flex-center gap-md">
          <Link to="/purchase-notes" className="btn btn-ghost btn-sm btn-icon-only">
            <FiArrowLeft />
          </Link>
          <div>
            <h1>{isEditing ? 'Edit Nota Pembelian' : 'Nota Pembelian Baru'}</h1>
            <p>Input detail pembelian dan split S5/S3</p>
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

      <form className="grid gap-lg">
        {/* Header Section */}
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

        {/* Items Section */}
        {items.map((item, idx) => (
          <div key={idx} className="card animate-in" style={{ borderColor: 'rgba(99,102,241,0.2)', borderLeftWidth: 4, borderLeftColor: '#6366f1' }}>
            <div className="card-header flex-between" style={{ background: 'rgba(99,102,241,0.05)' }}>
              <h3 className="card-title flex-center gap-sm">
                <span className="badge badge-primary">{idx + 1}</span> Item Pembelian
              </h3>
              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removeItem(idx)}>
                <FiTrash2 /> Hapus
              </button>
            </div>
            
            <div className="p-md grid gap-md">
              <div className="grid grid-3 gap-md">
                <div className="form-group">
                  <label className="form-label">Pilih Bahan Baku</label>
                  <select className="form-select" value={item.materialId} onChange={e => updateItem(idx, 'materialId', e.target.value)} required>
                    <option value="">-- Pilih Master Bahan --</option>
                    {masterBahan.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Total Qty di Nota ({item.unit || '-'})</label>
                  <input type="number" className="form-input" value={item.qtyNota} onChange={e => updateItem(idx, 'qtyNota', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Harga Beli per Satuan (Rp)</label>
                  <input type="number" className="form-input" value={item.pricePerUnit} onChange={e => updateItem(idx, 'pricePerUnit', e.target.value)} />
                </div>
              </div>

              {/* Split Logic */}
              <div className="grid grid-2 gap-lg" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {/* Branch S5 */}
                <div>
                  <div className="flex-between mb-sm">
                    <h4 style={{ margin: 0, color: '#38bdf8' }}>SPPG SINDANGJAYA 5</h4>
                    <span className="badge badge-cyan">Split S5</span>
                  </div>
                  <div className="grid grid-2 gap-sm">
                    <div className="form-group">
                      <label className="form-label text-xs">Qty Split</label>
                      <input type="number" className="form-input form-input-sm" value={item.splits.s5.qty} onChange={e => updateSplit(idx, 's5', 'qty', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label text-xs">Penyusutan</label>
                      <input type="number" className="form-input form-input-sm text-danger" value={item.splits.s5.shrinkage} onChange={e => updateSplit(idx, 's5', 'shrinkage', e.target.value)} />
                    </div>
                  </div>
                  <div className="mt-sm text-sm" style={{ fontWeight: 600 }}>
                    Qty Bersih (Net): <span className="text-primary">{item.splits.s5.netQty} {item.unit || ''}</span>
                  </div>
                </div>

                {/* Branch S3 */}
                <div>
                  <div className="flex-between mb-sm">
                    <h4 style={{ margin: 0, color: '#fb923c' }}>SPPG SINDANGJAYA 3</h4>
                    <span className="badge badge-orange">Split S3</span>
                  </div>
                  <div className="grid grid-2 gap-sm">
                    <div className="form-group">
                      <label className="form-label text-xs">Qty Split</label>
                      <input type="number" className="form-input form-input-sm" value={item.splits.s3.qty} onChange={e => updateSplit(idx, 's3', 'qty', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label text-xs">Penyusutan</label>
                      <input type="number" className="form-input form-input-sm text-danger" value={item.splits.s3.shrinkage} onChange={e => updateSplit(idx, 's3', 'shrinkage', e.target.value)} />
                    </div>
                  </div>
                  <div className="mt-sm text-sm" style={{ fontWeight: 600 }}>
                    Qty Bersih (Net): <span className="text-primary">{item.splits.s3.netQty} {item.unit || ''}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-2 gap-md">
                <div className="form-group">
                  <label className="form-label">Harga Jual Direncanakan (Rp)</label>
                  <input type="number" className="form-input" value={item.sellPrice} onChange={e => updateItem(idx, 'sellPrice', e.target.value)} />
                </div>
                <div className="flex-end">
                  <div style={{ textAlign: 'right' }}>
                    <div className="text-xs text-muted mb-xs">Subtotal Item:</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{formatCurrency(item.totalCost)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button type="button" className="btn btn-secondary btn-lg" onClick={addItem} style={{ borderStyle: 'dashed' }}>
          <FiPlus /> Tambah Item Lainnya
        </button>

        <div className="card shadow-lg" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          <div className="p-lg flex-between">
            <div>
              <h3 style={{ margin: 0 }}>Total Nota</h3>
              <p className="text-muted text-sm">Akumulasi seluruh item pembelian</p>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1' }}>
              {formatCurrency(grandTotal)}
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

      {/* Import Modal */}
      <Modal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)}
        title="Tarik Item dari Invoice"
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <p className="text-muted text-sm mb-md">Pilih invoice untuk mengambil item kategori <strong>Bahan</strong>.</p>
          <div className="grid gap-sm">
            {invoices.length === 0 ? (
              <div className="empty-state">No Invoices found</div>
            ) : invoices.map(inv => {
              const bahanCount = (inv.items || []).filter(it => it.type === 'material').length;
              if (bahanCount === 0) return null;
              
              return (
                <button 
                  key={inv.id} 
                  className="btn btn-ghost" 
                  style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}
                  onClick={() => {
                    const materials = (inv.items || [])
                      .filter(it => it.type === 'material')
                      .map(it => ({
                        materialId: it.productId,
                        materialName: it.productName,
                        unit: it.unit,
                        qtyNota: Number(it.qty) || 0,
                        pricePerUnit: Number(it.unitPrice) || 0,
                        sellPrice: Number(it.unitPrice) || 0,
                        splits: {
                          s5: { qty: 0, shrinkage: 0, netQty: 0 },
                          s3: { qty: 0, shrinkage: 0, netQty: 0 }
                        },
                        totalCost: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0)
                      }));
                    
                    if (materials.length > 0) {
                      setItems(materials);
                      setSupplierName(inv.customerName || '');
                      setNotes(n => `${n}${n ? '\n' : ''}Tarik dari Invoice: ${inv.invoiceNumber}`);
                    }
                    setIsImportModalOpen(false);
                  }}
                >
                  <div>
                    <strong>{inv.invoiceNumber}</strong><br />
                    <span className="text-xs text-muted">{inv.customerName} - {new Date(inv.date).toLocaleDateString()}</span>
                    <span className="badge badge-primary ml-sm" style={{marginLeft: 8}}>{bahanCount} Bahan</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
