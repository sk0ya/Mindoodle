# Mindoodle Project Overview

## Purpose
Mindoodle is a local-first, markdown-based mind mapping application built with React + TypeScript + Vite. It's designed to work completely offline with no network dependencies, focusing on creating and managing mind maps locally.

## Tech Stack
- **Frontend Framework**: React 18 with TypeScript 5.8
- **Build Tool**: Vite 6
- **State Management**: Zustand
- **Editor**: Monaco Editor with Vim mode support
- **File Handling**: JSZip for import/export
- **Markdown Processing**: Marked library
- **Icons**: Lucide React
- **Styling**: CSS (details not yet explored)

## Key Features
- Local-first architecture (no network calls)
- Markdown-based mind mapping
- Import/export functionality
- Monaco editor integration with Vim support
- All data stored locally using browser APIs

## Project Structure
- **Root**: `frontend/` contains the entire application
- **Source**: `frontend/src/` with modular architecture
- **Core**: `src/app/core/` for hooks, store, services, storage, data
- **Features**: `src/app/features/` with mindmap and files modules
- **Shared**: `src/app/shared/` and `src/shared/` for utilities
- **Types**: `src/types/` for type definitions

## Development Philosophy
- Feature-based organization
- Hook-based core architecture
- Modular exports through index.ts files
- Local-first with no external dependencies