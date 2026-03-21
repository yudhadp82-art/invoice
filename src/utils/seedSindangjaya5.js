import { Products, PriceCategories, Customers } from './storage';

export async function runSindangjaya5Seeder() {
  const CUSTOMER_NAME = "SPPG SINDANGJAYA 5";
  const CAT_NAME = "SPPG SINDANGJAYA 5 (Khusus)";

  const existingCustomers = await Customers.getAll();
  if (existingCustomers.some(c => c.name.toLowerCase() === CUSTOMER_NAME.toLowerCase())) {
    console.log(`${CUSTOMER_NAME} seeder already run.`);
    return; // Already run
  }

  const categories = await PriceCategories.getAll();
  let catId = categories.find(c => c.name === CAT_NAME)?.id;
  if (!catId) {
    const newCat = await PriceCategories.create({ name: CAT_NAME });
    catId = newCat.id;
  }

  await Customers.create({
    name: CUSTOMER_NAME,
    company: "SPPG",
    phone: "",
    email: "",
    address: "Sindangjaya 5",
    priceCategoryId: catId
  });

  const SINDANGJAYA5_PRICES = [
    { name: "asem jawa", price: 75000, unit: "kg" },
    { name: "bombay", price: 40000, unit: "kg" },
    { name: "daun bawang", price: 12000, unit: "kg" },
    { name: "bawang merah", price: 40000, unit: "kg" },
    { name: "bawang putih", price: 37000, unit: "kg" },
    { name: "bayam", price: 7000, unit: "kg" },
    { name: "brokoli", price: 17000, unit: "kg" },
    { name: "buncis", price: 20000, unit: "kg" },
    { name: "bunga lawang", price: 0, unit: "kg" },
    { name: "caisim", price: 11000, unit: "kg" },
    { name: "Daun Jeruk", price: 70000, unit: "kg" },
    { name: "daun salam", price: 40000, unit: "ikat" },
    { name: "daun kari", price: 142857, unit: "kg" },
    { name: "daun ketumbar", price: 15000, unit: "kg" },
    { name: "jagung pipil", price: 20000, unit: "kg" },
    { name: "jamur kuping", price: 30000, unit: "kg" },
    { name: "Jagung muda", price: 32000, unit: "kg" },
    { name: "jinten", price: 120000, unit: "kg" },
    { name: "kacang polong", price: 50000, unit: "kg" },
    { name: "kapolaga", price: 175000, unit: "kg" },
    { name: "kapri muda", price: 50000, unit: "kg" },
    { name: "kemiri", price: 60000, unit: "kg" },
    { name: "kemangi", price: 35000, unit: "ikat" },
    { name: "kembang kol", price: 31000, unit: "kg" },
    { name: "kol putih", price: 12000, unit: "kg" },
    { name: "kunyit", price: 17000, unit: "kg" },
    { name: "labu siam", price: 8000, unit: "kg" },
    { name: "lengkuas", price: 25000, unit: "kg" },
    { name: "nanas", price: 30000, unit: "pcs" },
    { name: "pakcoy", price: 15000, unit: "kg" },
    { name: "selada", price: 18000, unit: "kg" },
    { name: "sereh", price: 16000, unit: "kg" },
    { name: "seledri", price: 25000, unit: "kg" },
    { name: "timun", price: 12000, unit: "kg" },
    { name: "tomat", price: 15000, unit: "kg" },
    { name: "wortel", price: 9000, unit: "kg" },
    { name: "Regal", price: 1000, unit: "pcs" },
    { name: "Susu kotak ultra 125ml", price: 3125, unit: "pcs" },
    { name: "susu kotak ultra 115ml", price: 2500, unit: "pcs" },
    { name: "mix vegetable", price: 25000, unit: "kg" },
    { name: "sania 18ltr", price: 360500, unit: "jrigen" },
    { name: "tahu coklat", price: 500, unit: "pcs" },
    { name: "telur", price: 30000, unit: "kg" },
    { name: "cabe merah besar", price: 95000, unit: "kg" },
    { name: "cabe kering", price: 95000, unit: "kg" },
    { name: "paprika merah", price: 75000, unit: "kg" },
    { name: "jamur campignon", price: 60000, unit: "kg" },
    { name: "ketumbar", price: 60000, unit: "kg" },
    { name: "nangka muda", price: 15000, unit: "kg" },
    { name: "jamur merang", price: 0, unit: "kg" },
    { name: "kacang koro", price: 0, unit: "kg" },
    { name: "biscuit gandum", price: 1850, unit: "pcs" },
    { name: "tahu putih", price: 500, unit: "pcs" },
    { name: "jamu champignon kaleng", price: 20000, unit: "kaleng" },
    { name: "kacang tanah", price: 31000, unit: "kg" },
    { name: "letuce", price: 14000, unit: "kg" },
    { name: "daun pandan", price: 15000, unit: "kg" },
    { name: "biji pala", price: 250000, unit: "kg" },
    { name: "bawang merah iris", price: 55000, unit: "kg" },
    { name: "daun kunyit", price: 15000, unit: "kg" },
    { name: "jahe", price: 40000, unit: "kg" },
    { name: "tahu rasa", price: 500, unit: "pcs" },
    { name: "kacang tolo", price: 30000, unit: "kg" },
    { name: "saos sambal", price: 150000, unit: "jrigen" },
    { name: "saos tomat", price: 120000, unit: "jrigen" },
    { name: "bawang putih iris", price: 42000, unit: "kg" },
    { name: "kecap manis", price: 190000, unit: "jrigen" },
    { name: "kaldu ayam", price: 100000, unit: "bag" },
    { name: "abon sapi 30gr", price: 135000, unit: "pcs" },
    { name: "zukini", price: 30000, unit: "kg" },
    { name: "keju Slice", price: 1100, unit: "slice" },
    { name: "tempe", price: 11000, unit: "kotak" },
    { name: "paprika hijau", price: 75000, unit: "kg" },
    { name: "kunyit giling", price: 28000, unit: "kg" },
    { name: "bunga telang", price: 75000, unit: "kg" },
    { name: "daun kare", price: 0, unit: "kg" },
    { name: "Puding Nutrijell Pandan", price: 9000, unit: "pcs" },
    { name: "Agar-agar Wallet", price: 60000, unit: "dus" },
    { name: "oregano", price: 450000, unit: "kg" },
    { name: "kunyit bubuk", price: 50000, unit: "kg" },
    { name: "singkong mentega", price: 15000, unit: "kg" },
  ];

  const allProducts = await Products.getAll();

  for (const item of SINDANGJAYA5_PRICES) {
    if (item.price === 0) continue;

    const existingProduct = allProducts.find(
      p => p.name.toLowerCase() === item.name.toLowerCase() || 
           (p.sku && p.sku.toLowerCase() === item.name.toLowerCase())
    );

    if (existingProduct) {
      const updatedCatPrices = { ...(existingProduct.categoryPrices || {}) };
      updatedCatPrices[catId] = item.price;
      await Products.update(existingProduct.id, { categoryPrices: updatedCatPrices });
    } else {
      const newSku = item.name.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      await Products.create({
        name: item.name,
        sku: newSku,
        category: 'Sayuran / Bahan Pokok', // default fallback
        purchaseCost: Math.floor(item.price * 0.8),
        sellPrice: item.price,
        stock: 0,
        unit: item.unit || 'kg',
        categoryPrices: { [catId]: item.price }
      });
    }
  }

  console.log(`${CUSTOMER_NAME} seeder finished.`);
}
