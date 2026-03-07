/**
 * Shared modal styles and constants
 * Common patterns for modal overlays, content, headers, and footers
 */

/**
 * Base modal overlay styles - full-screen backdrop
 */
export const modalOverlayStyles = `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(2px);
  animation: modalFadeIn 0.2s ease-out;

  @keyframes modalFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

/**
 * Base modal content styles - centered container
 */
export const modalContentStyles = `
  background-color: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalScaleIn 0.2s ease-out;

  @keyframes modalScaleIn {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  [data-theme="dark"] & {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  }
`;

/**
 * Modal header styles - title area with close button
 */
export const modalHeaderStyles = `
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
`;

/**
 * Modal close button styles
 */
export const modalCloseButtonStyles = `
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  transition: color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--text-primary);
  }
`;

/**
 * Modal body styles - scrollable content area
 */
export const modalBodyStyles = `
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  color: var(--text-primary);
`;

/**
 * Modal footer styles - action buttons area
 */
export const modalFooterStyles = `
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
`;

/**
 * Modal button styles
 */
export const modalButtonStyles = `
  .btn {
    padding: 8px 16px;
    border: 1px solid;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
  }

  .btn:focus {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: transparent;
    color: var(--text-primary);
    border-color: var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-secondary);
  }

  .btn-danger {
    background: #dc2626;
    color: white;
    border-color: #dc2626;
  }

  .btn-danger:hover:not(:disabled) {
    background: #b91c1c;
  }

  .footer-left,
  .footer-right {
    display: flex;
    gap: 8px;
  }
`;

/**
 * Combined modal styles - all common patterns
 */
export const combineModalStyles = () => `
  .modal-overlay {
    ${modalOverlayStyles}
  }

  .modal-content {
    ${modalContentStyles}
  }

  .modal-header {
    ${modalHeaderStyles}
  }

  .modal-close {
    ${modalCloseButtonStyles}
  }

  .modal-body {
    ${modalBodyStyles}
  }

  .modal-footer {
    ${modalFooterStyles}
  }

  ${modalButtonStyles}
`;

/**
 * Z-index constants for consistent layering
 */
export const MODAL_Z_INDEX = {
  OVERLAY: 9999,
  CONTENT: 10000,
  MENU: 10001,
  TOOLTIP: 10002,
} as const;
