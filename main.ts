// Silent Stacks — the handoff program for make.fun's best-stealth-game bounty.
//
// What this file does, in one sentence: it gathers the finished game (the static
// files under game/) and its screenshots (screenshots/) into a fresh output folder
// and writes dossier.json there, the summary the judge reads.
//
// The game itself is plain static content — game/index.html plus its ES modules —
// so a desktop browser can load it offline with no library and no network request.
// This program never touches the game; it only copies files and asks the vendored
// make.fun library (vendor/makefun-game.ts) to describe what was copied.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader's container the output folder is /output by default. The run
// is deterministic: the same inputs always produce the same dossier.json bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's caps (reference/gate.json). text_max_bytes is the only one that
// shapes the dossier bytes; the rest make buildDossier refuse anything the scorer
// itself would refuse: more than 4 screenshots, or one over 256 KiB; more than
// 993 files in game/, or 48 MiB of game files in total, or a path under game/
// longer than 1000 bytes. game/ is counted beside /output's own 1000-entry cap,
// its screenshots/ and dossier.json.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

const GAME_DIR_NAME = 'game';
const SCREENSHOTS_DIR_NAME = 'screenshots';
const DOSSIER_FILE_NAME = 'dossier.json';

/** Folder this file lives in — game/ and screenshots/ sit beside it. */
function resolveSourceDir(): string {
  return fileURLToPath(new URL('.', import.meta.url));
}

/** Where the handoff goes: $MAKEFUN_OUTPUT_DIR, or /output in the grader. */
function resolveOutputDir(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
}

/** Walk a directory tree and count every file plus their total byte size. */
function countTreeFiles(root: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.isFile()) {
        files += 1;
        bytes += statSync(path).size;
      }
    }
  };
  walk(root);
  return { files, bytes };
}

/**
 * Fail early with a plain message when a required input is missing, so a broken
 * checkout is caught here instead of producing a half-copied output folder.
 */
function requireInputFolders(sourceDir: string): void {
  const gameDir = join(sourceDir, GAME_DIR_NAME);
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    throw new Error(`Silent Stacks: ${GAME_DIR_NAME}/ is missing — nothing to hand in.`);
  }
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('Silent Stacks: game/index.html is missing — the game has no entry point.');
  }
  const shotsDir = join(sourceDir, SCREENSHOTS_DIR_NAME);
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    throw new Error(`Silent Stacks: ${SCREENSHOTS_DIR_NAME}/ is missing — the judge needs screenshots.`);
  }
  const shots = readdirSync(shotsDir).filter((name) => statSync(join(shotsDir, name)).isFile());
  if (shots.length === 0) {
    throw new Error(`Silent Stacks: ${SCREENSHOTS_DIR_NAME}/ is empty — add at least one screenshot.`);
  }
}

/**
 * Copy game/ and screenshots/ into the output folder, creating it first, and
 * return how many files and bytes were copied from each side.
 */
function copyEntryFiles(sourceDir: string, outputDir: string): {
  game: { files: number; bytes: number };
  screenshots: { files: number; bytes: number };
} {
  mkdirSync(outputDir, { recursive: true });
  const gameSource = join(sourceDir, GAME_DIR_NAME);
  const shotsSource = join(sourceDir, SCREENSHOTS_DIR_NAME);
  const gameStats = countTreeFiles(gameSource);
  const shotsStats = countTreeFiles(shotsSource);
  cpSync(gameSource, join(outputDir, GAME_DIR_NAME), { recursive: true });
  cpSync(shotsSource, join(outputDir, SCREENSHOTS_DIR_NAME), { recursive: true });
  return { game: gameStats, screenshots: shotsStats };
}

/** Ask the vendored library to describe the copied entry and save the result. */
function writeDossier(outputDir: string): { bytes: number } {
  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  const dossierPath = join(outputDir, DOSSIER_FILE_NAME);
  writeFileSync(dossierPath, dossier);
  return { bytes: statSync(dossierPath).size };
}

/** One short report line per copied side plus the dossier size, for the log. */
function reportDossierStats(
  outputDir: string,
  copied: { game: { files: number; bytes: number }; screenshots: { files: number; bytes: number } },
  dossier: { bytes: number },
): void {
  const describe = (label: string, stats: { files: number; bytes: number }): string =>
    `${label}: ${stats.files} file(s), ${stats.bytes} byte(s)`;
  console.log(`Silent Stacks: copied ${describe(GAME_DIR_NAME, copied.game)}`);
  console.log(`Silent Stacks: copied ${describe(SCREENSHOTS_DIR_NAME, copied.screenshots)}`);
  console.log(`Silent Stacks: wrote ${join(outputDir, DOSSIER_FILE_NAME)} (${dossier.bytes} bytes)`);
}

function main(): void {
  const sourceDir = resolveSourceDir();
  const outputDir = resolveOutputDir();
  requireInputFolders(sourceDir);
  const copied = copyEntryFiles(sourceDir, outputDir);
  const dossier = writeDossier(outputDir);
  reportDossierStats(outputDir, copied, dossier);
}

main();
