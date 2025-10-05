import React from 'react';

const ContextMenuStyles: React.FC = () => (
  <style>{`
    .context-menu {
      background: white;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      border: 1px solid #e5e7eb;
      min-width: 220px;
      max-width: 300px;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
    }

    [data-theme="dark"] .context-menu {
      background: #2a2a2a;
      border: 1px solid #444;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
    }

    .menu-header {
      padding: 12px 16px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    [data-theme="dark"] .menu-header {
      background: #333;
      border-bottom: 1px solid #555;
    }

    .node-title {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 2px;
      word-wrap: break-word;
    }

    [data-theme="dark"] .node-title {
      color: #e0e0e0;
    }

    .link-description {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.4;
      word-wrap: break-word;
    }

    [data-theme="dark"] .link-description {
      color: #aaa;
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

    [data-theme="dark"] .menu-item:hover:not(.disabled) {
      background: #404040;
    }

    .menu-item.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .menu-item.danger {
      color: #dc2626;
    }

    .menu-item.danger:hover:not(.disabled) {
      background: #fef2f2;
    }

    [data-theme="dark"] .menu-item.danger {
      color: #ff6b6b;
    }

    [data-theme="dark"] .menu-item.danger:hover:not(.disabled) {
      background: #4a2c2c;
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

    .menu-divider {
      height: 1px;
      background: #e5e7eb;
      margin: 4px 0;
    }

    [data-theme="dark"] .menu-divider {
      background: #555;
    }

  `}</style>
);

export default ContextMenuStyles;
