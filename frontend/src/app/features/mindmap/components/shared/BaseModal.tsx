import React from 'react';
import { X } from 'lucide-react';
import { useModalBehavior } from './useModalBehavior';
import { combineModalStyles } from './modalStyles';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  showCloseButton?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * BaseModal - Reusable modal wrapper with common functionality
 *
 * Features:
 * - Body scroll lock
 * - Close on Escape key
 * - Close on backdrop click
 * - Dark mode support
 * - Consistent styling
 */
export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'medium',
  showCloseButton = true,
  closeOnEscape = true,
  closeOnBackdrop = true,
  className = '',
  contentClassName = '',
}) => {
  const { handleBackdropClick } = useModalBehavior(isOpen, onClose, {
    closeOnEscape,
    closeOnBackdrop,
    lockBodyScroll: true,
  });

  if (!isOpen) return null;

  const sizeClasses = {
    small: 'modal-size-small',
    medium: 'modal-size-medium',
    large: 'modal-size-large',
    fullscreen: 'modal-size-fullscreen',
  };

  return (
    <div className={`modal-overlay ${className}`} onClick={handleBackdropClick}>
      <div className={`modal-content ${sizeClasses[size]} ${contentClassName}`}>
        {title && (
          <div className="modal-header">
            <h2>{title}</h2>
            {showCloseButton && (
              <button
                className="modal-close"
                onClick={onClose}
                aria-label="閉じる"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>

      <style>{`
        ${combineModalStyles()}

        .modal-size-small {
          width: 400px;
          max-width: 90vw;
        }

        .modal-size-medium {
          width: 600px;
          max-width: 90vw;
        }

        .modal-size-large {
          width: 800px;
          max-width: 90vw;
        }

        .modal-size-fullscreen {
          width: 95vw;
          height: 95vh;
        }
      `}</style>
    </div>
  );
};

interface ModalFooterActionsProps {
  onCancel?: () => void;
  onSave?: () => void;
  saveText?: string;
  cancelText?: string;
  saveDisabled?: boolean;
  leftActions?: React.ReactNode;
  showCancel?: boolean;
  showSave?: boolean;
}

/**
 * ModalFooterActions - Standard footer with cancel/save buttons
 */
export const ModalFooterActions: React.FC<ModalFooterActionsProps> = ({
  onCancel,
  onSave,
  saveText = '保存',
  cancelText = 'キャンセル',
  saveDisabled = false,
  leftActions,
  showCancel = true,
  showSave = true,
}) => {
  return (
    <>
      <div className="footer-left">{leftActions}</div>
      <div className="footer-right">
        {showCancel && onCancel && (
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
        )}
        {showSave && onSave && (
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={saveDisabled}
          >
            {saveText}
          </button>
        )}
      </div>
    </>
  );
};
