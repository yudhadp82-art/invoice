"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Order } from "@/types"
import { format } from "date-fns"
import { PurchaseNoteDialog } from "./PurchaseNoteDialog"
import Link from "next/link"
import { FileText } from "lucide-react"

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

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return <div className="p-4 text-center">Loading orders...</div>
  }

  return (
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
                        <ul className="list-disc list-inside space-y-1">
                          {order.items.map((item, idx) => (
                            <li key={idx}>
                              {item.name} <span className="text-muted-foreground">({item.quantity} {item.unit || ""})</span>
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
                    </TableCell>
                  </TableRow>
                )
              })}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No orders found. Create one manually or via chat.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
