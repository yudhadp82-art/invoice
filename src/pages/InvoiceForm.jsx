import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiPlus, FiTrash2, FiArrowLeft, FiSave, FiSearch } from 'react-icons/fi';
import { Invoices, Customers, Products, DeliveryNotes } from '../utils/storage';
import { formatCurrency, generateInvoiceNumber, generateDeliveryNoteNumber, getCustomerPrice, formatNumberInput, parseNumberInput } from '../utils/formatter';
import ConfirmModal from '../components/ConfirmModal';

// -------------------------------------------------------
// Searchable Product Selector Component
// -------------------------------------------------------
function ProductSearch({ value, products, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Sync display when external value changes (e.g. initial load)
  useEffect(() => {
    if (!focused) {
      const prod = products.find(p => p.id === value);
      setQuery(prod ? prod.name : '');
    }
  }, [value, products, focused]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setFocused(false);
        // restore display name
        const prod = products.find(p => p.id === value);
        setQuery(prod ? prod.name : '');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value, products]);

  const filtered = query.trim()
    ? products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : products;

  function select(prod) {
    if (!prod) return;
    setQuery(prod.name);
    setOpen(false);
    setFocused(false);
    setActiveIndex(-1);
    onChange(prod.id);
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        select(filtered[activeIndex]);
      } else if (filtered.length > 0) {
        select(filtered[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setFocused(false);
      const prod = products.find(p => p.id === value);
      setQuery(prod ? prod.name : '');
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <FiSearch style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', pointerEvents: 'none', fontSize: 14
        }} />
        <input
          ref={inputRef}
          className="form-input"
          style={{ paddingLeft: 32 }}
          type="text"
          placeholder="Ketik nama produk..."
          value={query}
          autoComplete="off"
          onFocus={() => { setFocused(true); setOpen(true); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
          onKeyDown={handleKeyDown}
        />
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 1000, top: '100%', left: 0, right: 0,
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: 8,
          maxHeight: 220,
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          marginTop: 2,
        }}>
          {filtered.map((p, idx) => (
            <div
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); select(p); }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 13,
                borderBottom: '1px solid var(--border-color, #334155)',
                background: (value === p.id || activeIndex === idx) ? 'var(--primary-dim, rgba(99,102,241,0.15))' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(-1)}
            >
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 11 }}>{p.unit}</span>
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div style={{
          position: 'absolute', zIndex: 1000, top: '100%', left: 0, right: 0,
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: 8, padding: '10px 12px',
          fontSize: 13, color: 'var(--text-muted)',
          marginTop: 2,
        }}>
          Produk tidak ditemukan
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Searchable Customer Selector Component
// -------------------------------------------------------
function CustomerSearch({ value, customers, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!focused) {
      const cust = customers.find(c => c.id === value);
      setQuery(cust ? `${cust.name} (${cust.company || '-'})` : '');
    }
  }, [value, customers, focused]);

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setFocused(false);
        const cust = customers.find(c => c.id === value);
        setQuery(cust ? `${cust.name} (${cust.company || '-'})` : '');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value, customers]);

  const filtered = query.trim()
    ? customers.filter(c => 
        c.name.toLowerCase().includes(query.toLowerCase()) || 
        (c.company && c.company.toLowerCase().includes(query.toLowerCase()))
      )
    : customers;

  function select(cust) {
    if (!cust) return;
    setQuery(`${cust.name} (${cust.company || '-'})`);
    setOpen(false);
    setFocused(false);
    setActiveIndex(-1);
    onChange(cust.id);
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        select(filtered[activeIndex]);
      } else if (filtered.length > 0) {
        select(filtered[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setFocused(false);
      const cust = customers.find(c => c.id === value);
      setQuery(cust ? `${cust.name} (${cust.company || '-'})` : '');
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <FiSearch style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', pointerEvents: 'none', fontSize: 14
        }} />
        <input
          className="form-input"
          style={{ paddingLeft: 32 }}
          type="text"
          placeholder="Cari customer..."
          value={query}
          autoComplete="off"
          onFocus={() => { setFocused(true); setOpen(true); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
          onKeyDown={handleKeyDown}
        />
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 1000, top: '100%', left: 0, right: 0,
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: 8,
          maxHeight: 250,
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          marginTop: 2,
        }}>
          {filtered.map((c, idx) => (
            <div
              key={c.id}
              onMouseDown={(e) => { e.preventDefault(); select(c); }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 13,
                borderBottom: '1px solid var(--border-color, #334155)',
                background: (value === c.id || activeIndex === idx) ? 'var(--primary-dim, rgba(99,102,241,0.15))' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(-1)}
            >
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{c.company || 'Personal'} - {c.address}</div>
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div style={{
          position: 'absolute', zIndex: 1000, top: '100%', left: 0, right: 0,
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: 8, padding: '10px 12px',
          fontSize: 13, color: 'var(--text-muted)',
          marginTop: 2,
        }}>
          Customer tidak ditemukan
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Main InvoiceForm
// -------------------------------------------------------
export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = !!id;
  
  const telegramOrder = location.state?.telegramOrder;

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    customerId: '',
    customerName: '',
    customerAddress: '',
    invoiceNumber: generateInvoiceNumber(),
    items: [],
    notes: '',
    paymentStatus: 'unpaid',
    telegramChatId: '',
  });
  const [deleteId, setDeleteId] = useState(null);

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
            date: invoice.date || (invoice.createdAt ? invoice.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
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
          date: telegramOrder.createdAt ? telegramOrder.createdAt.split('T')[0] : f.date, // Carry over the date
          items: items,
          notes: `Pesan Telegram:\n${telegramOrder.rawMessage}`,
          telegramChatId: telegramOrder.telegramChatId || ''
        }));
      }
    }
    loadData();
  }, [id, telegramOrder]);
  
  function handleDateChange(newDate) {
    setForm(f => {
      const updates = { 
        date: newDate,
        invoiceNumber: generateInvoiceNumber(newDate)
      };
      return { ...f, ...updates };
    });
  }

  async function handleDelete() {
    if (isEdit && id) setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await Invoices.delete(deleteId);
    setDeleteId(null);
    navigate('/invoices');
  }

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
      
      const invoiceItemsForDN = (form.items || []).map(item => ({
        productId: item.productId,
        productName: item.productName,
        unit: item.unit,
        qty: Number(item.qty) || 0,
        notes: '', // Notes per item in DN (not in Invoice)
      }));

      if (existingNotes.length > 0) {
        // Update existing note
        const note = existingNotes[0];
        
        // Merge: Update existing items, add new ones, but keep notes from DN
        const updatedDNItems = invoiceItemsForDN.map(invItem => {
          const match = note.items.find(ni => ni.productId === invItem.productId);
          return {
            ...invItem,
            notes: match ? (match.notes || '') : '', // Preserve existing DN item notes
          };
        });

        // Optional: Keep items that are in DN but NOT in Invoice? 
        // User rule: Mirroring. So we replace.
        
        await DeliveryNotes.update(note.id, {
          ...note,
          customerId: form.customerId,
          customerName: form.customerName,
          customerAddress: form.customerAddress,
          date: form.date,
          invoiceNumber: form.invoiceNumber,
          items: updatedDNItems,
        });
      } else {
        // Create new note automatically
        await DeliveryNotes.create({
          customerId: form.customerId,
          customerName: form.customerName,
          customerAddress: form.customerAddress,
          date: form.date,
          noteNumber: generateDeliveryNoteNumber(form.date),
          invoiceId: savedInvoice.id,
          invoiceNumber: savedInvoice.invoiceNumber,
          driver: '',
          vehicleNumber: '',
          items: invoiceItemsForDN,
          notes: 'Auto-generated from Invoice',
        });
      }
    }
    // ===============================

    navigate('/invoices');
  }

  const availableProducts = products.filter(p => !p.customerId || p.customerId === form.customerId);

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
            <label className="form-label">Customer</label>
            <CustomerSearch 
              value={form.customerId} 
              customers={customers} 
              onChange={handleCustomerChange} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tanggal Invoice</label>
            <input type="date" name="invoiceDate" className="form-input" value={form.date} onChange={e => handleDateChange(e.target.value)} />
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
                <th style={{ width: '30%' }}>Produk</th>
                <th style={{ width: '10%' }}>Qty</th>
                <th style={{ width: '8%' }}>Satuan</th>
                <th style={{ width: '20%' }}>Harga</th>
                <th style={{ width: '20%', textAlign: 'right' }}>Subtotal</th>
                <th style={{ width: '7%', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td>
                    <ProductSearch
                      value={item.productId || ''}
                      products={availableProducts}
                      onChange={productId => updateItem(i, 'productId', productId)}
                    />
                  </td>
                  <td>
                    <input name="qty_10" className="form-input" type="text" value={formatNumberInput(item.qty)} onChange={e => {
                      const val = e.target.value.replace(/\./g, '').replace(',', '.');
                      if (/^\d*\.?\d*$/.test(val) || val === '') {
                        updateItem(i, 'qty', val);
                      }
                    }} />
                  </td>
                  <td className="text-muted">{item.unit}</td>
                  <td>
                    <input name="unitPrice_12" className="form-input" type="text" value={formatNumberInput(item.unitPrice)} onChange={e => {
                      const val = e.target.value.replace(/\./g, '').replace(',', '.');
                      if (/^\d*\.?\d*$/.test(val) || val === '') {
                        updateItem(i, 'unitPrice', val);
                      }
                    }} />
                  </td>
                  <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(item.subtotal)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => removeItem(i)}><FiTrash2 /></button>
                  </td>
                </tr>
              ))}
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
      <ConfirmModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Hapus Invoice"
        message="Apakah Anda yakin ingin menghapus invoice ini? Data Surat Jalan terkait tidak akan terhapus otomatis."
      />
    </div>
  );
}
