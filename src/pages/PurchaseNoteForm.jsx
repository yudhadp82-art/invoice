import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiShoppingBag, FiInfo, FiUsers, FiFileText } from 'react-icons/fi';
import { PurchaseNotes, Products as MasterItems, Invoices, Suppliers, Customers } from '../utils/storage';
import { formatCurrency, formatNumberInput, parseNumberInput } from '../utils/formatter';
import Modal from '../components/Modal';
import PurchaseNoteReportPdf from '../components/PurchaseNoteReportPdf';
import SearchableSelect from '../components/SearchableSelect';

const emptyItem = {
  materialId: '',
  materialName: '',
  unit: '',
  supplier: '',
  isManuallyEdited: false,
  isSubItem: false,
  parentName: '',
  qtyNota: 0,
  invoiceQty: 0,
  invoicePrice: 0,
  pricePerUnit: 0,
  sellPrice: 0,
  purchaseCost: 0,
  salesRevenue: 0,
  profit: 0,
  marginPercent: 0,
  totalCost: 0
};

const MIX_VEG_INGREDIENTS = ['Wortel', 'Buncis', 'Jagung'];
const MIX_VEG_PARENT_ID = 'mix-vegetable-parent';
const MIX_VEG_NAME = '🥗 Mix Vegetable (Paket)';

function ensureMixVegetableInMaster(master = []) {
  const exists = master.some(
    (item) =>
      item.id === MIX_VEG_PARENT_ID ||
      String(item.name || '').trim().toLowerCase().includes('mix vegetable')
  );
  if (exists) return master;
  return [{ id: MIX_VEG_PARENT_ID, name: MIX_VEG_NAME, unit: 'kg', sellPrice: 0 }, ...master];
}

// Format angka: ribuan pakai titik, hilangkan ,00 desimal
function fmtNum(val) {
  const n = Number(val) || 0;
  if (n === 0) return '0';
  // Jika bilangan bulat, tampilkan tanpa desimal
  if (Number.isInteger(n)) {
    return n.toLocaleString('id-ID');
  }
  // Jika ada desimal, tampilkan max 2 digit tanpa trailing 0
  return n.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

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
  const [allCustomers, setAllCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
    window.addEventListener('app-data-mutation', handleDataMutation);
    return () => window.removeEventListener('app-data-mutation', handleDataMutation);
  }, [id]);

  function handleDataMutation() {
    // Refresh master bahan data when products change
    MasterItems.getAll().then(master => {
      setMasterBahan(ensureMixVegetableInMaster(master));
    });
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const master = await MasterItems.getAll();
      setMasterBahan(ensureMixVegetableInMaster(master));

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

          // Find master product
          let mb = null;
          if (newItem.materialId) {
            mb = master.find(m => m.id === newItem.materialId);
          }
          if (!mb && mName && master.length > 0) {
            mb = master.find(m => (m.name || '').toLowerCase() === mName);
          }

          if (mb) {
            // Set materialId if missing
            if (!newItem.materialId) {
              newItem.materialId = mb.id;
            }
            // Auto-fill sellPrice from master if not set or is 0
            if ((!newItem.sellPrice || newItem.sellPrice === 0) && mb.sellPrice && mb.sellPrice > 0) {
              newItem.sellPrice = Number(mb.sellPrice);
            }
          }

          // Calculate invoicePrice if missing (for old records)
          if ((!newItem.invoicePrice || newItem.invoicePrice === 0) && newItem.invoiceQty && newItem.salesRevenue) {
            newItem.invoicePrice = Number(newItem.salesRevenue) / Number(newItem.invoiceQty);
          }

          // If invoicePrice is 0 but sellPrice is available, use sellPrice as invoicePrice
          if ((!newItem.invoicePrice || newItem.invoicePrice === 0) && newItem.sellPrice && newItem.sellPrice > 0) {
            newItem.invoicePrice = Number(newItem.sellPrice);
          }

          // Recalculate salesRevenue if we have invoiceQty and invoicePrice
          const qty = Number(newItem.invoiceQty) || Number(newItem.qtyNota) || 0;
          const invPrice = Number(newItem.invoicePrice) || 0;
          if (qty > 0 && invPrice > 0) {
            newItem.salesRevenue = qty * invPrice;
          }

          newItem.isManuallyEdited = true;
          return newItem;
        });
        
        // AUTO-SUM: Re-aggregate to ensure parent Mix Veg reflects current sub-item sum
        setItems(aggregateItems(hydrated));
      } else {
        setItems(aggregateItems(actualItems));
      }

      const [invs, history, supps, allCusts] = await Promise.all([
        Invoices.getAll(),
        PurchaseNotes.getAll(),
        Suppliers.getAll(),
        Customers.getAll()
      ]);

      setInvoices(invs.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)));
      setAllSuppliers(supps);
      setAllCustomers(allCusts);
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

              const qty = Number(it.qty) || 0;
              // Prioritize unitPrice, fallback to subtotal/qty if unitPrice is 0
              let invPrice = Number(it.unitPrice) || 0;
              if (invPrice === 0 && it.subtotal && qty > 0) {
                invPrice = Number(it.subtotal) / qty;
              }
              const sellPrice = mb ? (Number(mb.sellPrice) || 0) : 0;

              console.log('LoadData import item:', {
                product: it.productName,
                unitPrice: it.unitPrice,
                subtotal: it.subtotal,
                qty: qty,
                calculatedInvPrice: invPrice,
                sellPrice: sellPrice
              });

              return {
                ...emptyItem,
                materialId: it.productId || (mb ? mb.id : ''),
                materialName: it.productName,
                unit: it.unit || (mb ? mb.unit : 'kg'),
                qtyNota: qty,
                invoiceQty: qty,
                invoicePrice: invPrice,
                pricePerUnit: 0,
                sellPrice: sellPrice,
                purchaseCost: 0,
                salesRevenue: qty * invPrice,
                profit: 0,
                marginPercent: 0,
                totalCost: 0
              };
            });
          const expanded = expandItems(materials, master);
          const aggregated = aggregateItems(expanded);
          if (aggregated.length > 0) {
            setItems(aggregated);
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
        // Mix Vegetable: Buat parent item dengan sub-items (jagung, wortel, buncis)
        const baseQty = Number(it.qtyNota) || 0;
        const basePrice = Number(it.pricePerUnit) || 0;
        const baseSellPrice = Number(it.sellPrice) || 0;
        const baseInvoiceQty = Number(it.invoiceQty) || 0;
        const baseInvoicePrice = Number(it.invoicePrice) || 0;

        // Tambahkan parent item "Mix Vegetable"
        const parentPurchaseCost = baseQty * basePrice;
        const parentSalesRevenue = baseInvoiceQty * baseInvoicePrice;
        const parentProfit = parentSalesRevenue - parentPurchaseCost;
        const parentMarginPercent = parentSalesRevenue > 0 ? (parentProfit / parentSalesRevenue) * 100 : 0;

        result.push({
          ...emptyItem,
          materialId: it.materialId || MIX_VEG_PARENT_ID,
          materialName: it.materialName || MIX_VEG_NAME,
          isSubItem: false,
          isParentItem: true,
          unit: 'kg',
          qtyNota: baseQty,
          invoiceQty: baseInvoiceQty,
          invoicePrice: baseInvoicePrice,
          pricePerUnit: basePrice,
          sellPrice: baseSellPrice,
          purchaseCost: parentPurchaseCost,
          salesRevenue: parentSalesRevenue,
          profit: parentProfit,
          marginPercent: parentMarginPercent,
          totalCost: parentPurchaseCost
        });

        // Sub-items: masing-masing punya harga beli sendiri, tapi Harga INV = 0
        MIX_VEG_INGREDIENTS.forEach(ingName => {
          const mb = master.find(b => b.name.toLowerCase() === ingName.toLowerCase());
          const q = Number((baseQty / 3).toFixed(2));

          result.push({
            ...emptyItem,
            materialId: mb ? mb.id : '',
            materialName: ingName,
            isSubItem: true,
            parentName: 'Mix Vegetable',
            unit: mb ? mb.unit : 'kg',
            qtyNota: q,
            invoiceQty: 0,      // Harga INV sub-item = 0
            invoicePrice: 0,    // Harga INV sub-item = 0
            pricePerUnit: 0,
            sellPrice: 0,
            purchaseCost: 0,
            salesRevenue: 0,    // Revenue ada di parent, bukan sub-item
            profit: 0,
            marginPercent: 0,
            totalCost: 0
          });
        });

        // Update parent totalCost = sum of sub-items (initially 0)
        const parentIdx = result.findIndex(r => r.materialId === 'mix-vegetable-parent');
        if (parentIdx !== -1) {
          result[parentIdx].totalCost = 0;
          result[parentIdx].purchaseCost = 0;
        }

      } else {
        result.push(it);
      }
    });
    return result;
  }

  // Gabungkan item dengan produk/bahan yang sama menjadi satu baris
  function aggregateItems(itemsList) {
    const map = new Map();
    const parentMap = new Map(); // Track parent items for Mix Vegetable

    itemsList.forEach(it => {
      // Skip sub-items (they will be aggregated under their parent)
      if (it.isSubItem) {
        const parentKey = it.parentName || 'Mix Vegetable';
        if (!parentMap.has(parentKey)) {
          parentMap.set(parentKey, {
            qtyNota: 0,
            invoiceQty: 0,
            totalCost: 0,
            purchaseCost: 0,
            salesRevenue: 0,
            profit: 0,
            invoicePrice: 0,
            subItems: []
          });
        }
        const parent = parentMap.get(parentKey);
        parent.qtyNota += Number(it.qtyNota) || 0;
        parent.invoiceQty += Number(it.invoiceQty) || 0;
        parent.totalCost += Number(it.totalCost) || 0;
        parent.purchaseCost += Number(it.purchaseCost) || 0;
        parent.salesRevenue += Number(it.salesRevenue) || 0;
        parent.profit += Number(it.profit) || 0;
        parent.invoicePrice = Number(it.invoicePrice) || 0;
        parent.subItems.push(it);
        return;
      }

      // Kunci pengelompokan: materialId jika ada, jika tidak pakai materialName
      const key = it.materialId || (it.materialName || '').toLowerCase().trim();
      if (!key) { map.set(`_empty_${map.size}`, { ...it }); return; }

      if (map.has(key)) {
        const ex = map.get(key);
        const addQty = Number(it.qtyNota) || 0;
        const addInvQty = Number(it.invoiceQty) || 0;
        const addCost = Number(it.totalCost) || 0;
        const addPurchaseCost = Number(it.purchaseCost) || 0;
        const addSalesRevenue = Number(it.salesRevenue) || 0;
        const addInvoicePrice = Number(it.invoicePrice) || 0;

        ex.qtyNota += addQty;
        ex.invoiceQty += addInvQty;
        ex.totalCost += addCost;
        ex.purchaseCost += addPurchaseCost;
        ex.salesRevenue += addSalesRevenue;

        // Keep the invoice price from the most recent item or average
        if (addInvoicePrice > 0) {
          ex.invoicePrice = addInvoicePrice;
        }

        // Harga rata-rata tertimbang
        ex.pricePerUnit = ex.qtyNota > 0 ? Number((ex.totalCost / ex.qtyNota).toFixed(2)) : 0;

        // Recalculate profit and margin
        ex.profit = ex.salesRevenue - ex.purchaseCost;
        ex.marginPercent = ex.salesRevenue > 0 ? (ex.profit / ex.salesRevenue) * 100 : 0;
      } else {
        // Calculate margin for new item
        const purchaseCost = Number(it.purchaseCost) || (Number(it.pricePerUnit || 0) * Number(it.qtyNota || 0));
        const salesRevenue = Number(it.salesRevenue) || (Number(it.invoiceQty || it.qtyNota || 0) * Number(it.invoicePrice || it.sellPrice || 0));
        const profit = salesRevenue - purchaseCost;
        const marginPercent = salesRevenue > 0 ? (profit / salesRevenue) * 100 : 0;

        map.set(key, {
          ...it,
          qtyNota: Number(it.qtyNota) || 0,
          invoiceQty: Number(it.invoiceQty) || 0,
          invoicePrice: Number(it.invoicePrice) || 0,
          totalCost: Number(it.totalCost) || 0,
          pricePerUnit: Number(it.pricePerUnit) || 0,
          sellPrice: Number(it.sellPrice) || 0,
          purchaseCost: purchaseCost,
          salesRevenue: salesRevenue,
          profit: profit,
          marginPercent: marginPercent
        });
      }
    });

    // Update Mix Vegetable parent with aggregated sub-items
    parentMap.forEach((parent, parentName) => {
      // Dapatkan parent dari map (dipenuhi dari expandItems atau edit user)
      let existingParent = null;
      let existingParentKey = 'mix-vegetable-parent';
      for (const [key, val] of map.entries()) {
        if (val.isParentItem && (val.materialName || '').toLowerCase().includes('mix vegetable')) {
          existingParent = val;
          existingParentKey = key;
          break;
        }
      }

      // invoiceQty parent BUKAN dari sub-items (karena 0), melainkan dari parent asli (atau dari input user)
      const invQty = existingParent ? Number(existingParent.invoiceQty) || Number(existingParent.qtyNota) || 0 : 0;
      const totalBeli = parent.totalCost; // Total beli hanya 100% dari akumulasi edit sub-items

      const profit = existingParent ? existingParent.salesRevenue - totalBeli : -totalBeli;
      const marginPercent = existingParent && existingParent.salesRevenue > 0 ? (profit / existingParent.salesRevenue) * 100 : 0;

      const parentItem = {
        ...(existingParent || emptyItem),
        materialId: existingParentKey,
        materialName: parentName,
        isParentItem: true,
        unit: 'kg',
        qtyNota: 0, // Kosongkan qty nota parent per request
        // invoiceQty bawaan existingParent tetap dipertahankan
        pricePerUnit: invQty > 0 ? Number((totalBeli / invQty).toFixed(2)) : 0,
        purchaseCost: totalBeli,
        totalCost: totalBeli,
        profit: profit,
        marginPercent: marginPercent
      };

      map.set(existingParentKey, parentItem);

      // Add sub-items (dan 0-kan sellPrice / Harga Jual)
      parent.subItems.forEach((subItem, idx) => {
        const subKey = `mix-veg-sub-${idx}`;
        map.set(subKey, { ...subItem, sellPrice: 0, invoicePrice: 0 });
      });
    });

    return Array.from(map.values());
  }

  async function handleImportSelectedInvoices(idsOverride = null) {
    const ids = Array.isArray(idsOverride) ? idsOverride : selectedInvoiceIds;
    if (ids.length === 0) return;
    
    const selectedInvs = invoices.filter(inv => ids.includes(inv.id));
    const newRawItems = [];
    
    selectedInvs.forEach(inv => {
      (inv.items || []).forEach(it => {
        const pName = (it.productName || '').toLowerCase();
        const mb = masterBahan.find(m => (m.name || '').toLowerCase() === pName);

        const qty = Number(it.qty) || 0;
        // Prioritize unitPrice, fallback to subtotal/qty if unitPrice is 0
        let invPrice = Number(it.unitPrice) || 0;
        if (invPrice === 0 && it.subtotal && qty > 0) {
          invPrice = Number(it.subtotal) / qty;
        }
        const sellPrice = mb ? (Number(mb.sellPrice) || 0) : 0;

        console.log('Import item:', {
          product: it.productName,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
          qty: qty,
          calculatedInvPrice: invPrice,
          sellPrice: sellPrice
        });

        newRawItems.push({
          ...emptyItem,
          materialId: it.productId || (mb ? mb.id : ''),
          materialName: it.productName,
          unit: it.unit || (mb ? mb.unit : 'kg'),
          qtyNota: qty,
          invoiceQty: qty,
          invoicePrice: invPrice,
          pricePerUnit: 0,
          sellPrice: sellPrice,
          purchaseCost: 0,
          salesRevenue: qty * invPrice,
          profit: 0,
          marginPercent: 0,
          totalCost: 0
        });
      });
    });

    // Expand (Mix Veg → individual ingredients), lalu gabungkan duplikat
    const expanded = expandItems(newRawItems, masterBahan);
    const aggregated = aggregateItems(expanded);
    
    if (aggregated.length > 0) {
      setItems(prev => {
        if (prev.length === 1 && !prev[0].materialId && !prev[0].materialName) {
          return aggregated;
        }
        // Gabungkan dengan item yang sudah ada di tabel
        return aggregateItems([...prev, ...aggregated]);
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
    setStatusMessage(`✅ Berhasil menarik ${aggregated.length} bahan dari ${selectedInvs.length} invoice (otomatis digabungkan).`);
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
    if (field === 'materialId' || field === 'qtyNota' || field === 'pricePerUnit' || field === 'totalCost') it.isManuallyEdited = true;

    if (field === 'materialId') {
      // Check if this is the virtual Mix Vegetable parent ID
      const isMixVegById = value === 'mix-vegetable-parent';
      
      if (isMixVegById) {
        // Set up the Mix Vegetable parent item directly
        it.materialId = 'mix-vegetable-parent';
        it.materialName = 'Mix Vegetable';
        it.unit = 'kg';
      } else {
        const m = masterBahan.find(b => b.id === value);
        if (m) {
          it.materialId = value;
          it.materialName = m.name;
          it.unit = m.unit;
          it.sellPrice = m.sellPrice || 0;
          const qty = Number(it.qtyNota) || 0;
          it.salesRevenue = (Number(it.invoiceQty) || 0) * (Number(it.invoicePrice) || 0);
          it.purchaseCost = Number(it.totalCost) || 0;
          it.profit = it.salesRevenue - it.purchaseCost;
          it.marginPercent = it.salesRevenue > 0 ? ((it.profit / it.salesRevenue) * 100) : 0;
        }
      }

      newItems[index] = it;

      // If Mix Vegetable selected (by ID or name), auto-expand to sub-items
      const isMixVeg = isMixVegById ||
                       (it.materialName || '').toLowerCase().includes('mix vegetable') ||
                       (it.materialName || '').toLowerCase().includes('mix veg');
      if (isMixVeg) {
        setItems(expandItems(newItems, masterBahan));
        return;
      }

      setItems(newItems);
      return;
    } else if (field === 'qtyNota') {
      it[field] = value;
      // Recalculate costs and margins
      const qty = Number(value) || 0;
      const pricePerUnit = Number(it.pricePerUnit) || 0;
      const sellPrice = Number(it.sellPrice) || 0;

      it.totalCost = qty * pricePerUnit;
      it.purchaseCost = it.totalCost;
      it.salesRevenue = (Number(it.invoiceQty) || Number(it.qtyNota) || 0) * (Number(it.invoicePrice) || 0);
      it.profit = it.salesRevenue - it.purchaseCost;
      it.marginPercent = it.salesRevenue > 0 ? ((it.profit / it.salesRevenue) * 100) : 0;
    } else if (field === 'totalCost') {
      // If totalCost is input, calculate pricePerUnit
      it.totalCost = Number(value) || 0;
      const qty = Number(it.qtyNota) || 0;
      if (qty > 0) {
        it.pricePerUnit = Number((it.totalCost / qty).toFixed(2));
      }
      // Recalculate margin
      const sellPrice = Number(it.sellPrice) || 0;
      it.purchaseCost = it.totalCost;
      it.salesRevenue = (Number(it.invoiceQty) || Number(it.qtyNota) || 0) * (Number(it.invoicePrice) || 0);
      it.profit = it.salesRevenue - it.purchaseCost;
      it.marginPercent = it.salesRevenue > 0 ? ((it.profit / it.salesRevenue) * 100) : 0;
    } else if (field === 'pricePerUnit') {
      // If pricePerUnit is input, calculate totalCost
      it[field] = value;
      const qty = Number(it.qtyNota) || 0;
      it.totalCost = qty * Number(value);
      it.purchaseCost = it.totalCost;

      // Recalculate margin
      it.salesRevenue = (Number(it.invoiceQty) || Number(it.qtyNota) || 0) * (Number(it.invoicePrice) || 0);
      it.profit = it.salesRevenue - it.purchaseCost;
      it.marginPercent = it.salesRevenue > 0 ? ((it.profit / it.salesRevenue) * 100) : 0;
    } else if (field === 'sellPrice') {
      it[field] = value;
      // Recalculate margin
      const qty = Number(it.qtyNota) || 0;
      const sellPrice = Number(value) || 0;
      it.salesRevenue = (Number(it.invoiceQty) || Number(it.qtyNota) || 0) * (Number(it.invoicePrice) || 0);
      it.purchaseCost = Number(it.totalCost) || 0;
      it.profit = it.salesRevenue - it.purchaseCost;
      it.marginPercent = it.salesRevenue > 0 ? ((it.profit / it.salesRevenue) * 100) : 0;
    } else if (field === 'invoiceQty') {
      // Total Jual = Qty Invoice × Harga Invoice per item
      it[field] = value;
      const invoiceQty = Number(value) || 0;
      const invoicePrice = Number(it.invoicePrice) || 0;
      it.salesRevenue = invoiceQty * invoicePrice;
      it.purchaseCost = Number(it.totalCost) || 0;
      it.profit = it.salesRevenue - it.purchaseCost;
      it.marginPercent = it.salesRevenue > 0 ? ((it.profit / it.salesRevenue) * 100) : 0;
    } else if (field === 'invoicePrice') {
      // Total Jual = Qty Invoice × Harga Invoice per item
      it[field] = value;
      const invoiceQty = Number(it.invoiceQty) || 0;
      const invoicePrice = Number(value) || 0;
      it.salesRevenue = invoiceQty * invoicePrice;
      it.purchaseCost = Number(it.totalCost) || 0;
      it.profit = it.salesRevenue - it.purchaseCost;
      it.marginPercent = it.salesRevenue > 0 ? ((it.profit / it.salesRevenue) * 100) : 0;
    } else {
      it[field] = value;
    }

    newItems[index] = it;

    // RULE 1: If this is a Mix Vegetable sub-item, force 0 revenue/profit (shared with parent)
    if (it.isSubItem && (it.parentName || '').toLowerCase().includes('mix vegetable')) {
      newItems[index] = {
        ...it,
        invoicePrice: 0,
        invoiceQty: 0,
        salesRevenue: 0,
        profit: 0,
        marginPercent: 0
      };
      
      // AUTO-SUM: Update Parent Mix Vegetable row
      const parentIdx = newItems.findIndex(x => 
        x.isParentItem && (x.materialName || '').toLowerCase().includes('mix vegetable')
      );
      if (parentIdx !== -1) {
        const parent = newItems[parentIdx];
        const subItems = newItems.filter(i => i.isSubItem && i.parentName === parent.materialName);
        const subTotal = subItems.reduce((sum, i) => sum + (Number(i.totalCost) || 0), 0);
        const subQtyNota = subItems.reduce((sum, i) => sum + (Number(i.qtyNota) || 0), 0);
        const invQty = Number(parent.invoiceQty) || Number(parent.qtyNota) || 0;
        
        newItems[parentIdx] = {
          ...parent,
          qtyNota: 0, // Kosongkan qty nota parent per request
          totalCost: subTotal,
          purchaseCost: subTotal,
          pricePerUnit: invQty > 0 ? Number((subTotal / invQty).toFixed(2)) : 0,
          profit: (Number(parent.salesRevenue) || 0) - subTotal,
          marginPercent: (Number(parent.salesRevenue) || 0) > 0
            ? (((Number(parent.salesRevenue) || 0) - subTotal) / (Number(parent.salesRevenue) || 0)) * 100
            : 0
        };
      }
    }

    // RULE 2: If parent invoiceQty changes, update pricePerUnit (Total Beli / Qty Inv)
    if (it.isParentItem && (it.materialName || '').toLowerCase().includes('mix vegetable') && field === 'invoiceQty') {
      const subItems = newItems.filter(i => i.isSubItem && i.parentName === it.materialName);
      const subTotal = subItems.reduce((sum, i) => sum + (Number(i.totalCost) || 0), 0);
      const invQty = Number(value) || 0;
      
      it.qtyNota = 0; // Kosongkan
      it.pricePerUnit = invQty > 0 ? Number((subTotal / invQty).toFixed(2)) : 0;
      it.totalCost = subTotal;
      newItems[index] = it;
    }

    setItems(newItems);
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      // Save all items including sub-items (jagung, wortel, buncis) to preserve their supplier data
      const itemsToSave = items;

      // Grand total based on parent and regular items only (sub-items would double-count)
      const grandTotal = items.filter(it => !it.isSubItem).reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);
      const totalDiscount = Object.values(supplierDiscounts).reduce((s, d) => s + (Number(d) || 0), 0);
      const totalAdditionalCosts = Object.values(additionalCosts).reduce((s, c) => s + (Number(c) || 0), 0);
      const finalTotal = Math.max(0, grandTotal - totalDiscount) + totalAdditionalCosts;

      const payload = {
        date, supplierName, items: itemsToSave, notes, grandTotal,
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
                const oldNet = Number(oldIt.qtyNota) || 0;
                await MasterItems.update(m.id, { stock: (Number(m.stock) || 0) - oldNet });
              }
            }
          }
        }
        await PurchaseNotes.update(id, payload);
      } else {
        await PurchaseNotes.create(payload);
      }

      // Update stock for all items (including Mix Vegetable ingredients)
      for (const it of items) {
        if (it.isSubItem && it.materialId) {
          // Update stock for individual ingredients (jagung, wortel, buncis)
          const m = await MasterItems.getById(it.materialId);
          if (m) {
            const net = Number(it.qtyNota) || 0;
            await MasterItems.update(m.id, { stock: (Number(m.stock) || 0) + net });
          }
        } else if (!it.isParentItem && it.materialId) {
          // Update stock for regular items (not Mix Vegetable parent)
          const m = await MasterItems.getById(it.materialId);
          if (m) {
            const net = Number(it.qtyNota) || 0;
            await MasterItems.update(m.id, { stock: (Number(m.stock) || 0) + net });
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
      const sellPrice = mb ? (Number(mb.sellPrice) || 0) : 0;
      return {
        ...emptyItem,
        materialId: mb?.id || '',
        materialName: r.name,
        unit: r.unit || mb?.unit || 'kg',
        qtyNota: r.totalQty,
        invoiceQty: r.totalQty,
        invoicePrice: 0,
        pricePerUnit: 0,
        sellPrice: sellPrice,
        purchaseCost: 0,
        salesRevenue: 0,
        profit: 0,
        marginPercent: 0,
        totalCost: 0
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
          <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}><FiShoppingBag /> Tarik Invoice</button>
          {Object.keys(groupRecapData).length > 0 && <button className="btn btn-secondary" onClick={() => setIsGroupImportModalOpen(true)}><FiUsers /> Rekap Grup</button>}
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

            <div className="card overflow-x p-0">
              <table className="table table-compact" style={{ minWidth: 1200 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>No</th>
                    <th style={{ minWidth: 200 }}>Bahan Baku</th>
                    <th className="text-center" style={{ width: 90 }}>Qty Inv</th>
                    <th style={{ width: 100 }}>Qty Nota</th>
                    <th style={{ width: 120 }}>Harga Beli</th>
                    <th style={{ width: 120 }}>Total Beli</th>
                    <th style={{ width: 120 }}>Harga Jual</th>
                    <th style={{ width: 120 }}>Harga Inv</th>
                    <th style={{ width: 120 }}>Total Jual</th>
                    <th style={{ width: 120 }}>Laba</th>
                    <th style={{ width: 100 }}>Margin %</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const isMixVegParent = (item.materialName || '').toLowerCase().includes('mix vegetable') && item.isParentItem;
                    const isSubItem = item.isSubItem;
                    const isMixVegChild = isSubItem && (item.parentName || '').toLowerCase().includes('mix vegetable');

                    // Calculate values
                    const totalBeli = Number(item.totalCost) || 0;
                    // Total Jual = Qty Invoice × Harga Invoice per item
                    const totalJual = Number(item.salesRevenue) || 0;
                    const laba = totalJual - totalBeli;
                    const marginPercent = totalJual > 0 ? (laba / totalJual) * 100 : 0;

                    return (
                      <tr key={idx} style={{
                        background: isMixVegParent ? 'rgba(139, 92, 246, 0.08)' : isMixVegChild ? 'rgba(139, 92, 246, 0.04)' : 'transparent',
                        fontWeight: isMixVegParent ? 700 : isSubItem ? 400 : 'normal'
                      }}>
                        <td className="text-center text-muted font-xs">
                          {isSubItem ? (
                            <span style={{ color: '#8b5cf6', marginLeft: 16 }}>↳</span>
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td style={{
                          paddingLeft: isSubItem ? '32px' : '8px'
                        }}>
                          <div className="flex flex-col gap-xs">
                            {!isSubItem ? (
                              <>
                                <SearchableSelect
                                  options={masterBahan.map(m => ({ id: m.id, name: m.name }))}
                                  value={item.materialId}
                                  onChange={val => updateItem(idx, 'materialId', val)}
                                  placeholder="Pilih/Cari Bahan..."
                                  required
                                />
                                <input className="form-input font-xs opacity-80" list="sups" value={item.supplier} onChange={e => updateItem(idx, 'supplier', e.target.value)} placeholder="Supplier (Opsional)" />
                              </>
                            ) : (
                              <div className="flex flex-col gap-xs">
                                <div style={{
                                  color: '#8b5cf6',
                                  fontWeight: 600,
                                  fontSize: '13px'
                                }}>
                                  {item.materialName}
                                </div>
                                <input
                                  className="form-input font-xs opacity-80"
                                  list="sups"
                                  value={item.supplier || ''}
                                  onChange={e => updateItem(idx, 'supplier', e.target.value)}
                                  placeholder="Supplier sub-item..."
                                  style={{ fontSize: '11px', padding: '3px 8px', height: 'auto' }}
                                />
                              </div>
                            )}
                            {isMixVegParent && (
                              <div className="text-xs" style={{ color: '#8b5cf6', fontWeight: 600 }}>
                                {item.materialName || MIX_VEG_NAME} (Jagung + Wortel + Buncis)
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input form-input-sm text-center font-bold text-info"
                            style={{ fontSize: '0.85rem' }}
                            value={formatNumberInput(item.invoiceQty)}
                            onChange={e => updateItem(idx, 'invoiceQty', parseNumberInput(e.target.value))}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input type="text" className="form-input form-input-sm text-center" value={formatNumberInput(item.qtyNota)} onChange={e => updateItem(idx, 'qtyNota', parseNumberInput(e.target.value))} />
                        </td>
                        <td>
                          <input type="text" className="form-input form-input-sm" value={formatNumberInput(item.pricePerUnit)} onChange={e => updateItem(idx, 'pricePerUnit', parseNumberInput(e.target.value))} placeholder="Harga Beli" />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input form-input-sm text-right"
                            style={{
                              color: '#f97316',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              minWidth: '100px'
                            }}
                            value={formatNumberInput(item.totalCost)}
                            onChange={e => updateItem(idx, 'totalCost', parseNumberInput(e.target.value))}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input type="text" className="form-input form-input-sm" value={formatNumberInput(item.sellPrice)} onChange={e => updateItem(idx, 'sellPrice', parseNumberInput(e.target.value))} placeholder="Harga Jual" />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input form-input-sm text-center font-bold"
                            style={{ color: '#3b82f6', fontSize: '13px' }}
                            value={formatNumberInput(item.invoicePrice)}
                            onChange={e => updateItem(idx, 'invoicePrice', parseNumberInput(e.target.value))}
                            placeholder="Harga Invoice"
                            title="Harga satuan dari invoice"
                          />
                        </td>
                        <td className="text-right font-bold" style={{ color: '#3b82f6', fontSize: '13px' }}>
                          {formatCurrency(totalJual)}
                        </td>
                        <td className="text-right font-bold" style={{
                          color: laba >= 0 ? '#10b981' : '#ef4444',
                          fontSize: '13px'
                        }}>
                          {formatCurrency(laba)}
                        </td>
                        <td className="text-center">
                          <span className={`badge ${marginPercent >= 20 ? 'badge-success' : marginPercent >= 10 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '11px' }}>
                            {marginPercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-center">
                          <button type="button" className="btn btn-ghost btn-sm text-danger p-1" onClick={() => removeItem(idx)}><FiTrash2 /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="p-md border-top"><button type="button" className="btn btn-ghost btn-sm" onClick={addItem}><FiPlus /> Tambah Item</button></div>
            </div>

            {/* Rekap Per Supplier */}
            <div className="card p-md">
              <div className="flex-between items-center mb-md">
                <h3 className="m-0 text-sm font-bold uppercase tracking-wider opacity-70">📋 Rekap Pembelian Per Supplier</h3>
              </div>

              {Array.from(new Set(items.map(it => it.supplier || supplierName))).filter(Boolean).length === 0 ? (
                <div className="text-center text-muted py-lg">
                  <em>Belum ada item ditambahkan</em>
                </div>
              ) : (
                <div className="grid grid-2 gap-lg">
                  {Array.from(new Set(items.map(it => it.supplier || (it.isSubItem ? null : supplierName)).filter(Boolean))).map(supplier => {
                    const displaySup = supplier === 'H. Falah' ? 'Falahudin' : supplier;
                    // Include both parent/regular items AND sub-items that have this supplier
                    const supplierItems = items.filter(it => {
                      const itSupplier = it.supplier || (it.isSubItem ? null : supplierName);
                      return itSupplier === supplier && !it.isParentItem;
                    });
                    const supplierTotal = supplierItems.reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);
                    const disc = Number(supplierDiscounts[supplier]) || 0;
                    const finalTotal = supplierTotal - disc;

                    return (
                      <div key={supplier} className="border rounded-lg p-md" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                        <div className="flex-between items-center mb-sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                          <strong style={{ color: 'var(--accent-primary)', fontSize: '14px' }}>{displaySup}</strong>
                          <span className="font-bold" style={{ color: 'var(--accent-success)', fontSize: '15px' }}>{formatCurrency(finalTotal)}</span>
                        </div>

                        <div className="flex flex-col gap-xs">
                          {supplierItems.length === 0 ? (
                            <em className="text-xs opacity-30">Tidak ada item</em>
                          ) : (
                            supplierItems.map((it, idx) => (
                              <div key={idx} className="flex-between text-xs" style={{ gap: 12, paddingLeft: it.isSubItem ? 12 : 0, borderLeft: it.isSubItem ? '2px solid rgba(139,92,246,0.3)' : 'none' }}>
                                <span className="flex-1" style={{ opacity: 0.8 }}>
                                  {it.isSubItem && <span style={{ color: '#8b5cf6', marginRight: 4 }}>↳</span>}
                                  {it.materialName || 'Tanpa Nama'}
                                </span>
                                <span style={{ opacity: 0.6, minWidth: '50px', textAlign: 'right' }}>
                                  {fmtNum(it.qtyNota)} {it.unit}
                                </span>
                                <span className="font-medium whitespace-nowrap" style={{ minWidth: '80px', textAlign: 'right', color: 'var(--accent-warning)' }}>
                                  {formatCurrency(it.totalCost)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>

                        {disc > 0 && (
                          <div className="flex-between text-xs text-danger mt-sm pt-sm" style={{ borderTop: '1px dashed rgba(239,68,68,0.3)' }}>
                            <span>Diskon</span>
                            <span>-{formatCurrency(disc)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* Panel Ringkasan Modern */}
            <div className="card p-0 overflow-hidden border-primary-pale shadow-glow-sm animate-in" style={{ background: 'var(--bg-card)' }}>
              <div className="grid grid-3 gap-0" style={{ minHeight: 140 }}>
                {/* Kolom 1: Per-Supplier Totals */}
                <div className="p-xl border-right" style={{ borderRight: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                  <div className="text-xxs opacity-50 uppercase tracking-widest mb-lg">Rincian Per Supplier</div>
                  <div className="flex flex-col gap-md">
                    {Array.from(new Set(items.map(it => it.supplier || (it.isSubItem ? null : supplierName)).filter(Boolean))).map(s => {
                      const displaySup = s === 'H. Falah' ? 'Falahudin' : s;
                      const subtotal = items
                        .filter(it => {
                          const itSup = it.supplier || (it.isSubItem ? null : supplierName);
                          return itSup === s && !it.isParentItem;
                        })
                        .reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0);
                      const disc = Number(supplierDiscounts[s]) || 0;
                      return (
                        <div key={s} className="flex-between text-sm" style={{ gap: 24, marginBottom: 4 }}>
                          <span className="opacity-80 truncate" title={displaySup}>{displaySup}</span>
                          <span className="font-bold whitespace-nowrap">{formatCurrency(subtotal - disc)}</span>
                        </div>
                      );
                    })}
                    {Array.from(new Set(items.map(it => it.supplier || supplierName))).filter(Boolean).length === 0 && (
                      <em className="text-xs opacity-30 text-center block py-md">Belum ada item ditambahkan</em>
                    )}
                  </div>
                </div>

                {/* Kolom 2: Breakdown Biaya */}
                <div className="p-xl flex flex-col justify-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="text-xxs opacity-50 uppercase tracking-widest mb-lg">Breakdown Biaya</div>
                  <div className="flex flex-col gap-sm">
                    <div className="flex-between text-xs"><span>Subtotal Produk</span><span className="font-medium text-sm">{formatCurrency(totalItemCost)}</span></div>
                    <div className="flex-between text-xs text-danger"><span>Total Diskon</span><span className="font-medium text-sm">-{formatCurrency(totalDiscount)}</span></div>
                    <div className="flex-between text-xs text-info"><span>Biaya Tambahan</span><span className="font-medium text-sm">+{formatCurrency(totalAdditionalCosts)}</span></div>
                  </div>
                  <hr className="opacity-5 my-md" />
                  <div className="grid grid-3 gap-md">
                    {['labor', 'shipping', 'productionMaterial'].map(f => (
                      <div key={f} className="flex flex-col">
                        <label className="text-xxs opacity-40 capitalize mb-xs">{f === 'labor' ? 'Tenaga' : f === 'shipping' ? 'Ongkir' : 'Lain'}</label>
                        <input 
                          type="text" 
                          className="form-input form-input-sm text-center font-sm" 
                          style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 4px', height: 40 }}
                          value={formatNumberInput(additionalCosts[f])} 
                          onChange={e => setAdditionalCosts({...additionalCosts, [f]: parseNumberInput(e.target.value)})} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kolom 3: Grand Total */}
                <div className="p-xl flex flex-col justify-center items-center text-center" style={{ 
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(6,182,212,0.12) 100%)',
                  borderLeft: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div className="text-xxs opacity-60 uppercase tracking-widest mb-sm">Total Tagihan Keseluruhan</div>
                  <div className="text-3xl font-black text-primary" style={{ fontSize: '2.4rem', letterSpacing: '-0.02em' }}>
                    {formatCurrency(grandTotalValue)}
                  </div>
                  <div className="mt-md">
                     <button type="button" onClick={handleSave} className="btn btn-primary w-full shadow-glow" disabled={saving || loading}>
                       <FiSave /> {saving ? 'Menyimpan...' : 'Simpan & Selesaikan'}
                     </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Input Diskon Tersembunyi (Akses Per Supplier) */}
            <div className="card p-md border-dashed opacity-80 hover-opacity-100 transition-normal">
              <div className="text-xs font-bold uppercase tracking-wider mb-sm flex items-center gap-sm">
                <FiInfo className="text-warning" /> Input Diskon per Supplier
              </div>
              <div className="grid grid-3 gap-md">
                {Array.from(new Set(items.map(it => it.supplier || (it.isSubItem ? null : supplierName)).filter(Boolean))).map(s => {
                  const displaySup = s === 'H. Falah' ? 'Falahudin' : s;
                  return (
                    <div key={s} className="flex items-center gap-md p-md bg-glass rounded-lg border border-white-05">
                      <span className="text-xs font-semibold flex-1 truncate" title={displaySup}>{displaySup}</span>
                      <input 
                        type="text" 
                        className="form-input form-input-sm text-center" 
                        style={{ width: 120, fontSize: 13, height: 36 }} 
                        placeholder="Rp 0"
                        value={formatNumberInput(supplierDiscounts[s] || 0)} 
                        onChange={e => setSupplierDiscounts({...supplierDiscounts, [s]: parseNumberInput(e.target.value)})} 
                      />
                    </div>
                  );
                })}
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
