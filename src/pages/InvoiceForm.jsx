import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiPlus, FiTrash2, FiArrowLeft, FiSave } from 'react-icons/fi';
import { Invoices, Customers, Products, DeliveryNotes } from '../utils/storage';
import { formatCurrency, generateInvoiceNumber, generateDeliveryNoteNumber, getCustomerPrice } from '../utils/formatter';

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = !!id;
  
  const telegramOrder = location.state?.telegramOrder;

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    customerId: '',
    customerName: '',
    customerAddress: '',
    invoiceNumber: generateInvoiceNumber(),
    items: [],
    notes: '',
    paymentStatus: 'unpaid',
    telegramChatId: '',
  });

  useEffect(() => {
    async function loadData() {
      const c = await Customers.getAll();
      const p = await Products.getAll();
      setCustomers(c);
      setProducts(p);

      if (isEdit) {
        const invoice = await Invoices.getById(id);
        if (invoice) {
          setForm({
            customerId: invoice.customerId || '',
            customerName: invoice.customerName || '',
            customerAddress: invoice.customerAddress || '',
            invoiceNumber: invoice.invoiceNumber || '',
            items: invoice.items || [],
            notes: invoice.notes || '',
            paymentStatus: invoice.paymentStatus || 'unpaid',
            telegramChatId: invoice.telegramChatId || '',
          });
        }
      } else if (telegramOrder) {
        const customer = c.find(cust => cust.id === telegramOrder.matchedCustomerId);
        
        const items = telegramOrder.items.map(item => {
          const product = p.find(prod => prod.id === item.productId);
          const unitPrice = customer && product ? getCustomerPrice(product, customer) : (product ? product.sellPrice : 0);
          
          return {
            productId: item.productId || '',
            productName: item.matchedName || item.productName,
            unit: item.matchedUnit || item.unit || 'kg',
            qty: item.qty,
            unitPrice: unitPrice,
            purchaseCost: product ? product.purchaseCost : 0,
            subtotal: unitPrice * item.qty
          };
        });

        setForm(f => ({
          ...f,
          customerId: telegramOrder.matchedCustomerId || '',
          customerName: customer ? customer.name : telegramOrder.customerName,
          customerAddress: customer ? customer.address : '',
          items: items,
          notes: `Pesan Telegram:\n${telegramOrder.rawMessage}`,
          telegramChatId: telegramOrder.telegramChatId || ''
        }));
      }
    }
    loadData();
  }, [id, telegramOrder]);

  function handleCustomerChange(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    // Recalculate prices when customer changes
    const updatedItems = form.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return item;
      const unitPrice = getCustomerPrice(product, customer);
      const subtotal = unitPrice * item.qty;
      return { ...item, unitPrice, subtotal };
    });

    setForm(f => ({
      ...f,
      customerId,
      customerName: customer.name,
      customerAddress: customer.address || '',
      items: updatedItems,
    }));
  }

  function addItem() {
    const availableProducts = products.filter(p => !p.customerId || p.customerId === form.customerId);
    if (availableProducts.length === 0) {
      alert('Tidak ada produk yang tersedia untuk customer ini.');
      return;
    }
    const product = availableProducts[0];
    const customer = customers.find(c => c.id === form.customerId);
    const unitPrice = customer ? getCustomerPrice(product, customer) : product.sellPrice;

    setForm(f => ({
      ...f,
      items: [...f.items, {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        qty: 1,
        unitPrice,
        purchaseCost: product.purchaseCost,
        subtotal: unitPrice,
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
          const customer = customers.find(c => c.id === f.customerId);
          const unitPrice = customer ? getCustomerPrice(product, customer) : product.sellPrice;
          item.productId = value;
          item.productName = product.name;
          item.unit = product.unit;
          item.unitPrice = unitPrice;
          item.purchaseCost = product.purchaseCost;
        }
      } else if (field === 'qty') {
        item.qty = value;
      } else if (field === 'unitPrice') {
        item.unitPrice = Number(value) || 0;
      }

      item.subtotal = item.unitPrice * (Number(item.qty) || 0);
      items[index] = item;
      return { ...f, items };
    });
  }

  function removeItem(index) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  const subtotal = form.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const grandTotal = subtotal;
  const totalCost = form.items.reduce((sum, item) => sum + ((item.purchaseCost || 0) * (Number(item.qty) || 0)), 0);
  const profit = grandTotal - totalCost;
  const profitMargin = grandTotal > 0 ? ((profit / grandTotal) * 100).toFixed(1) : 0;

  async function handleSave() {
    if (!form.customerId || form.items.length === 0) {
      alert('Pilih customer dan tambahkan minimal 1 item');
      return;
    }

    const data = {
      ...form,
      items: form.items.map(item => ({ ...item, qty: Number(item.qty) || 0 })),
      subtotal,
      taxAmount: 0, // Legacy support
      taxEnabled: false,
      grandTotal,
      totalTotal: grandTotal, // keep it safe
      totalCost,
      profit,
    };

    let savedInvoice;
    if (isEdit) {
      savedInvoice = await Invoices.update(id, data);
    } else {
      savedInvoice = await Invoices.create(data);
    }

    // === Sync with Delivery Note ===
    if (savedInvoice) {
      const allNotes = await DeliveryNotes.getAll();
      const existingNotes = allNotes.filter(n => n.invoiceId === savedInvoice.id);
      
      let noteItems = [];
      (form.items || []).forEach(item => {
        noteItems.push({
          productId: item.productId,
          productName: item.productName,
          unit: item.unit,
          qty: Number(item.qty) || 0,
          notes: '',
        });
      });

      if (existingNotes.length > 0) {
        // Update existing note
        const note = existingNotes[0];
        
        // Coba merge: jika ada item di delivery note yang TIDAK ada di noteItems hasil generate invoice, 
        // kita KEMBALIKAN karena kemungkinan supir menambahkan manual (misal: packaging jerigen, gabus, es batu).
        const existingExtraItems = note.items.filter(exItem => 
          !noteItems.some(nItem => nItem.productName === exItem.productName)
        );
        
        const mergedItems = [...noteItems];
        // Timpa qty untuk item hasil invoice yang sudah pernah disesuaikan qty/notesnya di DN (jika ada)
        mergedItems.forEach(mi => {
          const match = note.items.find(xi => xi.productName === mi.productName);
          if (match) {
            mi.qty = match.qty; // retain driver manual adjustments
            if (match.notes) mi.notes = match.notes; // retain driver manual notes
          }
        });
        
        await DeliveryNotes.update(note.id, {
          ...note,
          customerId: form.customerId,
          customerName: form.customerName,
          customerAddress: form.customerAddress,
          items: [...mergedItems, ...existingExtraItems],
        });
      } else {
        // Create new note automatically
        await DeliveryNotes.create({
          customerId: form.customerId,
          customerName: form.customerName,
          customerAddress: form.customerAddress,
          noteNumber: generateDeliveryNoteNumber(),
          invoiceId: savedInvoice.id,
          invoiceNumber: savedInvoice.invoiceNumber,
          driver: '',
          vehicleNumber: '',
          items: noteItems,
          notes: 'Auto-generated dari Invoice',
        });
      }
    }
    // ===============================

    navigate('/invoices');
  }

  return (
    <div className="animate-in">
      <div className="page-header page-header-actions">
        <div>
          <h1>{isEdit ? 'Edit Invoice' : 'Buat Invoice Baru'}</h1>
          <p>{form.invoiceNumber}</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={() => navigate('/invoices')}>
            <FiArrowLeft /> Kembali
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <FiSave /> Simpan
          </button>
        </div>
      </div>

      <div className="card mb-lg">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Customer</label>
            <select name="customerId_2" className="form-select" value={form.customerId} onChange={e => handleCustomerChange(e.target.value)}>
              <option value="">-- Pilih Customer --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company || '-'})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">No. Invoice</label>
            <input name="invoiceNumber_4" className="form-input" value={form.invoiceNumber} onChange={e => setForm({...form, invoiceNumber: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Status Pembayaran</label>
            <select name="paymentStatus_6" className="form-select" value={form.paymentStatus} onChange={e => setForm({...form, paymentStatus: e.target.value})}>
              <option value="unpaid">Belum Bayar</option>
              <option value="partial">Sebagian</option>
              <option value="paid">Lunas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card mb-lg">
        <div className="card-header">
          <h3 className="card-title">Item Invoice</h3>
          <button className="btn btn-secondary btn-sm" onClick={addItem}>
            <FiPlus /> Tambah Item
          </button>
        </div>

        {form.items.length === 0 ? (
          <div className="empty-state">
            <p className="text-muted">Belum ada item. Klik "Tambah Item" untuk menambahkan.</p>
          </div>
        ) : (
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: '5%', textAlign: 'center' }}>No.</th>
                <th style={{ width: '25%' }}>Produk</th>
                <th style={{ width: '10%' }}>Qty</th>
                <th style={{ width: '8%' }}>Satuan</th>
                <th style={{ width: '20%' }}>Harga</th>
                <th style={{ width: '22%', textAlign: 'right' }}>Subtotal</th>
                <th style={{ width: '10%', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, i) => {
                const availableProducts = products.filter(p => !p.customerId || p.customerId === form.customerId);
                return (
                <tr key={i}>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td>
                    <select name={`productId_${i}`} className="form-select" value={item.productId || ''} onChange={e => updateItem(i, 'productId', e.target.value)}>
                      <option value="">-- Pilih Produk --</option>
                      {availableProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input name="qty_10" className="form-input" type="number" min="0" step="any" value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} />
                  </td>
                  <td className="text-muted">{item.unit}</td>
                  <td>
                    <input name="unitPrice_12" className="form-input" type="number" min="0" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} />
                  </td>
                  <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(item.subtotal)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => removeItem(i)}><FiTrash2 /></button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      {/* Totals & Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <div className="form-group">
            <label className="form-label">Catatan</label>
            <textarea name="notes_16" className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Catatan tambahan..." />
          </div>
        </div>

        <div className="card">
          <div className="totals-section" style={{ justifyContent: 'stretch' }}>
            <div className="totals-table" style={{ width: '100%' }}>
              <div className="total-row grand-total">
                <span>Grand Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, padding: '12px', background: 'rgba(16,185,129,0.08)', borderRadius: '10px', fontSize: '13px' }}>
            <div className="flex-between">
              <span className="text-muted">Modal</span>
              <span>{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex-between mt-sm">
              <span className="text-muted">Profit</span>
              <span style={{ color: profit >= 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>{formatCurrency(profit)}</span>
            </div>
            <div className="flex-between mt-sm">
              <span className="text-muted">Margin</span>
              <span style={{ fontWeight: 600 }}>{profitMargin}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
