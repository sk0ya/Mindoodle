import React, { memo, useState } from 'react';
import { X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

interface WebPreviewModalProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
}

const WebPreviewModal: React.FC<WebPreviewModalProps> = ({ url, isOpen, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isOpen) return null;

  const handleOpenInNewTab = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const panelWidth = isCollapsed ? '48px' : '45%';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: panelWidth,
        backgroundColor: '#ffffff',
        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10000,
        transition: 'width 0.3s ease'
      }}
    >
      {}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #e1e4e8',
          backgroundColor: '#f6f8fa',
          minHeight: '52px'
        }}
      >
        {!isCollapsed && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span
              style={{
                fontSize: '13px',
                color: '#656d76',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={url}
            >
              {url}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {!isCollapsed && (
            <button
              onClick={handleOpenInNewTab}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #d0d7de',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#24292f',
                fontWeight: '500',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f6f8fa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
              title="新しいタブで開く"
            >
              <ExternalLink size={14} />
              <span>新しいタブ</span>
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              backgroundColor: '#ffffff',
              border: '1px solid #d0d7de',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#656d76',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f6f8fa';
              e.currentTarget.style.color = '#24292f';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#656d76';
            }}
            title={isCollapsed ? '展開' : '折りたたむ'}
          >
            {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              backgroundColor: '#ffffff',
              border: '1px solid #d0d7de',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#656d76',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f6f8fa';
              e.currentTarget.style.color = '#24292f';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#656d76';
            }}
            title="閉じる"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {}
      {!isCollapsed && (
        <div style={{ flex: 1, position: 'relative', backgroundColor: '#ffffff' }}>
          <iframe
            src={url}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            title="Web Preview"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      )}
    </div>
  );
};

export default memo(WebPreviewModal);
