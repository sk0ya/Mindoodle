/**
 * Shortcut to Command Mapper
 * Unified system for mapping keyboard shortcuts to commands
 */

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

// All keyboard shortcuts mapped to commands
export const SHORTCUT_COMMANDS: ShortcutDefinition[] = [
  // Vim navigation commands (already handled by vim system)
  { key: 'h', command: 'h', category: 'vim', description: 'Navigate left' },
  { key: 'j', command: 'j', category: 'vim', description: 'Navigate down' },
  { key: 'k', command: 'k', category: 'vim', description: 'Navigate up' },
  { key: 'l', command: 'l', category: 'vim', description: 'Navigate right' },
  { key: 'i', command: 'i', category: 'vim', description: 'Insert mode (cursor at start)' },
  { key: 'a', command: 'a', category: 'vim', description: 'Append mode (cursor at end)' },
  { key: 'o', command: 'o', category: 'vim', description: 'Open new child node' },
  { key: 'm', command: 'm', category: 'vim', description: 'Convert markdown node' },
  { key: 'zz', command: 'zz', category: 'vim', description: 'Center node in view' },
  { key: 'dd', command: 'dd', category: 'vim', description: 'Delete node' },
  { key: 'za', command: 'za', category: 'vim', description: 'Toggle node collapse' },
  { key: 'ciw', command: 'ciw', category: 'vim', description: 'Clear text and edit' },

  // Arrow navigation
  { key: 'ArrowUp', command: 'arrow-navigate', args: { direction: 'up' }, category: 'navigation', description: 'Navigate up' },
  { key: 'ArrowDown', command: 'arrow-navigate', args: { direction: 'down' }, category: 'navigation', description: 'Navigate down' },
  { key: 'ArrowLeft', command: 'arrow-navigate', args: { direction: 'left' }, category: 'navigation', description: 'Navigate left' },
  { key: 'ArrowRight', command: 'arrow-navigate', args: { direction: 'right' }, category: 'navigation', description: 'Navigate right' },

  // Standard editing shortcuts
  { key: ' ', command: 'start-edit', category: 'editing', description: 'Start editing (Space)' },
  { key: 'F2', command: 'start-edit-end', category: 'editing', description: 'Start editing (F2)' },
  { key: 'Tab', command: 'add-child', category: 'editing', description: 'Add child node' },
  { key: 'Enter', command: 'add-sibling', category: 'editing', description: 'Add sibling node' },
  { key: 'Delete', command: 'delete', category: 'editing', description: 'Delete node' },
  { key: 'Backspace', command: 'delete', category: 'editing', description: 'Delete node' },

  // Application shortcuts (with modifiers)
  { key: 'z', modifiers: { ctrl: true }, command: 'undo', category: 'application', description: 'Undo (Ctrl+Z)' },
  { key: 'z', modifiers: { ctrl: true, shift: true }, command: 'redo', category: 'application', description: 'Redo (Ctrl+Shift+Z)' },
  { key: 'y', modifiers: { ctrl: true }, command: 'redo', category: 'application', description: 'Redo (Ctrl+Y)' },
  { key: 'c', modifiers: { ctrl: true }, command: 'copy', category: 'application', description: 'Copy (Ctrl+C)' },
  { key: 'v', modifiers: { ctrl: true }, command: 'paste', category: 'application', description: 'Paste (Ctrl+V)' },
  { key: 'm', modifiers: { ctrl: true }, command: 'toggle-markdown-panel', category: 'ui', description: 'Toggle Markdown panel (Ctrl+M)' },

  // UI shortcuts
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

/**
 * Parse keyboard event into normalized shortcut
 */
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

/**
 * Match a parsed shortcut against shortcut definitions
 */
export function matchShortcut(parsed: ParsedShortcut): ShortcutDefinition | null {
  return SHORTCUT_COMMANDS.find(shortcut => {
    // Check key match
    if (shortcut.key !== parsed.key) {
      return false;
    }

    // Check modifiers
    const mods = shortcut.modifiers || {};
    return (
      (mods.ctrl || false) === parsed.modifiers.ctrl &&
      (mods.shift || false) === parsed.modifiers.shift &&
      (mods.alt || false) === parsed.modifiers.alt &&
      (mods.meta || false) === parsed.modifiers.meta
    );
  }) || null;
}

/**
 * Check if a shortcut should be handled by vim mode
 */
export function isVimShortcut(shortcut: ShortcutDefinition): boolean {
  return shortcut.category === 'vim';
}

/**
 * Check if a shortcut has modifier keys
 */
export function hasModifiers(parsed: ParsedShortcut): boolean {
  return parsed.modifiers.ctrl || parsed.modifiers.shift || parsed.modifiers.alt || parsed.modifiers.meta;
}

/**
 * Get all shortcuts for a specific category
 */
export function getShortcutsByCategory(category: string): ShortcutDefinition[] {
  return SHORTCUT_COMMANDS.filter(shortcut => shortcut.category === category);
}

/**
 * Get shortcut description for help display
 */
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

/**
 * Format key combination for display
 */
function formatKeyDisplay(shortcut: ShortcutDefinition): string {
  const parts: string[] = [];

  if (shortcut.modifiers?.ctrl) parts.push('Ctrl');
  if (shortcut.modifiers?.shift) parts.push('Shift');
  if (shortcut.modifiers?.alt) parts.push('Alt');
  if (shortcut.modifiers?.meta) parts.push('Meta');

  parts.push(shortcut.key);

  return parts.join('+');
}
