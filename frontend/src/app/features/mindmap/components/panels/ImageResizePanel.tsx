import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import type { MindMapNode } from '@shared/types';

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
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);

  // 初期アスペクト比を計算
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

  // ノートから画像を抽出して表示用URLを取得
  const extractNoteImages = (note?: string): string[] => {
    if (!note) return [];
    const urls: string[] = [];
    const re = /!\[[^\]]*\]\(\s*([^)]+)\)|<img[^>]*\ssrc=["']([^"'>]+)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(note)) !== null) {
      const url = m[1] || m[2];
      if (url) urls.push(url.trim());
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