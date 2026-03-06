export interface Product {
  id: string;
  name: string;
  price: number; // Default price
  priceSppg?: number; // Price for SPPG 5 & SPPG 3
  priceAlHam?: number; // Price for Al Ham
  materialCost?: number;
  unit: string;
  category?: string;
  createdAt: any;
}

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
  materialCost?: number; // HPP per unit at time of order
  unit?: string;
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
  rawMessage?: string;
  chatId?: number;
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
