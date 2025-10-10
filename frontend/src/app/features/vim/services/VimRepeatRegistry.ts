

import type { CommandContext } from '@commands/system/types';


export interface RepeatableOperation {
  
  commandName: string;
  
  count: number;
  
  context: Partial<CommandContext>;
}

export class VimRepeatRegistry {
  private lastChange: RepeatableOperation | null = null;

  
  record(operation: RepeatableOperation): void {
    this.lastChange = operation;
  }

  
  getLastChange(): RepeatableOperation | null {
    return this.lastChange;
  }

  
  clear(): void {
    this.lastChange = null;
  }

  
  hasChange(): boolean {
    return this.lastChange !== null;
  }
}
