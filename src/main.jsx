import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { runSindangjayaSeeder } from './utils/seedSindangjaya.js'
import { runSindangjaya3Seeder } from './utils/seedSindangjaya3.js'
import { runSindangjaya5Seeder } from './utils/seedSindangjaya5.js'
import { runResetStock } from './utils/resetStock.js'

// runSindangjayaSeeder()
// runSindangjaya3Seeder()
// runResetStock()
// runSindangjaya5Seeder()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
