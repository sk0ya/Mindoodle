// Lightweight adapter to stabilize access to monaco-vim APIs

import type { editor as MonacoNS } from 'monaco-editor';

export type MonacoVimModule = any;

export async function loadMonacoVim(): Promise<MonacoVimModule | null> {
  try {
    const mod: any = await import('monaco-vim');
    return mod || null;
  } catch {
    return null;
  }
}

export function getVimFromModule(mod: MonacoVimModule | null): any | null {
  try {
    if (!mod) return (window as any)?.Vim || (window as any)?.MonacoVim?.Vim || null;
    // Prefer package export VimMode (which is keymap_vim default export)
    if ((mod)?.VimMode) return (mod).VimMode;
    // Fallbacks for various bundlings
    if ((mod)?.Vim) return (mod).Vim;
    if ((mod)?.default?.VimMode) return (mod).default.VimMode;
    if ((mod)?.default?.Vim) return (mod).default.Vim;
    if ((window as any)?.Vim) return (window as any).Vim;
    if ((window as any)?.MonacoVim?.Vim) return (window as any).MonacoVim.Vim;
    return null;
  } catch {
    return null;
  }
}

// Try direct import of internal module that actually exports Vim API
export async function loadDirectVimApi(): Promise<any | null> {
  try {
    // Some bundlers allow importing this internal path
    const m: any = await import('monaco-vim/lib/cm/keymap_vim');
    return (m && (m.Vim || m.default?.Vim)) ? (m.Vim || m.default.Vim) : null;
  } catch {
    return null;
  }
}

export function initVimMode(mod: MonacoVimModule | null, ed: MonacoNS.IStandaloneCodeEditor, statusEl?: HTMLElement | null): any | null {
  try {
    const init = (mod)?.initVimMode || (mod)?.default || (mod);
    if (typeof init !== 'function') return null;
    return init(ed, statusEl || undefined);
  } catch {
    return null;
  }
}
