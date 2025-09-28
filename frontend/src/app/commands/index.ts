// navigation
import * as navigationCommands from './navigation/navigate';
import * as centerCommands from './navigation/center';
import * as navigationUtilCommands from './navigation/navigation';
import * as navigationIndexCommands from './navigation/index';

// editing
import * as deleteCommands from './editing/delete';
import * as editCommands from './editing/edit';
import * as insertCommands from './editing/insert';

// structure
import * as structureCommands from './structure/structure';
import * as toggleCommands from './structure/toggle';

// application
import * as applicationCommands from './application/application';
import * as mindmapCommands from './application/mindmap';

// ui
import * as uiCommands from './ui/ui';

// system
export { useCommands } from './system/useCommands';
export type { UseCommandsReturn } from './system/useCommands';


// =============================
// Flatten all commands
// =============================
export const allCommandModules = {
  navigation: { ...navigationCommands, ...centerCommands, ...navigationUtilCommands, ...navigationIndexCommands },
  editing: { ...deleteCommands, ...editCommands, ...insertCommands },
  structure: { ...structureCommands, ...toggleCommands },
  application: { ...applicationCommands, ...mindmapCommands },
  ui: uiCommands,
} as const;

// categoriesごとに配列化
export const commandCategories = Object.fromEntries(
  Object.entries(allCommandModules).map(([key, mod]) => [
    key,
    Object.values(mod),
  ])
) as Record<string, any[]>;

// すべてまとめた配列
export const commands = Object.values(commandCategories).flat();


// =============================
// Registry Helper
// =============================
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
