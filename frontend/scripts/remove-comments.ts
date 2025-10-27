import fs from "fs";
import path from "path";
import strip from "strip-comments";

const targetDir = path.resolve("src");
const exts = [".ts", ".tsx", ".js", ".jsx"];

function protectSpecialBlockComments(input: string): string {
  // Protect block comments containing TS/ESLint hints by turning /* into /*! so strip keeps them
  return input.replace(/\/\*([\s\S]*?)\*\//g, (m) => {
    const body = m.slice(2, -2);
    if (/@ts-|ts-expect-error|eslint|tslint|istanbul|<reference|@jsx|@jsxRuntime/i.test(body)) {
      return `/*!${body}*/`;
    }
    return m;
  });
}

function removeCommentsFromFile(filePath: string) {
  const code = fs.readFileSync(filePath, "utf8");
  const protectedCode = protectSpecialBlockComments(code);
  // Strip only block comments to avoid breaking 'http://' in strings
  const cleaned = strip.block(protectedCode, { keepProtected: true, preserveNewlines: true } as any);
  fs.writeFileSync(filePath, cleaned, "utf8");
  console.log(`🧹 Cleaned: ${filePath}`);
}

function walk(dir: string) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      walk(p);
    } else if (exts.some((ext) => p.endsWith(ext))) {
      removeCommentsFromFile(p);
    }
  }
}

console.log(`🚀 Removing comments in: ${targetDir}`);
walk(targetDir);
console.log("✅ コメント削除完了！");
