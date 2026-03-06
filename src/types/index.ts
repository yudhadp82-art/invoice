export interface PurchaseNote {
  id: string;
  orderId: string;
  description: string;
  amount: number;
  imageUrl?: string;
  createdAt: any; // Firestore Timestamp
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  source: 'whatsapp' | 'telegram' | 'manual';
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: any;
  totalAmount: number;
  hpp?: number;
  notes?: string;
  purchaseNotes?: PurchaseNote[];
}

export interface Invoice {
  id: string;
  orderId: string;
  invoiceNumber: string;
  createdAt: any;
  dueDate: any;
  amount: number;
  status: 'unpaid' | 'paid';
  pdfUrl?: string;
}
