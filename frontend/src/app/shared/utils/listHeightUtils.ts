

export interface ListHeightConfig {
  itemCount: number;
  maxHeight?: number;
}

export const calculateLinkListHeight = ({ itemCount, maxHeight = 240 }: ListHeightConfig): number => {
  if (itemCount === 0) return 0;
  
  const actualItemHeight = 16 + 4; 
  const containerPadding = 12; 
  const itemGaps = Math.max(0, itemCount - 1) * 1; 
  
  return Math.min(itemCount * actualItemHeight + containerPadding + itemGaps, maxHeight);
};