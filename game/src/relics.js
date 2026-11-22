// Relics. One job: the 12 between-floor rewards and what each one changes.
// The game picks 1 of 3 each floor; effects stack through `game.mods`.
export const RELICS = [
  { id: 'silk-gloves', name: 'Silk Gloves', glyph: 'S', desc: 'Crack vaults 40% faster.' },
  { id: 'cats-paw', name: "Cat's Paw", glyph: 'P', desc: 'Move 15% faster.' },
  { id: 'shadow-cloak', name: 'Shadow Cloak', glyph: 'C', desc: 'Alarm fills 30% slower.' },
  { id: 'magnet-charm', name: 'Magnet Charm', glyph: 'M', desc: 'Loot pickup radius +60%.' },
  { id: 'lucky-coin', name: 'Lucky Coin', glyph: 'L', desc: 'All loot is worth 25% more.' },
  { id: 'smoke-rig', name: 'Smoke Rig', glyph: 'F', desc: '+1 smoke bomb at every floor.' },
  { id: 'emp-cell', name: 'EMP Cell', glyph: 'E', desc: '+1 EMP charge at every floor.' },
  { id: 'quiet-boots', name: 'Quiet Boots', glyph: 'B', desc: 'Sneak at full walking speed.' },
  { id: 'second-wind', name: 'Second Wind', glyph: 'W', desc: 'Survive one extra strike.' },
  { id: 'crowbar', name: 'Crowbar', glyph: 'K', desc: 'Crack vaults 25% faster.' },
  { id: 'night-goggles', name: 'Night Goggles', glyph: 'N', desc: 'Alarm drains 50% faster.' },
  { id: 'golden-touch', name: 'Golden Touch', glyph: 'G', desc: '+$25 for every loot taken.' },
];

export function freshMods() {
  return {
    crackMul: 1,
    speedMul: 1,
    alarmFillMul: 1,
    alarmDecayMul: 1,
    pickupRadius: 30,
    lootValueMul: 1,
    bonusPerLoot: 0,
    smokePerFloor: 0,
    empPerFloor: 0,
    sneakFullSpeed: false,
    extraStrikes: 0,
  };
}

export function applyRelic(mods, relicId) {
  switch (relicId) {
    case 'silk-gloves': mods.crackMul *= 0.6; break;
    case 'cats-paw': mods.speedMul *= 1.15; break;
    case 'shadow-cloak': mods.alarmFillMul *= 0.7; break;
    case 'magnet-charm': mods.pickupRadius *= 1.6; break;
    case 'lucky-coin': mods.lootValueMul *= 1.25; break;
    case 'smoke-rig': mods.smokePerFloor += 1; break;
    case 'emp-cell': mods.empPerFloor += 1; break;
    case 'quiet-boots': mods.sneakFullSpeed = true; break;
    case 'second-wind': mods.extraStrikes += 1; break;
    case 'crowbar': mods.crackMul *= 0.75; break;
    case 'night-goggles': mods.alarmDecayMul *= 1.5; break;
    case 'golden-touch': mods.bonusPerLoot += 25; break;
    default: break;
  }
  return mods;
}

// Draw three relic choices the thief has not taken yet.
export function drawRelicChoices(rng, ownedIds, count = 3) {
  const pool = RELICS.filter((r) => !ownedIds.includes(r.id));
  return rng.shuffle(pool).slice(0, Math.min(count, pool.length));
}

export function relicById(id) {
  return RELICS.find((r) => r.id === id);
}
