
import React from 'react';
import MarkdownPanel from '../../panels/NodeNotesPanel';
import type { MapIdentifier } from '@shared/types';

type Props = {
  currentMapIdentifier?: MapIdentifier | null;
  getMapMarkdown?: (id: MapIdentifier) => Promise<string | null>;
  onMapMarkdownInput?: (markdown: string) => void;
  subscribeMarkdownFromNodes?: (cb: (text: string) => void) => () => void;
  getNodeIdByMarkdownLine?: (line: number) => string | null;
  onSelectNode?: (nodeId: string) => void;
  onClose?: () => void;
};

const MarkdownPanelContainer: React.FC<Props> = ({
  currentMapIdentifier,
  getMapMarkdown,
  onMapMarkdownInput,
  subscribeMarkdownFromNodes,
  getNodeIdByMarkdownLine,
  onSelectNode,
  onClose,
}) => {
  return (
    <MarkdownPanel
      currentMapIdentifier={currentMapIdentifier || null}
      getMapMarkdown={getMapMarkdown}
      onMapMarkdownInput={onMapMarkdownInput}
      subscribeMarkdownFromNodes={subscribeMarkdownFromNodes}
      getNodeIdByMarkdownLine={getNodeIdByMarkdownLine}
      onSelectNode={onSelectNode}
      onClose={onClose}
    />
  );
};

export default React.memo(MarkdownPanelContainer);
