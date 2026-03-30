import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, title, children, size = '', persistent = false }) {
  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (!persistent) {
      onClose();
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={`modal ${size ? `modal-${size}` : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
