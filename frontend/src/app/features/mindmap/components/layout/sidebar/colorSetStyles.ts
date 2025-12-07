/**
 * Shared styles for color set selection UI
 * Used by both SettingsSidebar and ColorSettingsSidebar
 */

export const colorSetStyles = `
  .color-set-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin-top: 12px;
  }

  .color-set-card {
    padding: 12px;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--bg-secondary);
  }

  .color-set-card:hover {
    border-color: var(--accent-color);
    background: var(--hover-color);
  }

  .color-set-card.selected {
    border-color: var(--accent-color);
    background: rgba(0, 122, 204, 0.1);
  }

  .color-set-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .color-set-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .color-set-check {
    color: var(--accent-color);
    font-size: 16px;
    font-weight: bold;
  }

  .color-set-colors {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .color-set-swatch {
    flex: 1;
    height: 24px;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }

  .color-set-description {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.4;
  }
`;
