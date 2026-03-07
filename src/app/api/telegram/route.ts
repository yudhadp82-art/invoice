import { NextResponse } from "next/server"
import { addDoc, collection, serverTimestamp, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Product } from "@/types"

// Helper to find product price
async function findProductPrice(itemName: string) {
  try {
    // Basic fuzzy match: Check if product name is contained in item name or vice versa
    // In a real app, use a search index like Algolia or Typesense
    // Here we fetch all products and filter in memory (OK for small lists)
    const productsRef = collection(db, "products")
    const snapshot = await getDocs(productsRef)
    
    let bestMatch: Product | null = null
    const normalizedItem = itemName.toLowerCase().trim()

    snapshot.forEach(doc => {
      const product = doc.data() as Product
      const normalizedProduct = product.name.toLowerCase().trim()
      
      // Exact match
      if (normalizedItem === normalizedProduct) {
        bestMatch = product
      }
      // Partial match (e.g. "Singkong" matches "Singkong Mentega")
      else if (normalizedItem.includes(normalizedProduct) && !bestMatch) {
        bestMatch = product
      }
    })

    return bestMatch
  } catch (error) {
    console.error("Error finding product:", error)
    return null
  }
}

async function parseOrderText(text: string) {
  const lines = text.split('\n')
  const data: any = {
    customerName: "Unknown",
    customerPhone: "",
    items: [],
    totalAmount: 0,
    hpp: 0, // Initialize HPP
    rawMessage: text
  }

  // Always take first line as Customer Name (with or without PO)
  const firstLine = lines[0].trim()
  if (firstLine) {
    // Remove "PO" prefix if present (case insensitive), but keep the rest
    data.customerName = firstLine.replace(/^PO\s+/i, "").trim() || firstLine
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Also try to find phone number in any line
    if (trimmed.toLowerCase().startsWith("hp:") || trimmed.toLowerCase().startsWith("phone:")) {
      data.customerPhone = trimmed.split(":")[1].trim()
    }

    // Parse Items (Both Formats)
    // Format 1: - Item (Qty) Price
    // Format 2: •Item : Qty
    
    if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.startsWith("*")) {
      try {
        const cleanLine = trimmed.substring(1).trim() // Remove bullet
        
        // Format 2: "Singkong : 350kg"
        if (cleanLine.includes(":")) {
          const parts = cleanLine.split(":")
          const name = parts[0].trim()
          const qtyString = parts[1].trim() // "350kg" or "350 kg"
          
          // Extract number from "350kg" -> 350
          const qtyMatch = qtyString.match(/(\d+)/)
          const quantity = qtyMatch ? parseInt(qtyMatch[0]) : 1
          
          // Lookup Price and Material Cost
          const product = await findProductPrice(name)
          let price = 0
          let materialCost = 0

          if (product) {
            // Type guard to ensure product is not null
            const p = product as Product
            materialCost = p.materialCost || 0
            
            // Dynamic Pricing Logic
            const customer = data.customerName.toUpperCase()
            if (customer.includes("SPPG 5") || customer.includes("SPPG 2")) {
              // Priority: SPPG 5/2 Price -> Default Price
              price = p.priceSppg5 && p.priceSppg5 > 0 ? p.priceSppg5 : p.price
            } else if (customer.includes("SPPG 3")) {
              // Priority: SPPG 3 Price -> Default Price
              price = p.priceSppg3 && p.priceSppg3 > 0 ? p.priceSppg3 : p.price
            } else if (customer.includes("AL HAM")) {
              // Priority: Al Ham Price -> Default Price
              price = p.priceAlHam && p.priceAlHam > 0 ? p.priceAlHam : p.price
            } else {
              // Default
              price = p.price
            }
          }
          
          data.items.push({ name, quantity, price, materialCost, unit: qtyString.replace(/\d+/g, '').trim() })
          data.totalAmount += (quantity * price)
          data.hpp = (data.hpp || 0) + (quantity * materialCost)
        }
        // Format 1: "Sepatu (1) 150000"
        else {
           const match = cleanLine.match(/^(.*)\((\d+)\)\s*(\d+)$/)
           if (match) {
             const name = match[1].trim()
             const quantity = parseInt(match[2])
             const price = parseInt(match[3])
             data.items.push({ name, quantity, price })
             data.totalAmount += (quantity * price)
           }
        }
      } catch (e) {
        console.error("Error parsing item line:", line, e)
      }
    }
  }

  return data
}

export async function GET() {
  return NextResponse.json({ status: "Telegram Webhook is Active", mode: "POST only for updates" })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log("Webhook received:", JSON.stringify(body, null, 2))
    
    const message = body.message || body.edited_message
    
    if (!message || !message.text) {
      console.log("No text message found")
      return NextResponse.json({ status: "ignored" })
    }

    const text = message.text
    console.log("Processing text:", text)
    
    // Check keywords for both formats
    // Format 1: "item:" or "pesanan:"
    // Format 2: Starts with "PO" or has bullets "•", "-", "*"
    const isFormat1 = text.toLowerCase().includes("item:") || text.toLowerCase().includes("pesanan:")
    const isFormat2 = text.trim().toUpperCase().startsWith("PO") || text.includes("•") || text.includes("- ") || text.includes("* ")
    
    if (isFormat1 || isFormat2) {
      const orderData = await parseOrderText(text)
      console.log("Parsed order data:", JSON.stringify(orderData, null, 2))
      
      if (orderData.items.length > 0) {
        try {
          const docRef = await addDoc(collection(db, "orders"), {
            ...orderData,
            source: "telegram",
            createdAt: serverTimestamp(),
            status: "pending",
            chatId: message.chat.id, 
          })
          console.log("Order saved to Firestore with ID:", docRef.id)
          
          // Reply to Telegram
          const botToken = process.env.TELEGRAM_BOT_TOKEN
          if (botToken) {
            let replyText = `✅ Pesanan Diterima!\nID: ${docRef.id.slice(0, 8)}\nCustomer: ${orderData.customerName}\n`
            
            // List items in reply
            orderData.items.forEach((item: any) => {
               replyText += `- ${item.name} (${item.quantity}) = ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(item.price * item.quantity)}\n`
            })
            
            replyText += `\nTotal: ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(orderData.totalAmount)}\n\nTerima kasih!`
            
            const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: message.chat.id,
                text: replyText,
                reply_to_message_id: message.message_id
              })
            })
            
            const telegramResult = await telegramResponse.json()
            console.log("Telegram reply sent:", telegramResult)
          }
        } catch (dbError) {
          console.error("Database error:", dbError)
        }
      } else {
        console.log("No items parsed from text")
      }
    } else {
      console.log("Text does not match order format keywords")
    }

    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("Telegram webhook error:", error)
    return NextResponse.json({ status: "error" }, { status: 500 })
  }
}
