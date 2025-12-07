/**
 * Shared layout helpers for node operations
 */

import { logger } from '@shared/utils';
import type { MindMapStore } from '../types';

/**
 * Apply auto layout if enabled in settings
 * @param get - Store getter function
 * @param immediate - Whether to apply layout immediately (skip debounce)
 */
export const applyAutoLayoutIfEnabled = (
  get: () => MindMapStore,
  immediate: boolean = false
): void => {
  const { data, applyAutoLayout } = get();

  if (!data?.settings?.autoLayout) {
    logger.debug('Auto layout disabled or settings missing');
    return;
  }

  logger.debug('Applying auto layout', { immediate });

  if (typeof applyAutoLayout === 'function') {
    applyAutoLayout(immediate);
  } else {
    logger.error('applyAutoLayout function not found');
  }
};
