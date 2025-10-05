# Roadmap and Refactoring

This document tracks active tasks and future plans.

## Active Tasks

### 🟡 Medium Priority

1. **Vim Keymap Customization**
   - Add keymap editor to settings screen
   - Use `monaco-vim` key mapping customization API

### 🟢 Low Priority

1. **Multi-Node Selection**
   - `v` selection mode → multi-select → `m` for batch ops
   - Add selection state to Zustand store

2. **Additional Features (Future)**
   - Image Editor, CSV Editor, Drawing Tool, Auto-format by structure

---

## Refactoring Plan

### 🔄 In Progress

**Large File Refactoring (Progressive)**
- Targets (goal 500–700 lines):
  - MindMapSidebar.tsx (~1277)
  - MarkdownEditor.tsx (~1273)
  - MarkdownFolderAdapter.ts (~1193)
  - markdownImporter.ts (~1140)
  - NodeRenderer.tsx (~1070)

### 🟢 Low Priority

- Type Definition Cleanup: consolidate MindMapNode/MindMapData, resolve cycles
- Hooks Optimization: remove unused, fix dependencies, follow guidelines

