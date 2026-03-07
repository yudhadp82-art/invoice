"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot, query, orderBy, Timestamp, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Order } from "@/types"
import { format } from "date-fns"
import { PurchaseNoteDialog } from "./PurchaseNoteDialog"
import { OrderForm } from "./OrderForm"
import Link from "next/link"
import { FileText, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [editingOrder, setEditingOrder] = useState<Order | undefined>(undefined)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    // Query orders sorted by creation time
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[]
      setOrders(orderData)
      setLoading(false)
    }, (error) => {
      console.error("Error fetching orders:", error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this order?")) {
      await deleteDoc(doc(db, "orders", id))
    }
  }

  if (loading) {
    return <div className="p-4 text-center">Loading orders...</div>
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>HPP</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const hpp = order.hpp || 0
                  const profit = order.totalAmount - hpp
                  // Handle Firestore Timestamp or fallback
                  const date = order.createdAt?.seconds ? new Timestamp(order.createdAt.seconds, order.createdAt.nanoseconds).toDate() : new Date()

                  return (
                    <TableRow key={order.id} className="align-top">
                      <TableCell className="font-medium whitespace-nowrap">
                        {format(date, "dd MMM HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{order.customerName}</div>
                        <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.source === "whatsapp" ? "default" : order.source === "telegram" ? "secondary" : "outline"}>
                          {order.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <ul className="space-y-1">
                            {order.items.map((item, idx) => (
                              <li key={idx} className="h-6 flex items-center">
                                {item.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm">
                          <ul className="space-y-1">
                            {order.items.map((item, idx) => (
                              <li key={idx} className="h-6 flex items-center justify-end text-muted-foreground">
                                {item.quantity} {item.unit || ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(order.totalAmount)}
                      </TableCell>
                      <TableCell className="text-red-500 font-medium">
                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(hpp)}
                      </TableCell>
                      <TableCell className={profit >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(profit)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2">
                        <PurchaseNoteDialog order={order} />
                        <Link href={`/invoice/${order.id}`} passHref>
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </Link>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                                setEditingOrder(order)
                                setEditOpen(true)
                            }}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(order.id)} className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No orders found. Create one manually or via chat.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <OrderForm 
        order={editingOrder} 
        open={editOpen} 
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setTimeout(() => setEditingOrder(undefined), 300) // Clear after close animation
        }} 
        trigger={<></>} // Hidden trigger since we control open state
      />
    </>
  )
}
