#!/usr/bin/env bun

/**
 * Setup script for git submodules and app dependencies
 * Runs on postinstall to ensure all apps are properly initialized
 * 
 * Note: Gracefully handles missing apps (not all are open source yet)
 */

import { spawn } from "bun";
import { existsSync } from "fs";
import { join } from "path";

interface App {
  name: string;
  path: string;
  packageManager: "npm" | "pnpm" | "bun";
  lockfile: string;
}

const APPS: App[] = [
  {
    name: "caliguland",
    path: "apps/caliguland",
    packageManager: "bun",
    lockfile: "bun.lock",
  },
  {
    name: "cloud",
    path: "apps/cloud",
    packageManager: "npm",
    lockfile: "package-lock.json",
  },
  {
    name: "hyperscape",
    path: "apps/hyperscape",
    packageManager: "bun",
    lockfile: "bun.lock",
  },
  {
    name: "launchpad",
    path: "apps/launchpad",
    packageManager: "pnpm",
    lockfile: "pnpm-lock.yaml",
  },
  {
    name: "otc-agent",
    path: "apps/otc-agent",
    packageManager: "bun",
    lockfile: "bun.lock",
  },
];

const ROOT_DIR = process.cwd();

/**
 * Execute a command and stream output
 */
async function exec(
  cmd: string,
  args: string[],
  cwd: string = ROOT_DIR
): Promise<boolean> {
  console.log(`\n📦 Running: ${cmd} ${args.join(" ")}`);
  console.log(`   Directory: ${cwd}`);

  const proc = spawn({
    cmd: [cmd, ...args],
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const exitCode = await proc.exited;
  return exitCode === 0;
}

/**
 * Check if we're in a git repository
 */
function isGitRepo(): boolean {
  return existsSync(join(ROOT_DIR, ".git"));
}

/**
 * Initialize and update git submodules
 */
async function setupSubmodules(): Promise<void> {
  console.log("\n🔄 Setting up git submodules...");

  if (!isGitRepo()) {
    console.log("⚠️  Not a git repository, skipping submodule setup");
    return;
  }

  // Check if .gitmodules exists
  if (!existsSync(join(ROOT_DIR, ".gitmodules"))) {
    console.log("⚠️  No .gitmodules file found, skipping submodule setup");
    return;
  }

  // Initialize submodules
  const initSuccess = await exec("git", ["submodule", "init"]);
  if (!initSuccess) {
    console.error("❌ Failed to initialize submodules");
    return;
  }

  // Update submodules
  const updateSuccess = await exec("git", [
    "submodule",
    "update",
    "--init",
    "--recursive",
    "--remote",
  ]);
  if (!updateSuccess) {
    console.error("❌ Failed to update submodules");
    return;
  }

  console.log("✅ Submodules updated successfully");
}

/**
 * Install dependencies for a specific app
 */
async function installAppDependencies(app: App): Promise<void> {
  const appPath = join(ROOT_DIR, app.path);

  // Check if app directory exists
  if (!existsSync(appPath)) {
    console.log(`⚠️  ${app.name} directory not found, skipping...`);
    return;
  }

  // Check if package.json exists
  const packageJsonPath = join(appPath, "package.json");
  if (!existsSync(packageJsonPath)) {
    console.log(`⚠️  ${app.name} has no package.json, skipping...`);
    return;
  }

  console.log(`\n📦 Installing dependencies for ${app.name}...`);

  let success = false;

  switch (app.packageManager) {
    case "npm":
      success = await exec("npm", ["install"], appPath);
      break;
    case "pnpm":
      success = await exec("pnpm", ["install"], appPath);
      break;
    case "bun":
      success = await exec("bun", ["install"], appPath);
      break;
  }

  if (success) {
    console.log(`✅ ${app.name} dependencies installed successfully`);
  } else {
    console.warn(`⚠️  Failed to install ${app.name} dependencies (may not be available yet)`);
  }
}

/**
 * Main setup function
 */
async function main() {
  console.log("🚀 Starting apps setup...\n");
  console.log("=" .repeat(60));

  try {
    // Step 1: Setup git submodules
    await setupSubmodules();

    console.log("\n" + "=".repeat(60));
    console.log("\n📦 Installing app dependencies...\n");

    // Step 2: Install dependencies for each app
    for (const app of APPS) {
      await installAppDependencies(app);
    }

  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Setup complete!");
  console.log("\n💡 Next:");
  console.log("   bun run dev      # Start everything");
  console.log("   bun run test     # Run all tests");
  console.log("\n" + "=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ Setup failed:", error);
    process.exit(1);
  }
}

// Run the setup
main();

