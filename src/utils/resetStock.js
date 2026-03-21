import { Products } from './storage';

export function runResetStock() {
  const isResetDone = localStorage.getItem('invoicepro_stock_reset_done');
  if (isResetDone) return;

  const allProducts = Products.getAll();
  allProducts.forEach(p => {
    Products.update(p.id, { stock: 0 });
  });

  localStorage.setItem('invoicepro_stock_reset_done', 'true');
}
