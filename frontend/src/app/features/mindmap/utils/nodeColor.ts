import type { NormalizedData } from '../../../core/data/normalizedStore';

// ========================================
// Color Set Management
// ========================================

function getColorSetColors(colorSetName: string): string[] {
  const colorSets: Record<string, string[]> = {
    vibrant: ['#FF6B6B', '#4ECDC4', '#FECA57', '#54A0FF', '#FF9FF3', '#96CEB4'],
    gentle: ['#FFB5B5', '#A8E6CF', '#FFE699', '#B5D7FF', '#FFD4F0', '#C4E8C2'],
    pastel: ['#FFD1DC', '#B4E7CE', '#FFF4C2', '#C2E0FF', '#E8D4FF', '#D4F1D4'],
    nord: ['#BF616A', '#88C0D0', '#EBCB8B', '#5E81AC', '#B48EAD', '#A3BE8C'],
    warm: ['#FF6B6B', '#FF9F43', '#FECA57', '#FFB142', '#FF7979', '#F8B739'],
    cool: ['#5DADE2', '#48C9B0', '#85C1E2', '#52B788', '#6C9BD1', '#45B39D'],
    monochrome: ['#4A4A4A', '#707070', '#909090', '#B0B0B0', '#D0D0D0', '#606060'],
    sunset: ['#FF6B9D', '#FF8E53', '#FFB627', '#FFA45B', '#FF7B89', '#FFAA5C']
  };

  return colorSets[colorSetName] || colorSets.vibrant;
}

// ========================================
// Color Conversion Functions
// ========================================

function hexToHSL(hex: string) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number) {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = lNorm;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

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
}

// ========================================
// Branch Color Generation
// ========================================

export function generateBranchColors(baseColor: string): string[] {
  const baseHSL = hexToHSL(baseColor);
  const colors: string[] = [];

  colors.push(baseColor);

  for (let i = 1; i < 6; i++) {
    const lightnessShift = i * -4;
    const newL = Math.max(20, Math.min(80, baseHSL.l + lightnessShift));
    colors.push(hslToHex(baseHSL.h, baseHSL.s, newL));
  }

  return colors;
}

// ========================================
// Branch Color Lookup
// ========================================

export function getBranchColor(
  nodeId: string,
  normalizedData: NormalizedData,
  colorSetName?: string
): string {
  if (!normalizedData || !nodeId) return '#666';

  const isRootNode = !normalizedData.parentMap[nodeId];

  if (isRootNode) {
    return '#333';
  }

  let currentNodeId = nodeId;
  let branchRootId: string | null = null;
  let level = 0;

  while (currentNodeId) {
    const parentId = normalizedData.parentMap[currentNodeId];

    if (!parentId) {
      break;
    }

    level++;

    const parentIsRoot = !normalizedData.parentMap[parentId];

    if (parentIsRoot) {
      branchRootId = currentNodeId;
      break;
    }

    currentNodeId = parentId;
  }

  if (!branchRootId) return '#666';

  const parentOfBranchRoot = normalizedData.parentMap[branchRootId];
  if (!parentOfBranchRoot) return '#666';

  const rootChildren = normalizedData.childrenMap[parentOfBranchRoot] || [];
  const branchIndex = rootChildren.indexOf(branchRootId);

  if (branchIndex < 0) return '#666';

  const colorSet = getColorSetColors(colorSetName || 'vibrant');
  const baseColor = colorSet[branchIndex % colorSet.length];
  const branchColors = generateBranchColors(baseColor);

  if (nodeId === branchRootId) {
    return branchColors[0];
  }

  const parentId = normalizedData.parentMap[nodeId];
  if (!parentId) return '#666';

  if (parentId === branchRootId) {
    const siblings = normalizedData.childrenMap[parentId] || [];
    const siblingIndex = siblings.indexOf(nodeId);
    if (siblingIndex < 0) return '#666';
    return branchColors[siblingIndex % branchColors.length];
  }

  return getBranchColor(parentId, normalizedData, colorSetName);
}

export { getColorSetColors };
