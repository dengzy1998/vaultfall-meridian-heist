// Relics: between floors the thief picks 1 of 3. Each relic is a small
// permanent modifier for the rest of the run, applied through relicMods.
export const RELICS = [
  { id: 'silent-shoes', name: 'SILENT SHOES', desc: 'Move 15% faster while sneaking.', mods: { sneakMul: 1.15 } },
  { id: 'grapple', name: 'GRAPPLE LINE', desc: 'Move 12% faster everywhere.', mods: { moveMul: 1.12 } },
  { id: 'smoke-veil', name: 'SMOKE VEIL', desc: 'Smoke bombs last 60% longer.', mods: { smokeMul: 1.6 } },
  { id: 'emp-coil', name: 'EMP COIL', desc: 'EMP lasts 50% longer.', mods: { empMul: 1.5 } },
  { id: 'lucky-charm', name: 'LUCKY CHARM', desc: 'All loot is worth 25% more.', mods: { lootMul: 1.25 } },
  { id: 'thick-skin', name: 'THICK SKIN', desc: 'Survive one extra strike.', mods: { extraStrike: 1 } },
  { id: 'eagle-eye', name: 'EAGLE EYE', desc: 'Guard cones read 20% shorter.', mods: { visionMul: 0.8 } },
  { id: 'ghost-step', name: 'GHOST STEP', desc: 'Alarm decays 40% faster.', mods: { decayMul: 1.4 } },
  { id: 'vault-sense', name: 'VAULT SENSE', desc: 'Crack vaults 30% faster.', mods: { crackMul: 0.7 } },
  { id: 'coin-magnet', name: 'COIN MAGNET', desc: 'Pick up loot from 50% further away.', mods: { lootRadiusMul: 1.5 } },
  { id: 'second-wind', name: 'SECOND WIND', desc: 'Once per run, a strike is forgiven.', mods: { secondWind: 1 } },
  { id: 'master-key', name: 'MASTER KEY', desc: 'The next vault cracks instantly.', mods: { instantCrack: 1 } },
];

export function baseMods() {
  return {
    moveMul: 1, sneakMul: 1, smokeMul: 1, empMul: 1, lootMul: 1,
    extraStrike: 0, visionMul: 1, decayMul: 1, crackMul: 1,
    lootRadiusMul: 1, secondWind: 0, instantCrack: 0,
  };
}

// Fold a list of owned relic ids into one modifier object.
export function computeMods(ownedIds) {
  const mods = baseMods();
  for (const id of ownedIds) {
    const relic = RELICS.find((r) => r.id === id);
    if (!relic) continue;
    for (const [k, v] of Object.entries(relic.mods)) {
      if (typeof v === 'number' && k.endsWith('Mul')) mods[k] = (mods[k] || 1) * v;
      else if (typeof v === 'number') mods[k] = (mods[k] || 0) + v;
    }
  }
  return mods;
}

// Deal 3 distinct relics the player does not own yet.
export function dealRelics(rng, ownedIds) {
  const pool = RELICS.filter((r) => !ownedIds.includes(r.id));
  const out = [];
  const copy = pool.slice();
  while (out.length < 3 && copy.length) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}
