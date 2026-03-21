import { Products, PriceCategories, Customers } from './storage';

export function runSindangjaya3Seeder() {
  const CUSTOMER_NAME = "SPPG SINDANGJAYA 3";
  const CAT_NAME = "SPPG SINDANGJAYA 3 (Khusus)";

  const existingCustomers = Customers.getAll();
  if (existingCustomers.some(c => c.name.toLowerCase() === CUSTOMER_NAME.toLowerCase())) {
    return; // Already run
  }

  const categories = PriceCategories.getAll();
  let catId = categories.find(c => c.name === CAT_NAME)?.id;
  if (!catId) {
    const newCat = PriceCategories.create({ name: CAT_NAME });
    catId = newCat.id;
  }

  Customers.create({
    name: CUSTOMER_NAME,
    company: "SPPG",
    phone: "",
    email: "",
    address: "Sindangjaya",
    priceCategoryId: catId
  });

  const SINDANGJAYA3_PRICES = [
    { "name": "bawang bombay", "price": 35000, "unit": "kg" },
    { "name": "bawang daun", "price": 11000, "unit": "kg" },
    { "name": "bawang merah kupas", "price": 50000, "unit": "kg" },
    { "name": "bawang putih kupas", "price": 37000, "unit": "kg" },
    { "name": "brokoli", "price": 18000, "unit": "kg" },
    { "name": "buncis", "price": 14000, "unit": "kg" },
    { "name": "caisim", "price": 12000, "unit": "kg" },
    { "name": "Daun Jeruk", "price": 50000, "unit": "kg" },
    { "name": "Edaname", "price": 20000, "unit": "kg" },
    { "name": "jagung manis", "price": 15000, "unit": "kg" },
    { "name": "jamur kuping", "price": 26000, "unit": "kg" },
    { "name": "Jagung muda tanpa topi", "price": 20000, "unit": "kg" },
    { "name": "jahe", "price": 32000, "unit": "kg" },
    { "name": "kacang panjang", "price": 13000, "unit": "kg" },
    { "name": "kacang polong", "price": 55000, "unit": "kg" },
    { "name": "kapri muda", "price": 44000, "unit": "kg" },
    { "name": "kembang kol", "price": 26000, "unit": "kg" },
    { "name": "kol", "price": 13000, "unit": "kg" },
    { "name": "kunyit", "price": 19000, "unit": "kg" },
    { "name": "lengkuas", "price": 17500, "unit": "kg" },
    { "name": "pakcoy", "price": 13000, "unit": "kg" },
    { "name": "baby pakcoy", "price": 14000, "unit": "kg" },
    { "name": "sawi putih", "price": 13000, "unit": "kg" },
    { "name": "selada keriting", "price": 18000, "unit": "kg" },
    { "name": "seledri", "price": 12000, "unit": "kg" },
    { "name": "sereh", "price": 17000, "unit": "kg" },
    { "name": "timun", "price": 12000, "unit": "kg" },
    { "name": "tomat", "price": 15000, "unit": "kg" },
    { "name": "wortel", "price": 18000, "unit": "kg" },
    { "name": "kayu manis", "price": 12000, "unit": "kg" },
    { "name": "mix vegetable", "price": 25000, "unit": "kg" },
    { "name": "regal", "price": 1000, "unit": "pcs" },
    { "name": "minyak goreng", "price": 360000, "unit": "jrigen" },
    { "name": "Spaghetti", "price": 24500, "unit": "kg" },
    { "name": "mie telur 640gr", "price": 12000, "unit": "640gr" },
    { "name": "mie telur 2kg", "price": 35500, "unit": "2kg" },
    { "name": "minyak wijen", "price": 50000, "unit": "botol" },
    { "name": "terigu", "price": 13000, "unit": "kg" },
    { "name": "tahu putih", "price": 500, "unit": "pcs" },
    { "name": "tahu coklat", "price": 500, "unit": "pcs" },
    { "name": "garam halus", "price": 80000, "unit": "40 bks" },
    { "name": "kecap inggris", "price": 42000, "unit": "botol" },
    { "name": "kecap manis 5.7kg", "price": 190000, "unit": "5.7kg" },
    { "name": "tepung panir", "price": 15500, "unit": "kg" },
    { "name": "maizena @maizenaku", "price": 23000, "unit": "kg" },
    { "name": "gula pasir", "price": 19000, "unit": "pack" },
    { "name": "kecap asin", "price": 25000, "unit": "botol" },
    { "name": "cuka", "price": 18000, "unit": "botol" },
    { "name": "tepung tapioka gunung agung", "price": 7000, "unit": "bag" },
    { "name": "Bumbu rasa ayam kokita", "price": 100000, "unit": "kg" },
    { "name": "merica", "price": 200000, "unit": "kg" },
    { "name": "palmia royal butter", "price": 12000, "unit": "pcs" },
    { "name": "saos tomat kokita 5.7kg", "price": 130000, "unit": "5.7kg" },
    { "name": "saos cabe kokita 5.7kg", "price": 160000, "unit": "5.7kg" },
    { "name": "saos teriyaki saori", "price": 65000, "unit": "botol" },
    { "name": "mayonaise", "price": 35000, "unit": "kg" },
    { "name": "sauce tiram saori", "price": 60000, "unit": "botol" },
    { "name": "plastix 90x120cm", "price": 12000, "unit": "pack" },
    { "name": "plastik uk 28", "price": 12000, "unit": "50 lbr" },
    { "name": "masker standar", "price": 40000, "unit": "pack" },
    { "name": "masker hijab", "price": 43000, "unit": "pack" },
    { "name": "handglove karet", "price": 80000, "unit": "pack" },
    { "name": "handglove", "price": 70000, "unit": "pack" },
    { "name": "hairnet", "price": 25000, "unit": "pack" },
    { "name": "sunlight", "price": 12000, "unit": "680ml" },
    { "name": "mamalemon", "price": 11000, "unit": "680ml" },
    { "name": "asam kandis", "price": 70000, "unit": "kg" },
    { "name": "pasta tomat", "price": 265000, "unit": "3.15kg" },
    { "name": "oregano", "price": 27000, "unit": "8gr" },
    { "name": "bay leaves", "price": 25000, "unit": "8gr" },
    { "name": "sauce tomat @delmonte", "price": 100000, "unit": "jrigen" },
    { "name": "sauce sambal @delmonte", "price": 120000, "unit": "jrigen" },
    { "name": "soda kue kupu-kupu", "price": 7000, "unit": "pcs" },
    { "name": "lemon", "price": 20000, "unit": "kg" },
    { "name": "biji wijen", "price": 50000, "unit": "kg" },
    { "name": "kecap manis @bango", "price": 190000, "unit": "btl" },
    { "name": "royco ayam @1kg", "price": 45000, "unit": "bag" },
    { "name": "royco sapi @1kg", "price": 45000, "unit": "bag" },
    { "name": "baby pakcoy baru", "price": 16000, "unit": "kg" },
    { "name": "kecap ikan", "price": 50000, "unit": "btl" },
    { "name": "terigu @segitiga", "price": 13000, "unit": "kg" },
    { "name": "Kurma", "price": 330000, "unit": "kg" },
    { "name": "Minyakita 2ltr/dus", "price": 234000, "unit": "Dus" },
    { "name": "dimsum", "price": 850, "unit": "pcs" },
    { "name": "bolen pisang", "price": 3000, "unit": "pcs" }
  ];

  const allProducts = Products.getAll();

  for (const item of SINDANGJAYA3_PRICES) {
    if (item.price === 0) continue;

    const existingProduct = allProducts.find(
      p => p.name.toLowerCase() === item.name.toLowerCase() || 
           (p.sku && p.sku.toLowerCase() === item.name.toLowerCase())
    );

    if (existingProduct) {
      const updatedCatPrices = { ...(existingProduct.categoryPrices || {}) };
      updatedCatPrices[catId] = item.price;
      Products.update(existingProduct.id, { categoryPrices: updatedCatPrices });
    } else {
      const newSku = item.name.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      Products.create({
        name: item.name,
        sku: newSku,
        category: 'Sayuran / Bahan Pokok', // default fallback
        purchaseCost: Math.floor(item.price * 0.8),
        sellPrice: item.price,
        stock: 0,
        unit: item.unit,
        categoryPrices: { [catId]: item.price }
      });
    }
  }
}
