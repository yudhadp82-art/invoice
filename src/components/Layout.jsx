import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  FiHome, FiPackage, FiUsers, FiFileText,
  FiTruck, FiShoppingCart, FiBarChart2, FiTag, FiBriefcase, FiMessageCircle, FiPieChart, FiTool, FiDollarSign
} from 'react-icons/fi';
import { addMutationListener, removeMutationListener, executeUndo } from '../utils/storage';

const navItems = [
  { section: 'Menu Utama' },
  { path: '/dashboard', label: 'Dashboard', icon: FiHome },
  { path: '/products', label: 'Produk', icon: FiPackage },
  { path: '/customers', label: 'Customer', icon: FiUsers },
  { path: '/suppliers', label: 'Supplier', icon: FiBriefcase },
  { path: '/pricing', label: 'Kategori Harga', icon: FiTag },
  { section: 'Transaksi' },
  { path: '/telegram-orders', label: 'Pesanan Telegram', icon: FiMessageCircle },
  { path: '/invoices', label: 'Invoice', icon: FiFileText },
  { path: '/delivery-notes', label: 'Surat Jalan', icon: FiTruck },
  { path: '/purchase-notes', label: 'Nota Pembelian', icon: FiShoppingCart },
  { section: 'Biaya Produksi' },
  { path: '/production/materials', label: 'Bahan Pendukung', icon: FiPackage },
  { path: '/production/material-items', label: 'Master Bahan', icon: FiTag },
  { path: '/production/employees', label: 'Daftar Pekerja', icon: FiUsers },
  { path: '/production/salary', label: 'Biaya Gaji', icon: FiDollarSign },
  { path: '/production/needs', label: 'Kebutuhan Produksi', icon: FiTool },
  { section: 'Analisa' },
  { path: '/hpp', label: 'HPP', icon: FiPieChart },
  { path: '/recap', label: 'Rekap', icon: FiBarChart2 },
  { path: '/reports', label: 'Laporan', icon: FiBarChart2 },
];

export default function Layout() {
  const [latestMutation, setLatestMutation] = useState(null);

  useEffect(() => {
    const handleMutation = (mut) => {
      setLatestMutation(prev => {
        // If there's an active delete mutation, don't let updates override it immediately
        if (prev && prev.action === 'delete' && mut.action === 'update') {
          return prev;
        }
        return mut;
      });
      const timer = setTimeout(() => {
        setLatestMutation(null);
      }, 5000);
      return () => clearTimeout(timer);
    };
    addMutationListener(handleMutation);
    return () => removeMutationListener(handleMutation);
  }, []);

  const handleUndo = async () => {
    if (latestMutation) {
      await executeUndo(latestMutation);
      setLatestMutation(null);
    }
  };

  const getCollectionLabel = (col) => {
    const map = {
      products: 'Produk', customers: 'Customer', suppliers: 'Supplier',
      invoices: 'Invoice', delivery_notes: 'Surat Jalan',
      price_categories: 'Kategori Harga', hpp_reports: 'HPP',
      production_materials: 'Bahan Pendukung', salary_costs: 'Biaya Gaji',
      production_needs: 'Kebutuhan Produksi', employees: 'Daftar Pekerja',
      supporting_material_items: 'Master Bahan'
    };
    return map[col] || col;
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">IP</div>
          <span className="sidebar-brand">InvoicePro</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if (item.section) {
              return <div key={i} className="sidebar-section-label">{item.section}</div>;
            }
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon"><Icon /></span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
        
        {latestMutation && (
          <div className="undo-snackbar">
            <div className="undo-content">
              <span>
                {getCollectionLabel(latestMutation.collection)}{' '}
                {latestMutation.action === 'create' ? 'ditambahkan' : latestMutation.action === 'update' ? 'diubah' : 'dihapus'}
              </span>
              <button className="btn btn-primary btn-sm" onClick={handleUndo} style={{ marginLeft: 12 }}>
                Batal (Undo)
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
