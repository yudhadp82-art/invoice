import { z } from "zod"

export const orderSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerPhone: z.string().optional(),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    brand: z.string().optional(),
    quantity: z.number().min(0.1, "Quantity must be greater than 0"),
    price: z.number().min(0, "Price must be non-negative"),
    materialCost: z.number().optional(),
    unit: z.string().optional(),
  })).min(1, "At least one item is required"),
  source: z.enum(["whatsapp", "telegram", "manual"]),
})

export const purchaseNoteSchema = z.object({
  description: z.string().min(2, "Description is required"),
  amount: z.number().min(0, "Amount must be non-negative"),
})
