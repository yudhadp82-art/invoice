const BOT_TOKEN = '8671171673:AAGqI3BacRQEeKm1YrVdhmqTKtiBA6S-B84';
const BASE_URL = `/tgapi/bot${BOT_TOKEN}`;

export async function checkBotStatus() {
  try {
    const res = await fetch(`${BASE_URL}/getMe`);
    const data = await res.json();
    return data.ok ? data.result : null;
  } catch (err) {
    console.error('Failed to check bot status:', err);
    return null;
  }
}

export async function fetchUpdates(offset = 0) {
  try {
    const res = await fetch(`${BASE_URL}/getUpdates?offset=${offset}&timeout=10`);
    const data = await res.json();
    if (data.ok) return data.result;
    return [];
  } catch (err) {
    console.error('Failed to fetch Telegram updates:', err);
    return [];
  }
}

export async function sendMessage(chatId, text) {
  try {
    const res = await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    return { ok: false };
  }
}

const UNIT_PATTERN = /^(kg|gr|g|ons|pack|ikat|bks|bungkus|dus|bal|karung|buah|liter|lt|pcs|lusin|jrg|jrigen|jerigen|dirigen|botol|btl|kaleng|bag|kotak|slice|lbr|lembar|renteng|sisir|tandan|slop|karton|tray|biji)$/i;

/**
 * Parse Telegram order message.
 * Baris 1: kode/nama customer (boleh campur teks+angka, e.g. "SPPG sindangjaya 5")
 *   → Token non-angka = keyword customer
 * Baris 2+: "- namaBarang qa[unit]"  atau "namaBarang qty [unit]"
 */
export function parseOrderMessage(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 1) return null;

  const customerRaw = lines[0];

  // Detect SPPG number from line 1 — ambil angka terakhir di baris 1
  // Contoh: "PO SPPG SINDANGJAYA5" -> 5, "SPPG sindangjaya 3" -> 3
  const allNums = [...customerRaw.matchAll(/\d+/g)];
  const sppgNumber = allNums.length > 0 ? parseInt(allNums[allNums.length - 1][0], 10) : null;

  // Extract keyword tokens — all words that are not pure numbers
  // Also strip trailing digits from words (e.g., "SINDANGJAYA5" -> "sindangjaya")
  const customerKeywords = customerRaw
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => w.replace(/\d+$/, '').toLowerCase())
    .filter(w => w.length > 0 && isNaN(w));

  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Remove leading dash/bullet if any
    let clean = line.replace(/^[-*•]\s*/, '').trim();
    // Replace colon or equals with space (e.g., "Saos Tomat : 3jrg" -> "Saos Tomat   3jrg")
    clean = clean.replace(/\s*[:=]\s*/, ' ');
    if (!clean) continue;

    // Split by whitespace
    const parts = clean.split(/\s+/);
    if (parts.length < 2) continue;

    // The last token may be unit, second-to-last may be qty, or qty glued with unit ("5kg")
    let unit = 'kg';
    let qty = 0;
    let productParts = [];

    // Check if last part is a pure unit
    if (parts.length >= 2 && UNIT_PATTERN.test(parts[parts.length - 1])) {
      unit = parts[parts.length - 1].toLowerCase();
      const qtyStr = parts[parts.length - 2];
      qty = parseFloat(qtyStr.replace(',', '.'));
      productParts = parts.slice(0, parts.length - 2);
    } else {
      // Last part might be "5kg" or just "5"
      const lastPart = parts[parts.length - 1];
      const gluedMatch = lastPart.match(/^(\d+(?:[.,]\d+)?)(kg|gr|g|ons|pack|ikat|bks|bungkus|dus|bal|karung|buah|liter|lt|pcs|lusin|jrg|jrigen|jerigen|dirigen|botol|btl|kaleng|bag|kotak|slice|lbr|lembar|renteng|sisir|tandan|slop|karton|tray|biji)?$/i);
      if (gluedMatch) {
        qty = parseFloat(gluedMatch[1].replace(',', '.'));
        unit = gluedMatch[2] ? gluedMatch[2].toLowerCase() : 'kg';
        productParts = parts.slice(0, parts.length - 1);
      } else {
        // No number found, skip
        continue;
      }
    }

    if (!qty || productParts.length === 0) continue;

    items.push({
      productName: productParts.join(' '),
      qty,
      unit,
    });
  }

  return { customerRaw, customerKeywords, sppgNumber, items };
}

/**
 * Match customer by keywords extracted from order message.
 * sppgNumber: jika ada angka di baris 1 (misal 3 atau 5), digunakan sebagai
 * discriminator tambahan agar SPPG SINDANGJAYA 3 tidak tertukar dengan SPPG SINDANGJAYA 5.
 * Kategori harga SPPG 5 dan SPPG 2 adalah sama (sudah diset di data customer).
 */
export function matchCustomer(customerKeywords, availableCustomers, sppgNumber = null) {
  if (!customerKeywords?.length || !availableCustomers?.length) return null;

  let best = null;
  let bestScore = 0;

  for (const c of availableCustomers) {
    const haystack = `${c.name} ${c.company || ''}`.toLowerCase();
    let score = 0;
    for (const kw of customerKeywords) {
      if (kw.length >= 2 && haystack.includes(kw)) score++;
    }

    // Bonus/penalti berdasarkan angka SPPG di baris 1
    if (sppgNumber !== null && score > 0) {
      // Ekstrak angka dari nama customer (misal "SPPG SINDANGJAYA 3" -> 3)
      const custNumMatch = c.name.match(/(\d+)/);
      const custNum = custNumMatch ? parseInt(custNumMatch[1], 10) : null;

      if (custNum !== null) {
        if (custNum === sppgNumber) {
          score += 10; // cocok persis
        } else {
          score -= 5;  // angka tidak cocok, kurangi skor agar tidak dipilih
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return bestScore > 0 ? best : null;
}

/**
 * Tiered fuzzy product matching:
 * 1. Exact (lowercase)
 * 2. Product name contains search
 * 3. Search contains product name
 * 4. Token-level word overlap
 */
export function matchProduct(productName, availableProducts) {
  if (!productName || !availableProducts?.length) return null;
  const search = productName.toLowerCase().trim();

  let m = availableProducts.find(p => p.name.toLowerCase() === search);
  if (m) return m;

  m = availableProducts.find(p => p.name.toLowerCase().includes(search));
  if (m) return m;

  m = availableProducts.find(p => search.includes(p.name.toLowerCase()));
  if (m) return m;

  // Token-level: score by word overlap
  const searchTokens = search.split(/\s+/);
  let best = null;
  let bestHits = 0;
  for (const p of availableProducts) {
    const pTokens = p.name.toLowerCase().split(/\s+/);
    const hits = searchTokens.filter(t =>
      t.length >= 3 && pTokens.some(pt => pt.includes(t) || t.includes(pt))
    ).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = p;
    }
  }
  return bestHits > 0 ? best : null;
}

/**
 * Fuzzy product matching to suggest best alternatives.
 * Returns array of products ranked by similarity score.
 */
export function suggestProducts(productName, availableProducts) {
  if (!productName || !availableProducts?.length) return [];
  const search = productName.toLowerCase().trim();
  const searchTokens = search.split(/\s+/).filter(t => t.length >= 2);

  const scored = availableProducts.map(p => {
    let score = 0;
    const pName = p.name.toLowerCase();
    
    if (pName === search) score += 100;
    else if (pName.includes(search)) score += 50;
    else if (search.includes(pName)) score += 40;

    const pTokens = pName.split(/\s+/);
    let tokenHits = 0;
    for (const t of searchTokens) {
      if (pTokens.some(pt => pt.includes(t) || t.includes(pt))) {
        tokenHits++;
      }
    }
    score += tokenHits * 10;
    
    return { product: p, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.product);
}
