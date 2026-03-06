import { z } from "zod"

export const orderSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerPhone: z.string().min(10, "Valid phone number is required"),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    price: z.number().min(0, "Price must be non-negative"),
  })).min(1, "At least one item is required"),
  source: z.enum(["whatsapp", "telegram", "manual"]),
})

export const purchaseNoteSchema = z.object({
  description: z.string().min(2, "Description is required"),
  amount: z.number().min(0, "Amount must be non-negative"),
})
