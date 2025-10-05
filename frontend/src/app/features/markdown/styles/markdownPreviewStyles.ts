export const markdownPreviewStyles = `
  .markdown-editor {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
    background-color: var(--bg-primary);
  }

  .editor-container {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .editor-container.mode-edit {
    flex-direction: column;
  }

  .editor-container.mode-preview {
    flex-direction: column;
  }

  .editor-container.mode-split {
    flex-direction: row;
  }

  .mode-edit .editor-pane {
    flex: 1;
    overflow: hidden;
  }

  .mode-preview .preview-pane {
    flex: 1;
    overflow: hidden;
  }

  .mode-split .editor-pane {
    flex: 1;
    overflow: hidden;
    border-right: 1px solid var(--border-color);
  }

  .mode-split .preview-pane {
    flex: 1;
    overflow: hidden;
    border-right: none;
    border-left: none;
  }

  .editor-pane {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .preview-pane {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--bg-primary);
  }

  .preview-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    min-height: 0;
    height: 100%;
  }

  .markdown-preview {
    line-height: 1.6;
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }

  .markdown-preview h1,
  .markdown-preview h2,
  .markdown-preview h3,
  .markdown-preview h4,
  .markdown-preview h5,
  .markdown-preview h6 {
    margin: 20px 0 10px 0;
    font-weight: 600;
    line-height: 1.25;
  }

  .markdown-preview h1 {
    font-size: 2em;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 10px;
  }

  .markdown-preview h2 {
    font-size: 1.5em;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }

  .markdown-preview h3 {
    font-size: 1.25em;
  }

  .markdown-preview p {
    margin: 12px 0;
  }

  .markdown-preview ul,
  .markdown-preview ol {
    margin: 12px 0;
    padding-left: 20px;
  }

  .markdown-preview li {
    margin: 4px 0;
  }

  .markdown-preview pre {
    background: var(--bg-tertiary);
    border-radius: 6px;
    padding: 16px;
    overflow-x: auto;
    border: 1px solid var(--border-color);
    margin: 12px 0;
  }

  .markdown-preview code {
    background: var(--bg-tertiary);
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 85%;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  }

  .markdown-preview pre code {
    background: none;
    padding: 0;
  }

  .markdown-preview blockquote {
    border-left: 4px solid var(--border-color);
    padding: 0 16px;
    margin: 12px 0;
    color: var(--text-secondary);
  }

  .markdown-preview table {
    border-collapse: collapse;
    margin: 12px 0;
    width: 100%;
  }

  .markdown-preview th,
  .markdown-preview td {
    border: 1px solid var(--border-color);
    padding: 8px 12px;
    text-align: left;
  }

  .markdown-preview th {
    background: var(--bg-secondary);
    font-weight: 600;
  }

  .markdown-preview img {
    max-width: 100%;
    height: auto;
    margin: 12px 0;
  }

  .markdown-preview a {
    color: var(--accent-color);
    text-decoration: none;
  }

  .markdown-preview a:hover {
    text-decoration: underline;
  }

  .preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
    text-align: center;
  }

  .preview-empty-icon {
    margin-bottom: 16px;
    opacity: 0.6;
    color: var(--text-secondary);
  }

  .preview-empty-message {
    font-size: 14px;
    line-height: 1.5;
  }

  .vim-statusbar {
    background-color: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    padding: 4px 12px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    color: var(--text-primary);
    min-height: 20px;
    display: flex;
    align-items: center;
  }

  .vim-mode-indicator {
    font-weight: bold;
  }
`;
