#!/usr/bin/env tsx

/**
 * Documentation Generator
 * Automatically generates keyboard shortcut documentation from command system
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const docsDir = join(projectRoot, 'docs');

/**
 * Get current timestamp for documentation
 */
function getCurrentTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate standard shortcuts documentation
 */

interface Command {
  name: string;
  aliases?: string[];
  description: string;
  category: string;
}

/**
 * Extract commands from command files dynamically
 */
async function extractCommands(): Promise<Command[]> {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const commands: Command[] = [];
  const commandDirs = ['navigation', 'editing', 'structure', 'application', 'ui'];

  for (const dir of commandDirs) {
    try {
      const dirPath = join(__dirname, '../frontend/src/app/commands', dir);
      const { readdirSync } = await import('fs');
      const files = readdirSync(dirPath).filter(f => f.endsWith('.ts'));

      for (const file of files) {
        const filePath = join(dirPath, file);
        const content = readFileSync(filePath, 'utf-8');

        // Extract command definitions using regex
        const commandPattern = /(\w+Command):\s*Command\s*=\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
        let match;

        while ((match = commandPattern.exec(content)) !== null) {
          const commandBlock = match[2];

          // Extract properties
          const nameMatch = commandBlock.match(/name:\s*['"`]([^'"`]+)['"`]/);
          const aliasesMatch = commandBlock.match(/aliases:\s*\[([^\]]+)\]/);
          const descMatch = commandBlock.match(/description:\s*['"`]([^'"`]+)['"`]/);
          const categoryMatch = commandBlock.match(/category:\s*['"`]([^'"`]+)['"`]/);

          if (nameMatch && descMatch && categoryMatch) {
            const aliases: string[] = [];
            if (aliasesMatch) {
              const aliasStr = aliasesMatch[1];
              const aliasMatches = aliasStr.match(/['"`]([^'"`]+)['"`]/g);
              if (aliasMatches) {
                aliases.push(...aliasMatches.map(a => a.replace(/['"`]/g, '')));
              }
            }

            commands.push({
              name: nameMatch[1],
              aliases,
              description: descMatch[1],
              category: categoryMatch[1]
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Error reading commands from ${dir}:`, error);
    }
  }

  return commands;
}

/**
 * Generate documentation from extracted commands
 */
function generateDocsFromCommands(commands: Command[]): { vim: string; standard: string } {
  const timestamp = getCurrentTimestamp();
  const vimCommands = commands.filter(cmd =>
    cmd.aliases?.some(alias => alias.length === 1 && /^[a-zA-Z]$/.test(alias)) ||
    cmd.aliases?.some(alias => ['gg', 'dd', 'yy', 'ciw', 'za', 'zo', 'zc', 'zR', 'zM', 'zz'].includes(alias))
  );

  const standardCommands = commands.filter(cmd => !vimCommands.includes(cmd));

  // Generate Vim documentation
  const vimContent = `# Mindoodle マインドマップ Vim キーバインド（早見表）

Vim 風のショートカット一覧です。

## 基本の考え方

- モードは Normal 前提
- 主要移動: h/j/k/l

${generateCommandSection(vimCommands, 'vim')}

最終更新: ${timestamp}
`;

  // Generate standard documentation
  const standardContent = `# Mindoodle 通常ショートカット（非 Vim）

現行実装の通常ショートカットをまとめた早見表です。

${generateCommandSection(standardCommands, 'standard')}

最終更新: ${timestamp}
`;

  return { vim: vimContent, standard: standardContent };
}

/**
 * Generate command section by category
 */
function generateCommandSection(commands: Command[], type: 'vim' | 'standard'): string {
  const categories = [...new Set(commands.map(cmd => cmd.category))];
  let content = '';

  for (const category of categories) {
    const categoryCommands = commands.filter(cmd => cmd.category === category);
    if (categoryCommands.length === 0) continue;

    const categoryTitle = getCategoryTitle(category);
    content += `## ${categoryTitle}\n\n`;
    content += `| キー | 動作 |\n`;
    content += `|---|---|\n`;

    for (const command of categoryCommands) {
      if (command.aliases && command.aliases.length > 0) {
        for (const alias of command.aliases) {
          content += `| ${alias} | ${command.description} |\n`;
        }
      } else {
        content += `| ${command.name} | ${command.description} |\n`;
      }
    }
    content += '\n';
  }

  return content;
}

/**
 * Get Japanese category title
 */
function getCategoryTitle(category: string): string {
  const titles: Record<string, string> = {
    'navigation': 'ナビゲーション',
    'editing': '編集',
    'structure': '構造',
    'application': 'アプリケーション',
    'ui': 'UI'
  };
  return titles[category] || category;
}

/**
 * Main generation function
 */
async function generateDocs(): Promise<void> {
  console.log('🔧 Generating keyboard shortcut documentation...');

  // Ensure docs directory exists
  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true });
  }

  try {
    // Extract commands from implementation
    const commands = await extractCommands();
    console.log(`📚 Extracted ${commands.length} commands from implementation`);

    // Generate documentation
    const { vim, standard } = generateDocsFromCommands(commands);

    // Write files
    writeFileSync(join(docsDir, 'vim-keybindings.md'), vim, 'utf-8');
    console.log('✅ Generated vim-keybindings.md');

    writeFileSync(join(docsDir, 'shortcuts.md'), standard, 'utf-8');
    console.log('✅ Generated shortcuts.md');

    console.log('🎉 Documentation generation completed successfully!');

  } catch (error) {
    console.error('❌ Error generating documentation:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateDocs().catch(error => {
    console.error('Failed to generate docs:', error);
    process.exit(1);
  });
}

export { generateDocs };