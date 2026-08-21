import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const sourceRoot = path.resolve(projectRoot, 'src');

const collectSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const sourceFiles = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      sourceFiles.push(...await collectSourceFiles(entryPath));
      continue;
    }

    const isTypeScript = entry.name.endsWith('.ts') || entry.name.endsWith('.tsx');
    const isExcluded = entry.name.endsWith('.d.ts') || entry.name.includes('.test.');
    if (isTypeScript && !isExcluded) sourceFiles.push(entryPath);
  }

  return sourceFiles;
};

const patterns = [
  { name: 'explicit any', expression: /\bany\b/g },
  { name: 'non-null assertion', expression: /(?<![.!])!\./g },
  { name: 'unchecked JSON.parse', expression: /JSON\.parse\s*\(/g }
];

const findings = [];
const files = await collectSourceFiles(sourceRoot);

for (const filePath of files.sort()) {
  const source = await readFile(filePath, 'utf8');
  const lines = source.split(/\r?\n/);

  for (const [lineIndex, line] of lines.entries()) {
    for (const pattern of patterns) {
      if (pattern.expression.test(line)) {
        findings.push(`${path.relative(projectRoot, filePath)}:${lineIndex + 1} ${pattern.name}`);
        pattern.expression.lastIndex = 0;
      }
    }
  }
}

if (findings.length > 0) {
  console.warn(`Unsafe pattern scan found ${findings.length} existing occurrence(s):`);
  for (const finding of findings) console.warn(`- ${finding}`);
} else {
  console.log('Unsafe pattern scan passed.');
}
