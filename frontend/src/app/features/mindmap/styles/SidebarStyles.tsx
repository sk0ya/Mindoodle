import React from 'react';

// Theme color palette
const colors = {
  light: {
    bg: '#ffffff',
    bgGradientStart: '#f8f9fa',
    bgGradientEnd: '#e9ecef',
    border: 'rgba(148, 163, 184, 0.2)',
    borderSolid: '#dee2e6',
    text: '#333',
    textSecondary: '#888',
    textMuted: '#6c757d',
    hover: 'rgba(229, 229, 229, 0.6)',
    inputBg: 'rgba(248, 250, 252, 0.8)',
    inputBgFocus: 'white',
    buttonBg: 'rgba(51, 65, 85, 0.08)',
    buttonBorder: 'rgba(51, 65, 85, 0.12)',
    buttonColor: '#475569',
    buttonHoverBg: 'rgba(51, 65, 85, 0.12)',
    buttonHoverColor: '#1e293b',
    controlBg: 'rgba(248, 250, 252, 0.9)',
    controlHoverBg: 'rgba(236, 239, 244, 0.9)',
    scrollThumb: 'rgba(148, 163, 184, 0.5)',
    scrollThumbHover: 'rgba(148, 163, 184, 0.7)',
    contextMenuBg: 'white',
    contextMenuBorder: '#ccc',
    contextMenuHover: '#f0f0f0',
    separator: '#e0e0e0',
  },
  dark: {
    bg: '#1f2937',
    bgGradientStart: '#374151',
    bgGradientEnd: '#4b5563',
    border: 'rgba(75, 85, 99, 0.3)',
    borderSolid: '#6b7280',
    text: '#d1d5db',
    textSecondary: '#9ca3af',
    textMuted: '#9ca3af',
    hover: 'rgba(75, 85, 99, 0.6)',
    inputBg: 'rgba(55, 65, 81, 0.8)',
    inputBgFocus: '#374151',
    buttonBg: 'rgba(75, 85, 99, 0.3)',
    buttonBorder: 'rgba(107, 114, 128, 0.4)',
    buttonColor: '#d1d5db',
    buttonHoverBg: 'rgba(107, 114, 128, 0.4)',
    buttonHoverColor: '#f3f4f6',
    controlBg: 'rgba(55, 65, 81, 0.9)',
    controlHoverBg: 'rgba(75, 85, 99, 0.9)',
    scrollThumb: 'rgba(107, 114, 128, 0.5)',
    scrollThumbHover: 'rgba(107, 114, 128, 0.7)',
    contextMenuBg: '#374151',
    contextMenuBorder: '#6b7280',
    contextMenuHover: '#4b5563',
    separator: '#6b7280',
  },
};

// Style generators
const themed = (prop: string, lightVal: string, darkVal: string) =>
  `${prop}: ${lightVal};\n    [data-theme="dark"] & { ${prop}: ${darkVal}; }`;

const scrollbar = (theme: 'light' | 'dark' = 'light') => `
  scrollbar-width: thin;
  scrollbar-color: ${colors[theme].scrollThumb} transparent;
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background-color: ${colors[theme].scrollThumb};
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background-color: ${colors[theme].scrollThumbHover};
  }`;

const button = (w = 32, h = 32) => `
  width: ${w}px;
  height: ${h}px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;`;

const hoverEffect = (scale = false) => `
  transition: all 0.2s ease;
  ${scale ? 'transform: scale(1.05);' : ''}`;

const SidebarStyles: React.FC = () => (
  <style>{`
    /* Base Sidebar */
    .mind-map-sidebar,
    .mindmap-sidebar {
      width: 280px;
      height: calc(100vh);
      ${themed('background', colors.light.bg, colors.dark.bg)}
      ${themed('border-right', `1px solid ${colors.light.border}`, `1px solid ${colors.dark.border}`)}
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 48px;
      top: 0;
      z-index: 100;
      overflow: hidden;
      box-shadow: 4px 0 6px -1px rgba(0, 0, 0, 0.05);
      padding-bottom: 24px;
    }

    [data-theme="dark"] .mind-map-sidebar,
    [data-theme="dark"] .mindmap-sidebar {
      box-shadow: 4px 0 6px -1px rgba(0, 0, 0, 0.2);
    }

    /* Collapsed State */
    .mind-map-sidebar.collapsed,
    .mindmap-sidebar.collapsed {
      width: 50px;
      height: 100vh;
      ${themed('background', `linear-gradient(to bottom, ${colors.light.bgGradientStart}, ${colors.light.bgGradientEnd})`, `linear-gradient(to bottom, ${colors.dark.bgGradientStart}, ${colors.dark.bgGradientEnd})`)}
      ${themed('border-right', `2px solid ${colors.light.borderSolid}`, `2px solid ${colors.dark.borderSolid}`)}
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 8px 40px 8px;
      position: fixed;
      left: 0;
      top: 0;
      z-index: 100;
      overflow: hidden;
    }

    /* Header */
    .sidebar-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      ${themed('color', colors.light.text, colors.dark.text)}
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-top {
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
    }

    .header-actions {
      display: flex !important;
      gap: 6px;
      align-items: center;
      flex-wrap: nowrap;
      justify-content: flex-start;
      width: 100%;
      margin: 0;
      overflow: visible !important;
    }

    /* Toggle Buttons */
    .sidebar-collapse-toggle,
    .sidebar-expand-toggle {
      ${button()}
      ${themed('background', colors.light.buttonBg, colors.dark.buttonBg)}
      ${themed('border', `1px solid ${colors.light.buttonBorder}`, `1px solid ${colors.dark.buttonBorder}`)}
      ${themed('color', colors.light.buttonColor, colors.dark.buttonColor)}
      font-size: 14px;
    }

    .sidebar-expand-toggle { margin-bottom: 12px; }

    .sidebar-collapse-toggle:hover,
    .sidebar-expand-toggle:hover {
      ${themed('background', colors.light.buttonHoverBg, colors.dark.buttonHoverBg)}
      ${themed('color', colors.light.buttonHoverColor, colors.dark.buttonHoverColor)}
      ${hoverEffect(true)}
    }

    /* Search */
    .search-container {
      display: flex;
      gap: 0;
      margin: 0;
      padding: 0;
      width: 100%;
    }

    .search-input {
      flex: 1;
      padding: 4px 6px;
      font-size: 12px;
      line-height: 1.1;
      ${themed('background', colors.light.inputBg, colors.dark.inputBg)}
      ${themed('border', `1px solid ${colors.light.border}`, `1px solid ${colors.dark.border}`)}
      ${themed('color', colors.light.text, colors.dark.text)}
      border-radius: 4px;
      transition: border-color 0.15s ease, background 0.15s ease;
      margin: 0;
      min-height: 24px;
      height: 24px;
    }

    .search-input:focus {
      outline: none;
      ${themed('background', colors.light.inputBgFocus, colors.dark.inputBgFocus)}
      border-color: rgba(59, 130, 246, 0.5);
      box-shadow: none;
    }

    [data-theme="dark"] .search-input:focus {
      border-color: rgba(59, 130, 246, 0.6);
    }

    .search-input::placeholder { font-size: 12px; }
    [data-theme="dark"] .search-input::placeholder { color: #9ca3af; }

    /* Control Buttons */
    .map-control-buttons {
      display: flex;
      gap: 2px;
      margin: 0;
      justify-content: flex-start;
    }

    .control-button {
      ${button(36, 36)}
      ${themed('background', colors.light.controlBg, colors.dark.controlBg)}
      ${themed('border', `1px solid ${colors.light.border}`, `1px solid ${colors.dark.border}`)}
      ${themed('color', colors.light.text, colors.dark.text)}
      padding: 0;
      margin: 0;
      font-size: 16px;
      min-width: 36px;
      min-height: 36px;
    }

    .control-button:hover {
      ${themed('background', colors.light.controlHoverBg, colors.dark.controlHoverBg)}
      ${themed('border-color', colors.light.border, colors.dark.border)}
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .control-button.add-map:hover {
      ${themed('background', 'rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.15)')}
      ${themed('border-color', 'rgba(16, 185, 129, 0.3)', 'rgba(16, 185, 129, 0.4)')}
      ${themed('color', '#059669', '#10b981')}
    }

    .control-button.add-folder:hover {
      ${themed('background', 'rgba(251, 191, 36, 0.1)', 'rgba(251, 191, 36, 0.15)')}
      ${themed('border-color', 'rgba(251, 191, 36, 0.3)', 'rgba(251, 191, 36, 0.4)')}
      ${themed('color', '#d97706', '#fbbf24')}
    }

    .control-button.expand-all:hover {
      ${themed('background', 'rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.15)')}
      ${themed('border-color', 'rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.4)')}
      ${themed('color', '#2563eb', '#3b82f6')}
    }

    .control-button.collapse-all:hover {
      ${themed('background', 'rgba(107, 114, 128, 0.1)', 'rgba(156, 163, 175, 0.15)')}
      ${themed('border-color', 'rgba(107, 114, 128, 0.3)', 'rgba(156, 163, 175, 0.4)')}
      ${themed('color', '#374151', '#d1d5db')}
    }

    /* Action Button */
    .action-button {
      background: linear-gradient(135deg, #10b981, #059669) !important;
      color: white !important;
      border: none !important;
      border-radius: 10px !important;
      ${button(36, 36).split('\n').map(l => l.trim() + ' !important').join('\n      ')}
      font-size: 16px !important;
      font-weight: bold !important;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2) !important;
      pointer-events: auto !important;
      z-index: 1000 !important;
      position: relative !important;
      visibility: visible !important;
      opacity: 1 !important;
      flex-shrink: 0 !important;
      overflow: visible !important;
      margin: 0 !important;
      padding: 0 !important;
      min-width: 36px !important;
      min-height: 36px !important;
      max-width: 36px !important;
      max-height: 36px !important;
    }

    .action-button:hover {
      background: linear-gradient(135deg, #059669, #047857) !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .action-button.category {
      background: #ff9800 !important;
    }

    .action-button.category:hover {
      background: #f57c00 !important;
    }

    .toggle-button {
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      ${button(28, 28)}
      font-size: 12px;
    }

    .toggle-button:hover { background: #5a6268; }

    .collapsed-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }

    /* Scrollable Content */
    .maps-content,
    .maps-content-wrapper {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      ${scrollbar('light')}
    }

    [data-theme="dark"] .maps-content,
    [data-theme="dark"] .maps-content-wrapper {
      ${scrollbar('dark')}
    }

    .maps-content-wrapper {
      position: relative;
      min-height: 0;
    }

    .maps-content-wrapper.drag-over-root {
      background: rgba(34, 197, 94, 0.05);
      border: 2px dashed rgba(34, 197, 94, 0.3);
      border-radius: 8px;
      margin: 8px;
    }

    /* Category */
    .category-group {
      margin: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      transition: all 0.15s ease;
      overflow: hidden;
    }

    .category-group.drag-over {
      background-color: rgba(59, 130, 246, 0.05);
      border: 2px dashed rgba(59, 130, 246, 0.3);
    }

    .category-header {
      padding: 8px 12px;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      font-size: 13px;
      ${themed('color', colors.light.text, colors.dark.text)}
      transition: all 0.15s ease;
      border-bottom: none;
      height: 32px;
    }

    .category-header[draggable="true"] { cursor: grab; }
    .category-header[draggable="true"]:active {
      cursor: grabbing;
      opacity: 0.7;
      transform: rotate(2deg);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }

    .category-header:hover {
      ${themed('background', colors.light.hover, colors.dark.hover)}
    }

    .category-header.selected {
      background: #0078d4;
      color: white;
    }

    .category-header.selected .category-folder-icon,
    .category-header.selected .category-expand-icon,
    .category-header.selected .category-name,
    .category-header.selected .category-count {
      color: white;
    }

    .category-header.drag-over {
      ${themed('background', 'rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.25)')}
    }

    .category-expand-icon {
      font-size: 10px;
      ${themed('color', '#666', colors.dark.textSecondary)}
      width: 12px;
      text-align: center;
      transition: transform 0.15s ease;
    }

    .category-folder-icon {
      font-size: 14px;
      ${themed('color', '#dcb67a', '#f59e0b')}
    }

    .category-name {
      flex: 1;
      font-size: 13px;
      ${themed('color', colors.light.text, colors.dark.text)}
    }

    .category-count {
      font-size: 11px;
      ${themed('color', colors.light.textSecondary, colors.dark.textSecondary)}
      ${themed('background', 'rgba(200, 200, 200, 0.3)', 'rgba(75, 85, 99, 0.4)')}
      padding: 1px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }

    .category-maps {
      background: transparent;
      padding-left: 18px;
    }

    /* Explorer File */
    .explorer-file {
      padding: 4px 12px;
      margin: 0;
      border-radius: 0;
      cursor: default;
      display: flex;
      align-items: center;
      gap: 6px;
      height: 26px;
    }

    .explorer-file.is-md { cursor: pointer; }

    .explorer-file:hover {
      ${themed('background', colors.light.hover, colors.dark.hover)}
    }

    .explorer-file .file-icon {
      font-size: 14px;
      ${themed('color', '#666', colors.dark.textSecondary)}
      display: inline-flex;
      align-items: center;
    }

    .explorer-file .file-name {
      font-size: 13px;
      ${themed('color', colors.light.text, colors.dark.text)}
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .explorer-file.selected {
      ${themed('background', 'rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.25)')}
    }

    .explorer-file.selected .file-name {
      ${themed('color', '#1f2937', '#e5e7eb')}
    }

    /* Map Item */
    .map-item {
      padding: 4px 12px;
      margin: 0;
      border-radius: 0;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.15s ease;
      position: relative;
      height: 28px;
      font-size: 13px;
    }

    .map-item[draggable="true"] { cursor: grab; }
    .map-item[draggable="true"]:active {
      cursor: grabbing;
      opacity: 0.7;
      transform: rotate(1deg);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .map-item:hover {
      ${themed('background', colors.light.hover, colors.dark.hover)}
      transform: none;
    }

    .map-item.active {
      background: #0078d4;
      color: white;
      border-left: none;
      box-shadow: none;
    }

    .map-item.active .map-title { color: white; }
    .map-item.active .map-meta { color: rgba(255, 255, 255, 0.8); }

    .map-info {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .map-file-icon {
      font-size: 14px;
      flex-shrink: 0;
    }

    .map-details {
      flex: 1;
      min-width: 0;
    }

    .map-title {
      font-size: 13px;
      font-weight: 400;
      ${themed('color', colors.light.text, colors.dark.text)}
      margin-bottom: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }

    .map-meta {
      display: none;
      gap: 8px;
      font-size: 11px;
      ${themed('color', colors.light.textSecondary, colors.dark.textSecondary)}
      margin-top: 2px;
    }

    .node-count,
    .update-date {
      white-space: nowrap;
    }

    /* Input */
    .title-input {
      width: 100%;
      border: 1px solid #4285f4;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 14px;
      font-weight: 500;
      background: white;
    }

    .title-input:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
    }

    /* Empty State */
    .empty-state {
      padding: 40px 20px;
      text-align: center;
      ${themed('color', colors.light.textMuted, colors.dark.textMuted)}
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-title {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 8px;
      ${themed('color', '#495057', colors.dark.text)}
    }

    .empty-description {
      font-size: 14px;
      line-height: 1.5;
    }

    /* Context Menu */
    .context-menu {
      ${themed('background', colors.light.contextMenuBg, colors.dark.contextMenuBg)}
      ${themed('border', `1px solid ${colors.light.contextMenuBorder}`, `1px solid ${colors.dark.contextMenuBorder}`)}
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 4px 0;
      min-width: 180px;
      font-size: 13px;
      z-index: 9999;
    }

    [data-theme="dark"] .context-menu {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .context-menu-item {
      padding: 8px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background-color 0.15s ease;
      ${themed('color', colors.light.text, colors.dark.text)}
    }

    .context-menu-item:hover {
      ${themed('background-color', colors.light.contextMenuHover, colors.dark.contextMenuHover)}
    }

    .context-menu-item.disabled {
      ${themed('color', '#999', '#6b7280')}
      cursor: not-allowed;
    }

    .context-menu-item.disabled:hover { background-color: transparent; }

    .context-menu-icon {
      width: 16px;
      text-align: center;
      flex-shrink: 0;
    }

    .context-menu-label { flex: 1; }

    .context-menu-separator {
      height: 1px;
      ${themed('background-color', colors.light.separator, colors.dark.separator)}
      margin: 4px 0;
    }

    /* Search Highlight */
    .search-highlight {
      background-color: #fef3c7;
      color: #d97706;
      padding: 1px 2px;
      border-radius: 2px;
      font-weight: 600;
      box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.2);
    }

    .search-highlight:first-child { margin-left: 0; }
    .search-highlight:last-child { margin-right: 0; }

    .category-name .search-highlight {
      background-color: #ecfdf5;
      color: #059669;
      box-shadow: 0 0 0 1px rgba(5, 150, 105, 0.2);
    }

    .map-title .search-highlight {
      background-color: #fef3c7;
      color: #d97706;
      box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.2);
    }

    [data-theme="dark"] .search-highlight {
      background-color: #92400e;
      color: #fbbf24;
      box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.3);
    }

    [data-theme="dark"] .category-name .search-highlight {
      background-color: #065f46;
      color: #34d399;
      box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.3);
    }

    [data-theme="dark"] .map-title .search-highlight {
      background-color: #92400e;
      color: #fbbf24;
      box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.3);
    }
  `}</style>
);

export default SidebarStyles;
