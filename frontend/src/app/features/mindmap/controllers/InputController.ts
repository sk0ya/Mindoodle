import type { UseCommandsReturn } from '@commands/index';

// Bridges diverse input sources (vim/shortcuts/palette/menu) to command execution
export class InputController {
  constructor(private commands: UseCommandsReturn) {}

  execute(nameOrString: string) {
    return this.commands.execute(nameOrString);
  }
}
