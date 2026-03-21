import { FiX } from 'react-icons/fi';

export default function Modal({ isOpen, onClose, title, children, size = '' }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${size ? `modal-${size}` : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
