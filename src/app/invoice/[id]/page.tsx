"use client"

import { useEffect, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Order } from "@/types"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

export default function InvoicePage() {
  const params = useParams()
  const id = params?.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const fetchOrder = async () => {
      try {
        const docRef = doc(db, "orders", id)
        const docSnap = await getDoc(docRef)
        
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() } as Order)
        }
      } catch (error) {
        console.error("Error fetching invoice:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [id])

  if (loading) return <div className="p-8 text-center">Loading Invoice...</div>
  if (!order) return <div className="p-8 text-center text-red-500">Invoice not found</div>

  const date = order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : new Date()

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 min-h-screen">
      <div className="flex justify-between items-start mb-8 no-print">
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print Invoice
        </Button>
        <Button variant="outline" onClick={() => window.location.href = "/"}>
          Back to Dashboard
        </Button>
      </div>

      <div className="border p-8" id="invoice-content">
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-widest">Invoice</h1>
            <p className="text-sm text-gray-500">#{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <h2 className="font-bold text-xl">My Store Name</h2>
            <p className="text-sm text-gray-500">Jakarta, Indonesia</p>
          </div>
        </div>

        <div className="flex justify-between mb-8">
          <div>
            <h3 className="font-bold text-gray-600 mb-2">Bill To:</h3>
            <p className="font-semibold">{order.customerName}</p>
            <p className="text-sm">{order.customerPhone}</p>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-gray-600 mb-2">Details:</h3>
            <p className="text-sm">Date: {format(date, "dd MMM yyyy")}</p>
            <p className="text-sm">Source: {order.source}</p>
          </div>
        </div>

        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2">Item</th>
              <th className="text-center py-2">Qty</th>
              <th className="text-right py-2">Price</th>
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={index} className="border-b border-gray-100">
                <td className="py-2">{item.name}</td>
                <td className="text-center py-2">{item.quantity}</td>
                <td className="text-right py-2">
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(item.price)}
                </td>
                <td className="text-right py-2 font-medium">
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(item.price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="text-right py-4 font-bold">Total Amount:</td>
              <td className="text-right py-4 font-bold text-lg">
                {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(order.totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="border-t pt-4 text-center text-gray-500 text-sm">
          <p>Thank you for your business!</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none;
          }
          body {
            background: white;
          }
          .border {
            border: none !important;
          }
        }
      `}</style>
    </div>
  )
}
