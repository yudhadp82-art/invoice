import { createPortal } from 'react-dom';
import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, size = '', persistent = false, closeOnOverlay = true, closeOnEsc = true }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !persistent && closeOnEsc) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, persistent, closeOnEsc]);

  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (!persistent && closeOnOverlay) {
      onClose();
    }
  };

  return createPortal(
    <div className={`modal-overlay ${size === 'fullscreen' ? 'overlay-fullscreen' : ''}`} onClick={handleOverlayClick}>
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
