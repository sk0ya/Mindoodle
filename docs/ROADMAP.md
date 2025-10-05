# Roadmap and Refactoring

This document tracks the current implementation roadmap and refactoring plan.

## Implementation Roadmap

### 🔴 Priority: High (Critical Bug Fixes)

#### ✅ COMPLETED
1. Node Coordinate Glitch — Fixed
   - Eliminated Y-coordinate shift during node creation
2. Mermaid Diagram Cache — Fixed
   - Proper cache clearing on map data changes
3. Search IME Support — Fixed
   - Added IME support for Vim search and command modes
4. Sidebar/Panel Resize — Fixed
   - Improved resize event handling with capture phase

---

### 🟡 Priority: Medium (Feature Improvements)

#### ✅ COMPLETED
1. Enhanced Search Navigation — Implemented
   - Improved search navigation to handle dynamic node changes
2. Vim Search and Command Unification — Implemented
   - Unified Vim search and command input with dynamic mode switching
3. Keyboard Shortcut Helper — Enhanced
   - Dynamic generation and compact UI
4. Inline Markdown Formatting — Added
   - Support for inline markdown with Vim keybindings
5. Hierarchical Color System — Added
   - Mind map connections with color set selection
6. System Clipboard Paste — Added
   - Multi-line text paste support

#### 🎯 TODO
1. Vim Keymap Customization
   - Add keymap editor to settings screen
   - Use `monaco-vim` key mapping customization API

---

### 🟢 Priority: Low (New Features)

#### ✅ COMPLETED
1. Cloud Storage Implementation — Implemented
   - CloudStorageAdapter with Cloudflare Workers backend
   - KV for user data and map metadata
   - R2 for markdown files and images
   - Authentication with email-based access
   - Workspace management for cloud mode
2. Storage Adapter Refactoring — Completed
   - Simplified storage adapters, removed unnecessary metadata
3. Paste Operation Enhancement — Fixed
   - Fixed undo/redo stack and checkbox preservation
4. Checkbox Default State — Added
   - New checkbox nodes default to unchecked
5. Blank Line Setting — Added
   - Blank line setting for heading nodes
6. Cloud Image Storage Extension — Implemented
   - Backend endpoints for image operations; R2 integration
   - Frontend CloudStorageAdapter supports image ops

#### 🎯 TODO
1. Multi-Node Selection
   - `v` selection mode → multi-select → `m` for batch ops
   - Add selection state to Zustand store
2. Additional Features (Future)
   - Image Editor, CSV Editor, Drawing Tool, Auto-format by structure

---

## Refactoring Plan

### ✅ Completed Refactoring

1. ViewportService Implementation — COMPLETED
   - `ViewportService` in `frontend/src/app/core/services/`
   - `useViewport` hook; migrated references
2. MindMapApp.tsx Component Split — COMPLETED
   - Extracted hooks: useMindMapLinks, useMindMapFileOps, useMindMapEvents, useMindMapClipboard, useMindMapViewport, and others
   - 1731 → 881 lines (−850 / 49%)
3. Memory Management Utilities Consolidation — COMPLETED
   - Unified `MemoryService` class; timers, monitoring, thresholds, cleanup
   - Integrated in dataSlice; type-check passed

### 🔄 In Progress Refactoring

4. Large File Refactoring (Progressive) — PHASE 4 IN PROGRESS
   - Targets (goal 500–700 lines):
     - MindMapSidebar.tsx (~1277) — analysis in progress
     - MarkdownEditor.tsx (~1273)
     - MarkdownFolderAdapter.ts (~1193)
     - markdownImporter.ts (~1140)
     - NodeRenderer.tsx (~1070)

### 🟢 Low Priority Improvements

- Type Definition Cleanup: consolidate MindMapNode/MindMapData, resolve cycles
- Hooks Optimization: remove unused, fix dependencies, follow guidelines

