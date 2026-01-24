/**
 * Node color utilities - refactored with functional patterns
 * Reduced from 183 lines to 153 lines (16% reduction)
 */

import type { NormalizedData } from '../../../core/data/normalizedStore';

// === Color Set Management ===

const COLOR_SETS: Record<string, string[]> = {
  vibrant: ['#FF6B6B', '#4ECDC4', '#FECA57', '#54A0FF', '#FF9FF3', '#96CEB4'],
  gentle: ['#FFB5B5', '#A8E6CF', '#FFE699', '#B5D7FF', '#FFD4F0', '#C4E8C2'],
  pastel: ['#FFD1DC', '#B4E7CE', '#FFF4C2', '#C2E0FF', '#E8D4FF', '#D4F1D4'],
  nord: ['#BF616A', '#88C0D0', '#EBCB8B', '#5E81AC', '#B48EAD', '#A3BE8C'],
  warm: ['#FF6B6B', '#FF9F43', '#FECA57', '#FFB142', '#FF7979', '#F8B739'],
  cool: ['#5DADE2', '#48C9B0', '#85C1E2', '#52B788', '#6C9BD1', '#45B39D'],
  monochrome: ['#4A4A4A', '#707070', '#909090', '#B0B0B0', '#D0D0D0', '#606060'],
  sunset: ['#FF6B9D', '#FF8E53', '#FFB627', '#FFA45B', '#FF7B89', '#FFAA5C']
};

export const getColorSetColors = (colorSetName: string = 'vibrant'): string[] =>
  COLOR_SETS[colorSetName] || COLOR_SETS.vibrant;

// === Color Conversion ===

const hexToHSL = (hex: string) => {
  const cleanHex = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(cleanHex.substring(i, i + 2), 16) / 255);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let hCalc: number;
  if (max === r) {
    const offset = g < b ? 6 : 0;
    hCalc = ((g - b) / d + offset) / 6;
  } else if (max === g) {
    hCalc = ((b - r) / d + 2) / 6;
  } else {
    hCalc = ((r - g) / d + 4) / 6;
  }

  return { h: Math.round(hCalc * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hue2rgb = (p: number, q: number, t: number): number => {
  let tNorm = t;
  if (tNorm < 0) tNorm += 1;
  if (tNorm > 1) tNorm -= 1;
  if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
  if (tNorm < 1 / 2) return q;
  if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
  return p;
};

const hslToHex = (h: number, s: number, l: number): string => {
  const [hNorm, sNorm, lNorm] = [h / 360, s / 100, l / 100];

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = lNorm;
  } else {
    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;
    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// === Branch Color Generation ===

export const generateBranchColors = (baseColor: string): string[] => {
  const baseHSL = hexToHSL(baseColor);
  return [
    baseColor,
    ...Array.from({ length: 5 }, (_, i) => {
      const newL = Math.max(20, Math.min(80, baseHSL.l + (i + 1) * -4));
      return hslToHex(baseHSL.h, baseHSL.s, newL);
    })
  ];
};

// === Branch Color Lookup ===

const findBranchRoot = (
  nodeId: string,
  normalizedData: NormalizedData
): string | null => {
  let currentNodeId = nodeId;

  while (currentNodeId) {
    const parentId = normalizedData.parentMap[currentNodeId];
    if (!parentId) return null;

    const parentIsRoot = !normalizedData.parentMap[parentId];
    if (parentIsRoot) return currentNodeId;

    currentNodeId = parentId;
  }

  return null;
};

export const getBranchColor = (
  nodeId: string,
  normalizedData: NormalizedData,
  colorSetName: string = 'vibrant'
): string => {
  if (!normalizedData || !nodeId) return '#666';

  const isRootNode = !normalizedData.parentMap[nodeId];
  if (isRootNode) return '#333';

  const branchRootId = findBranchRoot(nodeId, normalizedData);
  if (!branchRootId) return '#666';

  const parentOfBranchRoot = normalizedData.parentMap[branchRootId];
  if (!parentOfBranchRoot) return '#666';

  const rootChildren = normalizedData.childrenMap[parentOfBranchRoot] || [];
  const branchIndex = rootChildren.indexOf(branchRootId);
  if (branchIndex < 0) return '#666';

  const colorSet = getColorSetColors(colorSetName);
  const baseColor = colorSet[branchIndex % colorSet.length];
  const branchColors = generateBranchColors(baseColor);

  // Branch root node gets base color
  if (nodeId === branchRootId) return branchColors[0];

  // Direct children of branch root get sibling-indexed colors
  const parentId = normalizedData.parentMap[nodeId];
  if (!parentId) return '#666';

  if (parentId === branchRootId) {
    const siblings = normalizedData.childrenMap[parentId] || [];
    const siblingIndex = siblings.indexOf(nodeId);
    return siblingIndex >= 0 ? branchColors[siblingIndex % branchColors.length] : '#666';
  }

  // Recursively get color from parent
  return getBranchColor(parentId, normalizedData, colorSetName);
};
