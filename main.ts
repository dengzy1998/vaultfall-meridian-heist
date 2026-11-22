// VAULTFALL hand-in program (Node 22, standard library only).
//
// What it does: takes this repository's game/ and screenshots/ folders and
// assembles the submission output — the same two folders plus dossier.json,
// the summary the judge reads, built by the vendored make.fun library.
//
// Run it locally with MAKEFUN_OUTPUT_DIR set to a scratch folder:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader the output directory is /output and no env var is set.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

// Refuse to hand in a repository with no playable game in it.
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing; nothing to hand in');
}

mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// Caps mirror the gate so a build that would fail there fails here first:
// at most 4 screenshots of 256 KiB, at most 993 game files / 48 MiB total,
// paths under game/ at most 1000 bytes, dossier text at most 160 KiB.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

const shotCount = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((f) => !f.startsWith('.')).length
  : 0;
console.log(
  `VAULTFALL handed in: ${statSync(join(outputDir, 'dossier.json')).size} byte dossier, ` +
  `${shotCount} screenshot(s) -> ${outputDir}`,
);
