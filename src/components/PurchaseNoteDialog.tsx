"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2 } from "lucide-react"
import { doc, updateDoc, arrayUnion, arrayRemove, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Order, PurchaseNote } from "@/types"
import { purchaseNoteSchema } from "@/lib/validations"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface PurchaseNoteDialogProps {
  order: Order
}

type PurchaseNoteFormValues = z.infer<typeof purchaseNoteSchema>

export function PurchaseNoteDialog({ order }: PurchaseNoteDialogProps) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PurchaseNoteFormValues>({
    resolver: zodResolver(purchaseNoteSchema),
  })

  const onSubmit = async (data: PurchaseNoteFormValues) => {
    try {
      setLoading(true)
      const newNote: PurchaseNote = {
        id: crypto.randomUUID(),
        orderId: order.id,
        description: data.description,
        amount: data.amount,
        createdAt: Timestamp.now(),
      }

      const orderRef = doc(db, "orders", order.id)
      
      // Calculate new HPP
      const currentHpp = order.hpp || 0
      const newHpp = currentHpp + data.amount

      await updateDoc(orderRef, {
        purchaseNotes: arrayUnion(newNote),
        hpp: newHpp,
      })

      reset()
    } catch (error) {
      console.error("Error adding note: ", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (note: PurchaseNote) => {
    try {
      setLoading(true)
      const orderRef = doc(db, "orders", order.id)
      
      const currentHpp = order.hpp || 0
      const newHpp = Math.max(0, currentHpp - note.amount)
      
      const newNotes = order.purchaseNotes?.filter((n) => n.id !== note.id) || []

      await updateDoc(orderRef, {
        purchaseNotes: newNotes,
        hpp: newHpp,
      })
    } catch (error) {
      console.error("Error deleting note: ", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Manage HPP
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Purchase Notes (HPP)</DialogTitle>
          <DialogDescription>
            Manage expenses for Order #{order.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2 items-end">
            <div className="grid gap-2 flex-1">
              <Label htmlFor="desc">Description</Label>
              <Input id="desc" {...register("description")} placeholder="Material cost..." />
            </div>
            <div className="grid gap-2 w-32">
              <Label htmlFor="amount">Amount</Label>
              <Input 
                id="amount" 
                type="number" 
                {...register("amount", { valueAsNumber: true })} 
                placeholder="0" 
              />
            </div>
            <Button type="submit" disabled={loading}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.purchaseNotes?.map((note) => (
                  <TableRow key={note.id}>
                    <TableCell>{note.description}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(note.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(note)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!order.purchaseNotes || order.purchaseNotes.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No purchase notes yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center font-bold">
            <span>Total HPP:</span>
            <span>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(order.hpp || 0)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
