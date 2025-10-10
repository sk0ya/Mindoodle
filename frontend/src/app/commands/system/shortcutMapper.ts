

export interface ShortcutDefinition {
  key: string;
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
  command: string;
  args?: Record<string, any>;
  description?: string;
  category?: 'vim' | 'application' | 'navigation' | 'editing' | 'ui' | 'utility';
}


export const SHORTCUT_COMMANDS: ShortcutDefinition[] = [
  
  { key: 'h', command: 'left', category: 'vim', description: '← 左へ移動' },
  { key: 'j', command: 'down', category: 'vim', description: '↓ 下へ移動' },
  { key: 'k', command: 'up', category: 'vim', description: '↑ 上へ移動' },
  { key: 'l', command: 'right', category: 'vim', description: '→ 右へ移動' },
  { key: 'gg', command: 'select-root', category: 'vim', description: 'ルートノードへ' },
  { key: 'G', command: 'select-bottom', category: 'vim', description: '最後のノードへ' },
  { key: '0', command: 'select-current-root', category: 'vim', description: 'カレントルート選択' },
  { key: 'M', command: 'select-center', category: 'vim', description: '画面中央のノード選択' },

  
  { key: 'i', command: 'append', category: 'vim', description: '編集モード (末尾から)' },
  { key: 'I', command: 'insert', category: 'vim', description: '編集モード (先頭から)' },
  { key: 'a', command: 'add-child', category: 'vim', description: '子ノード追加' },
  { key: 'A', command: 'append-end', category: 'vim', description: '編集モード (行末)' },
  { key: 'o', command: 'open', category: 'vim', description: '下に兄弟ノード追加' },
  { key: 'O', command: 'open-above', category: 'vim', description: '上に兄弟ノード追加' },
  { key: 'ciw', command: 'edit', category: 'vim', description: 'テキストクリア&編集' },

  
  { key: 'dd', command: 'cut', category: 'vim', description: 'ノードをカット' },
  { key: 'yy', command: 'copy', category: 'vim', description: 'ノードをコピー' },
  { key: 'p', command: 'paste-sibling-after', category: 'vim', description: '弟ノードとして貼り付け（下に）' },
  { key: 'P', command: 'paste-sibling-before', category: 'vim', description: '兄ノードとして貼り付け（上に）' },
  { key: 'x', command: 'toggle-checkbox', category: 'vim', description: 'チェックボックス切替' },
  { key: 'X', command: 'insert-checkbox-child', category: 'vim', description: 'チェックボックス付き子追加' },
  { key: 'u', command: 'undo', category: 'vim', description: '元に戻す' },
  { key: 'Ctrl+r', modifiers: { ctrl: true }, command: 'redo', category: 'vim', description: 'やり直し' },

  
  { key: 'zz', command: 'center', category: 'vim', description: '画面中央に表示' },
  { key: 'zt', command: 'center-left', category: 'vim', description: '画面左中央に表示' },
  { key: 'za', command: 'toggle', category: 'vim', description: '展開/折りたたみ' },
  { key: 'zo', command: 'expand', category: 'vim', description: 'ノード展開' },
  { key: 'zc', command: 'collapse', category: 'vim', description: 'ノード折りたたみ' },
  { key: 'zR', command: 'expand-all', category: 'vim', description: 'すべて展開' },
  { key: 'zM', command: 'collapse-all', category: 'vim', description: 'すべて折りたたみ' },
  { key: 'Ctrl+u', modifiers: { ctrl: true }, command: 'scroll-up', category: 'vim', description: '上にスクロール' },
  { key: 'Ctrl+d', modifiers: { ctrl: true }, command: 'scroll-down', category: 'vim', description: '下にスクロール' },

  
  { key: '/', command: 'search', category: 'vim', description: '検索開始' },
  { key: 'n', command: 'next-search', category: 'vim', description: '次の検索結果' },
  { key: 'N', command: 'prev-search', category: 'vim', description: '前の検索結果' },
  { key: 's', command: 'jumpy', category: 'vim', description: 'Jumpyモード' },

  
  { key: '>>', command: 'move-as-child-of-sibling', category: 'vim', description: '前の兄弟の子にする' },
  { key: '<<', command: 'move-as-next-sibling-of-parent', category: 'vim', description: '親の次の兄弟にする' },

  
  { key: ':', command: 'command-line', category: 'vim', description: 'コマンドライン' },
  { key: 'gt', command: 'next-map', category: 'vim', description: '次のマップ' },
  { key: 'gT', command: 'prev-map', category: 'vim', description: '前のマップ' },

  
  { key: 'm', command: 'convert', category: 'vim', description: 'Markdown形式変換' },
  { key: '1m', command: 'convert-ordered-1', category: 'vim', description: '1. 番号付きリスト' },
  { key: '2m', command: 'convert-ordered-2', category: 'vim', description: '2. 番号付きリスト' },

  
  { key: 'gv', command: 'show-knowledge-graph', category: 'vim', description: 'Knowledge Graph表示 (graph view)' },

  
  { key: 'ArrowUp', command: 'arrow-navigate', args: { direction: 'up' }, category: 'navigation', description: 'Navigate up' },
  { key: 'ArrowDown', command: 'arrow-navigate', args: { direction: 'down' }, category: 'navigation', description: 'Navigate down' },
  { key: 'ArrowLeft', command: 'arrow-navigate', args: { direction: 'left' }, category: 'navigation', description: 'Navigate left' },
  { key: 'ArrowRight', command: 'arrow-navigate', args: { direction: 'right' }, category: 'navigation', description: 'Navigate right' },

  
  { key: ' ', command: 'start-edit', category: 'editing', description: 'Start editing (Space)' },
  { key: 'F2', command: 'start-edit-end', category: 'editing', description: 'Start editing (F2)' },
  { key: 'Tab', command: 'add-child', category: 'editing', description: 'Add child node' },
  { key: 'Enter', command: 'add-sibling', category: 'editing', description: 'Add sibling node' },
  { key: 'Delete', command: 'delete', category: 'editing', description: 'Delete node' },
  { key: 'Backspace', command: 'delete', category: 'editing', description: 'Delete node' },

  
  { key: 'z', modifiers: { ctrl: true }, command: 'undo', category: 'application', description: 'Undo (Ctrl+Z)' },
  { key: 'z', modifiers: { ctrl: true, shift: true }, command: 'redo', category: 'application', description: 'Redo (Ctrl+Shift+Z)' },
  { key: 'y', modifiers: { ctrl: true }, command: 'redo', category: 'application', description: 'Redo (Ctrl+Y)' },
  { key: 'c', modifiers: { ctrl: true }, command: 'copy', category: 'application', description: 'Copy (Ctrl+C)' },
  { key: 'v', modifiers: { ctrl: true }, command: 'paste', category: 'application', description: 'Paste (Ctrl+V)' },
  { key: 'm', modifiers: { ctrl: true }, command: 'toggle-markdown-panel', category: 'ui', description: 'Toggle Markdown panel (Ctrl+M)' },
  { key: 'm', modifiers: { ctrl: true, shift: true }, command: 'toggle-node-note-panel', category: 'ui', description: 'Toggle Node Note panel (Ctrl+Shift+M)' },

  
  { key: 'F1', command: 'help', category: 'ui', description: 'Toggle help panel' },
  { key: 'Escape', command: 'close-panels', category: 'ui', description: 'Close all panels' },
];

export interface ParsedShortcut {
  key: string;
  modifiers: {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
}


export function parseKeyboardEvent(event: KeyboardEvent): ParsedShortcut {
  return {
    key: event.key,
    modifiers: {
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey,
    }
  };
}


export function matchShortcut(parsed: ParsedShortcut): ShortcutDefinition | null {
  return SHORTCUT_COMMANDS.find(shortcut => {
    
    if (shortcut.key !== parsed.key) {
      return false;
    }

    
    const mods = shortcut.modifiers || {};
    return (
      (mods.ctrl || false) === parsed.modifiers.ctrl &&
      (mods.shift || false) === parsed.modifiers.shift &&
      (mods.alt || false) === parsed.modifiers.alt &&
      (mods.meta || false) === parsed.modifiers.meta
    );
  }) || null;
}


export function isVimShortcut(shortcut: ShortcutDefinition): boolean {
  return shortcut.category === 'vim';
}


export function hasModifiers(parsed: ParsedShortcut): boolean {
  return parsed.modifiers.ctrl || parsed.modifiers.shift || parsed.modifiers.alt || parsed.modifiers.meta;
}


export function getShortcutsByCategory(category: string): ShortcutDefinition[] {
  return SHORTCUT_COMMANDS.filter(shortcut => shortcut.category === category);
}


export function getShortcutHelp(): string {
  const categories = ['vim', 'navigation', 'editing', 'application', 'ui'];
  let help = 'Keyboard Shortcuts:\n\n';

  for (const category of categories) {
    const shortcuts = getShortcutsByCategory(category);
    if (shortcuts.length === 0) continue;

    help += `${category.toUpperCase()}:\n`;
    for (const shortcut of shortcuts) {
      const keyDisplay = formatKeyDisplay(shortcut);
      help += `  ${keyDisplay} - ${shortcut.description || shortcut.command}\n`;
    }
    help += '\n';
  }

  return help;
}


function formatKeyDisplay(shortcut: ShortcutDefinition): string {
  const parts: string[] = [];

  if (shortcut.modifiers?.ctrl) parts.push('Ctrl');
  if (shortcut.modifiers?.shift) parts.push('Shift');
  if (shortcut.modifiers?.alt) parts.push('Alt');
  if (shortcut.modifiers?.meta) parts.push('Meta');

  parts.push(shortcut.key);

  return parts.join('+');
}
