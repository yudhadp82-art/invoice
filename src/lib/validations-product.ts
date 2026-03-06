import { z } from "zod"

export const productSchema = z.object({
  name: z.string().min(2, "Name is required"),
  price: z.number().min(0, "Price must be non-negative"),
  materialCost: z.number().min(0, "Material cost must be non-negative").optional(),
  unit: z.string().min(1, "Unit is required (e.g., kg, pcs)"),
  category: z.string().optional(),
})
