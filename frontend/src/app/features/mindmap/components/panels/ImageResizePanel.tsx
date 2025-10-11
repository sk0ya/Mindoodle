import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import type { MindMapNode } from '@shared/types';
import { useBooleanState } from '@shared/hooks/ui/useBooleanState';

interface ImageResizePanelProps {
  node: MindMapNode;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
}

const ImageResizePanel: React.FC<ImageResizePanelProps> = ({
  node,
  onUpdateNode
}) => {
  const [width, setWidth] = useState<number>(node.customImageWidth || 150);
  const [height, setHeight] = useState<number>(node.customImageHeight || 105);
  const { value: maintainAspectRatio, setValue: setMaintainAspectRatio } = useBooleanState({ initialValue: true });

  
  const initialAspectRatio = (node.customImageWidth || 150) / (node.customImageHeight || 105);

  useEffect(() => {
    setWidth(node.customImageWidth || 150);
    setHeight(node.customImageHeight || 105);
  }, [node.customImageWidth, node.customImageHeight]);

  const handleWidthChange = (newWidth: number) => {
    setWidth(newWidth);
    if (maintainAspectRatio) {
      const newHeight = Math.round(newWidth / initialAspectRatio);
      setHeight(newHeight);
      onUpdateNode(node.id, {
        customImageWidth: newWidth,
        customImageHeight: newHeight
      });
    } else {
      onUpdateNode(node.id, {
        customImageWidth: newWidth
      });
    }
  };

  const handleHeightChange = (newHeight: number) => {
    setHeight(newHeight);
    if (maintainAspectRatio) {
      const newWidth = Math.round(newHeight * initialAspectRatio);
      setWidth(newWidth);
      onUpdateNode(node.id, {
        customImageWidth: newWidth,
        customImageHeight: newHeight
      });
    } else {
      onUpdateNode(node.id, {
        customImageHeight: newHeight
      });
    }
  };

  const handleReset = () => {
    const defaultWidth = 150;
    const defaultHeight = 105;
    setWidth(defaultWidth);
    setHeight(defaultHeight);
    onUpdateNode(node.id, {
      customImageWidth: defaultWidth,
      customImageHeight: defaultHeight
    });
  };

  
  const extractNoteImages = (note?: string): string[] => {
    if (!note) return [];
    const urls: string[] = [];
    // Markdown images
    let idx = 0;
    while (idx < note.length) {
      const bang = note.indexOf('![', idx);
      if (bang === -1) break;
      const rbracket = note.indexOf('](', bang + 2);
      if (rbracket === -1) { idx = bang + 2; continue; }
      const close = note.indexOf(')', rbracket + 2);
      if (close === -1) { idx = rbracket + 2; continue; }
      const raw = note.slice(rbracket + 2, close).trim();
      const url = raw.split(/\s+/)[0];
      if (url) urls.push(url);
      idx = close + 1;
    }
    // HTML images
    idx = 0;
    const lower = note.toLowerCase();
    while (idx < note.length) {
      const tagStart = lower.indexOf('<img', idx);
      if (tagStart === -1) break;
      const tagEnd = note.indexOf('>', tagStart + 4);
      const tag = tagEnd !== -1 ? note.slice(tagStart, tagEnd + 1) : note.slice(tagStart);
      const srcPos = tag.toLowerCase().indexOf('src=');
      if (srcPos !== -1) {
        const rest = tag.slice(srcPos + 4).trim();
        const quote = rest[0];
        let url = '';
        if (quote === '"' || quote === '\'') {
          const qEnd = rest.indexOf(quote, 1);
          url = qEnd > 0 ? rest.slice(1, qEnd) : '';
        } else {
          const sp = rest.search(/[\s>]/);
          url = sp > 0 ? rest.slice(0, sp) : rest;
        }
        if (url) urls.push(url.trim());
      }
      idx = tagEnd === -1 ? tagStart + 4 : tagEnd + 1;
    }
    return urls;
  };

  const imageUrls = extractNoteImages(node.note);
  const hasImages = imageUrls.length > 0;

  if (!hasImages) {
    return (
      <div className="image-resize-panel">
        <div className="no-images-message">
          このノードには画像がありません
        </div>
        <style>{`
          .image-resize-panel {
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            border: 1px solid #e1e5e9;
          }

          .no-images-message {
            padding: 16px;
            text-align: center;
            color: #666;
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="image-resize-panel">
      <div className="panel-header">
        <h3>画像サイズ調整</h3>
        <button
          onClick={handleReset}
          className="reset-button"
          title="デフォルトサイズにリセット"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="size-controls">
        <div className="control-group">
          <label htmlFor="image-width">幅 (px)</label>
          <input
            id="image-width"
            type="number"
            min="50"
            max="800"
            value={width}
            onChange={(e) => handleWidthChange(parseInt(e.target.value) || 150)}
            className="size-input"
          />
        </div>

        <div className="control-group">
          <label htmlFor="image-height">高さ (px)</label>
          <input
            id="image-height"
            type="number"
            min="35"
            max="600"
            value={height}
            onChange={(e) => handleHeightChange(parseInt(e.target.value) || 105)}
            className="size-input"
          />
        </div>
      </div>

      <div className="aspect-ratio-control">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={maintainAspectRatio}
            onChange={(e) => setMaintainAspectRatio(e.target.checked)}
          />
          縦横比を維持
        </label>
      </div>

      <div className="preview-info">
        <div className="current-size">
          現在のサイズ: {width} × {height} px
        </div>
        <div className="aspect-ratio">
          縦横比: {(width / height).toFixed(2)}
        </div>
      </div>

      <style>{`
        .image-resize-panel {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border: 1px solid #e1e5e9;
          padding: 16px;
          min-width: 260px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e1e5e9;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .reset-button {
          background: none;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 4px;
          cursor: pointer;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .reset-button:hover {
          background: #f5f5f5;
          color: #333;
          border-color: #bbb;
        }

        .size-controls {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .control-group {
          flex: 1;
        }

        .control-group label {
          display: block;
          margin-bottom: 4px;
          font-size: 12px;
          font-weight: 500;
          color: #555;
        }

        .size-input {
          width: 100%;
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          transition: border-color 0.2s ease;
        }

        .size-input:focus {
          outline: none;
          border-color: #4285f4;
          box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.1);
        }

        .aspect-ratio-control {
          margin-bottom: 16px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          color: #555;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          margin: 0;
        }

        .preview-info {
          background: #f8f9fa;
          border-radius: 4px;
          padding: 12px;
        }

        .current-size,
        .aspect-ratio {
          margin: 0;
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }

        .current-size {
          font-weight: 500;
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
};

export default ImageResizePanel;
