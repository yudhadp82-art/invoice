"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2 } from "lucide-react"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

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
import { orderSchema } from "@/lib/validations"

type OrderFormValues = z.infer<typeof orderSchema>

export function OrderForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      items: [{ name: "", quantity: 1, price: 0 }],
      source: "manual",
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  })

  const onSubmit = async (data: OrderFormValues) => {
    try {
      setLoading(true)
      const totalAmount = data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      
      await addDoc(collection(db, "orders"), {
        ...data,
        totalAmount,
        status: "pending",
        createdAt: serverTimestamp(),
      })
      
      reset()
      setOpen(false)
    } catch (error) {
      console.error("Error adding document: ", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
          <DialogDescription>
            Enter order details manually here.
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
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" {...register("customerPhone")} placeholder="0812..." />
            {errors.customerPhone && (
              <p className="text-sm text-red-500">{errors.customerPhone.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: "", quantity: 1, price: 0 })}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2 border p-2 rounded-md">
                <div className="grid gap-2 flex-1">
                  <Input
                    {...register(`items.${index}.name`)}
                    placeholder="Item Name"
                  />
                  <div className="flex gap-2">
                    <div className="w-20">
                      <Input
                        type="number"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        placeholder="Qty"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        type="number"
                        {...register(`items.${index}.price`, { valueAsNumber: true })}
                        placeholder="Price"
                      />
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
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
