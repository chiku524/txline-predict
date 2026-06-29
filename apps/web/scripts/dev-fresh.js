const { execSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const appDir = path.join(__dirname, "..");
const nextDir = path.join(appDir, ".next");

const cacheDirs = [
  nextDir,
  path.join(appDir, "node_modules", ".cache"),
  path.join(appDir, ".next", "cache"),
];

for (const port of [3000, 3001, 3002]) {
  try {
    execSync(`npx --yes kill-port ${port}`, { stdio: "ignore", shell: true });
  } catch {
    /* port already free */
  }
}

for (const dir of cacheDirs) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Removed ${path.relative(appDir, dir)}`);
  }
}

console.log("\nStarting dev server on http://localhost:3000");
console.log("If you see missing chunk errors (e.g. ./548.js):");
console.log("  1. Ctrl+C to stop the server");
console.log("  2. Run npm run dev:fresh again");
console.log("  3. Hard refresh the browser (Ctrl+Shift+R)");
console.log("Never delete .next while the dev server is running.\n");

const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev"], {
  cwd: appDir,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
