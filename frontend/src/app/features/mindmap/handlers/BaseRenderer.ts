

import type { MindMapNode } from '@shared/types';

export interface RenderingState {
  isSelected: boolean;
  isDragging: boolean;
  isDragTarget: boolean;
  isLayoutTransitioning: boolean;
  isEditing?: boolean;
}

export interface ThemeConfig {
  theme: 'light' | 'dark';
  fontSize: number;
}

export interface AnimationConfig {
  enableTransitions: boolean;
  transitionDuration: string;
  transitionEasing: string;
}


export const getBaseNodeStyles = (
  state: RenderingState,
  _themeConfig: ThemeConfig,
  animationConfig: AnimationConfig = {
    enableTransitions: true,
    transitionDuration: '0.3s',
    transitionEasing: 'cubic-bezier(0.4, 0.0, 0.2, 1)'
  }
): React.CSSProperties => {
  const { isSelected, isDragging, isDragTarget, isLayoutTransitioning } = state;

  
  const baseStyles: React.CSSProperties = {
    cursor: isDragging ? 'grabbing' : 'pointer',
    opacity: isDragging ? 0.8 : 1,
    transform: isDragging ? 'scale(1.05)' : 'scale(1)',
    pointerEvents: 'auto'
  };

  
  if (isDragTarget) {
    baseStyles.filter = 'drop-shadow(0 8px 25px rgba(245, 158, 11, 0.4))';
  } else if (isDragging) {
    baseStyles.filter = 'drop-shadow(0 12px 30px rgba(0,0,0,0.2))';
  } else if (isSelected) {
    baseStyles.filter = 'drop-shadow(0 4px 20px rgba(59, 130, 246, 0.25))';
  } else {
    baseStyles.filter = 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))';
  }

  
  if (animationConfig.enableTransitions && !isDragging && !isLayoutTransitioning) {
    baseStyles.transition = `all ${animationConfig.transitionDuration} ${animationConfig.transitionEasing}`;
  } else {
    baseStyles.transition = 'none';
  }

  return baseStyles;
};


export const getSelectionBorderStyles = (
  state: RenderingState,
  animationConfig: AnimationConfig = {
    enableTransitions: true,
    transitionDuration: '0.3s',
    transitionEasing: 'cubic-bezier(0.4, 0.0, 0.2, 1)'
  }
): {
  stroke: string;
  strokeWidth: string;
  strokeDasharray: string;
  style: React.CSSProperties;
} => {
  const { isSelected, isDragTarget, isDragging, isLayoutTransitioning } = state;

  const styles: React.CSSProperties = {
    pointerEvents: 'none'
  };

  if (animationConfig.enableTransitions && !isDragging && !isLayoutTransitioning) {
    styles.transition = `all ${animationConfig.transitionDuration} ${animationConfig.transitionEasing}`;
  } else {
    styles.transition = 'none';
  }

  if (isDragTarget) {
    return {
      stroke: '#f59e0b',
      strokeWidth: '3',
      strokeDasharray: '5,5',
      style: styles
    };
  } else if (isSelected) {
    return {
      stroke: '#60a5fa',
      strokeWidth: '2.5',
      strokeDasharray: 'none',
      style: styles
    };
  }

  return {
    stroke: 'transparent',
    strokeWidth: '0',
    strokeDasharray: 'none',
    style: styles
  };
};


export const getBackgroundFill = (themeConfig: ThemeConfig): string => {
  return themeConfig.theme === 'dark'
    ? 'rgba(45, 45, 48, 0.9)'
    : 'rgba(255, 255, 255, 0.9)';
};


export const getTextColor = (themeConfig: ThemeConfig): string => {
  return themeConfig.theme === 'dark' ? '#ffffff' : '#000000';
};


export const getNodePosition = (
  node: MindMapNode,
  nodeWidth: number,
  nodeHeight: number,
  alignment: 'left' | 'center' | 'right' = 'left'
): { x: number; y: number } => {
  let x = node.x;

  switch (alignment) {
    case 'center':
      x = node.x - nodeWidth / 2;
      break;
    case 'right':
      x = node.x - nodeWidth;
      break;
    case 'left':
    default:
      
      break;
  }

  return {
    x,
    y: node.y - nodeHeight / 2
  };
};


export const generateDropZoneAnimation = (): string => {
  return `
    @keyframes dragPulse {
      0%, 100% { stroke-opacity: 0.8; }
      50% { stroke-opacity: 0.4; }
    }

    @keyframes dropZonePulse {
      0%, 100% {
        stroke-opacity: 0.5;
        r: 60;
      }
      50% {
        stroke-opacity: 0.8;
        r: 65;
      }
    }

    .drop-guide line {
      animation: dragPulse 1.5s ease-in-out infinite;
    }

    .drop-guide circle {
      animation: dropZonePulse 2s ease-in-out infinite;
    }
  `;
};


export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  enableTransitions: false,
  transitionDuration: '0s',
  transitionEasing: 'none'
};

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  theme: 'light',
  fontSize: 14
};