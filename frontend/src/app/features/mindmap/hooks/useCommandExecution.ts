import { useCallback } from 'react';

interface CommandExecutionParams {
  commands: {
    execute: (commandName: string, args?: Record<string, any>) => Promise<{
      success: boolean;
      message?: string;
      error?: string;
    }>;
  };
  showNotification: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

/**
 * Hook for command palette execution
 */
export function useCommandExecution({
  commands,
  showNotification,
}: CommandExecutionParams) {

  /**
   * Execute command from palette with error handling
   */
  const handleExecuteCommand = useCallback(async (commandName: string, _args?: Record<string, any>) => {
    try {
      const result = await commands.execute(commandName);
      if (result.success) {
        if (result.message) {
          showNotification('success', result.message);
        }
      } else {
        showNotification('error', result.error || 'コマンドの実行に失敗しました');
      }
    } catch (error) {
      console.error('Command execution failed:', error);
      showNotification('error', 'コマンドの実行中にエラーが発生しました');
    }
  }, [commands, showNotification]);

  return {
    handleExecuteCommand,
  };
}
