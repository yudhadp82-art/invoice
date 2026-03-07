"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2 } from "lucide-react"
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDocs, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Order, Product } from "@/types"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { orderSchema } from "@/lib/validations"

type OrderFormValues = z.infer<typeof orderSchema>

interface OrderFormProps {
  order?: Order
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

export function OrderForm({ order, open: controlledOpen, onOpenChange: setControlledOpen, trigger }: OrderFormProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = setControlledOpen || setInternalOpen

  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      items: [{ name: "", quantity: 1, price: 0, brand: "", unit: "kg" }],
      source: "manual",
      customerName: "",
      customerPhone: "",
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  })

  // Load products
  useEffect(() => {
    const fetchProducts = async () => {
      const q = query(collection(db, "products"), orderBy("name"))
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product))
      setProducts(data)
    }
    fetchProducts()
  }, [])

  // Reset form when order changes or dialog opens
  useEffect(() => {
    if (open) {
      if (order) {
        reset({
          customerName: order.customerName,
          customerPhone: order.customerPhone || "",
          source: order.source as "manual" | "whatsapp" | "telegram",
          items: order.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            brand: item.brand || "",
            unit: item.unit || "kg",
            materialCost: item.materialCost
          }))
        })
      } else {
        reset({
          items: [{ name: "", quantity: 1, price: 0, brand: "", unit: "kg" }],
          source: "manual",
          customerName: "",
          customerPhone: "",
        })
      }
    }
  }, [open, order, reset])

  const onSubmit = async (data: OrderFormValues) => {
    try {
      setLoading(true)
      
      // Calculate total amount and total HPP
      let totalAmount = 0
      let totalHpp = 0

      const processedItems = data.items.map(item => {
        const itemTotal = item.price * item.quantity
        totalAmount += itemTotal
        if (item.materialCost) {
          totalHpp += item.materialCost * item.quantity
        }
        return item
      })
      
      const orderData = {
        ...data,
        items: processedItems,
        totalAmount,
        hpp: totalHpp,
        updatedAt: serverTimestamp(),
      }

      if (order) {
        await updateDoc(doc(db, "orders", order.id), orderData)
      } else {
        await addDoc(collection(db, "orders"), {
          ...orderData,
          status: "pending",
          createdAt: serverTimestamp(),
        })
      }
      
      setOpen(false)
      if (!order) reset() // Only reset if creating new
    } catch (error) {
      console.error("Error saving order: ", error)
    } finally {
      setLoading(false)
    }
  }

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      setValue(`items.${index}.name`, product.name)
      setValue(`items.${index}.brand`, product.brand || "")
      setValue(`items.${index}.unit`, product.unit)
      
      // Dynamic Pricing Logic based on Customer Name
      const customerName = watch("customerName").toUpperCase()
      let price = product.price // Default price

      if (customerName.includes("SPPG 5") || customerName.includes("SPPG 2")) {
        price = product.priceSppg5 && product.priceSppg5 > 0 ? product.priceSppg5 : product.price
      } else if (customerName.includes("SPPG 3")) {
        price = product.priceSppg3 && product.priceSppg3 > 0 ? product.priceSppg3 : product.price
      } else if (customerName.includes("AL HAM")) {
        price = product.priceAlHam && product.priceAlHam > 0 ? product.priceAlHam : product.price
      }

      setValue(`items.${index}.price`, price)
      setValue(`items.${index}.materialCost`, product.materialCost)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add New Order
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? "Edit Order" : "Create New Order"}</DialogTitle>
          <DialogDescription>
            {order ? "Update order details." : "Enter order details manually."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Customer Name</Label>
            <Input id="name" {...register("customerName")} placeholder="John Doe" />
            {errors.customerName && (
              <p className="text-sm text-red-500">{errors.customerName.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: "", quantity: 1, price: 0, brand: "", unit: "kg" })}
              >
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            </div>
            
            {fields.map((field, index) => (
              <div key={field.id} className="border p-3 rounded-md space-y-3 bg-slate-50">
                <div className="flex justify-between items-start gap-2">
                   <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs">Product (Auto-fill)</Label>
                          <Select onValueChange={(val) => handleProductSelect(index, val)}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select product..." />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name} ({p.brand || "No Brand"})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                           <Label className="text-xs">Item Name</Label>
                           <Input {...register(`items.${index}.name`)} placeholder="Item Name" className="h-9" />
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <div className="w-1/3">
                           <Label className="text-xs">Brand</Label>
                           <Input {...register(`items.${index}.brand`)} placeholder="Brand" className="h-9" />
                        </div>
                         <div className="w-1/4">
                           <Label className="text-xs">Qty</Label>
                           <Input 
                             type="number" 
                             step="0.1"
                             {...register(`items.${index}.quantity`, { valueAsNumber: true })} 
                             placeholder="Qty" 
                             className="h-9"
                           />
                        </div>
                         <div className="w-1/4">
                           <Label className="text-xs">Unit</Label>
                           <Input {...register(`items.${index}.unit`)} placeholder="Unit" className="h-9" />
                        </div>
                         <div className="flex-1">
                           <Label className="text-xs">Price</Label>
                           <Input 
                             type="number" 
                             {...register(`items.${index}.price`, { valueAsNumber: true })} 
                             placeholder="Price" 
                             className="h-9"
                           />
                        </div>
                      </div>
                   </div>

                   <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            {errors.items && (
              <p className="text-sm text-red-500">{errors.items.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
