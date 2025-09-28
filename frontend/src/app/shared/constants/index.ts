/**
 * Unified constants for the Mindoodle application
 * All constants are consolidated here to eliminate duplication
 */

// =============================================================================
// COLORS
// =============================================================================
export const COLORS = {
  // ノードカラー
  NODE_COLORS: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD',
    '#00D2D3', '#FF9F43', '#EE5A24', '#0ABDE3'
  ],

  // システムカラー
  PRIMARY: '#007BFF',
  SECONDARY: '#6C757D',
  SUCCESS: '#28A745',
  WARNING: '#FFC107',
  ERROR: '#DC3545',
  INFO: '#17A2B8',

  // 背景・境界線
  BACKGROUND: '#FFFFFF',
  SURFACE: '#F8F9FA',
  BORDER: '#DEE2E6',
  TEXT: '#212529',
  MUTED: '#6C757D',

  // エラー重要度カラー
  SEVERITY: {
    low: '#3498db',
    medium: '#f39c12',
    high: '#e74c3c',
    critical: '#8e44ad'
  }
} as const;

// =============================================================================
// LAYOUT & COORDINATES
// =============================================================================
export const LAYOUT = {
  // 階層レイアウト
  LEVEL_SPACING: 140,
  VERTICAL_SPACING: 80,
  VERTICAL_SPACING_MIN: 2,
  VERTICAL_SPACING_MAX: 45,

  // ノード間隔
  NODE_PADDING: 30,
  TOGGLE_TO_CHILD_DISTANCE: 60,
  ROOT_TO_CHILD_DISTANCE: 120,
  NODE_MIN_DISTANCE: 100,
  MIN_NODE_DISTANCE: 50,
  SIBLING_SPACING: 60,
  CHILD_OFFSET_X: 200,
  CHILD_OFFSET_Y: 100,

  // グリッド
  GRID_SIZE: 20,
  SNAP_THRESHOLD: 10,

  // キャンバス境界
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5.0,
  DEFAULT_ZOOM: 1.0,
  ZOOM_STEP: 0.1,
  PAN_SENSITIVITY: 1.0,

  // UI要素の高さ・幅
  TOOLBAR_HEIGHT: 60,
  SIDEBAR_WIDTH: 280,
  PANEL_WIDTH: 300,
  PANEL_MIN_WIDTH: 200,
  PANEL_MAX_WIDTH: 400,
  CONTEXT_MENU_WIDTH: 180
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================
export const TYPOGRAPHY = {
  FONT_SIZES: {
    XS: 10,
    SM: 12,
    MD: 14,
    LG: 16,
    XL: 18,
    XXL: 20
  },
  FONT_WEIGHTS: {
    LIGHT: '300',
    NORMAL: 'normal',
    MEDIUM: '500',
    SEMI_BOLD: '600',
    BOLD: 'bold'
  },
  LINE_HEIGHTS: {
    TIGHT: 1.2,
    NORMAL: 1.4,
    LOOSE: 1.6
  },

  // レガシー互換性
  DEFAULT_FONT_SIZE: 16,
  MIN_FONT_SIZE: 10,
  MAX_FONT_SIZE: 48,
  DEFAULT_FONT_WEIGHT: 'normal',
  BOLD_FONT_WEIGHT: 'bold',

  // テキスト制限
  MAX_TEXT_LENGTH: 500,
  MAX_TITLE_LENGTH: 100
} as const;

// =============================================================================
// UI & UX
// =============================================================================
export const UI = {
  // アニメーション
  ANIMATION_DURATION: 300,
  TRANSITION_DURATION: 200,
  EASING: 'ease-out',
  TRANSITION_DELAY: 50,

  // Z-Index
  MODAL_Z_INDEX: 1000,

  // タイミング
  TOOLTIP_DELAY: 500,
  NOTIFICATION_DURATION: 3000,
  ERROR_NOTIFICATION_DURATION: 5000,

  // インタラクション
  DOUBLE_CLICK_THRESHOLD: 300,
  LONG_PRESS_DURATION: 500,
  DRAG_THRESHOLD: 5,

  // ボーダー・シャドウ
  BORDER_RADIUS: {
    SMALL: 4,
    MEDIUM: 8,
    LARGE: 12
  },
  SHADOW: {
    LIGHT: '0 2px 4px rgba(0,0,0,0.1)',
    MEDIUM: '0 4px 8px rgba(0,0,0,0.15)',
    HEAVY: '0 8px 16px rgba(0,0,0,0.2)'
  }
} as const;

// =============================================================================
// STORAGE & FILES
// =============================================================================
export const STORAGE = {
  // LocalStorage keys
  KEYS: {
    MINDMAPS: 'mindflow_mindmaps',
    CURRENT_MAP: 'mindflow_current_map',
    APP_SETTINGS: 'mindflow_app_settings',
    STORAGE_MODE: 'mindflow_storage_mode',
    SETTINGS: 'mindflow_settings'
  },

  // 画像最適化
  IMAGE: {
    MAX_WIDTH: 800,
    MAX_HEIGHT: 600,
    QUALITY: 0.8,
    COMPRESSION_QUALITY: 0.8,
    COMPRESSION_MAX_WIDTH: 1920,
    COMPRESSION_MAX_HEIGHT: 1080
  },

  // ファイル制限
  FILE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'application/pdf', 'application/json', 'text/markdown'
    ],
    IMAGE_TYPES: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
    ]
  },

  // 履歴・自動保存
  MAX_HISTORY_SIZE: 50,
  AUTO_SAVE_INTERVAL: 5000, // 5秒
  AUTO_SAVE_DELAY: 2000
} as const;

// =============================================================================
// DEFAULTS
// =============================================================================
export const DEFAULTS = {
  MINDMAP: {
    TITLE: '新しいマインドマップ',
    ROOT_TEXT: 'メインテーマ',
    ROOT_POSITION: { x: 400, y: 300 },
    SETTINGS: {
      autoSave: true,
      autoLayout: true,
      showGrid: false,
      animationEnabled: true
    }
  },

  NODE: {
    TEXT: '',
    FONT_SIZE: 14,
    FONT_WEIGHT: 'normal',
    COLOR: '#000000',
    BACKGROUND_COLOR: 'transparent'
  },

  UI: {
    SIDEBAR_VISIBLE: false,
    PERFORMANCE_DASH_VISIBLE: false
  },

  // Legacy compatibility - these will be removed in future versions
  NEW_MAP_TITLE: '新しいマインドマップ',
  ROOT_NODE_TEXT: 'メインテーマ',
  AUTO_SAVE: true,
  AUTO_LAYOUT: true,
  SNAP_TO_GRID: false,
  SHOW_GRID: false,
  ANIMATION_ENABLED: true
} as const;

// =============================================================================
// KEYBOARD SHORTCUTS
// =============================================================================
export const KEYBOARD = {
  NAVIGATION: {
    SELECT_UP: 'ArrowUp',
    SELECT_DOWN: 'ArrowDown',
    SELECT_LEFT: 'ArrowLeft',
    SELECT_RIGHT: 'ArrowRight'
  },
  EDITING: {
    START_EDIT: ' ', // Space
    FINISH_EDIT: 'Enter',
    CANCEL_EDIT: 'Escape',
    ADD_CHILD: 'Tab',
    ADD_SIBLING: 'Enter',
    DELETE_NODE: 'Delete'
  },
  APPLICATION: {
    SAVE: 'Ctrl+S',
    UNDO: 'Ctrl+Z',
    REDO: 'Ctrl+Y',
    ZOOM_IN: 'Ctrl+=',
    ZOOM_OUT: 'Ctrl+-',
    ZOOM_RESET: 'Ctrl+0',
    TOGGLE_HELP: 'F1'
  }
} as const;

// =============================================================================
// VALIDATION
// =============================================================================
export const VALIDATION = {
  NODE_TEXT: {
    MIN_LENGTH: 0,
    MAX_LENGTH: 500
  },
  MAP_TITLE: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  FILE_NAME: {
    MAX_LENGTH: 255,
    INVALID_CHARS: /[<>:"/\\|?*]/g
  }
} as const;

// =============================================================================
// PERFORMANCE
// =============================================================================
export const PERFORMANCE = {
  // レンダリング
  RENDER_TIME_WARNING: 16, // ms (60fps threshold)
  MAX_VISIBLE_NODES: 1000,
  COLLISION_CHECK_LIMIT: 100,
  LAYOUT_BATCH_SIZE: 50,
  NODE_COUNT_WARNING: 1000,

  // メモリ
  MEMORY_WARNING: 100 * 1024 * 1024, // 100MB

  // タイミング
  DEBOUNCE_DELAY: 300,
  THROTTLE_LIMIT: 100
} as const;

// =============================================================================
// COORDINATES
// =============================================================================
export const COORDINATES = {
  // Default coordinate constants
  DEFAULT_X: 0,
  DEFAULT_Y: 0,
  CANVAS_PADDING: 50,

  // Default canvas center (considering sidebar - root node positioned left)
  DEFAULT_CENTER_X: 180, // Adjusted considering sidebar 280px + map area 20% position
  DEFAULT_CENTER_Y: 300,

  // Root node default position (considering sidebar)
  ROOT_NODE_X: 180, // Left center position considering sidebar width
  ROOT_NODE_Y: 300,

  // Child node initial offset
  CHILD_OFFSET_X: 250,
  CHILD_OFFSET_Y: 350
} as const;

// =============================================================================
// ERROR HANDLING
// =============================================================================
export const ERRORS = {
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  TIMEOUT_DURATION: 10000,
  LOG_LEVEL: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4
  }
} as const;