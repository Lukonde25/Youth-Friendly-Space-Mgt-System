/**
 * Modal Component
 * 
 * Dialog/modal for displaying forms, confirmations, or content
 * 
 * Usage:
 * <Modal
 *   isOpen={isOpen}
 *   title="Add Member"
 *   onClose={() => setIsOpen(false)}
 * >
 *   <form>
 *     <Input label="Name" />
 *     <div className="mt-6 flex gap-3">
 *       <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
 *       <Button>Save</Button>
 *     </div>
 *   </form>
 * </Modal>
 */

import React, { useEffect } from 'react';

const Modal = ({
  isOpen,
  title,
  children,
  onClose,
  size = 'md',
  showCloseButton = true,
  dialogClassName = '',
  ...props
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'app-modal-dialog--sm',
    md: 'app-modal-dialog--md',
    lg: 'app-modal-dialog--lg',
    xl: 'app-modal-dialog--xl'
  };

  return (
    <div className="app-modal">
      <div
        className="app-modal-backdrop"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />
      <div
        className="app-modal-layer"
        role="presentation"
      >
        <div
          className={[
            'app-modal-dialog',
            sizeClasses[size],
            dialogClassName,
          ]
            .filter(Boolean)
            .join(' ')}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          {...props}
        >
          {/* Header */}
          <div className="flex-between items-start p-6 border-b border-gray-200">
            {title && (
              <h2 id="modal-title" className="text-xl font-bold m-0">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
