import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  FiHome, FiPackage, FiUsers, FiFileText,
  FiTruck, FiShoppingCart, FiBarChart2, FiTag, FiBriefcase, FiMessageCircle, FiPieChart
} from 'react-icons/fi';

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
  { path: '/purchases', label: 'Pembelian', icon: FiShoppingCart },
  { section: 'Analisa' },
  { path: '/hpp', label: 'HPP', icon: FiPieChart },
  { path: '/reports', label: 'Laporan', icon: FiBarChart2 },
];

export default function Layout() {
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
      </main>
    </div>
  );
}
