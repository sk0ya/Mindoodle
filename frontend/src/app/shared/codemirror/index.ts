/**
 * CodeMirror exports
 */

export { CodeMirrorEditor, type CodeMirrorEditorProps, type CodeMirrorEditorRef } from './CodeMirrorEditor';
export {
  createEditor,
  createBaseExtensions,
  reconfigureEditor,
  setEditorValue,
  getEditorValue,
  focusEditor,
  getCursorPosition,
  getVimApi,
  type EditorConfig,
} from './setup';
