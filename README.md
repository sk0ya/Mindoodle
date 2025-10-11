<div align="center">

# 🧠 Mindoodle

<p align="center">
  <img src="frontend/public/icon-512.png" alt="Mindoodle Logo" width="120" height="120">
</p>

**Local-first Mind Mapping with Markdown × Vim**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3-646cff.svg)](https://vitejs.dev/)

[🌐 **Live Demo**](https://sk0ya.github.io/Mindoodle/) • [📖 Documentation](#documentation) • [🚀 Quick Start](#quick-start) • [💡 Features](#features)

</div>

---

## ✨ What is Mindoodle?

Mindoodle is a **local-first mind mapping application** that combines the power of visual thinking with the simplicity of Markdown and the efficiency of Vim-like operations. Think, organize, and document your ideas seamlessly in a single, unified interface.

### 🎯 Core Philosophy

- **🌳 Visual Thinking**: Create mind maps with intuitive drag-and-drop operations
- **📝 Markdown Native**: All data stored as plain Markdown files - portable and future-proof
- **⚡ Vim Efficiency**: Navigate and edit with lightning-fast Vim keybindings
- **🔒 Local-First**: Your data stays on your device - works completely offline

## 🚀 Quick Start

### Prerequisites

- Modern web browser with File System Access API support (Chrome, Edge, Safari)
- No installation required!

### Getting Started

1. **Visit the live demo**: [https://sk0ya.github.io/Mindoodle/](https://sk0ya.github.io/Mindoodle/)
2. **Grant folder access** to start creating mind maps
3. **Start mapping** your ideas instantly!

### Local Development

```bash
# Clone the repository
git clone https://github.com/sk0ya/Mindoodle.git
cd Mindoodle/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5174` to see your local instance.

## 💡 Features

### 🗺️ Mind Mapping
- **Intuitive Node Operations**: Add, delete, move, and reorder nodes effortlessly
- **Drag & Drop**: Restructure your mind maps with simple drag operations
- **Zoom & Pan**: Navigate large mind maps smoothly
- **Collapse/Expand**: Focus on specific branches by folding nodes

### 📝 Markdown Integration
- **Bidirectional Sync**: Mind map structure ↔ Markdown document
- **CodeMirror Editor**: Professional code editor with syntax highlighting and Vim mode
- **Cross-References**: Link between different maps and nodes
- **File Attachments**: Reference external files with relative paths

### ⌨️ Vim-like Operations
- **Navigation**: `h/j/k/l` for lightning-fast movement
- **Editing**: `dd` to delete, `za` to toggle fold, and more
- **Modal Interface**: Command mode for advanced operations
- **Muscle Memory**: Familiar keybindings for Vim users

### 🔧 Workspace Management
- **Multi-Workspace**: Switch between different project folders
- **Local Storage**: File System Access API or IndexedDB
- **Cloud Sync**: Optional Cloudflare Workers backend with KV and R2
- **Workspace Switching**: Quick navigation with Ctrl+P/N

### 🤖 AI Integration (Optional)
- **Ollama Support**: Generate child node suggestions with local AI
- **Privacy-First**: AI processing happens locally on your machine

### 🎨 Advanced Features
- **Mermaid Diagrams**: Embed and render Mermaid diagrams in nodes
- **Image Support**: Paste and attach images with cloud storage
- **Hierarchical Colors**: Visual organization with color-coded connections
- **Search & Navigation**: Powerful search with IME support
- **Inline Markdown**: Format text with markdown syntax in nodes

## 🛠️ Built With

<div align="center">

![React](https://img.shields.io/badge/React-18.2-61dafb?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.3-646cff?style=for-the-badge&logo=vite)
![Zustand](https://img.shields.io/badge/Zustand-5.0-orange?style=for-the-badge)

</div>

### Core Technologies
- **Frontend**: React 18.2 + TypeScript 5.8 (strict mode)
- **Build Tool**: Vite 6.3 with lightning-fast HMR
- **State Management**: Zustand 5.0 + Immer 10.1
- **Editor**: CodeMirror 6.0 with @replit/codemirror-vim
- **Markdown**: Marked 16.2 for parsing and rendering
- **Diagrams**: Mermaid 10.9 for diagram rendering
- **File Handling**: JSZip 3.10 for import/export
- **Icons**: Lucide React 0.544 for beautiful UI

### Project Statistics
- **Total Files**: 277 TypeScript files
- **Lines of Code**: ~38,000 lines of TypeScript
- **Architecture**: Command-driven, feature-based organization
- **Storage**: Local-first with optional cloud sync (Cloudflare Workers)

## 📖 Documentation

- 📋 [Vim Keybindings Cheat Sheet](docs/vim-keybindings.md)
- ⌨️ [Regular Shortcuts Guide](docs/shortcuts.md)

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Commands

```bash
npm run dev              # Start development server
npm run build            # Production build with validation
npm run type-check       # TypeScript type checking
npm run lint             # ESLint code quality check
npm run validate         # Run all validation checks
```

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **CodeMirror** team for the excellent extensible code editor
- **React** team for the amazing framework
- **Vim** community for inspiring the keybinding system
- **Markdown** for being the perfect document format

---

<div align="center">

**Made with ❤️ by [Shigekazu Koya](https://github.com/sk0ya)**

[⬆ Back to Top](#-mindoodle)

</div>
