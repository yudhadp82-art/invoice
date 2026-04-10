/**
 * Resolusi invoice grup untuk satu nota pembelian (sama seperti di halaman Nota).
 */
export function getInvoicesForPurchaseNote(note, fullInvoices, allCustomers) {
  const noteDateStr = note.date ? String(note.date || '').slice(0, 10) : '';
  const grp = note.groupName || '(Tanpa Grup)';
  let invsForGroup = [];
  if (note.sourceInvoiceIds && note.sourceInvoiceIds.length > 0) {
    invsForGroup = fullInvoices.filter(inv => note.sourceInvoiceIds.includes(inv.id));
  } else if (note.invoiceId) {
    invsForGroup = fullInvoices.filter(inv => inv.id === note.invoiceId);
  } else {
    const nameToGroup = {};
    allCustomers.forEach(c => {
      if (c.group && c.name) nameToGroup[c.name.toLowerCase()] = c.group;
    });
    invsForGroup = fullInvoices.filter(inv => {
      try {
        const dateObj = inv.date ? new Date(inv.date) : (inv.createdAt ? new Date(inv.createdAt) : null);
        if (!dateObj || isNaN(dateObj.getTime())) return false;
        const invDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        return invDateStr === noteDateStr && nameToGroup[(inv.customerName || '').toLowerCase()] === grp;
      } catch (e) {
        return false;
      }
    });
  }
  return { invsForGroup, grp, noteDateStr };
}

/**
 * Model data bersama untuk laporan pembelian (HTML preview & PDF vektor).
 */
export function computePurchaseReportModel({
  groupName,
  date,
  purchaseItems = [],
  supplierName,
  supplierDiscounts = {},
  invoicesList = [],
  additionalCosts = {}
}) {
  const session1Data = [];
  (invoicesList || []).forEach(inv => {
    const custName = inv.customerName || '-';
    (inv.items || []).forEach(it => {
      const prodName = (it.productName || '').trim();
      if (!prodName) return;
      const qty = Number(it.qty) || 0;
      const price = Number(it.unitPrice) || 0;
      const total = qty * price;

      const existing = session1Data.find(x => x.name === prodName && x.customer === custName && x.price === price);
      if (existing) {
        existing.qty += qty;
        existing.total += total;
      } else {
        session1Data.push({ name: prodName, customer: custName, qty, price, total, unit: it.unit || 'kg' });
      }
    });
  });
  session1Data.sort((a, b) => a.name.localeCompare(b.name));
  const session1Total = session1Data.reduce((sum, item) => sum + item.total, 0);

  const uniqueCustomersSet = new Set();
  session1Data.forEach(it => uniqueCustomersSet.add(it.customer));
  const uniqueCustomers = Array.from(uniqueCustomersSet).sort();

  const session1Pivot = [];
  session1Data.forEach(it => {
    let row = session1Pivot.find(r => r.name === it.name && r.price === it.price);
    if (!row) {
      row = { name: it.name, price: it.price, unit: it.unit, customerQty: {}, totalQty: 0, totalRowValue: 0 };
      session1Pivot.push(row);
    }

    row.customerQty[it.customer] = (row.customerQty[it.customer] || 0) + it.qty;
    row.totalQty += it.qty;
    row.totalRowValue += it.total;
  });

  const session2Map = new Map();
  (purchaseItems || []).forEach(it => {
    const key = it.isSubItem ? `${it.materialName}_sub_${it.parentName}` : it.materialName;
    if (!session2Map.has(key)) {
      session2Map.set(key, { ...it, totalCost: 0, qtyNota: 0, invoiceQty: 0, purchaseCount: 0 });
    }
    const agg = session2Map.get(key);
    agg.totalCost += Number(it.totalCost) || 0;
    agg.qtyNota += Number(it.qtyNota) || 0;
    agg.invoiceQty += Number(it.invoiceQty) || 0;
    agg.purchaseCount += 1;

    if (agg.qtyNota > 0) agg.pricePerUnit = agg.totalCost / agg.qtyNota;
  });

  const session2Data = Array.from(session2Map.values());

  const getAvgSellPrice = (name) => {
    const items = session1Data.filter(x => (x.name || '').toLowerCase() === (name || '').toLowerCase());
    if (items.length === 0) return 0;
    const totalQty = items.reduce((sum, x) => sum + x.qty, 0);
    const totalRev = items.reduce((sum, x) => sum + x.total, 0);
    return totalQty > 0 ? totalRev / totalQty : 0;
  };

  const supplierMap = {};
  const displayNamesForSup = {};
  (purchaseItems || []).forEach(it => {
    if (it.isParentItem && (it.materialName || '').toLowerCase().includes('mix vegetable')) return;

    const rawSup = (it.supplier || supplierName || 'Penyedia Barang').trim();
    const supKey = rawSup.toUpperCase();
    if (!supplierMap[supKey]) {
      supplierMap[supKey] = new Map();
      displayNamesForSup[supKey] = rawSup;
    }

    const matName = it.materialName || 'Tanpa Nama';
    const matMap = supplierMap[supKey];
    if (matMap.has(matName)) {
      const ex = matMap.get(matName);
      ex.qtyNota = (Number(ex.qtyNota) || 0) + (Number(it.qtyNota) || 0);
      ex.totalCost = (Number(ex.totalCost) || 0) + (Number(it.totalCost) || 0);
      ex.pricePerUnit = ex.qtyNota > 0 ? ex.totalCost / ex.qtyNota : ex.pricePerUnit;
    } else {
      matMap.set(matName, { ...it, totalCost: Number(it.totalCost) || 0, qtyNota: Number(it.qtyNota) || 0 });
    }
  });

  const supplierGroups = Object.keys(supplierMap).sort().map(key => {
    const aggItems = Array.from(supplierMap[key].values());
    return [displayNamesForSup[key], aggItems];
  });

  const avgHppMap = {};
  session2Data.forEach(it => {
    if (!it.isSubItem && !it.isParentItem) {
      avgHppMap[(it.materialName || '').toLowerCase()] = it.pricePerUnit || 0;
    } else if (it.isParentItem) {
      const subItems = session2Data.filter(sub => sub.isSubItem && sub.parentName === it.materialName);
      const subTotalCost = subItems.reduce((s, sub) => s + (Number(sub.totalCost) || 0), 0);
      const invQty = Number(it.invoiceQty) || Number(it.qtyNota) || 1;
      avgHppMap[(it.materialName || '').toLowerCase()] = subTotalCost / invQty;
    }
  });

  const session4Data = [];
  const uniqueCustomersSet4 = new Set();
  session1Data.forEach(it => uniqueCustomersSet4.add(it.customer));
  const uniqueCustomers4 = Array.from(uniqueCustomersSet4).sort();

  uniqueCustomers4.forEach(cust => {
    let revenue = 0;
    let hpp = 0;

    session1Data.filter(it => it.customer === cust).forEach(it => {
      revenue += it.total;
      const unitHpp = avgHppMap[(it.name || '').toLowerCase()] || 0;
      hpp += (it.qty * unitHpp);
    });

    session4Data.push({ customer: cust, revenue, hpp, profit: revenue - hpp });
  });

  const session4SumRev = session4Data.reduce((s, r) => s + r.revenue, 0);
  const session4SumHpp = session4Data.reduce((s, r) => s + r.hpp, 0);
  const session4SumProfit = session4Data.reduce((s, r) => s + r.profit, 0);

  let totalFromSuppliers = 0;
  supplierGroups.forEach(([s, items]) => {
    const discount = Number(supplierDiscounts[s]) || 0;
    const subtotal = items.reduce((sum, it) => {
      if (it.isParentItem && (it.materialName || '').toLowerCase().includes('mix vegetable')) return sum;
      return sum + (Number(it.totalCost) || 0);
    }, 0);
    totalFromSuppliers += Math.max(0, subtotal - discount);
  });
  const totalAdditionalCosts = Object.values(additionalCosts || {}).reduce((s, c) => s + (Number(c) || 0), 0);
  const grandTotalNet = totalFromSuppliers + totalAdditionalCosts;

  const groupProfit = session1Total - grandTotalNet;
  const groupMarginPct = session1Total > 0 ? (groupProfit / session1Total) * 100 : 0;

  const custColCount = uniqueCustomers.length;

  return {
    groupName,
    date,
    session1Data,
    session1Total,
    uniqueCustomers,
    session1Pivot,
    session2Data,
    getAvgSellPrice,
    supplierGroups,
    session4Data,
    session4SumRev,
    session4SumHpp,
    session4SumProfit,
    totalAdditionalCosts,
    grandTotalNet,
    groupProfit,
    groupMarginPct,
    custColCount
  };
}

export function chunkArray(arr, size) {
  if (!arr || !arr.length || size < 1) return [];
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
