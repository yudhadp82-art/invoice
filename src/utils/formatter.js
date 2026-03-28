// Currency & date formatting utilities

export function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num || 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function generateInvoiceNumber(inputDate) {
  const dateStr = (inputDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `INV-${dateStr}-${seq}`;
}

export function generateDeliveryNoteNumber(inputDate) {
  const dateStr = (inputDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `SJ-${dateStr}-${seq}`;
}

export function calculateMargin(cost, price) {
  if (!cost || !price || price === 0) return 0;
  return ((price - cost) / price) * 100;
}

export function getCustomerPrice(product, customer) {
  // Check for customer-specific price overrides (kept for backward compatibility or edge cases)
  if (customer && customer.priceOverrides) {
    const override = customer.priceOverrides.find(o => o.productId === product.id);
    if (override) return override.price;
  }
  // Use category-based fixed price
  if (customer && customer.priceCategoryId && product.categoryPrices) {
    const catPrice = product.categoryPrices[customer.priceCategoryId];
    if (catPrice !== undefined && catPrice !== null) {
      return Number(catPrice);
    }
  }
  // Default to base retail price
  return Number(product.sellPrice || 0);
}

export function isToday(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function isThisWeek(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  return date >= weekAgo && date <= today;
}

export function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

export function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric' }).format(d),
    });
  }
  return days;
}
