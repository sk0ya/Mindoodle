import React from 'react';
import MarkdownPanelContainer from '../panel/NodeNotesPanelContainer';
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
  );
};

export default MarkdownPanelSection;
