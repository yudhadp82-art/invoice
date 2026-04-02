import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Invoices from './pages/Invoices';
import InvoiceForm from './pages/InvoiceForm';
import DeliveryNotes from './pages/DeliveryNotes';
import DeliveryNoteForm from './pages/DeliveryNoteForm';
import PurchaseNotes from './pages/PurchaseNotes';
import PurchaseNoteForm from './pages/PurchaseNoteForm';
import Reports from './pages/Reports';
import Pricing from './pages/Pricing';
import Suppliers from './pages/Suppliers';
import TelegramOrders from './pages/TelegramOrders';
import HPP from './pages/HPP';
import ProductionMaterials from './pages/ProductionMaterials';
import SalaryCosts from './pages/SalaryCosts';
import ProductionNeeds from './pages/ProductionNeeds';
import Employees from './pages/Employees';
import MaterialItems from './pages/MaterialItems';
import Stock from './pages/Stock';
import Recap from './pages/Recap';
import { seedDemoData } from './utils/storage';

function App() {
  useEffect(() => {
    seedDemoData().catch(console.error);
  }, []);

  return (
    <BrowserRouter>
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
          <Route path="/hpp" element={<HPP />} />
          <Route path="/recap" element={<Recap />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
