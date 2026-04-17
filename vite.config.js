import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('xlsx')) return 'vendor-xlsx';
          if (id.includes('@react-pdf/renderer')) return 'vendor-react-pdf';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf-export';
          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('react-hot-toast')) return 'vendor-react';
        },
      },
    },
  }
});