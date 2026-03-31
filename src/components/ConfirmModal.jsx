import React from 'react';
import Modal from './Modal';
import { FiAlertTriangle } from 'react-icons/fi';

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Konfirmasi Hapus', 
  message = 'Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.',
  confirmText = 'Hapus',
  cancelText = 'Batal',
  variant = 'danger' 
}) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title} 
      size="sm"
      persistent={true}
    >
      <div className="modal-body text-center" style={{ padding: '24px 16px' }}>
        <div style={{ 
          fontSize: '48px', 
          color: variant === 'danger' ? 'var(--accent-danger)' : 'var(--accent-warning)',
          marginBottom: '16px'
        }}>
          <FiAlertTriangle />
        </div>
        <p style={{ fontSize: '15px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
          {message}
        </p>
      </div>
      <div className="modal-footer" style={{ justifyContent: 'center', gap: '12px' }}>
        <button 
          className="btn btn-secondary" 
          onClick={onClose}
          style={{ minWidth: '100px' }}
        >
          {cancelText}
        </button>
        <button 
          className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
          onClick={async () => {
            await onConfirm();
            onClose();
          }}
          disabled={isOpen === false} // Prevent multiple clicks
          style={{ minWidth: '100px' }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
