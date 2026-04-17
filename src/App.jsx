import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import { seedDemoData } from './utils/storage';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Stock = lazy(() => import('./pages/Stock'));
const Products = lazy(() => import('./pages/Products'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Pricing = lazy(() => import('./pages/Pricing'));
const TelegramOrders = lazy(() => import('./pages/TelegramOrders'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceForm = lazy(() => import('./pages/InvoiceForm'));
const DeliveryNotes = lazy(() => import('./pages/DeliveryNotes'));
const DeliveryNoteForm = lazy(() => import('./pages/DeliveryNoteForm'));
const PurchaseNotes = lazy(() => import('./pages/PurchaseNotes'));
const PurchaseNoteForm = lazy(() => import('./pages/PurchaseNoteForm'));
const ProductionMaterials = lazy(() => import('./pages/ProductionMaterials'));
const SalaryCosts = lazy(() => import('./pages/SalaryCosts'));
const ProductionNeeds = lazy(() => import('./pages/ProductionNeeds'));
const Employees = lazy(() => import('./pages/Employees'));
const MaterialItems = lazy(() => import('./pages/MaterialItems'));
const Recap = lazy(() => import('./pages/Recap'));
const ProfitMargin = lazy(() => import('./pages/ProfitMargin'));
const Reports = lazy(() => import('./pages/Reports'));
const SppgSindangjaya3Receipt = lazy(() => import('./pages/SppgSindangjaya3Receipt'));

function RouteFallback() {
  return (
    <div className="card p-lg text-center animate-in">
      <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
      <p className="text-muted">Memuat halaman...</p>
    </div>
  );
}

function App() {
  useEffect(() => {
    seedDemoData().catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-right" reverseOrder={false} />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/products" element={<Products />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/telegram-orders" element={<TelegramOrders />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
            <Route path="/delivery-notes" element={<DeliveryNotes />} />
            <Route path="/delivery-notes/new" element={<DeliveryNoteForm />} />
            <Route path="/delivery-notes/:id/edit" element={<DeliveryNoteForm />} />
            <Route path="/purchase-notes" element={<PurchaseNotes />} />
            <Route path="/purchase-notes/new" element={<PurchaseNoteForm />} />
            <Route path="/purchase-notes/:id/edit" element={<PurchaseNoteForm />} />
            <Route path="/production/materials" element={<ProductionMaterials />} />
            <Route path="/production/salary" element={<SalaryCosts />} />
            <Route path="/production/needs" element={<ProductionNeeds />} />
            <Route path="/production/employees" element={<Employees />} />
            <Route path="/production/material-items" element={<MaterialItems />} />
            <Route path="/recap" element={<Recap />} />
            <Route path="/profit-margin" element={<ProfitMargin />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/receipts/sppg-sindangjaya-3" element={<SppgSindangjaya3Receipt />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
