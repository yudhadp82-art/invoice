import { OrderForm } from "@/components/OrderForm"
import { OrderList } from "@/components/OrderList"

export default function Home() {
  return (
    <div className="container mx-auto py-10 space-y-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoice Dashboard</h1>
          <p className="text-muted-foreground">Manage orders from WhatsApp/Telegram and generate invoices.</p>
        </div>
        <OrderForm />
      </div>
      
      <div className="grid gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-semibold">Automation Setup:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Telegram Webhook URL: <code>/api/telegram</code></li>
            <li>Format Pesanan: <code>Nama: [Nama], HP: [NoHP], Item: - [NamaItem] ([Qty]) [Harga]</code></li>
            <li>Contoh: <code>Nama: Budi, HP: 08123, Item: - Sepatu (1) 100000</code></li>
          </ul>
        </div>
        <OrderList />
      </div>
    </div>
  )
}
