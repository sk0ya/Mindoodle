// Monaco web worker wiring for Vite environment
// Ensures MonacoEnvironment.getWorker is defined before any editor is created

// Import worker constructors via Vite's ?worker bundling
// These imports must stay as top-level to allow bundling
// @ts-ignore - Vite worker import typings
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
// @ts-ignore
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
// @ts-ignore
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
// @ts-ignore
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
// @ts-ignore
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Assign global MonacoEnvironment.getWorker
const g: any = self as any;
if (!g.MonacoEnvironment || !g.MonacoEnvironment.getWorker) {
  g.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      switch (label) {
        case 'json':
          return new JsonWorker();
        case 'css':
        case 'scss':
        case 'less':
          return new CssWorker();
        case 'html':
        case 'handlebars':
        case 'razor':
          return new HtmlWorker();
        case 'typescript':
        case 'javascript':
          return new TsWorker();
        default:
          return new EditorWorker();
      }
    },
  };
}

