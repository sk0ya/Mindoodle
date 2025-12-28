/**
 * Shared menu and context menu styles
 * Used by ContextMenu, LinkActionMenu, and other menu components
 */

export const menuStyles = `
  .menu-header {
    padding: 12px 16px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .menu-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 4px 0;
  }

  .menu-items {
    padding: 4px 0;
  }

  .menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 8px 16px;
    border: none;
    background: none;
    color: #374151;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .menu-item:hover:not(.disabled) {
    background: #f3f4f6;
  }

  .menu-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .menu-item.primary {
    color: #2563eb;
    font-weight: 500;
  }

  .menu-item.primary:hover:not(.disabled) {
    background: #dbeafe;
  }

  .menu-item.danger {
    color: #dc2626;
  }

  .menu-item.danger:hover:not(.disabled) {
    background: #fef2f2;
  }

  .menu-icon {
    margin-right: 8px;
    font-size: 14px;
    width: 16px;
    text-align: center;
  }

  .menu-text {
    flex: 1;
  }

  /* Dark theme support */
  [data-theme="dark"] .menu-header {
    background: #333;
    border-bottom: 1px solid #555;
  }

  [data-theme="dark"] .menu-divider {
    background: #555;
  }

  [data-theme="dark"] .menu-item {
    color: #e0e0e0;
  }

  [data-theme="dark"] .menu-item:hover:not(.disabled) {
    background: #404040;
  }

  [data-theme="dark"] .menu-item.danger {
    color: #ff6b6b;
  }

  [data-theme="dark"] .menu-item.danger:hover:not(.disabled) {
    background: #4a2c2c;
  }
`;

export const menuContainerStyles = `
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  min-width: 220px;
  max-width: 300px;
  overflow: visible;
  font-size: 14px;
  font-family: system-ui, -apple-system, sans-serif;

  /* Dark theme */
  [data-theme="dark"] & {
    background: #2a2a2a;
    border: 1px solid #444;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
  }
`;
