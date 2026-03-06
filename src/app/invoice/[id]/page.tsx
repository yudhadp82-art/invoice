"use client"

import { useEffect, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Order } from "@/types"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { id as idLocale } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import Link from "next/link"

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

  // Format currency
  const formatRupiah = (value: number) => 
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value)

  return (
    <div className="max-w-[210mm] mx-auto bg-white min-h-screen p-8 print:p-0">
      {/* Navigation - Hidden on Print */}
      <div className="flex justify-between items-center mb-8 print:hidden">
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print Invoice
        </Button>
      </div>

      {/* Invoice Content */}
      <div className="text-sm text-black" id="invoice-content">
        
        {/* Header / Kop Surat */}
        <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-4">
          <div className="w-24 h-24 relative flex items-center justify-center border border-dashed border-gray-300 rounded-full">
            {/* Logo Placeholder */}
            <span className="text-xs text-center text-gray-400">Logo<br/>Desa</span>
          </div>
          <div className="text-center flex-1 px-4">
            <h1 className="font-bold text-lg uppercase">Koperasi Desa Merah Putih</h1>
            <h2 className="font-bold text-lg uppercase">Sindangjaya Kecamatan Cipanas</h2>
            <p className="text-xs font-bold">NOMOR AHU-0025673.AH.01.29.TAHUN 2025</p>
            <p className="text-xs mt-1 italic">
              Jl. Pakalongan No. 05 Desa Sindangjaya, Kecamatan Cipanas, Kabupaten Cianjur, Provinsi Jawa Barat, Indonesia, 43253.
            </p>
          </div>
        </div>

        {/* Invoice Title & Date */}
        <div className="mb-4">
          <div className="flex mb-1">
            <span className="w-24">Invoice :</span>
            <span className="font-medium">#{order.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex">
            <span className="w-24">Tanggal</span>
            <span>: {format(date, "dd MMMM yyyy", { locale: idLocale })}</span>
          </div>
        </div>

        {/* Invoice Bar */}
        <div className="bg-gray-200 border border-black py-1 px-4 mb-4 text-right print:bg-gray-200 print:text-black">
          <span className="font-bold uppercase tracking-widest">Invoice</span>
        </div>

        {/* Customer & Due Date Info */}
        <div className="flex gap-4 mb-6">
          {/* Left Box: Customer Info */}
          <div className="flex-1 border border-black p-2">
            <div className="font-bold mb-2">Pelanggan</div>
            <div className="grid grid-cols-[60px_10px_1fr]">
              <div>Nama</div>
              <div>:</div>
              <div>{order.customerName}</div>
              
              <div>Alamat</div>
              <div>:</div>
              <div>-</div>
              
              <div>Telp</div>
              <div>:</div>
              <div>{order.customerPhone || "-"}</div>
            </div>
          </div>

          {/* Right Box: Due Date */}
          <div className="flex-1 border border-black p-2 flex flex-col justify-between">
            <div className="text-right font-bold">jatuh tempo :</div>
            <div className="text-right text-lg">
               {/* Assuming due date is same day or specific logic, here using order date for simplicity */}
               {format(date, "dd MMMM yyyy", { locale: idLocale })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mb-6">
          <table className="w-full border-collapse border border-black text-sm">
            <thead>
              <tr className="bg-gray-200 print:bg-gray-200">
                <th className="border border-black p-2 w-10 text-center">No.</th>
                <th className="border border-black p-2 text-center">item</th>
                <th className="border border-black p-2 w-16 text-center">qty</th>
                <th className="border border-black p-2 w-16 text-center">unit</th>
                <th className="border border-black p-2 w-32 text-center">Harga Satuan<br/>(Rp)</th>
                <th className="border border-black p-2 w-32 text-center">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={index}>
                  <td className="border border-black p-2 text-center">{index + 1}</td>
                  <td className="border border-black p-2">{item.name}</td>
                  <td className="border border-black p-2 text-center">{item.quantity}</td>
                  <td className="border border-black p-2 text-center">{item.unit || "-"}</td>
                  <td className="border border-black p-2 text-right">{formatRupiah(item.price).replace("Rp", "").trim()}</td>
                  <td className="border border-black p-2 text-right">{formatRupiah(item.price * item.quantity).replace("Rp", "").trim()}</td>
                </tr>
              ))}
              {/* Fill empty rows if few items */}
              {Array.from({ length: Math.max(0, 10 - order.items.length) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-black p-2 text-center">&nbsp;</td>
                  <td className="border border-black p-2"></td>
                  <td className="border border-black p-2"></td>
                  <td className="border border-black p-2"></td>
                  <td className="border border-black p-2"></td>
                  <td className="border border-black p-2"></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="text-right p-2 font-bold uppercase">total</td>
                <td className="border border-black p-2 text-right font-bold">
                  {formatRupiah(order.totalAmount).replace("Rp", "").trim()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer: Bank & Signature */}
        <div className="flex gap-8 items-start">
          {/* Bank Info */}
          <div className="w-1/2 border border-black p-2 text-xs">
            <div className="grid grid-cols-[110px_1fr] gap-y-1">
              <div>NAMA BANK</div>
              <div>BRI</div>
              
              <div>CABANG UNIT</div>
              <div>CIPANAS</div>
              
              <div>NOMOR AKUN BANK</div>
              <div>3453 - 01 - 000012 - 56 - 6</div>
              
              <div>ATAS NAMA</div>
              <div>KOPERASI DESA MERAH PUTIH SINDANGJAYA</div>
            </div>
          </div>

          {/* Signature */}
          <div className="w-1/2 text-center flex flex-col items-center">
            <div className="mb-16">Mengetahui</div>
            <div className="font-bold border-b border-black w-48 mb-1">Ujang Rukmana</div>
            <div className="font-bold text-xs uppercase">ketua</div>
            <div className="text-xs">KDMP Sindangjaya kec.Cipanas</div>
          </div>
        </div>
        
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  )
}
