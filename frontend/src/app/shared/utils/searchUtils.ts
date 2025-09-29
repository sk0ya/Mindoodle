import type { MindMapNode, MindMapData } from '../types';

export interface SearchResult {
  nodeId: string;
  text: string;
  note: string;
  mapId: string | null;
  mapTitle: string | null;
  matchType: 'text' | 'note';
  workspaceId: string;
}

export interface FileBasedSearchResult {
  filePath: string;
  fileName: string;
  mapId: string;
  workspaceId: string;
  lineNumber: number;
  lineContent: string;
  matchedText: string;
  matchType: 'text' | 'note';
}

/**
 * ノードを再帰的に検索して、検索クエリにマッチするノードを返す
 */
export function searchNodesRecursively(
  node: MindMapNode,
  query: string,
  mapData: MindMapData,
  results: SearchResult[] = []
): SearchResult[] {
  const searchTerm = query.toLowerCase().trim();
  
  // 現在のノードをチェック
  const textMatch = node.text.toLowerCase().includes(searchTerm);
  const noteMatch = node.note?.toLowerCase().includes(searchTerm);

  if (textMatch || noteMatch) {
    results.push({
      nodeId: node.id,
      text: node.text,
      note: node.note || '',
      mapId: mapData.mapIdentifier.mapId,
      mapTitle: mapData.title,
      matchType: textMatch ? 'text' : 'note',
      workspaceId: (mapData as any).mapIdentifier?.workspaceId as string
    });
  }

  // 子ノードを再帰的に検索
  if (node.children) {
    node.children.forEach(child => {
      searchNodesRecursively(child, query, mapData, results);
    });
  }

  return results;
}

/**
 * マインドマップ内のノードを検索する
 */
export function searchNodes(query: string, mapData: MindMapData | null): SearchResult[] {
  if (!query.trim() || !mapData) return [];

  const results: SearchResult[] = [];
  const rootNodes = mapData.rootNodes || [];
  for (const rootNode of rootNodes) {
    results.push(...searchNodesRecursively(rootNode, query, mapData));
  }
  return results;
}

/**
 * 複数のマインドマップからノードを検索する
 */
export function searchMultipleMaps(query: string, maps: MindMapData[]): SearchResult[] {
  if (!query.trim() || maps.length === 0) return [];
  
  const allResults: SearchResult[] = [];
  
  maps.forEach(mapData => {
    const rootNodes = mapData.rootNodes || [];
    rootNodes.forEach(rootNode => {
      const mapResults = searchNodesRecursively(rootNode, query, mapData);
      allResults.push(...mapResults);
    });
  });
  
  return allResults;
}

/**
 * ファイルベースの検索を行う（マークダウンファイルの内容を行単位で検索）
 */
export async function searchFilesForContent(
  query: string,
  storageAdapter: any,
  workspaces?: Array<{ id: string; name: string }>
): Promise<FileBasedSearchResult[]> {
  if (!query.trim() || !storageAdapter || typeof storageAdapter.loadAllMaps !== 'function') {
    return [];
  }

  const results: FileBasedSearchResult[] = [];
  const searchTerm = query.toLowerCase();

  try {
    // すべてのマップを取得
    const maps: MindMapData[] = await storageAdapter.loadAllMaps();

    for (const map of maps) {
      const mapId = map.mapIdentifier.mapId;
      const workspaceId = map.mapIdentifier.workspaceId;

      // ワークスペース名を取得
      const workspace = workspaces?.find(w => w.id === workspaceId);
      const workspaceName = workspace?.name || workspaceId || 'デフォルト';

      // マップ名（タイトル）を使用
      const mapName = map.title || mapId;

      // エクスプローラー形式のパス: ワークスペース名/マップ名
      const filePath = `${workspaceName}/${mapName}`;

      // マークダウン形式に変換してから行単位で検索
      const markdownContent = convertMapToMarkdown(map);
      const lines = markdownContent.split('\n');

      lines.forEach((line, index) => {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes(searchTerm)) {
          results.push({
            filePath,
            fileName: mapName,
            mapId,
            workspaceId: workspaceId || '',
            lineNumber: index + 1, // 1-based line numbers
            lineContent: line.trim(),
            matchedText: query,
            matchType: 'text' // ファイルベースでは主にテキストマッチ
          });
        }
      });
    }
  } catch (error) {
    console.error('File-based search error:', error);
  }

  return results;
}

/**
 * マップデータをMarkdown形式に変換する（検索用の簡易版）
 */
function convertMapToMarkdown(map: MindMapData): string {
  const lines: string[] = [];

  // タイトルを追加
  if (map.title) {
    lines.push(`# ${map.title}`);
    lines.push('');
  }

  // rootNodesを処理
  map.rootNodes?.forEach(rootNode => {
    convertNodeToMarkdown(rootNode, 0, lines);
  });

  return lines.join('\n');
}

/**
 * ノードをMarkdown形式に変換（再帰的）
 */
function convertNodeToMarkdown(node: MindMapNode, depth: number, lines: string[]): void {
  const indent = '  '.repeat(depth);
  const prefix = depth === 0 ? '## ' : '- ';

  // ノードのテキストを追加
  if (node.text) {
    lines.push(`${indent}${prefix}${node.text}`);
  }

  // ノートがあれば追加
  if (node.note) {
    const noteLines = node.note.split('\n');
    noteLines.forEach(noteLine => {
      if (noteLine.trim()) {
        lines.push(`${indent}  > ${noteLine.trim()}`);
      }
    });
  }

  // 子ノードを処理
  if (node.children) {
    node.children.forEach(child => {
      convertNodeToMarkdown(child, depth + 1, lines);
    });
  }
}

/**
 * 行番号からノードを特定する（マップデータから）
 */
export function findNodeByLineNumber(
  map: MindMapData,
  targetLineNumber: number
): { node: MindMapNode; depth: number } | null {
  let currentLine = 0;

  // タイトル行をカウント
  if (map.title) {
    currentLine += 2; // タイトル + 空行
  }

  // rootNodesを探索
  for (const rootNode of map.rootNodes || []) {
    const result = findNodeByLineRecursive(rootNode, 0, currentLine, targetLineNumber);
    if (result && result.node) {
      return { node: result.node, depth: result.depth };
    }
    currentLine = result ? result.nextLine : currentLine;
  }

  return null;
}

/**
 * 再帰的にノードを探索して行番号に対応するノードを見つける
 */
function findNodeByLineRecursive(
  node: MindMapNode,
  depth: number,
  currentLine: number,
  targetLineNumber: number
): { node: MindMapNode; depth: number; nextLine: number } | null {
  // ノードのテキスト行
  currentLine++;
  if (currentLine === targetLineNumber) {
    return { node, depth, nextLine: currentLine };
  }

  // ノートの行
  if (node.note) {
    const noteLines = node.note.split('\n').filter(line => line.trim());
    for (let i = 0; i < noteLines.length; i++) {
      currentLine++;
      if (currentLine === targetLineNumber) {
        return { node, depth, nextLine: currentLine };
      }
    }
  }

  // 子ノードを探索
  if (node.children) {
    for (const child of node.children) {
      const result = findNodeByLineRecursive(child, depth + 1, currentLine, targetLineNumber);
      if (result && result.node) {
        return result;
      }
      currentLine = result?.nextLine || currentLine;
    }
  }

  return { node: null as any, depth, nextLine: currentLine };
}

/**
 * 検索結果のハイライト表示用のマッチ位置を返す
 */
export function getMatchPosition(text: string, query: string): {
  beforeMatch: string;
  match: string;
  afterMatch: string;
} | null {
  if (!query.trim()) return null;

  const searchTerm = query.toLowerCase();
  const lowerText = text.toLowerCase();
  const startIndex = lowerText.indexOf(searchTerm);

  if (startIndex === -1) return null;

  return {
    beforeMatch: text.slice(0, startIndex),
    match: text.slice(startIndex, startIndex + searchTerm.length),
    afterMatch: text.slice(startIndex + searchTerm.length)
  };
}
