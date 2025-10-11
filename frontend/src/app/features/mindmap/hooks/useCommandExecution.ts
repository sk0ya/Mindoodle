import { useStableCallback } from '@shared/hooks';

interface CommandExecutionParams {
  commands: {
    execute: (commandName: string, args?: Record<string, unknown>) => Promise<{
      success: boolean;
      message?: string;
      error?: string;
    }>;
  };
  showNotification: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}


export function useCommandExecution({
  commands,
  showNotification,
}: CommandExecutionParams) {


  const handleExecuteCommand = useStableCallback(async (commandName: string, _args?: Record<string, unknown>) => {
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
  });

  return {
    handleExecuteCommand,
  };
}
