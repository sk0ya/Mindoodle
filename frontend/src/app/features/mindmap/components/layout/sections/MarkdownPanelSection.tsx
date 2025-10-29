import React from 'react';
// Lazy-load the Markdown panel to defer heavy editor deps (codemirror/marked/mermaid)
const MarkdownPanelContainer = React.lazy(() => import('../panel/NodeNotesPanelContainer'));
import type { MindMapData, MapIdentifier } from '@shared/types';
import { selectNodeIdByMarkdownLine } from '@mindmap/selectors/mindMapSelectors';

interface Props {
  data: MindMapData | null;
  mindMap: {
    getMapMarkdown: (id: MapIdentifier) => Promise<string | null>;
    onMapMarkdownInput: (markdown: string) => void;
    subscribeMarkdownFromNodes: (cb: (markdown: string) => void) => () => void;
  };
  onSelectNode: (nodeId: string | null) => void;
  onClose: () => void;
}

const MarkdownPanelSection: React.FC<Props> = ({ data, mindMap, onSelectNode, onClose }) => {
  return (
    <React.Suspense fallback={
      <div style={{ width: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-sm" style={{ padding: 12 }}>Loading editor…</div>
      </div>
    }>
      <MarkdownPanelContainer
        currentMapIdentifier={data ? data.mapIdentifier : null}
        getMapMarkdown={mindMap.getMapMarkdown}
        onMapMarkdownInput={mindMap.onMapMarkdownInput}
        subscribeMarkdownFromNodes={mindMap.subscribeMarkdownFromNodes}
        getNodeIdByMarkdownLine={(line: number) => {
          try {
            return selectNodeIdByMarkdownLine(data?.rootNodes || [], line);
          } catch {
            return null;
          }
        }}
        onSelectNode={onSelectNode}
        onClose={onClose}
      />
    </React.Suspense>
  );
};

export default MarkdownPanelSection;
