import { spawn } from "node:child_process";
import { commandExists } from "./util.js";

export type PackageManager = "bun" | "npm";

export async function detectPackageManager(preferred?: string): Promise<PackageManager> {
  if (preferred === "bun" || preferred === "npm") return preferred;
  if (await commandExists("bun")) return "bun";
  if (await commandExists("npm")) return "npm";
  throw new Error("Neither bun nor npm found on PATH. Install one to continue.");
}

/** Run `<pm> install` / `<pm> run build` in dir, streaming output. */
export function runScript(pm: PackageManager, dir: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(pm, args, { cwd: dir, stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`\`${pm} ${args.join(" ")}\` exited with code ${code}`));
    });
  });
}
