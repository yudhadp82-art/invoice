export default function Modal({ isOpen, title, children, size = '' }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className={`modal ${size ? `modal-${size}` : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}
