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
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-modal"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={[
          'fixed inset-0 z-modal flex items-center justify-center p-4',
          'pointer-events-none'
        ]
          .filter(Boolean)
          .join(' ')}
        role="presentation"
      >
        <div
          className={[
            'bg-primary rounded-lg shadow-xl w-full',
            sizeClasses[size],
            'pointer-events-auto'
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
    </>
  );
};

export default Modal;
