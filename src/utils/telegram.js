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

export async function sendDocument(chatId, blob, filename) {
  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', blob, filename);

    const res = await fetch(`${BASE_URL}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send Telegram document:', err);
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
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_BASE   = '/orapi/v1';

/**
 * Parse pesan pesanan menggunakan AI via OpenRouter.
 * Mengembalikan struktur yang sama dengan regex parser.
 * Jika AI gagal, fallback ke regex.
 */
export async function parseOrderMessage(text) {
  if (!text) return null;

  // --- AI Parsing ---
  try {
    const prompt = `Kamu adalah parser pesanan bahan makanan. Ekstrak informasi dari pesan berikut.

Pesan:
${text}

Kembalikan HANYA JSON (tanpa teks lain) sesuai format:
{
  "customerRaw": "<baris pertama asli>",
  "items": [
    { "productName": "<nama produk>", "qty": <angka>, "unit": "<satuan>" }
  ]
}

Aturan:
- "customerRaw" adalah baris pertama pesan apa adanya.
- Setiap baris setelah baris pertama adalah item pesanan.
- "unit" default "kg" jika tidak disebutkan.
- "qty" harus angka (bukan string).
- Abaikan baris yang tidak mengandung produk atau jumlah.`;

    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Invoice App',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);

    const data   = await res.json();
    const raw    = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(raw);

    if (!parsed.customerRaw || !Array.isArray(parsed.items)) {
      throw new Error('Invalid AI response structure');
    }

    const customerRaw = parsed.customerRaw.trim();
    const allNums     = [...customerRaw.matchAll(/\d+/g)];
    const sppgNumber  = allNums.length > 0 ? parseInt(allNums[allNums.length - 1][0], 10) : null;

    const customerKeywords = customerRaw
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => w.replace(/\d+$/, '').toLowerCase())
      .filter(w => w.length > 0 && isNaN(w));

    const items = parsed.items
      .filter(it => it.productName && it.qty > 0)
      .map(it => ({
        productName: String(it.productName).trim(),
        qty: Number(it.qty),
        unit: String(it.unit || 'kg').toLowerCase().trim(),
      }));

    if (items.length === 0) throw new Error('AI returned 0 items');

    console.log('[AI parse] success:', { customerRaw, sppgNumber, items });
    return { customerRaw, customerKeywords, sppgNumber, items };

  } catch (err) {
    console.warn('[AI parse] failed, fallback ke regex:', err.message);
    return parseOrderMessageFallback(text);
  }
}

/** Fallback: parse pesanan dengan regex tanpa AI. */
function parseOrderMessageFallback(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 1) return null;

  const customerRaw = lines[0];

  const allNums = [...customerRaw.matchAll(/\d+/g)];
  const sppgNumber = allNums.length > 0 ? parseInt(allNums[allNums.length - 1][0], 10) : null;

  const customerKeywords = customerRaw
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => w.replace(/\d+$/, '').toLowerCase())
    .filter(w => w.length > 0 && isNaN(w));

  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    let clean = line.replace(/^[-*•]\s*/, '').trim();
    clean = clean.replace(/\s*[:=]\s*/, ' ');
    if (!clean) continue;

    const parts = clean.split(/\s+/);
    if (parts.length < 2) continue;

    let unit = 'kg';
    let qty = 0;
    let productParts = [];

    if (parts.length >= 2 && UNIT_PATTERN.test(parts[parts.length - 1])) {
      unit = parts[parts.length - 1].toLowerCase();
      const qtyStr = parts[parts.length - 2];
      qty = parseFloat(qtyStr.replace(',', '.'));
      productParts = parts.slice(0, parts.length - 2);
    } else {
      const lastPart = parts[parts.length - 1];
      const gluedMatch = lastPart.match(/^(\d+(?:[.,]\d+)?)(kg|gr|g|ons|pack|ikat|bks|bungkus|dus|bal|karung|buah|liter|lt|pcs|lusin|jrg|jrigen|jerigen|dirigen|botol|btl|kaleng|bag|kotak|slice|lbr|lembar|renteng|sisir|tandan|slop|karton|tray|biji)?$/i);
      if (gluedMatch) {
        qty = parseFloat(gluedMatch[1].replace(',', '.'));
        unit = gluedMatch[2] ? gluedMatch[2].toLowerCase() : 'kg';
        productParts = parts.slice(0, parts.length - 1);
      } else {
        continue;
      }
    }

    if (!qty || productParts.length === 0) continue;

    items.push({ productName: productParts.join(' '), qty, unit });
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

/**
 * Mencocokkan dan memperbaiki nama item pesanan ke daftar produk menggunakan AI.
 * Setelah selesai, kirim feedback ke Telegram berupa ringkasan koreksi.
 *
 * @param {Array}  items            - Item hasil parse pesan (productName, qty, unit)
 * @param {Array}  availableProducts - Daftar produk dari database
 * @param {string} chatId           - Chat ID Telegram untuk mengirim feedback
 * @param {string} customerName     - Nama customer untuk header feedback
 * @returns {Array} items yang sudah dilengkapi productId, matchedName, matchedUnit, originalName, aiConfidence
 */
export async function correctAndMatchItemsWithAI(items, availableProducts, chatId, customerName = '') {
  if (!items?.length) return [];

  const productNames = availableProducts.map(p => p.name);

  try {
    const prompt = `Kamu adalah asisten pencocokan produk bahan makanan dan bumbu dapur.

Daftar produk yang tersedia (${productNames.length} produk):
${productNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Item pesanan dari pelanggan:
${items.map((it, i) => `${i + 1}. "${it.productName}" qty: ${it.qty} ${it.unit}`).join('\n')}

Untuk setiap item pesanan, temukan nama produk yang PALING COCOK dari daftar.
Pertimbangkan: nama tidak lengkap, singkatan, typo ringan, urutan kata berbeda (mis. "merah bawang" = "bawang merah"), nama yang mirip.
Jika ada nama yang sangat mirip, pilih yang paling spesifik.

Kembalikan HANYA JSON berikut:
{
  "results": [
    {
      "originalName": "<nama asli di pesanan>",
      "matchedName": "<nama persis dari daftar produk, atau null jika benar-benar tidak ada>",
      "confidence": "exact|corrected|unmatched",
      "reason": "<singkat kenapa dipilih, hanya jika corrected>"
    }
  ]
}

- "exact": nama di pesanan sudah sama persis atau sangat dekat dengan nama produk
- "corrected": nama diperbaiki karena singkatan/typo/urutan kata berbeda
- "unmatched": tidak ada produk yang cocok`;

    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Invoice App',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);

    const data    = await res.json();
    const raw     = data.choices?.[0]?.message?.content || '';
    const aiData  = JSON.parse(raw);
    const results = aiData.results || [];

    // Cocokkan hasil AI ke objek produk
    const correctedItems = items.map((item, i) => {
      const result        = results[i] || {};
      const matchedName   = result.matchedName || null;
      const confidence    = result.confidence  || 'unmatched';
      const matchedProduct = matchedName
        ? availableProducts.find(p => p.name.toLowerCase() === matchedName.toLowerCase())
        : null;

      return {
        ...item,
        originalName:  item.productName,
        productName:   matchedProduct ? matchedProduct.name : item.productName,
        productId:     matchedProduct ? matchedProduct.id   : null,
        matchedName:   matchedProduct ? matchedProduct.name : null,
        matchedUnit:   matchedProduct ? matchedProduct.unit : null,
        aiConfidence:  confidence,
        aiReason:      result.reason || null,
      };
    });

    // --- Bangun pesan feedback ke Telegram ---
    const exactCount     = correctedItems.filter(it => it.aiConfidence === 'exact').length;
    const correctedCount = correctedItems.filter(it => it.aiConfidence === 'corrected').length;
    const unmatchedCount = correctedItems.filter(it => it.aiConfidence === 'unmatched').length;

    let feedbackLines = [];
    feedbackLines.push(`📦 Pesanan ${customerName ? `*${customerName}*` : ''} diterima:`);
    feedbackLines.push('');

    correctedItems.forEach((it, i) => {
      const unit = it.matchedUnit || it.unit;
      const name = it.matchedName || it.productName;
      const base = `${i + 1}. ${it.qty} ${unit} ${name}`;

      if (it.aiConfidence === 'exact') {
        feedbackLines.push(`${base} ✓`);
      } else if (it.aiConfidence === 'corrected') {
        feedbackLines.push(`${base} ✓`);
        feedbackLines.push(`   _(koreksi dari: "${it.originalName}"${it.aiReason ? ` — ${it.aiReason}` : ''})_`);
      } else {
        feedbackLines.push(`${base} ❓ tidak ditemukan di daftar produk`);
      }
    });

    if (correctedCount > 0 || unmatchedCount > 0) {
      feedbackLines.push('');
      if (correctedCount > 0) feedbackLines.push(`🔄 ${correctedCount} item dikoreksi otomatis`);
      if (unmatchedCount > 0) feedbackLines.push(`⚠️ ${unmatchedCount} item tidak ditemukan, akan dikonfirmasi manual`);
    }

    const feedbackText = feedbackLines.join('\n');

    if (chatId) {
      await sendMessage(chatId, feedbackText);
    }

    console.log('[AI correction] done:', { exactCount, correctedCount, unmatchedCount });
    return correctedItems;

  } catch (err) {
    console.warn('[AI correction] failed, fallback ke matchProduct:', err.message);

    // Fallback: pakai regex matchProduct biasa
    return items.map(item => {
      const match = matchProduct(item.productName, availableProducts);
      return {
        ...item,
        originalName: item.productName,
        productName:  match ? match.name : item.productName,
        productId:    match ? match.id   : null,
        matchedName:  match ? match.name : null,
        matchedUnit:  match ? match.unit : null,
        aiConfidence: match ? 'exact' : 'unmatched',
        aiReason:     null,
      };
    });
  }
}
