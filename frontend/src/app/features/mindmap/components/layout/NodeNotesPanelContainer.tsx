import React from 'react';
import MarkdownPanel from '../panels/NodeNotesPanel';
import type { MapIdentifier } from '@shared/types';

type Props = {
  currentMapIdentifier?: MapIdentifier | null;
  onClose: () => void;
  getMapMarkdown?: (id: MapIdentifier) => Promise<string | null>;
  setAutoSaveEnabled?: (enabled: boolean) => void;
  onMapMarkdownInput?: (markdown: string) => void;
  subscribeMarkdownFromNodes?: (cb: (text: string) => void) => () => void;
  getNodeIdByMarkdownLine?: (line: number) => string | null;
  onSelectNode?: (nodeId: string) => void;
};

const MarkdownPanelContainer: React.FC<Props> = ({
  currentMapIdentifier,
  onClose,
  getMapMarkdown,
  setAutoSaveEnabled,
  onMapMarkdownInput,
  subscribeMarkdownFromNodes,
  getNodeIdByMarkdownLine,
  onSelectNode,
}) => {
  return (
    <MarkdownPanel
      onClose={onClose}
      currentMapIdentifier={currentMapIdentifier || null}
      getMapMarkdown={getMapMarkdown}
      setAutoSaveEnabled={setAutoSaveEnabled}
      onMapMarkdownInput={onMapMarkdownInput}
      subscribeMarkdownFromNodes={subscribeMarkdownFromNodes}
      getNodeIdByMarkdownLine={getNodeIdByMarkdownLine}
      onSelectNode={onSelectNode}
    />
  );
};

export default MarkdownPanelContainer;
