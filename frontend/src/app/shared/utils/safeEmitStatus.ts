import { emitStatus } from '../hooks/useStatusBar';

/**
 * Safe wrapper for emitStatus that won't throw errors
 */
export function safeEmitStatus(
  type: 'info' | 'warning' | 'error' | 'success',
  message: string,
  duration?: number
): void {
  try {
    emitStatus(type, message, duration);
  } catch {
    // Silently ignore errors in status emission
  }
}

/**
 * Commonly used status messages with consistent durations
 */
export const statusMessages = {
  folderAccessUnavailable: () =>
    safeEmitStatus('info', 'この環境ではフォルダアクセス機能が利用できません', 6000),

  workspacePermissionDenied: (workspaceName: string) =>
    safeEmitStatus('warning', `ワークスペース「${workspaceName}」の権限がありません。フォルダを選び直してください`, 6000),

  fileReadPermissionDenied: () =>
    safeEmitStatus('warning', 'ファイルの読み取り権限がありません。フォルダを選び直してください', 6000),

  fileReadFailed: (fileName: string) =>
    safeEmitStatus('error', `「${fileName}」の読み込みに失敗しました`, 6000),

  customWarning: (message: string) =>
    safeEmitStatus('warning', message, 6000),

  customError: (message: string) =>
    safeEmitStatus('error', message, 6000),

  customInfo: (message: string) =>
    safeEmitStatus('info', message, 6000),

  customSuccess: (message: string) =>
    safeEmitStatus('success', message, 6000),

  markdownSyncFailed: () =>
    safeEmitStatus('error', 'マークダウンの同期に失敗しました', 5000),

  markdownGenerationFailed: () =>
    safeEmitStatus('warning', 'マークダウンの生成に失敗しました', 4000),

  markdownParsingFailed: (errorMessage: string) =>
    safeEmitStatus('error', `マークダウンの解析に失敗しました: ${errorMessage}`, 6000)
};