 240	        <div>
241	          <h1>Invoice</h1>
242	          <p>Kelola invoice penjualan</p>
243	        </div>
244	        <div className="flex gap-sm">
245	          <button className="btn btn-secondary" onClick={() => void exportInvoicesToExcel(filtered)}>
246	            <FiDownload /> Export Excel
247	          </button>
248	          <button className="btn btn-success" onClick={handleMoveSppgData} disabled={isMovingSppgData} title="Pindahkan Data SPPG SINDANGJAYA 3">
249	            <FiArrowRight /> {isMovingSppgData ? 'Memindahkan...' : 'Pindahkan Data SPPG 3'}
250	          </button>
251	          <Link to="/invoices/new" className="btn btn-primary">
252	            <FiPlus /> Buat Invoice
253	          </Link>
254	        </div>
255	      </div>
256
257	      {loading && (
258	        <div className="card p-lg text-center animate-in">
259	          <div className="loading-spinner mb-md" style={{ margin: '0 auto' }}></div>
260	          <p className="text-muted">Memuat data invoice...</p>
261	        </div>
262	      )}
