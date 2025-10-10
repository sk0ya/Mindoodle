import React, { useCallback, useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FileAttachment } from '@shared/types';
import { useEventListener } from '@shared/hooks/system/useEventListener';

interface ImageModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  altText?: string;
  onClose: () => void;
  
  file?: FileAttachment | null;
  files?: FileAttachment[];
  currentIndex?: number;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  imageUrl,
  altText = 'Image',
  onClose,
  file,
  files = [],
  currentIndex = 0,
  onNavigate
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft' && onNavigate && files.length > 1) {
      onNavigate('prev');
    } else if (e.key === 'ArrowRight' && onNavigate && files.length > 1) {
      onNavigate('next');
    }
  }, [onClose, onNavigate, files.length]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEventListener('keydown', handleKeyDown, { target: document, enabled: isOpen });

  const handleImageLoad = () => {
    setLoading(false);
    setError('');
  };

  const handleImageError = () => {
    setLoading(false);
    setError('画像の読み込みに失敗しました');
  };

  // Get the current image URL from file or imageUrl prop (prioritize dataURL for local images)
  const getCurrentImageUrl = (): string | null => {
    if (file) {
      const result = file.dataURL || file.data || file.downloadUrl || null;
      // Debug log for local image paths
      console.log('ImageModal - file data:', {
        name: file.name,
        hasDataURL: !!file.dataURL,
        hasData: !!file.data,
        hasDownloadUrl: !!file.downloadUrl,
        downloadUrl: file.downloadUrl,
        isRelativeLocal: (file as any).isRelativeLocal,
        result: result?.substring(0, 100) + '...'
      });
      return result;
    }
    return imageUrl;
  };

  // Get current file name for display
  const getCurrentFileName = (): string => {
    if (file) {
      return file.name;
    }
    return altText;
  };

  // Get current file size for display
  const getCurrentFileSize = (): number => {
    if (file && file.size) {
      return file.size;
    }
    return 0;
  };

  const currentImageUrl = getCurrentImageUrl();
  const currentFileName = getCurrentFileName();
  const currentFileSize = getCurrentFileSize();
  const hasMultipleImages = files.length > 1;

  // ファイルサイズのフォーマット関数（元の実装から）
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  
  useEffect(() => {
    if (currentImageUrl) {
      setLoading(true);
      setError('');
    }
  }, [currentImageUrl]);

  if (!isOpen || (!imageUrl && !currentImageUrl)) {
    return null;
  }

  return (
    <div className="image-modal-overlay" onClick={handleBackdropClick}>
      <div className="image-modal-content">
        <button
          className="image-modal-close"
          onClick={onClose}
          aria-label="画像を閉じる"
        >
          <X size={18} />
        </button>

        {/* Navigation buttons for multiple images */}
        {hasMultipleImages && onNavigate && (
          <>
            <button
              className="image-modal-nav image-modal-nav-prev"
              onClick={() => onNavigate('prev')}
              aria-label="前の画像"
              disabled={currentIndex === 0}
            >
              <ChevronLeft size={24} />
            </button>
            <button
              className="image-modal-nav image-modal-nav-next"
              onClick={() => onNavigate('next')}
              aria-label="次の画像"
              disabled={currentIndex === files.length - 1}
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        {}
        {hasMultipleImages && (
          <div className="image-modal-counter">
            {currentIndex + 1} / {files.length}
          </div>
        )}

        {}

        {loading && (
          <div className="image-modal-loading">
            読み込み中...
          </div>
        )}

        {error && (
          <div className="image-modal-error">
            {error}
          </div>
        )}

        <img
          src={currentImageUrl || ''}
          alt={currentFileName}
          className="image-modal-image"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{ display: loading ? 'none' : 'block' }}
        />

        {}
        <div className="image-modal-info">
          <p className="image-filename">{currentFileName}</p>
          {currentFileSize > 0 && (
            <p className="image-filesize">{formatFileSize(currentFileSize)}</p>
          )}
        </div>
      </div>

      <style>{`
        .image-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .image-modal-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: scaleIn 0.2s ease-out;
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .image-modal-close {
          position: absolute;
          top: -40px;
          right: -40px;
          background: rgba(255, 255, 255, 0.9);
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          z-index: 1001;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          color: #333;
        }

        .image-modal-close:hover {
          background: white;
          transform: scale(1.1);
        }

        .image-modal-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255, 255, 255, 0.9);
          border: none;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 1001;
          transition: all 0.2s ease;
          color: #333;
        }

        .image-modal-nav:hover:not(:disabled) {
          background: white;
          transform: translateY(-50%) scale(1.1);
        }

        .image-modal-nav:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .image-modal-nav-prev {
          left: -80px;
        }

        .image-modal-nav-next {
          right: -80px;
        }

        .image-modal-counter {
          position: absolute;
          top: -50px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }

        .image-modal-info {
          margin-top: 16px;
          text-align: center;
          color: white;
          background: rgba(0, 0, 0, 0.7);
          padding: 8px 16px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }

        .image-filename {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 500;
        }

        .image-filesize {
          margin: 0;
          font-size: 12px;
          opacity: 0.8;
        }

        .image-modal-image {
          max-width: 100%;
          max-height: calc(90vh - 80px);
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          background: transparent;
        }

        .image-modal-loading,
        .image-modal-error {
          color: white;
          text-align: center;
          padding: 40px;
          font-size: 16px;
        }

        .image-modal-error {
          color: #ff6b6b;
        }

        @media (max-width: 768px) {
          .image-modal-overlay {
            padding: 10px;
          }

          .image-modal-close {
            top: -30px;
            right: -30px;
            width: 28px;
            height: 28px;
            font-size: 16px;
          }

          .image-modal-image {
            max-height: calc(90vh - 60px);
          }

          .image-modal-loading,
          .image-modal-error {
            padding: 30px;
            font-size: 14px;
          }

          .image-modal-nav {
            width: 40px;
            height: 40px;
          }

          .image-modal-nav-prev {
            left: -60px;
          }

          .image-modal-nav-next {
            right: -60px;
          }

          .image-modal-counter {
            top: -40px;
            padding: 6px 12px;
            font-size: 12px;
          }

          .image-modal-info {
            margin-top: 12px;
            padding: 6px 12px;
          }

          .image-filename {
            font-size: 13px;
          }

          .image-filesize {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
};

export default ImageModal;