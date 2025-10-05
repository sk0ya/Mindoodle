declare module 'monaco-vim/lib/cm/keymap_vim' {
  export interface VimKeymapInstance {
    map: (lhs: string, rhs: string, mode?: string) => void;
    noremap: (lhs: string, rhs: string, mode?: string) => void;
    defineAction: (name: string, action: () => void) => void;
    mapCommand: (lhs: string, type: string, name: string, args?: any, extra?: any) => void;
  }
}
