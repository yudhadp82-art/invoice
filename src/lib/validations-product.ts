import { z } from "zod"

export const productSchema = z.object({
  name: z.string().min(2, "Name is required"),
  brand: z.string().optional(),
  price: z.number().min(0, "Price must be non-negative"),
  priceSppg: z.number().min(0).optional(),
  priceAlHam: z.number().min(0).optional(),
  materialCost: z.number().min(0, "Material cost must be non-negative").optional(),
  unit: z.string().min(1, "Unit is required (e.g., kg, pcs)"),
  category: z.string().optional(),
  ingredients: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    quantity: z.number().min(0.001)
  })).optional(),
})
