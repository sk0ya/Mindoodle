import type { MindMapNode } from '@shared/types';
import type { NormalizedData } from '../../../core/data/normalizedStore';
import { COLORS } from '../../../shared/constants';
import { hasInternalMarkdownLinks, extractExternalLinksFromMarkdown } from '../markdown/markdownLinkUtils';

// アイコンレイアウト情報
interface IconLayout {
  totalWidth: number; // アイコン群の総幅
  attachmentIcon?: {
    x: number; // ノード中心からの相対X座標
    y: number; // ノード中心からの相対Y座標
  };
  linkIcon?: {
    x: number; // ノード中心からの相対X座標
    y: number; // ノード中心からの相対Y座標
  };
}

interface NodeSize {
  width: number;
  height: number;
  imageHeight: number;
}

// Canvas要素を使用してテキストの実際の幅を測定するためのキャッシュ
let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;

/**
 * 測定用Canvasコンテキストを確実に初期化する
 */
function ensureMeasureContext(): CanvasRenderingContext2D | null {
  if (!measureCanvas || !measureContext) {
    measureCanvas = document.createElement('canvas');
    // DOMの影響を受けないようにCanvasを完全に隠し、配置しない
    measureCanvas.style.position = 'absolute';
    measureCanvas.style.left = '-9999px';
    measureCanvas.style.top = '-9999px';
    measureCanvas.style.visibility = 'hidden';
    measureCanvas.width = 1;
    measureCanvas.height = 1;
    
    measureContext = measureCanvas.getContext('2d');
    
    if (!measureContext) {
      return null;
    }
    
    // デフォルトのフォント設定でコンテキストをリセット
    measureContext.font = '14px system-ui, -apple-system, sans-serif';
    measureContext.textBaseline = 'alphabetic';
    measureContext.textAlign = 'left';
  }
  return measureContext;
}

/**
 * Canvas APIを使用してテキストの実際の幅を測定
 * @param text 計算対象のテキスト
 * @param fontSize フォントサイズ（px）
 * @param fontFamily フォントファミリー
 * @param fontWeight フォントウェイト
 * @param fontStyle フォントスタイル
 * @returns 実際のピクセル幅
 */
function measureTextWidth(
  text: string, 
  fontSize: number = 14, 
  fontFamily: string = 'system-ui, -apple-system, sans-serif',
  fontWeight: string = 'normal',
  fontStyle: string = 'normal'
): number {
  // 空文字の場合は0を返す
  if (!text) return 0;
  
  // 測定用Canvasコンテキストを確実に取得
  const context = ensureMeasureContext();
  
  if (!context) {
    // Canvas APIが使用できない場合は従来の文字数ベースの計算にフォールバック
    return calculateTextWidthFallback(text) * fontSize * 0.6;
  }
  
  // フォント設定を適用（毎回明示的に設定して一貫性を保つ）
  const fontString = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  context.font = fontString;
  
  // 一貫した測定のためにベースラインとアラインメントを再設定
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  
  // テキストの実際の幅を測定
  const metrics = context.measureText(text);
  return metrics.width;
}

/**
 * テキストの表示幅を計算（全角文字を考慮） - フォールバック用
 * @param text 計算対象のテキスト
 * @returns 表示幅（半角文字1文字を1とした単位）
 */
function calculateTextWidthFallback(text: string): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    
    // 全角文字の判定
    if (
      // 日本語文字（ひらがな、カタカナ、漢字）
      (code >= 0x3040 && code <= 0x309F) || // ひらがな
      (code >= 0x30A0 && code <= 0x30FF) || // カタカナ
      (code >= 0x4E00 && code <= 0x9FAF) || // 漢字
      // 全角記号・全角英数字
      (code >= 0xFF00 && code <= 0xFFEF) ||
      // その他の全角文字
      code > 0x007F
    ) {
      width += 2; // 全角文字は2倍の幅
    } else {
      width += 1; // 半角文字は1倍の幅
    }
  }
  return width;
}

/**
 * ノードのアイコンレイアウトを計算
 */
export function calculateIconLayout(node: MindMapNode, nodeWidth: number): IconLayout {
  const noteStr = (node as any)?.note as string | undefined;
  const hasLinks = hasInternalMarkdownLinks(noteStr) || (extractExternalLinksFromMarkdown(noteStr).length > 0);
  
  // アイコンの基本サイズ
  const ICON_WIDTH = 22;
  const ICON_HEIGHT = 14;
  const ICON_SPACING = 6;
  const RIGHT_MARGIN = 2; // 右端との最小余白
  
  let totalWidth = 0;
  let attachmentIcon: { x: number; y: number } | undefined;
  let linkIcon: { x: number; y: number } | undefined;
  
  if (hasLinks) {
    // 両方ある場合: 添付ファイル + スペース + リンク
    totalWidth = ICON_WIDTH + ICON_SPACING + ICON_WIDTH;
    const startX = nodeWidth / 2 - totalWidth - RIGHT_MARGIN;
    
    attachmentIcon = { x: startX, y: -ICON_HEIGHT / 2 };
    linkIcon = { x: startX + ICON_WIDTH + ICON_SPACING, y: -ICON_HEIGHT / 2 };
  } else if (hasLinks) {
    // リンクのみ
    totalWidth = ICON_WIDTH;
    const startX = nodeWidth / 2 - totalWidth - RIGHT_MARGIN;
    
    linkIcon = { x: startX, y: -ICON_HEIGHT / 2 };
  }
  
  return {
    totalWidth,
    attachmentIcon,
    linkIcon
  };
}

export function calculateNodeSize(
  node: MindMapNode, 
  editText?: string, 
  isEditing: boolean = false,
  globalFontSize?: number
): NodeSize {
  // 画像の有無とサイズを確認（添付 or ノート埋め込み画像）
  // 添付画像は廃止。ノート内画像のみ検出
  const noteStr: string = (node as any)?.note || '';
  const hasNoteImages = !!noteStr && ( /!\[[^\]]*\]\(([^)]+)\)/.test(noteStr) || /<img[^>]*\ssrc=["'][^"'>\s]+["'][^>]*>/i.test(noteStr) );
  const hasImages = !!hasNoteImages;
  
  let imageHeight = 0;
  let imageWidth = 0;
  
  if (hasImages) {
    // カスタムサイズを優先
    if (node.customImageWidth && node.customImageHeight) {
      imageWidth = node.customImageWidth;
      imageHeight = node.customImageHeight;
    } else {
      // ノート内の<img>幅/高さを使用（最初に見つかったもの）
      let noteW: number | null = null;
      let noteH: number | null = null;
      if (noteStr) {
        const tagMatch = noteStr.match(/<img[^>]*>/i);
        if (tagMatch) {
          const tag = tagMatch[0];
          const wMatch = tag.match(/\swidth=["']?(\d+)(?:px)?["']?/i);
          const hMatch = tag.match(/\sheight=["']?(\d+)(?:px)?["']?/i);
          if (wMatch && hMatch) {
            const w = parseInt(wMatch[1], 10);
            const h = parseInt(hMatch[1], 10);
            if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
              noteW = w; noteH = h;
            }
          }
        }
      }
      if (noteW && noteH) {
        imageWidth = noteW;
        imageHeight = noteH;
      } else {
        // デフォルトの画像サイズを使用
        imageWidth = 150;
        imageHeight = 105;
      }
    }
  }
  
  // マークダウンリンク検出関数
  const isMarkdownLink = (text: string): boolean => {
    const markdownLinkPattern = /^\[([^\]]*)\]\(([^)]+)\)$/;
    return markdownLinkPattern.test(text);
  };

  // マークダウンリンクから表示テキストを抽出
  const getDisplayTextFromMarkdownLink = (text: string): string => {
    const match = text.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
    return match ? match[1] : text;
  };

  // 編集中は editText の長さ、非編集時は表示用の長さを使用
  let effectiveText: string;
  if (isEditing && editText !== undefined) {
    effectiveText = editText;
  } else {
    // 非編集時：マークダウンリンクの場合は表示テキストのみ使用
    effectiveText = isMarkdownLink(node.text) ? getDisplayTextFromMarkdownLink(node.text) : node.text;
  }
  
  // フォント設定を取得
  const fontSize = globalFontSize || node.fontSize || 14;
  const fontFamily = node.fontFamily || 'system-ui, -apple-system, sans-serif';
  const fontWeight = node.fontWeight || 'normal';
  const fontStyle = node.fontStyle || 'normal';
  
  // Canvas APIを使用して実際のテキスト幅を測定（マーカーを含む）
  let actualTextWidth: number;
  if (isEditing) {
    // 編集中は実際のテキスト幅を計算し、最小幅を確保
    const measuredWidth = measureTextWidth(effectiveText, fontSize, fontFamily, fontWeight, fontStyle);
    const minWidth = fontSize * 8; // 最小8文字分の幅
    actualTextWidth = Math.max(measuredWidth, minWidth);
  } else {
    // 非編集時は実際のテキスト幅を計算（マーカーを含む）
    let displayText = effectiveText;

    // マーカーがある場合は追加
    if (node.markdownMeta) {
      let marker = '';
      if (node.markdownMeta.type === 'heading') {
        marker = '# ';
      } else if (node.markdownMeta.type === 'unordered-list') {
        marker = '- ';
      } else if (node.markdownMeta.type === 'ordered-list') {
        marker = '1. ';
      }
      displayText = marker + effectiveText;
    }

    const measuredWidth = measureTextWidth(displayText, fontSize, fontFamily, fontWeight, fontStyle);
    const minWidth = fontSize * 2; // 最小2文字分の幅に縮小
    actualTextWidth = Math.max(measuredWidth, minWidth);
  }
  
  // アイコンレイアウトに必要な最小幅を計算
  const hasAttachments = false; // 添付画像UIは無効化方向
  const noteStr2 = (node as any)?.note as string | undefined;
  const hasLinks = hasInternalMarkdownLinks(noteStr2) || (extractExternalLinksFromMarkdown(noteStr2).length > 0);
  const ICON_WIDTH = 32;
  const ICON_SPACING = 6;
  
  let minIconWidth = 0;
  if (hasAttachments && hasLinks) {
    minIconWidth = ICON_WIDTH + ICON_SPACING + ICON_WIDTH; // 右マージンはここでは足さない
  } else if (hasAttachments || hasLinks) {
    minIconWidth = ICON_WIDTH; // 右マージンはレイアウト側で微調整
  }
  
  // パディングを追加（左右に余白を持たせる）
  // 編集時はinputにpadding(左右各10px) + border(各1px)があり、foreignObject自体にも内側余白(-8)を設けているため
  // コンテンツ幅 >= 実測テキスト幅 となるように実質的な左右合計パディングを広めに確保する
  const H_PADDING = isEditing ? 34 : 6; // 編集時は合計約30px + 余裕4px、非編集時は従来の6px
  const textBasedWidth = Math.max(actualTextWidth + H_PADDING, Math.max(fontSize * 2, 24));
  
  // ノードの高さは最小限に（フォントサイズ + 少しの上下パディング）
  const baseNodeHeight = Math.max(fontSize + 8, 22); // 元の高さに戻す
  
  // アイコンとテキストが共存する場合の幅計算
  let finalWidth: number;
  
  if (minIconWidth > 0) {
    // アイコンがある場合：テキスト幅 + アイコン幅 + 余白を確保
    const TEXT_ICON_SPACING = 6; // さらにタイトに
    const combinedWidth = textBasedWidth + minIconWidth + TEXT_ICON_SPACING;
    const imageBasedWidth = hasImages ? imageWidth + 10 : 0;
    finalWidth = Math.max(combinedWidth, imageBasedWidth);
  } else {
    // アイコンがない場合：従来通り
    const imageBasedWidth = hasImages ? imageWidth + 10 : 0;
    finalWidth = Math.max(textBasedWidth, imageBasedWidth);
  }
  
  const nodeWidth = finalWidth;
  // 画像マージンはレイアウト計算に含めず、描画時のみ使用
  const nodeHeight = baseNodeHeight + imageHeight;

  return {
    width: nodeWidth,
    height: nodeHeight,
    imageHeight
  };
}

/**
 * ノードの左端X座標を計算
 */
export function getNodeLeftX(node: MindMapNode, nodeWidth: number): number {
  return node.x - nodeWidth / 2;
}

export function getToggleButtonPosition(node: MindMapNode, rootNode: MindMapNode, nodeSize: NodeSize, globalFontSize?: number) {
  // ルートノード自身の場合は常に右側に配置
  const isRootNodeItself = node.id === rootNode.id;
  const isOnRight = isRootNodeItself ? true : node.x > rootNode.x;
  
  // フォントサイズとノードサイズに応じた動的なマージン調整
  const fontSize = globalFontSize || 14;
  
  // フォントサイズに比例した基本マージン
  let baseMargin = Math.max(fontSize * 1.5, 20);
  
  // 画像の高さに応じてマージンを調整
  if (nodeSize.imageHeight > 100) {
    baseMargin = baseMargin + (nodeSize.imageHeight - 100) * 0.1;
  }
  
  // 幅に応じた追加調整（フォントサイズも考慮）
  const expectedMinWidth = fontSize * 8; // 想定される最小幅
  const widthAdjustment = Math.max(0, (nodeSize.width - expectedMinWidth) * 0.08);
  const totalMargin = baseMargin + widthAdjustment;
  
  // ノードの右端から一定距離でトグルボタンを配置
  const nodeRightEdge = node.x + nodeSize.width / 2;
  const nodeLeftEdge = node.x - nodeSize.width / 2;
  
  const toggleX = isOnRight ? (nodeRightEdge + totalMargin) : (nodeLeftEdge - totalMargin);
  const toggleY = node.y;
  
  return { x: toggleX, y: toggleY };
}

/**
 * 親ノードの右端から子ノードの左端までの水平距離を計算
 */
export function getDynamicNodeSpacing(parentNodeSize: NodeSize, childNodeSize: NodeSize, isRootChild: boolean = false): number {
  if (isRootChild) {
    // ルートノードの子の場合：密な配置にするため距離を大幅に短縮
    const baseDistance = 50; // 120から50に短縮
    const widthAdjustment = Math.max(0, (parentNodeSize.width - 100) * 0.1); // 0.2から0.1に削減
    const imageAdjustment = parentNodeSize.imageHeight > 0 ? parentNodeSize.imageHeight * 0.05 : 0; // 0.15から0.05に削減

    return baseDistance + widthAdjustment + imageAdjustment;
  } else {
    // 通常の親子間：密な配置にするため距離を短縮
    const baseDistance = 40; // 60から40に短縮
    const parentWidthAdjustment = Math.max(0, (parentNodeSize.width - 100) * 0.05); // 0.1から0.05に削減
    const parentImageAdjustment = parentNodeSize.imageHeight > 0 ? parentNodeSize.imageHeight * 0.05 : 0; // 0.1から0.05に削減
    const childSizeAdjustment = Math.max(0, (childNodeSize.width - 100) * 0.02); // 0.05から0.02に削減

    return baseDistance + parentWidthAdjustment + parentImageAdjustment + childSizeAdjustment;
  }
}

/**
 * 親ノードの右端から子ノードの左端までの距離に基づいて子ノードのX座標を計算
 */
export function calculateChildNodeX(parentNode: MindMapNode, childNodeSize: NodeSize, edgeToEdgeDistance: number): number {
  const parentNodeSize = calculateNodeSize(parentNode);
  const parentRightEdge = parentNode.x + parentNodeSize.width / 2;
  const childLeftEdge = parentRightEdge + edgeToEdgeDistance;
  const childCenterX = childLeftEdge + childNodeSize.width / 2;
  
  return childCenterX;
}

/**
 * ノードのルートブランチを特定し、そのブランチに対応する色を返す
 * @param nodeId ノードID
 * @param normalizedData 正規化されたデータ
 * @returns ブランチカラー
 */
export function getBranchColor(nodeId: string, normalizedData: NormalizedData): string {
  if (!normalizedData || !nodeId) return '#666';

  // 現在のノードがルートノードかどうかを判定
  const isRootNode = !normalizedData.parentMap[nodeId];

  if (isRootNode) {
    // ルートノード自体はデフォルト色
    return '#333';
  }

  // 現在のノードから親を辿ってルートノードの直接の子（ブランチルート）を見つける
  let currentNodeId = nodeId;
  let branchRootId: string | null = null;

  while (currentNodeId) {
    const parentId = normalizedData.parentMap[currentNodeId];

    if (!parentId) {
      // 親がいない = ルートノードに到達（これは起こらないはず）
      break;
    }

    // 親がルートノードかどうかをチェック
    const parentIsRoot = !normalizedData.parentMap[parentId];

    if (parentIsRoot) {
      // 親がルートノード = 現在のノードがブランチルート
      branchRootId = currentNodeId;
      break;
    }

    currentNodeId = parentId;
  }

  // ブランチルートが見つからない場合はデフォルト色
  if (!branchRootId) return '#666';

  // ルートノードを取得してその子ノード一覧からインデックスを特定
  const parentOfBranchRoot = normalizedData.parentMap[branchRootId];
  if (!parentOfBranchRoot) return '#666';

  const rootChildren = normalizedData.childrenMap[parentOfBranchRoot] || [];
  const branchIndex = rootChildren.indexOf(branchRootId);

  // インデックスに基づいて色を決定
  if (branchIndex >= 0) {
    return COLORS.NODE_COLORS[branchIndex % COLORS.NODE_COLORS.length];
  }

  return '#666';
}
