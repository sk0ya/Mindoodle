import React, { memo, useState } from 'react';
import AIGenerationModal from './AIGenerationModal';
import ImageModal from './ImageModal';
import { MindMapModalsProvider, useMindMapModals, type MindMapModalsProviderProps } from './MindMapModalsContext';
import type { MindMapNode } from '../../../../shared';

/**
 * 画像モーダル管理フック
 */
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
 */
const useAIModal = () => {
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTargetNode, setAiTargetNode] = useState<MindMapNode | null>(null);
  
  const handleAIGenerate = (node: MindMapNode) => {
    setAiTargetNode(node);
    setShowAIModal(true);
  };
  
  const handleAIGenerationComplete = (childTexts: string[]) => {
    const { nodeOperations } = useMindMapModals();
    
    if (aiTargetNode) {
      // 複数の子ノードを順番に作成
      childTexts.forEach((text, index) => {
        setTimeout(() => {
          // 子ノードを追加して新しいノードIDを取得
          const newNodeId = nodeOperations.onAddChild(aiTargetNode.id, text);
          
          // 追加ログを出力（デバッグ用）
          // Optionally log added/failed nodes here in dev
          void newNodeId;
        }, index * 100); // 各ノード作成を100ms間隔で実行
      });
    }
    setShowAIModal(false);
    setAiTargetNode(null);
  };
  
  const closeAIModal = () => {
    setShowAIModal(false);
    setAiTargetNode(null);
  };
  
  return {
    showAIModal,
    aiTargetNode,
    handleAIGenerate,
    handleAIGenerationComplete,
    closeAIModal
  };
};



/**
 * AI生成モーダルコンポーネント
 */
const AIGenerationModalComponent: React.FC<{ 
  showAIModal: boolean;
  aiTargetNode: MindMapNode | null;
  onGenerationComplete: (childTexts: string[]) => void;
  onClose: () => void;
}> = ({ showAIModal, aiTargetNode, onGenerationComplete, onClose }) => {
  return (
    <AIGenerationModal
      isOpen={showAIModal}
      parentNode={aiTargetNode}
      contextNodes={[]} // コンテキストノードの取得ロジックは後で実装
      onClose={onClose}
      onGenerationComplete={onGenerationComplete}
    />
  );
};

/**
 * メインのモーダル管理コンポーネント（内部実装）
 */
const MindMapModalsInternal: React.FC = () => {
  const { showAIModal, aiTargetNode, handleAIGenerationComplete, closeAIModal } = useAIModal();

  const {
    showImageModal,
    imageUrl,
    imageAlt,
    handleShowImage,
    handleCloseImage
  } = useImageModal();

  const { uiOperations } = useMindMapModals();

  // Expose the image modal handler through the context
  React.useEffect(() => {
    if (uiOperations.onShowImageModal !== handleShowImage) {
      // The context should provide the handler
      // We'll connect this when the context is properly set up
    }
  }, [handleShowImage, uiOperations.onShowImageModal]);

  return (
    <>
      <AIGenerationModalComponent
        showAIModal={showAIModal}
        aiTargetNode={aiTargetNode}
        onGenerationComplete={handleAIGenerationComplete}
        onClose={closeAIModal}
      />
      <ImageModal
        isOpen={showImageModal}
        imageUrl={imageUrl}
        altText={imageAlt}
        onClose={handleCloseImage}
      />
    </>
  );
};

/**
 * リファクタリング後のMindMapModalsコンポーネント
 * プロバイダーパターンを使用して複雑なpropsを整理
 */
const MindMapModals: React.FC<Omit<MindMapModalsProviderProps, 'children'>> = (props) => {
  return (
    <MindMapModalsProvider {...props}>
      <MindMapModalsInternal />
    </MindMapModalsProvider>
  );
};

export default memo(MindMapModals);
