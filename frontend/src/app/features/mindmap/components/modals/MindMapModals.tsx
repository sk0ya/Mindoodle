import React, { memo, useState } from 'react';
import ImageModal from './ImageModal';
import { MindMapModalsProvider, useMindMapModals, type MindMapModalsProviderProps } from './MindMapModalsContext';


const useImageModal = () => {
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageAlt, setImageAlt] = useState<string>('');

  const handleShowImage = (url: string, alt?: string) => {
    setImageUrl(url);
    setImageAlt(alt || 'Image');
    setShowImageModal(true);
  };

  const handleCloseImage = () => {
    setShowImageModal(false);
    setImageUrl(null);
    setImageAlt('');
  };

  return {
    showImageModal,
    imageUrl,
    imageAlt,
    handleShowImage,
    handleCloseImage
  };
};

/**
 * AI生成モーダル管理フック
 * Note: nodeOperations should be passed as a parameter from the component using the context
 */
/**
 * メインのモーダル管理コンポーネント（内部実装）
 */
const MindMapModalsInternal: React.FC = () => {
  const {  uiOperations } = useMindMapModals();
  const {
    showImageModal,
    imageUrl,
    imageAlt,
    handleShowImage,
    handleCloseImage
  } = useImageModal();

  // Expose the image modal handler through the context
  React.useEffect(() => {
    if (uiOperations.onShowImageModal !== handleShowImage) {
      // The context should provide the handler
      // We'll connect this when the context is properly set up
    }
  }, [handleShowImage, uiOperations.onShowImageModal]);

  return (
    <>
      <ImageModal
        isOpen={showImageModal}
        imageUrl={imageUrl}
        altText={imageAlt}
        onClose={handleCloseImage}
      />
    </>
  );
};


const MindMapModals: React.FC<Omit<MindMapModalsProviderProps, 'children'>> = (props) => {
  return (
    <MindMapModalsProvider {...props}>
      <MindMapModalsInternal />
    </MindMapModalsProvider>
  );
};

export default memo(MindMapModals);
