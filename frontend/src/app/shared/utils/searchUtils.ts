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
 * ファイルベースの検索を行う（マークダウンファイルの内容を直接行単位で検索）
 */
export async function searchFilesForContent(
  query: string,
  storageAdapter: any,
  workspaces?: Array<{ id: string; name: string }>
): Promise<FileBasedSearchResult[]> {
  if (!query.trim() || !storageAdapter) {
    return [];
  }

  const results: FileBasedSearchResult[] = [];
  const searchTerm = query.toLowerCase();

  try {
    // すべてのマップを取得（メタデータのみ）
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

      // ファイルの生のマークダウン内容を直接取得
      if (typeof storageAdapter.getMapMarkdown === 'function') {
        try {
          const markdownContent = await storageAdapter.getMapMarkdown(map.mapIdentifier);
          if (markdownContent) {
            const lines = markdownContent.split('\n');

            lines.forEach((line: string, index: number) => {
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
                  matchType: 'text'
                });
              }
            });
          }
        } catch (error) {
          console.warn(`Failed to get markdown for ${mapId}:`, error);
          // フォールバック: マップデータから検索（後方互換性）
          continue;
        }
      }
    }
  } catch (error) {
    console.error('File-based search error:', error);
  }

  return results;
}


/**
 * 行番号からノードを特定する（ファイル内容から直接検索）
 * 注意: この関数は実際のMarkdownファイルの行番号を基準とするため、
 * MarkdownImporterの解析結果のmarkdownMetaを利用することを推奨
 */
export function findNodeByLineNumber(
  map: MindMapData,
  targetLineNumber: number
): { node: MindMapNode; depth: number } | null {
  // rootNodesを探索してmarkdownMeta.lineNumberを確認
  const findInNodes = (nodes: MindMapNode[], depth: number = 0): { node: MindMapNode; depth: number } | null => {
    for (const node of nodes) {
      // markdownMetaにlineNumberがある場合、それを使用
      const nodeLineNumber = (node as any).markdownMeta?.lineNumber;
      if (typeof nodeLineNumber === 'number' && nodeLineNumber + 1 === targetLineNumber) {
        return { node, depth };
      }

      // 子ノードも検索
      if (node.children) {
        const result = findInNodes(node.children, depth + 1);
        if (result) return result;
      }
    }
    return null;
  };

  return findInNodes(map.rootNodes || []);
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
