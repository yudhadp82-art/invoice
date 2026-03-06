import { NextResponse } from "next/server"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

function parseOrderText(text: string) {
  const lines = text.split('\n')
  const data: any = {
    customerName: "Unknown",
    customerPhone: "",
    items: [],
    totalAmount: 0
  }

  let parsingItems = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.toLowerCase().startsWith("nama:")) {
      data.customerName = trimmed.split(":")[1].trim()
    } else if (trimmed.toLowerCase().startsWith("hp:") || trimmed.toLowerCase().startsWith("phone:")) {
      data.customerPhone = trimmed.split(":")[1].trim()
    } else if (trimmed.toLowerCase().includes("item:") || trimmed.toLowerCase().includes("pesanan:")) {
      parsingItems = true
      continue
    }

    if (parsingItems && trimmed.startsWith("-")) {
      // Format: - ItemName (Qty) Price
      // Example: - Nasi Goreng (2) 15000
      try {
        const itemContent = trimmed.substring(1).trim()
        // Regex to extract Name, (Qty), Price
        // Matches "Item Name (2) 10000"
        const match = itemContent.match(/^(.*)\((\d+)\)\s*(\d+)$/)
        
        if (match) {
          const name = match[1].trim()
          const quantity = parseInt(match[2])
          const price = parseInt(match[3])
          
          data.items.push({ name, quantity, price })
          data.totalAmount += (quantity * price)
        } else {
          // Fallback simple split if regex fails: Name, Qty, Price
          // Example: Nasi Goreng, 2, 15000
          const parts = itemContent.split(',')
          if (parts.length === 3) {
            const name = parts[0].trim()
            const quantity = parseInt(parts[1].trim())
            const price = parseInt(parts[2].trim())
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
    
    // Only process if it looks like an order
    // Relaxed check: Just need "item" or "pesanan" keyword
    if (text.toLowerCase().includes("item:") || text.toLowerCase().includes("pesanan:")) {
      const orderData = parseOrderText(text)
      console.log("Parsed order data:", JSON.stringify(orderData, null, 2))
      
      if (orderData.items.length > 0) {
        try {
          const docRef = await addDoc(collection(db, "orders"), {
            ...orderData,
            source: "telegram",
            createdAt: serverTimestamp(),
            status: "pending",
            rawMessage: text,
            chatId: message.chat.id, 
          })
          console.log("Order saved to Firestore with ID:", docRef.id)
          
          // Reply to Telegram
          const botToken = process.env.TELEGRAM_BOT_TOKEN
          if (botToken) {
            const replyText = `✅ Pesanan Diterima!\nID: ${docRef.id.slice(0, 8)}\nTotal: ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(orderData.totalAmount)}\n\nTerima kasih! Invoice sedang diproses.`
            
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
          } else {
            console.warn("TELEGRAM_BOT_TOKEN is missing")
          }
        } catch (dbError) {
          console.error("Database error:", dbError)
          // Still return ok to Telegram so it doesn't retry
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
