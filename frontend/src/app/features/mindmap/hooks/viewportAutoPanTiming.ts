export const LAYOUT_AUTO_PAN_SUPPRESSION_MS = 800;
export const NEW_NODE_VISIBILITY_RETRY_MS = 32;
export const NEW_NODE_VISIBILITY_MAX_RETRIES = 2;

export type EnsureSelectedNodeVisibleOptions = {
  force?: boolean;
  preventDownwardPan?: boolean;
};
export type EnsureSelectedNodeVisibleResult = 'suppressed' | void;
