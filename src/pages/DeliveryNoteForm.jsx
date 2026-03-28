import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiPlus, FiTrash2, FiArrowLeft, FiSave } from 'react-icons/fi';
import { DeliveryNotes, Customers, Products, Invoices } from '../utils/storage';
import { generateDeliveryNoteNumber, formatNumberInput, getCustomerPrice } from '../utils/formatter';
import ConfirmModal from '../components/ConfirmModal';

export default function DeliveryNoteForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    customerId: '',
    customerName: '',
    customerAddress: '',
    noteNumber: generateDeliveryNoteNumber(),
    invoiceId: '',
    invoiceNumber: '',
    driver: '',
    vehicleNumber: '',
    items: [],
    notes: '',
  });
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    async function loadData() {
      setCustomers(await Customers.getAll());
      setProducts(await Products.getAll());
      const allInvoices = await Invoices.getAll();
      setInvoices(allInvoices);

      if (isEdit) {
        const note = await DeliveryNotes.getById(id);
        if (note) {
          setForm({
            date: note.date || (note.createdAt ? note.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
            customerId: note.customerId || '',
            customerName: note.customerName || '',
            customerAddress: note.customerAddress || '',
            noteNumber: note.noteNumber || '',
            invoiceId: note.invoiceId || '',
            invoiceNumber: note.invoiceNumber || '',
            driver: note.driver || '',
            vehicleNumber: note.vehicleNumber || '',
            items: note.items || [],
            notes: note.notes || '',
          });
        }
      } else {
        const initInvoiceId = searchParams.get('invoiceId');
        if (initInvoiceId) {
          const invoice = allInvoices.find(i => i.id === initInvoiceId);
          if (invoice) {
            setForm(f => ({
              ...f,
              date: invoice.date || (invoice.createdAt ? invoice.createdAt.split('T')[0] : f.date),
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              customerId: invoice.customerId,
              customerName: invoice.customerName,
              customerAddress: invoice.customerAddress || '',
              items: (invoice.items || []).map(item => ({
                productId: item.productId,
                productName: item.productName,
                unit: item.unit,
                qty: item.qty,
                notes: '',
              })),
            }));
            if (!isEdit) {
              setForm(f => ({ ...f, noteNumber: generateDeliveryNoteNumber(f.date) }));
            }
          }
        }
      }
    }
    loadData();
  }, [id, searchParams]);
  
  function handleDateChange(newDate) {
    setForm(f => {
      const updates = { 
        date: newDate,
        noteNumber: generateDeliveryNoteNumber(newDate)
      };
      return { ...f, ...updates };
    });
  }

  function handleCustomerChange(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    setForm(f => ({
      ...f,
      customerId,
      customerName: customer.name,
      customerAddress: customer.address || '',
    }));
  }

  function handleInvoiceLink(invoiceId) {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) {
      setForm(f => ({ ...f, invoiceId: '', invoiceNumber: '' }));
      return;
    }
    setForm(f => {
      const newDate = invoice.date || (invoice.createdAt ? invoice.createdAt.split('T')[0] : f.date);
      return {
        ...f,
        date: newDate,
        noteNumber: isEdit ? f.noteNumber : generateDeliveryNoteNumber(newDate),
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        customerAddress: invoice.customerAddress || '',
        items: (invoice.items || []).map(item => ({
          productId: item.productId,
          productName: item.productName,
          unit: item.unit,
          qty: item.qty,
          notes: '',
        })),
      };
    });
  }

  function addItem() {
    if (products.length === 0) return;
    setForm(f => ({
      ...f,
      items: [...f.items, {
        productId: products[0].id,
        productName: products[0].name,
        unit: products[0].unit,
        qty: 1,
        notes: '',
      }],
    }));
  }

  function updateItem(index, field, value) {
    setForm(f => {
      const items = [...f.items];
      const item = { ...items[index] };
      if (field === 'productId') {
        const product = products.find(p => p.id === value);
        if (product) {
          item.productId = value;
          item.productName = product.name;
          item.unit = product.unit;
        }
      } else if (field === 'qty') {
        item.qty = value;
      } else {
        item[field] = value;
      }
      items[index] = item;
      return { ...f, items };
    });
  }

  function removeItem(index) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  async function handleDelete() {
    if (isEdit && id) setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await DeliveryNotes.delete(deleteId);
    setDeleteId(null);
    navigate('/delivery-notes');
  }

  async function handleSave() {
    if (!form.customerName || form.items.length === 0) {
      alert('Pilih customer dan tambahkan minimal 1 item');
      return;
    }

    const dataToSave = { ...form, items: form.items.map(i => ({...i, qty: Number(i.qty) || 0})) };
    let savedNote;
    if (isEdit) {
      savedNote = await DeliveryNotes.update(id, dataToSave);
    } else {
      savedNote = await DeliveryNotes.create(dataToSave);
    }

    // === Reverse Sync with Invoice ===
    if (form.invoiceId) {
      const invoice = await Invoices.getById(form.invoiceId);
      if (invoice) {
        const customer = customers.find(c => c.id === invoice.customerId);
        
        // Match items and recalculate
        const updatedInvoiceItems = form.items.map(dnItem => {
          // Find existing item in invoice to get its price/cost
          const existingInvItem = (invoice.items || []).find(ii => ii.productId === dnItem.productId);
          
          if (existingInvItem) {
            const qty = Number(dnItem.qty) || 0;
            return {
              ...existingInvItem,
              qty: qty,
              subtotal: (existingInvItem.unitPrice || 0) * qty
            };
          } else {
            // New item added from DN, need to fetch product info
            const product = products.find(p => p.id === dnItem.productId);
            const qty = Number(dnItem.qty) || 0;
            const unitPrice = customer && product ? getCustomerPrice(product, customer) : (product ? product.sellPrice : 0);
            return {
              productId: dnItem.productId,
              productName: dnItem.productName,
              unit: dnItem.unit,
              qty: qty,
              unitPrice: unitPrice,
              purchaseCost: product ? product.purchaseCost : 0,
              subtotal: unitPrice * qty
            };
          }
        });

        const subtotal = updatedInvoiceItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
        const grandTotal = subtotal;
        const totalCost = updatedInvoiceItems.reduce((sum, item) => sum + ((item.purchaseCost || 0) * (item.qty || 0)), 0);
        const profit = grandTotal - totalCost;

        await Invoices.update(invoice.id, {
          ...invoice,
          items: updatedInvoiceItems,
          subtotal,
          grandTotal,
          totalTotal: grandTotal,
          totalCost,
          profit,
        });
      }
    }
    // =================================

    navigate('/delivery-notes');
  }

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>{isEdit ? 'Edit Surat Jalan' : 'Buat Surat Jalan'}</h1>
          <p>{form.noteNumber}</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={() => navigate('/delivery-notes')}>
            <FiArrowLeft /> Kembali
          </button>
          {isEdit && (
            <button className="btn btn-ghost text-danger" onClick={handleDelete}>
              <FiTrash2 /> Hapus
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave}>
            <FiSave /> Simpan
          </button>
        </div>
      </div>

      <div className="card mb-lg">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Link ke Invoice (opsional)</label>
            <select name="invoiceId_2" className="form-select" value={form.invoiceId} onChange={e => handleInvoiceLink(e.target.value)}>
              <option value="">-- Tanpa Invoice --</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.invoiceNumber} - {inv.customerName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">No. Surat Jalan</label>
            <input name="noteNumber_4" className="form-input" value={form.noteNumber} onChange={e => setForm({...form, noteNumber: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Tanggal Surat Jalan</label>
            <input type="date" name="noteDate" className="form-input" value={form.date} onChange={e => handleDateChange(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Customer</label>
            <select name="customerId_6" className="form-select" value={form.customerId} onChange={e => handleCustomerChange(e.target.value)}>
              <option value="">-- Pilih Customer --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Driver</label>
            <input name="driver_8" className="form-input" value={form.driver} onChange={e => setForm({...form, driver: e.target.value})} placeholder="Nama driver" />
          </div>
          <div className="form-group">
            <label className="form-label">No. Kendaraan</label>
            <input name="vehicleNumber_10" className="form-input" value={form.vehicleNumber} onChange={e => setForm({...form, vehicleNumber: e.target.value})} placeholder="B 1234 ABC" />
          </div>
        </div>
      </div>

      <div className="card mb-lg">
        <div className="card-header">
          <h3 className="card-title">Daftar Barang</h3>
          <button className="btn btn-secondary btn-sm" onClick={addItem}>
            <FiPlus /> Tambah Barang
          </button>
        </div>

        {form.items.length === 0 ? (
          <div className="empty-state">
            <p className="text-muted">Belum ada barang.</p>
          </div>
        ) : (
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: '5%', textAlign: 'center' }}>No.</th>
                <th style={{ width: '30%' }}>Barang</th>
                <th style={{ width: '12%' }}>Qty</th>
                <th style={{ width: '12%' }}>Satuan</th>
                <th style={{ width: '30%' }}>Keterangan</th>
                <th style={{ width: '6%' }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td>
                    <select name="productId_12" className="form-select" value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input name="qty_14" className="form-input" type="text" value={formatNumberInput(item.qty)} onChange={e => {
                      const val = e.target.value.replace(/,/g, '');
                      if (/^\d*\.?\d*$/.test(val)) {
                        updateItem(i, 'qty', val);
                      }
                    }} />
                  </td>
                  <td className="text-muted">{item.unit}</td>
                  <td>
                    <input name="input_15_16" className="form-input" value={item.notes || ''} onChange={e => updateItem(i, 'notes', e.target.value)} placeholder="Keterangan..." />
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => removeItem(i)}><FiTrash2 /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="form-group">
          <label className="form-label">Catatan</label>
          <textarea name="notes_18" className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Catatan pengiriman..." />
        </div>
      </div>
      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Hapus Surat Jalan"
        message="Apakah Anda yakin ingin menghapus surat jalan ini?"
      />
    </div>
  );
}
