import type { MindMapNode } from '@shared/types';
import type { NormalizedData } from '../../../core/data/normalizedStore';
import { COLORS } from '../../../shared/constants';
import { hasInternalMarkdownLinks, extractExternalLinksFromMarkdown } from '../../markdown/markdownLinkUtils';
import { LineEndingUtils } from '@shared/utils/lineEndingUtils';

// アイコンレイアウト情報
interface IconLayout {
  totalWidth: number; // アイコン群の総幅
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
  const RIGHT_MARGIN = 2; // 右端との最小余白
  
  let totalWidth = 0;
  let linkIcon: { x: number; y: number } | undefined;
  
  if (hasLinks) {
    // リンクのみ（添付ファイル機能は廃止されているため）
    totalWidth = ICON_WIDTH;
    const startX = nodeWidth / 2 - totalWidth - RIGHT_MARGIN;

    linkIcon = { x: startX, y: -ICON_HEIGHT / 2 };
  }
  
  return {
    totalWidth,
    linkIcon
  };
}

export function calculateNodeSize(
  node: MindMapNode, 
  editText?: string, 
  isEditing: boolean = false,
  globalFontSize?: number
): NodeSize {
  // Table node sizing - 動的サイズ更新に対応
  if (node.kind === 'table') {
    // カスタムサイズが設定されている場合は、それを使用（動的更新済み）
    if (node.customImageWidth && node.customImageHeight) {
      const contentWidth = node.customImageWidth;
      const contentHeight = node.customImageHeight;
      // テーブル表示に適したパディング
      const padding = 10;
      return {
        width: contentWidth + padding,
        height: contentHeight + padding,
        imageHeight: contentHeight
      };
    }

    // カスタムサイズが未設定の場合のフォールバック計算
    const parseTableFromString = (src?: string): { headers?: string[]; rows: string[][] } | null => {
      if (!src) return null;
      const lines = LineEndingUtils.splitLines(src).filter(l => !LineEndingUtils.isEmptyOrWhitespace(l));
      for (let i = 0; i < lines.length - 1; i++) {
        const header = lines[i];
        const sep = lines[i + 1];
        const isHeader = /^\|.*\|$/.test(header) || header.includes('|');
        const isSep = /:?-{3,}:?\s*\|/.test(sep) || /^\|?(\s*:?-{3,}:?\s*\|)+(\s*:?-{3,}:?\s*)\|?$/.test(sep);
        if (isHeader && isSep) {
          const outRows: string[][] = [];
          const toCells = (line: string) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
          const headers = toCells(header);
          outRows.push(headers);
          let j = i + 2;
          while (j < lines.length && lines[j].includes('|')) {
            outRows.push(toCells(lines[j]));
            j++;
          }
          return { headers, rows: outRows.slice(1) };
        }
      }
      return null;
    };

    let parsed = parseTableFromString(node.text) || parseTableFromString((node as any).note);
    if (!parsed) {
      const td = (node as any).tableData as { headers?: string[]; rows?: string[][] } | undefined;
      if (td && Array.isArray(td.rows)) {
        parsed = { headers: td.headers, rows: td.rows } as any;
      }
    }

    // NodeRendererと同じ高さ計算（フォールバック用）
    const calculateTableHeight = (parsed: { headers?: string[]; rows: string[][] } | null): number => {
      if (!parsed) return 70;
      const headerRows = parsed.headers ? 1 : 0;
      const dataRows = parsed.rows.length;
      const totalRows = headerRows + dataRows;
      // NodeRendererの新しいCSS: padding: '12px 16px', line-height: 1.5, fontSize: 14px * 0.95
      // 実際の計算: (13.3px * 1.5) + (12px * 2) = 19.95px + 24px = 43.95px ≈ 44px
      const rowHeight = 44;
      return Math.max(70, totalRows * rowHeight + 12); // 最小70px + 適切なマージン
    };

    const calculatedHeight = calculateTableHeight(parsed);
    const contentWidth = Math.max(150, 200); // 基本的な幅
    const contentHeight = calculatedHeight;

    const padding = 10; // テーブル表示に適したパディング
    const nodeWidth = contentWidth + padding;
    const nodeHeight = contentHeight + padding;

    return {
      width: nodeWidth,
      height: nodeHeight,
      imageHeight: contentHeight
    };
  }

  // 画像の有無とサイズを確認（添付 or ノート埋め込み画像）
  // 添付画像は廃止。ノート内画像のみ検出
  const noteStr: string = (node as any)?.note || '';
  const hasNoteImages = !!noteStr && ( /!\[[^\]]*\]\(([^)]+)\)/.test(noteStr) || /<img[^>]*\ssrc=["'][^"'>\s]+["'][^>]*>/i.test(noteStr) );
  const hasMermaid = !!noteStr && /```mermaid[\s\S]*?```/i.test(noteStr);
  const hasImages = !!(hasNoteImages || hasMermaid);
  
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
        // 画像: <img>サイズ指定を反映
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
        // デフォルトのコンテンツサイズを使用（画像/mermaid）
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

    // 非常に長いテキスト（特に全角文字）に対する安全マージンを追加
    // Canvas測定とSVGレンダリングの微小な差異を補正
    if (displayText.length > 100) {
      const safetyMargin = measuredWidth * 0.02; // 測定幅の2%の安全マージン
      actualTextWidth = Math.max(measuredWidth + safetyMargin, minWidth);
    }

    // 非常に長いテキストの場合のデバッグ（開発時のみ）
    if (displayText.length > 100 && process.env.NODE_ENV === 'development') {
      console.log(`Long text debug - Length: ${displayText.length}, Measured: ${measuredWidth}, Font: ${fontSize}px`);
    }
  }
  
  // アイコンレイアウトに必要な最小幅を計算（リンクのみ、添付ファイル機能は廃止）
  const noteStr2 = (node as any)?.note as string | undefined;
  const hasLinks = hasInternalMarkdownLinks(noteStr2) || (extractExternalLinksFromMarkdown(noteStr2).length > 0);
  const ICON_WIDTH = 22; // 実際のアイコン幅に合わせる

  let minIconWidth = 0;
  if (hasLinks) {
    minIconWidth = ICON_WIDTH; // リンクアイコンのみ
  }
  
  // パディングを追加（左右に余白を持たせる）
  // 編集時はinputにpadding(左右各10px) + border(各1px)があり、foreignObject自体にも内側余白(-8)を設けているため
  // コンテンツ幅 >= 実測テキスト幅 となるように実質的な左右合計パディングを広めに確保する
  // 非編集時：テキスト長に応じて適応的なパディングを計算（SVGテキストレンダリングの安全性確保）
  let H_PADDING: number;
  if (isEditing) {
    H_PADDING = 34; // 編集時は合計約30px + 余裕4px
  } else {
    // 非編集時：基本パディング + テキスト長による適応的パディング
    const basePadding = 12; // 基本12px（左右各6px）
    const textLength = editText ? editText.length : node.text.length;
    const textLengthFactor = Math.min(textLength / 25, 1); // 25文字で1倍、最大1倍
    const additionalPadding = textLengthFactor * 13; // 最大13px追加（25px総計）
    H_PADDING = basePadding + additionalPadding;
  }
  const textBasedWidth = Math.max(actualTextWidth + H_PADDING, Math.max(fontSize * 2, 24));
  
  // ノードの高さは最小限に（フォントサイズ + 少しの上下パディング）
  const baseNodeHeight = Math.max(fontSize + 8, 22); // 元の高さに戻す
  
  // アイコンとテキストが共存する場合の幅計算
  let finalWidth: number;
  
  if (minIconWidth > 0) {
    // アイコンがある場合：テキスト幅 + アイコン幅 + 余白を確保
    const TEXT_ICON_SPACING = 1; // テキストとアイコンの最小間隔
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
 * ノードの座標計算ユーティリティ
 * 一貫性のある座標計算を提供
 */

/**
 * ノードの左端X座標を計算
 */
export function getNodeLeftX(node: MindMapNode, nodeWidth: number): number {
  return node.x - nodeWidth / 2;
}

/**
 * ノードの右端X座標を計算
 */
export function getNodeRightX(node: MindMapNode, nodeWidth: number): number {
  return node.x + nodeWidth / 2;
}

/**
 * ノードの上端Y座標を計算
 */
export function getNodeTopY(node: MindMapNode, nodeHeight: number): number {
  return node.y - nodeHeight / 2;
}

/**
 * ノードの下端Y座標を計算
 */
export function getNodeBottomY(node: MindMapNode, nodeHeight: number): number {
  return node.y + nodeHeight / 2;
}

/**
 * ノードの境界を計算する（統一インターフェース）
 */
export function getNodeBounds(node: MindMapNode, nodeSize: NodeSize) {
  return {
    left: getNodeLeftX(node, nodeSize.width),
    right: getNodeRightX(node, nodeSize.width),
    top: getNodeTopY(node, nodeSize.height),
    bottom: getNodeBottomY(node, nodeSize.height),
    centerX: node.x,
    centerY: node.y,
    width: nodeSize.width,
    height: nodeSize.height
  };
}

export function getToggleButtonPosition(node: MindMapNode, rootNode: MindMapNode, nodeSize?: NodeSize, globalFontSize?: number) {
  // ルートノード自身の場合は常に右側に配置
  const isRootNodeItself = node.id === rootNode.id;
  const isOnRight = isRootNodeItself ? true : node.x > rootNode.x;

  // 一貫したノードサイズ計算を使用（引数で渡されない場合は内部で計算）
  const actualNodeSize = nodeSize || calculateNodeSize(node, undefined, false, globalFontSize);

  // フォントサイズとノードサイズに応じた動的なマージン調整
  const fontSize = globalFontSize || 14;
  // フォントサイズに比例した基本マージン
  const base = Math.max(fontSize * 1.5, 20);

  // Mermaidや表など「ビジュアルが大きいノード」はトグルを遠ざけ過ぎない
  const note: string = (node as any)?.note || '';
  const hasMermaid = /```mermaid[\s\S]*?```/i.test(note);
  const isTable = (node as any)?.kind === 'table';
  const isVisualHeavy = hasMermaid || isTable;

  let baseMargin = base;
  let widthAdjustment = 0;

  if (!isVisualHeavy) {
    // 画像の高さに応じた調整（軽微）
    if (actualNodeSize.imageHeight > 100) {
      baseMargin += Math.min((actualNodeSize.imageHeight - 100) * 0.08, 24); // 上限24px
    }
    // 幅に応じた追加調整（ノードサイズに比例させる）
    // 基準となる幅をフォントサイズの4倍程度に設定（より現実的な値）
    const baseWidth = fontSize * 4;
    // ノード幅が基準を超えた分の10%をマージンとして追加（より控えめ）
    widthAdjustment = Math.max(0, (actualNodeSize.width - baseWidth) * 0.04);
    widthAdjustment = Math.min(widthAdjustment, 20); // 上限20px（より控えめ）
  } else {
    // ビジュアルが大きいノードは固定の小さめオフセット
    baseMargin += 8;
  }

  // 最終的なトグル余白をクランプ（より控えめな上限）
  const totalMargin = Math.min(Math.max(baseMargin + widthAdjustment, 12), 35);

  // ノードの右端から一定距離でトグルボタンを配置（統一された関数を使用）
  const nodeRightEdge = getNodeRightX(node, actualNodeSize.width);
  const nodeLeftEdge = getNodeLeftX(node, actualNodeSize.width);

  const toggleX = isOnRight ? (nodeRightEdge + totalMargin) : (nodeLeftEdge - totalMargin);
  const toggleY = node.y;


  return { x: toggleX, y: toggleY };
}

/**
 * 親ノードの右端から子ノードの左端までの水平距離を計算
 * トグルボタンの存在を考慮した間隔計算
 */
export function getDynamicNodeSpacing(parentNodeSize: NodeSize, childNodeSize: NodeSize, _isRootChild: boolean = false): number {
  // トグルボタンのサイズと最小間隔を考慮
  const toggleButtonWidth = 20; // トグルボタンの幅
  const minToggleToChildSpacing = 15; // トグルボタンと子ノードの最小間隔

  // 基本間隔（親ノード → トグルボタン → 子ノード）
  const baseSpacing = 30;

  // 親ノードと子ノードの幅を考慮した追加間隔
  const parentWidthFactor = Math.min(parentNodeSize.width / 100, 1) * 5; // 最大5px追加
  const childWidthFactor = Math.min(childNodeSize.width / 100, 1) * 5;   // 最大5px追加

  // トグルボタンのためのスペースを確保
  const calculatedSpacing = baseSpacing + parentWidthFactor + childWidthFactor;
  const minRequiredSpacing = toggleButtonWidth + minToggleToChildSpacing;

  return Math.round(Math.max(calculatedSpacing, minRequiredSpacing));
}

/**
 * 親ノードの右端から子ノードの左端までの距離に基づいて子ノードのX座標を計算
 * トグルボタンの位置を考慮して重なりを防ぐ
 */
export function calculateChildNodeX(parentNode: MindMapNode, childNodeSize: NodeSize, edgeToEdgeDistance: number, globalFontSize?: number): number {
  const parentNodeSize = calculateNodeSize(parentNode, undefined, false, globalFontSize);
  const parentRightEdge = getNodeRightX(parentNode, parentNodeSize.width);

  // 基本的な子ノード位置計算
  const basicChildLeftEdge = parentRightEdge + edgeToEdgeDistance;

  // トグルボタンの位置を計算（getToggleButtonPositionと同じロジック）
  const togglePosition = getToggleButtonPosition(parentNode, parentNode, parentNodeSize, globalFontSize);
  const toggleButtonWidth = 20; // トグルボタンの幅
  const minToggleToChildSpacing = 15; // トグルボタンと子ノードの最小間隔
  const requiredChildLeftEdge = togglePosition.x + toggleButtonWidth / 2 + minToggleToChildSpacing;

  // 基本計算と、トグルボタンを考慮した位置の、より右側を使用
  const finalChildLeftEdge = Math.max(basicChildLeftEdge, requiredChildLeftEdge);
  const childCenterX = finalChildLeftEdge + childNodeSize.width / 2;

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
