/**
 * Shared styles for all sidebar components
 * Reduces duplication across SettingsSidebar, ColorSettingsSidebar, etc.
 */

export const sharedSidebarStyles = `
  .settings-section {
    margin-bottom: 24px;
  }

  .settings-section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 12px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .settings-section-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .settings-toggle {
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 4px 0;
  }

  .settings-toggle input[type="checkbox"] {
    margin-right: 8px;
    accent-color: #007acc;
  }

  .settings-toggle-label {
    color: var(--text-primary);
    font-size: 14px;
  }

  .settings-input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .settings-input-label {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .settings-input,
  .settings-select {
    padding: 6px 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
  }

  .settings-input:focus,
  .settings-select:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .settings-radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .settings-radio-option {
    display: flex;
    align-items: center;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .settings-radio-option:hover {
    background-color: var(--hover-color);
  }

  .settings-radio-option input[type="radio"] {
    margin-right: 8px;
    accent-color: var(--accent-color);
  }

  .settings-radio-label {
    display: flex;
    align-items: center;
    color: var(--text-primary);
    font-size: 14px;
  }

  .settings-icon {
    margin-right: 8px;
  }

  .settings-description {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    margin-top: 4px;
    padding-left: 4px;
  }

  .settings-button {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
  }

  .settings-button:hover {
    background-color: var(--hover-color);
    border-color: var(--accent-color);
    color: var(--text-primary);
  }
`;
