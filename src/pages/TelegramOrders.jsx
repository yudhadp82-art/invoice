import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiCheck, FiFileText, FiTrash2, FiAlertCircle, FiEdit2, FiX, FiSave } from 'react-icons/fi';
import { TelegramOrders, Customers, Products as ProductStorage } from '../utils/storage';
import { checkBotStatus, fetchUpdates, parseOrderMessage, matchCustomer, matchProduct, sendMessage } from '../utils/telegram';
import { formatDateTime } from '../utils/formatter';

export default function TelegramOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders]     = useState([]);
  const [botInfo, setBotInfo]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [allCustomers, setAllCustomers] = useState([]);
  const [allProducts, setAllProducts]   = useState([]);
  const [editOrder, setEditOrder] = useState(null); // order being edited in modal

  useEffect(() => {
    async function init() {
      const custs = await Customers.getAll();
      const prods = await ProductStorage.getAll();
      setAllCustomers(custs);
      setAllProducts(prods);
      await loadOrders();
      await loadBotStatus();
    }
    init();
  }, []);

  async function loadOrders() {
    const list = await TelegramOrders.getAll();
    setOrders([...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  async function loadBotStatus() {
    const info = await checkBotStatus();
    setBotInfo(info);
  }

  async function handleRefresh() {
    setLoading(true);
    const custs = await Customers.getAll();
    const prods = await ProductStorage.getAll();

    const offset  = TelegramOrders.getOffset();
    const updates = await fetchUpdates(offset + 1);

    let newOffset  = offset;
    let addedCount = 0;

    const allOrders = await TelegramOrders.getAll();

    for (const update of updates) {
      if (update.update_id > newOffset) newOffset = update.update_id;

      if (update.message?.text) {
        const text   = update.message.text;
        const chatId = update.message.chat.id;
        const msgId  = update.message.message_id;

        const existing = allOrders.find(o => o.telegramMessageId === msgId);
        if (existing) continue;

        const parsed = parseOrderMessage(text);
        if (!parsed || parsed.items.length === 0) continue;

        const matchedCust = matchCustomer(parsed.customerKeywords, custs);

        const scopedProducts = prods.filter(p => !p.customerId || (matchedCust && p.customerId === matchedCust.id));

        const matchedItems = parsed.items.map(item => {
          const match = matchProduct(item.productName, scopedProducts);
          return {
            ...item,
            productId:   match ? match.id   : null,
            matchedName: match ? match.name  : null,
            matchedUnit: match ? match.unit  : null,
          };
        });

        await TelegramOrders.create({
          rawMessage:        text,
          telegramMessageId: msgId,
          telegramChatId:    chatId,
          customerRaw:       parsed.customerRaw,
          customerName:      matchedCust ? matchedCust.name : parsed.customerRaw,
          matchedCustomerId: matchedCust ? matchedCust.id   : null,
          items:             matchedItems,
          status:            'baru',
        });
        addedCount++;
      }
    }

    if (newOffset > offset) TelegramOrders.setOffset(newOffset);

    await loadOrders();
    if (addedCount > 0) {
      alert(`Berhasil mengambil ${addedCount} pesanan baru`);
    } else if (updates.length > 0) {
      alert(`${updates.length} pesan diterima tapi format tidak sesuai.`);
    } else {
      alert('Tidak ada pesan baru.');
    }
    setLoading(false);
  }

  async function handleProcess(order) {
    await TelegramOrders.update(order.id, { status: 'diproses' });
    await loadOrders();
    sendMessage(order.telegramChatId, `Pesanan "${order.customerRaw || order.customerName}" sedang kami proses. Terima kasih!`);
  }

  async function handleDelete(id) {
    if (confirm('Hapus log pesanan ini?')) {
      await TelegramOrders.delete(id);
      await loadOrders();
    }
  }

  function handleCreateInvoice(order) {
    navigate('/invoices/new', { state: { telegramOrder: order } });
  }

  // ---- Edit Modal ----
  function openEdit(order) {
    // Deep clone + enrich items with selector options
    setEditOrder({
      ...order,
      items: order.items.map(it => ({ ...it })),
    });
  }

  function closeEdit() { setEditOrder(null); }

  async function saveEdit() {
    if (!editOrder) return;
    const { id, matchedCustomerId, customerName, items, status } = editOrder;
    // Remap productId/matchedName from selection
    await TelegramOrders.update(id, { matchedCustomerId, customerName, items, status });
    await loadOrders();
    setEditOrder(null);
  }

  function editCustomerChange(custId) {
    const c = allCustomers.find(x => x.id === custId);
    setEditOrder(e => ({
      ...e,
      matchedCustomerId: custId,
      customerName: c ? c.name : e.customerRaw || '',
    }));
  }

  function editItemChange(index, field, value) {
    setEditOrder(e => {
      const items = [...e.items];
      const item  = { ...items[index] };
      if (field === 'productId') {
        const p = allProducts.find(x => x.id === value);
        item.productId   = value;
        item.matchedName = p ? p.name : null;
        item.matchedUnit = p ? p.unit : null;
      } else if (field === 'qty') {
        item.qty = Number(value);
      } else if (field === 'productName') {
        item.productName = value;
      }
      items[index] = item;
      return { ...e, items };
    });
  }

  function addEditItem() {
    setEditOrder(e => ({
      ...e,
      items: [...e.items, { productName: '', qty: 1, unit: 'kg', productId: null, matchedName: null, matchedUnit: null }],
    }));
  }

  function removeEditItem(index) {
    setEditOrder(e => ({ ...e, items: e.items.filter((_, i) => i !== index) }));
  }

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="page-header page-header-actions">
        <div>
          <h1>Pesanan Telegram</h1>
          <div style={{ marginTop: 6 }}>
            <div className="telegram-status">
              <div className={`telegram-status-dot ${botInfo ? 'connected' : 'disconnected'}`} />
              <span>{botInfo ? `@${botInfo.username} — Connected` : 'Disconnected / Cek Proxy'}</span>
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleRefresh} disabled={loading}>
          <FiRefreshCw style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Mengambil...' : 'Ambil Pesanan Baru'}
        </button>
      </div>

      {/* Empty State */}
      {orders.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FiAlertCircle className="empty-state-icon" />
            <h3>Belum ada pesanan masuk</h3>
            <p className="text-muted">Kirim pesan ke bot, lalu klik "Ambil Pesanan Baru".</p>
            <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 12, maxWidth: 420, margin: '16px auto', textAlign: 'left' }}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Format Pesanan:</p>
              <pre style={{ background: '#090d16', padding: 10, borderRadius: 6, fontSize: 13, color: '#22d3ee', whiteSpace: 'pre' }}>{`SPPG sindangjaya 5
- wortel 5kg
- bawang merah 3 kg
- cabe rawit 2kg`}</pre>
              <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>Baris pertama = kode/nama customer. Angka di akhir diabaikan saat pencocokan nama.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="telegram-grid">
          {orders.map(order => (
            <div key={order.id} className="telegram-card">
              {/* Card Header */}
              <div className="telegram-card-header">
                <div>
                  <strong style={{ color: order.matchedCustomerId ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                    {order.customerName}
                  </strong>
                  {order.customerRaw && order.customerRaw !== order.customerName && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>({order.customerRaw})</span>
                  )}
                  {order.matchedCustomerId && (
                    <span className="match-tag" style={{ marginLeft: 8 }}>✓ Matched</span>
                  )}
                </div>
                <span className={`badge ${order.status === 'selesai' ? 'badge-success' : order.status === 'diproses' ? 'badge-info' : 'badge-warning'}`}>
                  {order.status === 'baru' ? 'Baru' : order.status === 'diproses' ? 'Diproses' : 'Selesai'}
                </span>
              </div>

              {/* Card Body */}
              <div className="telegram-card-body">
                <p className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>{formatDateTime(order.createdAt)}</p>
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '8px 10px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                  <p style={{ fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>Pesan Asli:</p>
                  <div style={{ fontFamily: 'inherit', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {order.rawMessage.split('\n').map(l => l.trim()).filter(l => l).map((line, idx) => {
                      if (idx === 0) return <div key={idx} style={{ fontWeight: 500, marginBottom: 4 }}>{line}</div>;
                      const cleanLine = line.replace(/^[-*•]\s*/, '');
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--text-muted)', width: '22px', flexShrink: 0, textAlign: 'right', display: 'inline-block', marginRight: '6px' }}>{idx}.</span>
                          <span>{cleanLine}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p style={{ fontWeight: 500, fontSize: 13, marginBottom: 6 }}>Item:</p>
                {order.items.map((item, i) => (
                  <div key={i} className="item-match">
                    <span><span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{i + 1}.</span>{item.productName} <span style={{ color: 'var(--text-muted)' }}>({item.qty} {item.unit})</span></span>
                    <span className={`match-tag ${item.productId ? '' : 'unmatched'}`}>
                      {item.productId ? `✓ ${item.matchedName}` : '? Unmatched'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Card Footer */}
              <div className="telegram-card-footer">
                {order.status === 'baru' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleProcess(order)}>
                    <FiCheck /> Proses
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(order)}>
                  <FiEdit2 /> Edit
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => handleCreateInvoice(order)}>
                  <FiFileText /> Invoice
                </button>
                <div style={{ marginLeft: 'auto' }}>
                  <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(order.id)}>
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Edit Modal ===== */}
      {editOrder && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Pesanan</h2>
              <button className="btn btn-ghost btn-sm" onClick={closeEdit}><FiX /></button>
            </div>
            <div className="modal-body">
              {/* Customer */}
              <div className="form-group">
                <label className="form-label">Pesan Asli (Baris 1): <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{editOrder.customerRaw}</span></label>
                <label className="form-label" style={{ marginTop: 10 }}>Customer (Hasil Pencocokan)</label>
                <select
                  className="form-select"
                  value={editOrder.matchedCustomerId || ''}
                  onChange={e => editCustomerChange(e.target.value)}
                >
                  <option value="">-- Pilih Customer --</option>
                  {allCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.company ? ` – ${c.company}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Items */}
              <div style={{ marginTop: 16 }}>
                <div className="flex-between mb-md">
                  <p style={{ fontWeight: 600 }}>Item Pesanan</p>
                  <button className="btn btn-secondary btn-sm" onClick={addEditItem}>+ Tambah</button>
                </div>
                {editOrder.items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 2fr 2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, textAlign: 'right' }}>{i + 1}.</span>
                    {/* Original name (read-only reference) */}
                    <input
                      className="form-input"
                      placeholder="Nama di pesan"
                      value={item.productName}
                      onChange={e => editItemChange(i, 'productName', e.target.value)}
                    />
                    {/* Product match */}
                    <select
                      className="form-select"
                      value={item.productId || ''}
                      onChange={e => editItemChange(i, 'productId', e.target.value)}
                    >
                      <option value="">-- Pilih Produk --</option>
                      {allProducts
                        .filter(p => !p.customerId || p.customerId === (editOrder.matchedCustomerId || 'never-match-if-empty'))
                        .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {/* Qty */}
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.5"
                      value={item.qty}
                      onChange={e => editItemChange(i, 'qty', e.target.value)}
                    />
                    {/* Unit display */}
                    <span className="text-muted" style={{ fontSize: 13 }}>{item.matchedUnit || item.unit}</span>
                    {/* Remove */}
                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => removeEditItem(i)}><FiTrash2 /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeEdit}>Batal</button>
              <button className="btn btn-primary" onClick={saveEdit}><FiSave /> Simpan</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
