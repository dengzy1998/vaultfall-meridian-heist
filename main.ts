// VAULTFALL — The Meridian Heist: hand-in program for the make.fun heist-game bounty.
//
// What this file does, in order:
//   1. Works out where the judge's bundle goes (MAKEFUN_OUTPUT_DIR, /output by default).
//   2. Stages the playable game (game/) and the screenshot set (screenshots/) into it.
//   3. Walks the staged game tree and prints a one-line inventory summary, so a human
//      running this by hand can see at a glance what is about to be handed in.
//   4. Asks the vendored make.fun library to summarise the bundle into dossier.json,
//      under the scorer's published size caps, and writes that file next to the game.
//
// The game itself is plain static files (game/index.html plus its ES modules): no build
// step, no network, nothing to install. Run `node serve.ts` to play it locally.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's ceilings, restated once so the hand-in below reads plainly:
// at most 160 KiB of outlined text, at most 4 screenshots of at most 256 KiB each,
// at most 993 game files totalling at most 48 MiB, and no game path over 1000 bytes.
const HAND_IN_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const ownDir = fileURLToPath(new URL('.', import.meta.url));
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy one sibling folder of this file into the bundle, when it exists.
function stageFolder(name) {
  const from = join(ownDir, name);
  if (existsSync(from)) {
    cpSync(from, join(targetDir, name), { recursive: true });
  }
}

// Recursively list every file under a directory as { path, bytes } entries.
function inventory(dir, prefix = '') {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...inventory(full, rel));
    } else {
      found.push({ path: rel, bytes: statSync(full).size });
    }
  }
  return found;
}

mkdirSync(targetDir, { recursive: true });
stageFolder('game');
mkdirSync(join(targetDir, 'screenshots'), { recursive: true });
stageFolder('screenshots');

const staged = inventory(join(targetDir, 'game'));
const totalBytes = staged.reduce((sum, file) => sum + file.bytes, 0);
console.log(`vaultfall hand-in: ${staged.length} game files, ${totalBytes} bytes staged`);

writeFileSync(join(targetDir, 'dossier.json'), buildDossier(targetDir, HAND_IN_LIMITS));
