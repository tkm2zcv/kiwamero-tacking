// Windows-only preload shim for OpenNext builds.
//
// `@opennextjs/aws` recreates pnpm-style symlinks while copying traced files into
// `.open-next/server-functions`. Windows only allows that with Developer Mode or
// an elevated shell; otherwise `symlinkSync` throws EPERM and the build aborts.
//
// Loading this file before the CLI replaces `fs.symlinkSync` with a fallback that
// copies the target (recursively for directories) when symlinking is denied.
// Nothing in node_modules or the repository source is modified.
//
// Usage (Windows): node -r ./tools/fs-symlink-fallback.cjs <opennext cli> build
const fs = require("node:fs");

if (process.platform === "win32") {
  const original = fs.symlinkSync;
  fs.symlinkSync = function symlinkWithCopyFallback(target, path, type) {
    try {
      return original.call(fs, target, path, type);
    } catch (error) {
      if (error.code !== "EPERM" && error.code !== "EACCES") throw error;
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        fs.cpSync(target, path, { recursive: true, dereference: true });
      } else {
        fs.copyFileSync(target, path);
      }
      return undefined;
    }
  };
}
