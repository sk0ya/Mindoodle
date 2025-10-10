
import * as navigationCommands from './navigation/navigate';
import * as centerCommands from './navigation/center';
import * as navigationUtilCommands from './navigation/navigation';
import * as navigationIndexCommands from './navigation/index';


import * as deleteCommands from './editing/delete';
import * as editCommands from './editing/edit';
import * as insertCommands from './editing/insert';
import * as formatCommands from './editing/format';


import * as structureCommands from './structure';
import * as toggleCommands from './toggle';


import * as applicationCommands from './application/application';
import * as mindmapCommands from './application/mindmap';


import * as uiCommands from './ui';


export { useCommands } from './system/useCommands';
export type { UseCommandsReturn } from './system/useCommands';





export const allCommandModules = {
  navigation: { ...navigationCommands, ...centerCommands, ...navigationUtilCommands, ...navigationIndexCommands },
  editing: { ...deleteCommands, ...editCommands, ...insertCommands, ...formatCommands },
  structure: { ...structureCommands, ...toggleCommands },
  application: { ...applicationCommands, ...mindmapCommands },
  ui: uiCommands,
} as const;


export const commandCategories = Object.fromEntries(
  Object.entries(allCommandModules).map(([key, mod]) => [
    key,
    Object.values(mod),
  ])
) as Record<string, any[]>;


export const commands = Object.values(commandCategories).flat();





export function registerAllCommands(registry: any) {
  for (const command of commands) {
    try {
      if (command && typeof command === 'object' && command.name) {
        registry.register(command);
      } else {
        console.warn('Invalid command structure:', command);
      }
    } catch (error) {
      console.warn(`Failed to register command: ${command?.name ?? 'unknown'}`, error);
    }
  }
}
