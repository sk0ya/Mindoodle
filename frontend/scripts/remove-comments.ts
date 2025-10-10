import fs from "fs";
import path from "path";
import strip from "strip-comments";

const targetDir = path.resolve("src");
const exts = [".ts", ".tsx", ".js", ".jsx"];

function removeCommentsFromFile(filePath: string) {
  const code = fs.readFileSync(filePath, "utf8");
  const cleaned = strip(code, { safe: false });
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
