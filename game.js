// Royaume — Kingdom Expeditions
// Vanilla JS prototype. GitHub-Pages friendly (no build step).

'use strict';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const TILE = 44;
const MAP_SIZE = 100;
const CASTLE = { x: 49, y: 49 };          // top-left of 3x3 castle
const CASTLE_CENTER = { x: 50, y: 50 };   // center cell of castle
const INFLUENCE_RADIUS = 8;               // cells

const CASE = {
  GRASS: 'grass', WHEAT: 'wheat', FOREST: 'forest', QUARRY: 'quarry',
  WATER: 'water', GOLD: 'gold', MONSTER: 'monster', RUINS: 'ruins',
  MOUNTAIN: 'mountain', CORRUPTED: 'corrupted', CASTLE: 'castle',
  HAMLET: 'hamlet', // small village — main civilian-encounter source
};

const RES = {
  wheat: { label: 'Nourriture', icon: 'assets/icons/ble.png' },
  water: { label: 'Eau',        icon: 'assets/icons/eau.png' },
  gold:  { label: 'Or',         icon: 'assets/icons/or.png' },
  wood:  { label: 'Bois',       icon: 'assets/icons/bois.png' },
  stone: { label: 'Pierre',     icon: 'assets/icons/pierre.png' },
};
const RES_ORDER = ['wheat', 'water', 'gold', 'wood', 'stone'];

const CELL_INFO = {
  wheat:   { name: 'Champ de blé',   glyph: '🌾', res: 'wheat', amount: [2, 4] },
  forest:  { name: 'Forêt',          glyph: '🌲', res: 'wood',  amount: [2, 4] },
  quarry:  { name: 'Carrière',       glyph: '⛰️', res: 'stone', amount: [2, 3] },
  water:   { name: 'Source',         glyph: '💧', res: 'water', amount: [2, 4] },
  gold:    { name: 'Filon d\'or',    glyph: '💰', res: 'gold',  amount: [2, 4] },
  monster: { name: 'Camp hostile',   glyph: '👹', res: null,    danger: [1, 3] },
  ruins:   { name: 'Ruines',         glyph: '🏚️', res: null,    treasure: true },
  mountain:{ name: 'Montagne',       glyph: '🗻', res: null,    blocking: true },
  grass:   { name: 'Herbe',          glyph: '',   res: null },
  corrupted:{ name: 'Zone corrompue',glyph: '☠️', res: null,    danger: [2, 4] },
  hamlet:  { name: 'Hameau',         glyph: '🛖', res: 'gold',  amount: [1, 2], encounter: 'civic' },
};

const SEASONS = [
  { name: 'Printemps', glyph: '🌸' },
  { name: 'Été',       glyph: '☀️' },
  { name: 'Automne',   glyph: '🍂' },
  { name: 'Hiver',     glyph: '❄️' },
];

// `civSlots` and `solSlots` add to the population caps managed by Le Peuple.
// Habitation buildings (Maison / Caserne) are the only way to grow population.
const BUILDINGS = [
  { id: 'house',   name: 'Maison',   glyph: '🏠', cost: { wood: 5, stone: 3 }, effect: '+3 logements · +1 civil', prod: {}, pool: null,         civSlots: 3 },
  { id: 'farm',    name: 'Ferme',    glyph: '🌾', cost: { wood: 3, stone: 1 }, effect: '+2 blé/mois',   prod: { wheat: 2 }, pool: 'intendance' },
  { id: 'mill',    name: 'Scierie',  glyph: '🪵', cost: { wood: 2, stone: 2 }, effect: '+1 bois/mois',  prod: { wood: 1 },  pool: 'exploration' },
  { id: 'barracks',name: 'Caserne',  glyph: '⚔️', cost: { wood: 5, stone: 3 }, effect: '+3 logements · +1 soldat', prod: {}, pool: 'militaire', solSlots: 3 },
  { id: 'granary', name: 'Grenier',  glyph: '🏛️', cost: { wood: 4, stone: 4 }, effect: '-25% coût nour.', prod: {},         pool: 'intendance' },
  { id: 'well',    name: 'Puits',    glyph: '🪣', cost: { stone: 5 },          effect: '+1 eau/mois',   prod: { water: 1 }, pool: null },
];

// Le Peuple — castle has an inherent household of 4 civilians (the king's
// servants). Additional capacity comes from Maison/Caserne. Conseil/Cour
// members are tracked separately and do NOT count toward the population.
const CASTLE_CIV_SLOTS = 4;
const CASTLE_SOL_SLOTS = 0;

const KING_STATES = [
  { max: 20, key: 'good',     label: 'TRÈS BON', mortality: 0.00, cssClass: 'king-good' },
  { max: 40, key: 'good',     label: 'BON',      mortality: 0.01, cssClass: 'king-good' },
  { max: 60, key: 'moyen',    label: 'MOYEN',    mortality: 0.03, cssClass: 'king-moyen' },
  { max: 80, key: 'mauvais',  label: 'MAUVAIS',  mortality: 0.07, cssClass: 'king-mauvais' },
  { max: 100,key: 'critical', label: 'CRITIQUE', mortality: 0.13, cssClass: 'king-critical' },
];

// Debug: expedition cost rules. Each rule contributes `amount × factorValue` (× months if perMonth).
// Factors map to a runtime value from the context { sendPop, fighters, explorers, dist, months }.
const COST_FACTORS = [
  { key: 'flat',       label: 'fixe' },
  { key: 'population', label: 'population' },
  { key: 'explorers',  label: 'explorateurs' },
  { key: 'fighters',   label: 'combattants' },
  { key: 'distance',   label: 'distance' },
];
const COST_RESOURCES = ['wheat', 'water', 'gold'];
const COST_SUBSTITUTE_RESOURCES = ['wheat', 'water', 'gold', 'wood', 'stone'];
const COST_MINIMUMS = { wheat: 0, water: 0, gold: 0 };
const PENALTY_TYPES = [
  { key: 'none',       label: 'aucune' },
  { key: 'units',      label: 'unités perdues' },
  { key: 'stress',     label: '+stress roi' },
  { key: 'substitute', label: 'payer en' },
];
const DEFAULT_COST_RULES = [
  { id: 'w1', resource: 'wheat', amount: 0.3, factor: 'explorers',  perMonth: true, penaltyType: 'none', penaltyAmount: 0, penaltySub: 'gold' },
  { id: 'w2', resource: 'wheat', amount: 0.2, factor: 'fighters',   perMonth: true, penaltyType: 'none', penaltyAmount: 0, penaltySub: 'gold' },
  { id: 'a1', resource: 'water', amount: 0.2, factor: 'population', perMonth: true, penaltyType: 'none', penaltyAmount: 0, penaltySub: 'gold' },
  { id: 'g1', resource: 'gold',  amount: 0.5, factor: 'fighters',   perMonth: true, penaltyType: 'none', penaltyAmount: 0, penaltySub: 'gold' },
];
const COST_RULES_STORAGE_KEY = 'ke_debug_cost_rules';

// Expedition events fire at most once per trip, keyed to the markers
// detected along the planned route (red ! = threat, green ! = boon).
const EXP_THREAT_EVENTS = [
  { id: 'ambush', msg: '🐺 Embuscade ! (−1 unité)', loseUnits: 1 },
];
const EXP_BOON_EVENTS = [
  { id: 'treasure', msg: '🏺 Trésor caché (+5 or)', gain: { gold: 5 } },
];
// Base chance that a detected marker actually triggers an event on launch.
// Future modifiers can scale this up/down per side.
const EXP_EVENT_TRIGGER_CHANCE = 0.7;
// Distance (in cells) for a map cell to count as "near the route".
const EXP_MARKER_RANGE = 3;

// ═══════════════════════════════════════════════════════════════
// RNG (deterministic by seed)
// ═══════════════════════════════════════════════════════════════

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(Math.floor(Math.random() * 1e9));

function rInt(min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function rPick(arr) { return arr[Math.floor(rng() * arr.length)]; }

// ═══════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════

const state = {
  resources: { wheat: 10, water: 8, gold: 5, wood: 8, stone: 5 },
  // Population = anonymous inhabitants only (Le Peuple). Specials in
  // Conseil/Cour are tracked separately and do not count here.
  population: 4,
  soldiers: 0,
  generals: 0,
  kingAge: 25,
  kingStress: 15,
  kingAlive: true,
  monthsAt: 0,         // absolute months since start (year 1 = months 0-11)
  map: [],
  roads: new Set(),    // 'x,y' strings — decorative path tiles
  buildings: [],       // {id, x, y}
  expedition: null,    // active expedition {cells, sendPop, fighters, routePath, ...}
  selection: null,     // {x1,y1,x2,y2} being drawn
  commitedSelection: null,
  dragging: false,
  journal: [],         // recent entries
  placingBuilding: null,
  festivalUsedYear: -1,
  // for stats
  expsCompleted: 0,
  unitsLost: 0,
  // UI
  mouseMode: 'default',   // 'default' = L:pan/R:select  ·  'swapped' = L:select/R:pan
  panelOpen: false,       // true when expedition panel in sidebar
  settings: {
    deselectOutside: true,  // single click outside committed zone deselects it
    showGrid: true,
    zoomFollowsCursor: true, // if false, wheel zoom anchors to viewport center
    wheelChangesPop: true,   // wheel/Shift+wheel adjusts civils/fighters in expedition panel
  },
  costRules: loadCostRules(),
  // Cour Royale — see section "COUR ROYALE" near the end of file
  court: {
    conseilCols: 3,
    conseilRows: 3,
    conseil: [null, null, null, null, null, null, null, null, null],
    courSize: 3,
    cour: [null, null, null],
    // Post-expédition bench. Units sit here in the report screen; user drags
    // them onto conseil/cour slots (or leaves them → refused at close).
    offer: [],
    collapsed: false,
    nextUid: 1,
    starterGranted: false,
    pity: {},            // [v2 legacy — unused in encounter system]
    refusedUnits: {},    // [v2 legacy — unused in encounter system]
    offerOpen: false,    // true while the expedition report screen is up
    pendingCeremony: false,
  },
};

function normalizeCostRule(r) {
  return {
    id: r.id,
    resource: r.resource,
    amount: Number.isFinite(r.amount) ? r.amount : 0,
    factor: r.factor,
    perMonth: !!r.perMonth,
    penaltyType: PENALTY_TYPES.some(p => p.key === r.penaltyType) ? r.penaltyType : 'none',
    penaltyAmount: Number.isFinite(r.penaltyAmount) ? r.penaltyAmount : 0,
    penaltySub: COST_SUBSTITUTE_RESOURCES.includes(r.penaltySub) ? r.penaltySub : 'gold',
  };
}

function loadCostRules() {
  try {
    const raw = localStorage.getItem(COST_RULES_STORAGE_KEY);
    if (!raw) return DEFAULT_COST_RULES.map(r => ({ ...r }));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_COST_RULES.map(r => ({ ...r }));
    return parsed
      .filter(r => r && COST_RESOURCES.includes(r.resource) && COST_FACTORS.some(f => f.key === r.factor))
      .map(normalizeCostRule);
  } catch (_) {
    return DEFAULT_COST_RULES.map(r => ({ ...r }));
  }
}

function saveCostRules() {
  try {
    localStorage.setItem(COST_RULES_STORAGE_KEY, JSON.stringify(state.costRules));
  } catch (_) { /* storage full or unavailable, ignore */ }
}

// PAN state (not in serializable state)
let pan = null; // { startX, startY, sl, st }

function currentYear() { return Math.floor(state.monthsAt / 12) + 1; }
function currentMonth() { return (state.monthsAt % 12) + 1; }
function currentSeasonIdx() { return Math.floor((state.monthsAt % 12) / 3); }
function isCastle(x, y) { return x >= CASTLE.x && x < CASTLE.x + 3 && y >= CASTLE.y && y < CASTLE.y + 3; }

// ═══════════════════════════════════════════════════════════════
// MAP GEN
// ═══════════════════════════════════════════════════════════════

// Biome kinds. Each quadrant around the castle is assigned one (random rotation per game).
const BIOMES = {
  plains:   { weights: { wheat: 5, forest: 1, water: 0.5, quarry: 0.2, gold: 0.1, mountain: 0 } },
  forest:   { weights: { wheat: 1, forest: 6, water: 0.6, quarry: 0.3, gold: 0.2, mountain: 0.3 } },
  mountain: { weights: { wheat: 0.2, forest: 0.6, water: 0.2, quarry: 4, gold: 1.2, mountain: 2 } },
  lake:     { weights: { wheat: 1.5, forest: 1.2, water: 5, quarry: 0.2, gold: 0.1, mountain: 0.1 } },
};
const BIOME_TYPES_TO_CASE = {
  wheat: CASE.WHEAT, forest: CASE.FOREST, water: CASE.WATER,
  quarry: CASE.QUARRY, gold: CASE.GOLD, mountain: CASE.MOUNTAIN,
};

function distFromCastle(x, y) {
  return Math.sqrt((x - CASTLE_CENTER.x) ** 2 + (y - CASTLE_CENTER.y) ** 2);
}

// For each cell, pick the quadrant biome based on angle from castle center,
// with a noisy border so biomes don't follow perfect 90° lines.
function buildBiomeMap(rotationOffset) {
  const order = ['plains', 'forest', 'mountain', 'lake'];
  // Random shuffle so each game assigns biomes to quadrants differently
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Cheap low-frequency noise from a few sinusoids
  const sA = rng() * 100, sB = rng() * 100, sC = rng() * 100;
  const noiseAt = (x, y) => (
    Math.sin((x + sA) * 0.08) +
    Math.sin((y + sB) * 0.09) +
    Math.sin((x + y + sC) * 0.06)
  ) * 0.4; // ~[-1.2, 1.2] radians worth of wobble

  const grid = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    const row = [];
    for (let x = 0; x < MAP_SIZE; x++) {
      const ang = Math.atan2(y - CASTLE_CENTER.y, x - CASTLE_CENTER.x) + rotationOffset + noiseAt(x, y);
      // Normalize to [0, 2pi)
      const a = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const quad = Math.floor(a / (Math.PI / 2)); // 0..3
      row.push(order[quad]);
    }
    grid.push(row);
  }
  return grid;
}

function generateMap() {
  const map = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    const row = [];
    for (let x = 0; x < MAP_SIZE; x++) {
      if (isCastle(x, y)) row.push({ x, y, type: CASE.CASTLE });
      else row.push({ x, y, type: CASE.GRASS, harvested: 0, cooldown: 0, biome: 'plains' });
    }
    map.push(row);
  }

  // 1. Biome layout: quadrant-based, random rotation per game
  const rotation = rng() * Math.PI * 2;
  const biomeGrid = buildBiomeMap(rotation);
  for (let y = 0; y < MAP_SIZE; y++)
    for (let x = 0; x < MAP_SIZE; x++)
      map[y][x].biome = biomeGrid[y][x];

  // 2. Rivers — 1-2 serpents crossing the map. Each river seeds a long water line
  //    and optionally a few wetlands around it.
  const riverCount = rInt(1, 2);
  for (let i = 0; i < riverCount; i++) {
    carveRiver(map);
  }

  // 3. Scattered small lakes in non-lake biomes
  for (let i = 0; i < 6; i++) {
    for (let a = 0; a < 40; a++) {
      const sx = rInt(4, MAP_SIZE - 5);
      const sy = rInt(4, MAP_SIZE - 5);
      if (isCastle(sx, sy)) continue;
      if (map[sy][sx].type !== CASE.GRASS) continue;
      if (distFromCastle(sx, sy) < 10) continue;
      growBlob(map, sx, sy, rInt(4, 10), CASE.WATER, 0.72);
      break;
    }
  }

  // 4. Resource clusters — placed per-biome. Size scales with distance:
  //    near castle = tiny patches (2-4), far edges = big fields/forests.
  //    Lake biome gets its water quota filled via the lake body + rivers; we still
  //    drop small wheat/forest pockets around the water's edge for realism.

  // Distance-driven size: near=small, far=large, quadratic curve.
  const sizeFor = (d, baseMin, baseMax, farBonus) => {
    const t = Math.min(1, d / (MAP_SIZE * 0.5));
    const bonus = Math.round(farBonus * t * t);
    return rInt(baseMin, baseMax + bonus);
  };

  // For each resource kind, derive a size profile + how many clusters we want in total.
  // Then we use biome weights to decide where each cluster lands.
  const resourceProfiles = [
    { res: 'wheat',    baseMin: 2, baseMax: 4, farBonus: 9,  branch: 0.72, count: 110 },
    { res: 'forest',   baseMin: 2, baseMax: 4, farBonus: 11, branch: 0.75, count: 130 },
    { res: 'quarry',   baseMin: 2, baseMax: 4, farBonus: 5,  branch: 0.55, count: 55 },
    { res: 'water',    baseMin: 2, baseMax: 4, farBonus: 4,  branch: 0.70, count: 35 },
    { res: 'gold',     baseMin: 1, baseMax: 2, farBonus: 2,  branch: 0.45, count: 28 },
    { res: 'mountain', baseMin: 3, baseMax: 5, farBonus: 6,  branch: 0.72, count: 30 },
  ];

  for (const profile of resourceProfiles) {
    for (let i = 0; i < profile.count; i++) {
      for (let attempt = 0; attempt < 70; attempt++) {
        const sx = rInt(1, MAP_SIZE - 2);
        const sy = rInt(1, MAP_SIZE - 2);
        if (isCastle(sx, sy)) continue;
        if (map[sy][sx].type !== CASE.GRASS) continue;
        const d = distFromCastle(sx, sy);
        if (d < 4) continue; // reserve innermost area for safe zone
        const biome = map[sy][sx].biome;
        const weight = BIOMES[biome].weights[profile.res] || 0;
        if (weight <= 0) continue;
        // Accept probability proportional to biome weight.
        // Base 0.25 + biome-weighted push ensures off-biome resources still exist sparsely.
        const acceptProb = Math.min(0.98, 0.15 + weight * 0.18);
        if (rng() > acceptProb) continue;
        const size = sizeFor(d, profile.baseMin, profile.baseMax, profile.farBonus);
        growBlob(map, sx, sy, size, BIOME_TYPES_TO_CASE[profile.res], profile.branch);
        break;
      }
    }
  }

  // 5. Safe zone around castle (radius 8). Override with small mixed clusters of
  //    wheat / water / forest so the player has something to gather immediately.
  seedSafeZone(map);

  // 6. Monsters + ruins + hamlets (single tiles, far from castle).
  // Hamlets are the main civilian-encounter source; they sit closer than ruins
  // so the player meets them on regular trips.
  const pointDefs = [
    { type: CASE.MONSTER, count: 48, minDist: 14 },
    { type: CASE.RUINS,   count: 22, minDist: 18 },
    { type: CASE.HAMLET,  count: 28, minDist: 10 },
  ];
  for (const def of pointDefs) {
    for (let i = 0; i < def.count; i++) {
      for (let a = 0; a < 60; a++) {
        const sx = rInt(0, MAP_SIZE - 1);
        const sy = rInt(0, MAP_SIZE - 1);
        if (isCastle(sx, sy)) continue;
        if (map[sy][sx].type !== CASE.GRASS) continue;
        if (distFromCastle(sx, sy) < def.minDist) continue;
        map[sy][sx].type = def.type;
        break;
      }
    }
  }

  // 7. Decorative paths from castle to a few distant points — render-layer only.
  state.roads = generatePaths(map);

  return map;
}

// Seed the castle surroundings with small mixed clusters so early game is gatherable.
function seedSafeZone(map) {
  const mixes = [
    { type: CASE.WHEAT,  count: 3, size: [2, 3] },
    { type: CASE.WATER,  count: 2, size: [2, 2] },
    { type: CASE.FOREST, count: 3, size: [2, 3] },
  ];
  for (const m of mixes) {
    for (let i = 0; i < m.count; i++) {
      for (let a = 0; a < 40; a++) {
        const ang = rng() * Math.PI * 2;
        const r = 3 + rng() * 5;
        const sx = Math.round(CASTLE_CENTER.x + Math.cos(ang) * r);
        const sy = Math.round(CASTLE_CENTER.y + Math.sin(ang) * r);
        if (sx < 1 || sx >= MAP_SIZE - 1 || sy < 1 || sy >= MAP_SIZE - 1) continue;
        if (isCastle(sx, sy)) continue;
        if (map[sy][sx].type !== CASE.GRASS) continue;
        growBlob(map, sx, sy, rInt(m.size[0], m.size[1]), m.type, 0.6);
        break;
      }
    }
  }
}

// Trace a serpentine river across the map. Picks two opposite-ish edge points and
// walks between them with heading noise. Writes water tiles of width 1 (with
// occasional bulges to width 2).
function carveRiver(map) {
  // Pick a source edge and a target edge (not the same, prefer opposite sides)
  const edges = ['top', 'bottom', 'left', 'right'];
  const srcEdge = edges[Math.floor(rng() * 4)];
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[srcEdge];
  const tgtEdge = rng() < 0.8 ? opposite : edges.filter(e => e !== srcEdge)[Math.floor(rng() * 3)];

  const pointOn = (edge) => {
    const t = 0.15 + rng() * 0.7; // avoid corners
    const k = Math.round(t * (MAP_SIZE - 1));
    if (edge === 'top')    return { x: k, y: 0 };
    if (edge === 'bottom') return { x: k, y: MAP_SIZE - 1 };
    if (edge === 'left')   return { x: 0, y: k };
    return { x: MAP_SIZE - 1, y: k };
  };
  const src = pointOn(srcEdge);
  const tgt = pointOn(tgtEdge);

  let x = src.x, y = src.y;
  // Heading in radians, initialized roughly toward target
  let heading = Math.atan2(tgt.y - src.y, tgt.x - src.x);
  const maxSteps = MAP_SIZE * 3;
  for (let step = 0; step < maxSteps; step++) {
    // Drift heading slightly toward target, with noise
    const want = Math.atan2(tgt.y - y, tgt.x - x);
    let diff = ((want - heading + Math.PI) % (Math.PI * 2)) - Math.PI;
    heading += diff * 0.06 + (rng() - 0.5) * 0.5;

    x += Math.cos(heading);
    y += Math.sin(heading);
    const ix = Math.round(x), iy = Math.round(y);
    if (ix < 0 || ix >= MAP_SIZE || iy < 0 || iy >= MAP_SIZE) break;
    if (isCastle(ix, iy)) {
      // deflect around castle
      heading += Math.PI / 2 * (rng() < 0.5 ? 1 : -1);
      continue;
    }
    if (map[iy][ix].type === CASE.GRASS) map[iy][ix].type = CASE.WATER;
    // Occasional bulge
    if (rng() < 0.25) {
      const bx = ix + (rng() < 0.5 ? -1 : 1);
      const by = iy + (rng() < 0.5 ? -1 : 1);
      if (bx >= 0 && bx < MAP_SIZE && by >= 0 && by < MAP_SIZE
          && !isCastle(bx, by) && map[by][bx].type === CASE.GRASS) {
        map[by][bx].type = CASE.WATER;
      }
    }

    // Stop when we're close enough to the target edge
    if (
      (tgtEdge === 'top' && iy <= 1) ||
      (tgtEdge === 'bottom' && iy >= MAP_SIZE - 2) ||
      (tgtEdge === 'left' && ix <= 1) ||
      (tgtEdge === 'right' && ix >= MAP_SIZE - 2)
    ) break;
  }
}

// Decorative paths — from castle outward to a handful of distant points.
// Returns a Set of 'x,y' strings. Paths avoid water and mountain tiles visually
// (they route "around" them by skipping those tiles — slight gap, no gameplay effect).
function generatePaths(map) {
  const roads = new Set();
  const pathCount = rInt(3, 4);
  for (let i = 0; i < pathCount; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = 22 + rng() * (MAP_SIZE * 0.35);
    const tx = Math.round(CASTLE_CENTER.x + Math.cos(ang) * dist);
    const ty = Math.round(CASTLE_CENTER.y + Math.sin(ang) * dist);
    if (tx < 2 || tx >= MAP_SIZE - 2 || ty < 2 || ty >= MAP_SIZE - 2) continue;
    // Noisy straight line from castle edge to target
    let x = CASTLE_CENTER.x, y = CASTLE_CENTER.y;
    let heading = Math.atan2(ty - y, tx - x);
    const steps = Math.round(Math.hypot(tx - x, ty - y));
    for (let s = 0; s < steps * 1.2; s++) {
      const want = Math.atan2(ty - y, tx - x);
      let diff = ((want - heading + Math.PI) % (Math.PI * 2)) - Math.PI;
      heading += diff * 0.2 + (rng() - 0.5) * 0.35;
      x += Math.cos(heading);
      y += Math.sin(heading);
      const ix = Math.round(x), iy = Math.round(y);
      if (ix < 0 || ix >= MAP_SIZE || iy < 0 || iy >= MAP_SIZE) break;
      if (isCastle(ix, iy)) continue;
      const t = map[iy][ix].type;
      if (t === CASE.WATER || t === CASE.MOUNTAIN) continue; // route skips these
      roads.add(ix + ',' + iy);
      if (ix === tx && iy === ty) break;
    }
  }
  return roads;
}

function growBlob(map, sx, sy, targetSize, type, branchProb) {
  const frontier = [{ x: sx, y: sy }];
  const placed = new Set();
  while (placed.size < targetSize && frontier.length) {
    // Prefer earlier cells (BFS-ish) with slight randomness for organic shape
    const idx = rng() < 0.7 ? 0 : Math.floor(rng() * frontier.length);
    const { x, y } = frontier.splice(idx, 1)[0];
    const key = x + ',' + y;
    if (placed.has(key)) continue;
    if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) continue;
    if (isCastle(x, y)) continue;
    if (map[y][x].type !== CASE.GRASS) continue;
    map[y][x].type = type;
    placed.add(key);
    const neighbors = [[x+1, y], [x-1, y], [x, y+1], [x, y-1]];
    // shuffle
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }
    for (const [nx, ny] of neighbors) {
      if (rng() < branchProb) frontier.push({ x: nx, y: ny });
    }
  }
}

function cellAt(x, y) {
  if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return null;
  return state.map[y][x];
}

// ═══════════════════════════════════════════════════════════════
// DOM REFS
// ═══════════════════════════════════════════════════════════════

const $ = (id) => document.getElementById(id);
const elApp = $('app');
const elResGroup = $('res-group');
const elMapScroller = $('map-scroller');
const elMapCanvas = $('map-canvas');
const elMapGrid = $('map-grid');
const elMapLayers = $('map-layers');
const elSelLayer = $('selection-layer');
const elFxLayer = $('fx-layer');
const elFlightLayer = $('flight-layer');
const elToastWrap = $('toast-wrap');
const elCeremony = $('ceremony-backdrop');
const elGameOver = $('gameover-backdrop');
const elSbTop = $('sb-top');
const elSbMiddle = $('sb-middle');
const elSbExp = $('sb-exp');
const elMinimap = $('minimap');
const elMinimapVp = $('minimap-viewport');
const elMinimapWrap = $('minimap-wrap');
const elZoneInfo = $('zone-info');
const elSbTopTitle = $('sb-top-title');
const elSbTopSub = $('sb-top-sub');
const elSettingsBtn = $('settings-btn');
const elSettingsMenu = $('settings-menu');
const elDebugBtn = $('debug-btn');
const elDebugPanel = $('debug-panel');
const elDebugRows = $('debug-rows');
const elDebugAdd = $('debug-add');
const elDebugReset = $('debug-reset');
const elDebugClose = $('debug-close');
const elOptDeselect = $('opt-deselect-outside');
const elOptMouseSwap = $('opt-mouse-swap');
const elOptShowGrid = $('opt-show-grid');
const elOptZoomCursor = $('opt-zoom-cursor');
const elOptWheelPop = $('opt-wheel-pop');
const elMapHint = $('map-hint');
const elBuildHead = $('build-head');
const elBuildHeadGrip = $('build-head-grip');

// ═══════════════════════════════════════════════════════════════
// RENDER: TOP BAR
// ═══════════════════════════════════════════════════════════════

function renderTopBar() {
  if (elResGroup.childElementCount === 0) {
    // first render
    for (const key of RES_ORDER) {
      const meta = RES[key];
      const slot = document.createElement('div');
      slot.className = 'res-slot';
      slot.id = `res-${key}`;
      slot.title = meta.label;
      slot.innerHTML = `
        <img class="res-icon" src="${meta.icon}" alt="${meta.label}">
        <div class="res-value-wrap">
          <span class="res-value" id="res-val-${key}">0</span>
          <span class="res-delta" id="res-delta-${key}"></span>
        </div>`;
      elResGroup.appendChild(slot);
    }
  }
  for (const key of RES_ORDER) {
    $(`res-val-${key}`).textContent = state.resources[key];
    const d = monthlyDelta(key);
    const el = $(`res-delta-${key}`);
    el.textContent = d === 0 ? '±0/mois' : (d > 0 ? `+${d}/mois` : `${d}/mois`);
    el.style.color = d > 0 ? 'var(--green-deep)' : d < 0 ? 'var(--red-deep)' : 'var(--ink-3)';
  }
  // population — unified counter "total / cap" including specials in Conseil/Cour
  $('pop-total-value').textContent = kingdomPopTotal();
  $('pop-total-cap').textContent = `/ ${kingdomPopCap()}`;
  // king
  const ks = kingStateEntry();
  const slot = $('king-slot');
  slot.className = `king-slot ${ks.cssClass}`;
  $('king-state').textContent = ks.label;
  $('king-age').textContent = `${state.kingAge} ans`;
  // portrait
  const crownSym = state.kingStress < 20 ? '👑' : state.kingStress < 50 ? '😐' : state.kingStress < 80 ? '😰' : '💀';
  $('king-crown').textContent = crownSym;
}

function kingStateEntry() {
  for (const e of KING_STATES) if (state.kingStress <= e.max) return e;
  return KING_STATES[KING_STATES.length - 1];
}

function monthlyDelta(key) {
  let d = 0;
  for (const b of state.buildings) {
    const def = BUILDINGS.find(x => x.id === b.id);
    if (def && def.prod[key]) d += def.prod[key];
  }
  return d;
}

// ── Population slot caps (Le Peuple) ──────────────────────────────
// Anonymous civilian/soldier housing only — special units self-house in
// Conseil/Cour grids and don't consume these slots.
function civSlotsCap() {
  let n = CASTLE_CIV_SLOTS;
  for (const b of state.buildings) {
    const def = BUILDINGS.find(x => x.id === b.id);
    if (def && def.civSlots) n += def.civSlots;
  }
  const eff = (typeof courtEffects === 'function') ? courtEffects() : null;
  if (eff && eff.civSlotsBonus) n += eff.civSlotsBonus;
  return n;
}
function solSlotsCap() {
  let n = CASTLE_SOL_SLOTS;
  for (const b of state.buildings) {
    const def = BUILDINGS.find(x => x.id === b.id);
    if (def && def.solSlots) n += def.solSlots;
  }
  const eff = (typeof courtEffects === 'function') ? courtEffects() : null;
  if (eff && eff.solSlotsBonus) n += eff.solSlotsBonus;
  return n;
}
// Anonymous-only counts (civilians/soldiers in Le Peuple).
function civCount() { return state.population - state.soldiers - state.generals; }
function solCount() { return state.soldiers + state.generals; }
function civSlotsFree() { return Math.max(0, civSlotsCap() - civCount()); }
function solSlotsFree() { return Math.max(0, solSlotsCap() - solCount()); }

// v4: Conseil/Cour are decoupled from population — they have their own slots
// in the right sidebar. The kingdom population only tracks Le Peuple
// (anonymous civilians + soldiers).
function kingdomCivTotal() { return civCount(); }
function kingdomSolTotal() { return solCount(); }
function kingdomPopTotal() { return kingdomCivTotal() + kingdomSolTotal(); }
function kingdomPopCap() { return civSlotsCap() + solSlotsCap(); }

// ═══════════════════════════════════════════════════════════════
// RENDER: MAP
// ═══════════════════════════════════════════════════════════════

function renderMap() {
  const W = MAP_SIZE * TILE, H = MAP_SIZE * TILE;
  elMapGrid.style.width = W + 'px';
  elMapGrid.style.height = H + 'px';
  elMapGrid.style.backgroundSize = `${TILE}px ${TILE}px`;
  applyZoom();

  elMapLayers.innerHTML = '';

  // Biome tint + paths drawn onto a single low-res canvas (1px per tile, scaled up).
  // Way cheaper than 10k divs.
  const biomeCanvas = document.createElement('canvas');
  biomeCanvas.className = 'biome-canvas';
  biomeCanvas.width = MAP_SIZE;
  biomeCanvas.height = MAP_SIZE;
  biomeCanvas.style.width = (MAP_SIZE * TILE) + 'px';
  biomeCanvas.style.height = (MAP_SIZE * TILE) + 'px';
  const bctx = biomeCanvas.getContext('2d');
  const BIOME_COLORS = {
    plains:   'rgba(172,198,120,0.35)',
    forest:   'rgba(86,135,85,0.38)',
    mountain: 'rgba(165,150,130,0.38)',
    lake:     'rgba(120,175,205,0.35)',
  };
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const c = state.map[y][x];
      if (!c.biome) continue;
      bctx.fillStyle = BIOME_COLORS[c.biome] || 'transparent';
      bctx.fillRect(x, y, 1, 1);
    }
  }
  // Paths on top of biome tint
  if (state.roads) {
    bctx.fillStyle = 'rgba(139,106,66,0.75)';
    for (const key of state.roads) {
      const [rx, ry] = key.split(',').map(Number);
      bctx.fillRect(rx, ry, 1, 1);
    }
  }
  elMapLayers.appendChild(biomeCanvas);

  // Influence halo
  const halo = document.createElement('div');
  halo.className = 'influence-halo';
  const hPx = INFLUENCE_RADIUS * 2 * TILE;
  halo.style.left = (CASTLE_CENTER.x * TILE + TILE/2 - hPx/2) + 'px';
  halo.style.top = (CASTLE_CENTER.y * TILE + TILE/2 - hPx/2) + 'px';
  halo.style.width = hPx + 'px';
  halo.style.height = hPx + 'px';
  elMapLayers.appendChild(halo);

  // Cells
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const c = state.map[y][x];
      if (c.type === CASE.CASTLE) continue; // skip; castle sprite covers
      const info = CELL_INFO[c.type];
      if (!info || !info.glyph) continue;
      const el = document.createElement('div');
      el.className = 'cell selectable' + (c.harvested ? ' harvested' : '') + (c.type === CASE.CORRUPTED ? ' corrupt' : '');
      el.style.left = (x * TILE) + 'px';
      el.style.top = (y * TILE) + 'px';
      el.style.width = TILE + 'px';
      el.style.height = TILE + 'px';
      el.style.fontSize = '22px';
      el.textContent = c.glyphOverride || info.glyph;
      el.dataset.x = x; el.dataset.y = y;
      el.addEventListener('mouseenter', (e) => showCellTooltip(c, e));
      el.addEventListener('mouseleave', hideCellTooltip);
      elMapLayers.appendChild(el);
    }
  }

  // Castle sprite
  const castle = document.createElement('div');
  castle.className = 'castle-sprite';
  castle.style.left = (CASTLE.x * TILE) + 'px';
  castle.style.top = (CASTLE.y * TILE) + 'px';
  castle.style.width = (3 * TILE) + 'px';
  castle.style.height = (3 * TILE) + 'px';
  castle.innerHTML = castleSVG();
  elMapLayers.appendChild(castle);

  // Buildings
  for (const b of state.buildings) {
    const def = BUILDINGS.find(x => x.id === b.id);
    const el = document.createElement('div');
    el.className = 'building-sprite';
    el.style.left = (b.x * TILE + 3) + 'px';
    el.style.top = (b.y * TILE + 3) + 'px';
    el.style.width = (TILE - 6) + 'px';
    el.style.height = (TILE - 6) + 'px';
    el.textContent = def.glyph;
    el.title = def.name;
    elMapLayers.appendChild(el);
  }

  // Placing hint
  if (state.placingBuilding) {
    const def = BUILDINGS.find(b => b.id === state.placingBuilding);
    // highlight buildable cells
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (canPlaceBuilding(x, y)) {
          const el = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
          if (el) el.classList.add('buildable');
          else {
            // empty grass cell without sprite: create placeholder
            const ph = document.createElement('div');
            ph.className = 'cell buildable';
            ph.style.left = (x*TILE)+'px'; ph.style.top = (y*TILE)+'px';
            ph.style.width = TILE+'px'; ph.style.height = TILE+'px';
            ph.dataset.x = x; ph.dataset.y = y;
            elMapLayers.appendChild(ph);
          }
        }
      }
    }
  }
}

function castleSVG() {
  // pixel-art castle 3x3 tiles
  return `<svg width="100%" height="100%" viewBox="0 0 24 24" style="image-rendering:pixelated" shape-rendering="crispEdges">
    <rect x="3" y="14" width="18" height="8" fill="#8A7355"/>
    <rect x="3" y="14" width="18" height="1" fill="#6B5540"/>
    <rect x="2" y="8" width="4" height="14" fill="#A88A60"/>
    <rect x="10" y="6" width="4" height="16" fill="#A88A60"/>
    <rect x="18" y="8" width="4" height="14" fill="#A88A60"/>
    <rect x="2" y="7" width="1" height="1" fill="#A88A60"/><rect x="4" y="7" width="1" height="1" fill="#A88A60"/>
    <rect x="10" y="5" width="1" height="1" fill="#A88A60"/><rect x="12" y="5" width="1" height="1" fill="#A88A60"/>
    <rect x="18" y="7" width="1" height="1" fill="#A88A60"/><rect x="20" y="7" width="1" height="1" fill="#A88A60"/>
    <rect x="11" y="17" width="2" height="5" fill="#3E2A18"/>
    <rect x="3" y="11" width="2" height="2" fill="#3E2A18"/>
    <rect x="11" y="9" width="2" height="2" fill="#3E2A18"/>
    <rect x="19" y="11" width="2" height="2" fill="#3E2A18"/>
    <rect x="12" y="2" width="1" height="4" fill="#6B4423"/>
    <rect x="13" y="2" width="3" height="2" fill="#A82828"/>
  </svg>`;
}

// ═══════════════════════════════════════════════════════════════
// CELL TOOLTIP
// ═══════════════════════════════════════════════════════════════

let cellTip = null;
function showCellTooltip(c, evt) {
  hideCellTooltip();
  const info = CELL_INFO[c.type];
  if (!info) return;
  cellTip = document.createElement('div');
  cellTip.className = 'cell-tooltip';
  const sub = c.harvested ? `Récolté ${c.harvested}×` : (info.res ? `Récolte ${info.amount[0]}-${info.amount[1]}` : '');
  cellTip.innerHTML = `<div class="cell-tooltip-title">${info.glyph} ${info.name}</div>${sub ? `<div class="cell-tooltip-sub">${sub}</div>` : ''}`;
  cellTip.style.left = evt.clientX + 'px';
  cellTip.style.top = evt.clientY + 'px';
  document.body.appendChild(cellTip);
}
function hideCellTooltip() { if (cellTip) { cellTip.remove(); cellTip = null; } }

// ═══════════════════════════════════════════════════════════════
// SELECTION (drag on map)
// ═══════════════════════════════════════════════════════════════

// ── Zoom ──
let zoom = 1;
const ZOOM_MIN = 0.55, ZOOM_MAX = 1.6;

function applyZoom() {
  const mc = $('map-canvas');
  const size = MAP_SIZE * TILE * zoom;
  mc.style.width = size + 'px';
  mc.style.height = size + 'px';
  mc.style.transform = `scale(${zoom})`;
  mc.style.transformOrigin = '0 0';
  // Scale grid line thickness inversely so lines stay >= 1px on screen when zoomed out
  const lineW = Math.max(1, Math.ceil(1 / zoom));
  elMapGrid.style.backgroundImage =
    `linear-gradient(rgba(107,68,35,0.10) ${lineW}px, transparent ${lineW}px),` +
    `linear-gradient(90deg, rgba(107,68,35,0.10) ${lineW}px, transparent ${lineW}px)`;
  clampScroll();
  updateMinimapViewport();
}

function clampScroll() {
  const maxSL = Math.max(0, MAP_SIZE * TILE * zoom - elMapScroller.clientWidth);
  const maxST = Math.max(0, MAP_SIZE * TILE * zoom - elMapScroller.clientHeight);
  if (elMapScroller.scrollLeft > maxSL) elMapScroller.scrollLeft = maxSL;
  if (elMapScroller.scrollTop > maxST) elMapScroller.scrollTop = maxST;
}

function setZoom(newZoom, anchorX, anchorY) {
  newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
  if (Math.abs(newZoom - zoom) < 0.0001) return;
  const rect = elMapScroller.getBoundingClientRect();
  const ax = anchorX != null ? anchorX : rect.width / 2;
  const ay = anchorY != null ? anchorY : rect.height / 2;
  const wx = (elMapScroller.scrollLeft + ax) / zoom;
  const wy = (elMapScroller.scrollTop + ay) / zoom;
  zoom = newZoom;
  applyZoom();
  elMapScroller.scrollLeft = Math.max(0, wx * zoom - ax);
  elMapScroller.scrollTop = Math.max(0, wy * zoom - ay);
  clampScroll();
  updateMinimapViewport();
}

function cellFromEvent(e) {
  const rect = elMapScroller.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left + elMapScroller.scrollLeft) / (TILE * zoom));
  const y = Math.floor((e.clientY - rect.top + elMapScroller.scrollTop) / (TILE * zoom));
  return { x: Math.max(0, Math.min(MAP_SIZE - 1, x)), y: Math.max(0, Math.min(MAP_SIZE - 1, y)) };
}

function selectButton() { return state.mouseMode === 'swapped' ? 0 : 2; }
function panButton()    { return state.mouseMode === 'swapped' ? 2 : 0; }

function rectOverlapsCastle(r) {
  return r.x2 >= CASTLE.x && r.x1 <= CASTLE.x + 2 && r.y2 >= CASTLE.y && r.y1 <= CASTLE.y + 2;
}
function pointInRect(x, y, r) {
  return x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2;
}

let dragStart = null;
let pendingReselect = null; // { clientX, clientY, cell } — click outside committed sel, waiting to see if drag or click
const RESELECT_DRAG_PX = 5;

elMapScroller.addEventListener('contextmenu', (e) => e.preventDefault());

elMapScroller.addEventListener('mousedown', (e) => {
  // Building placement uses LEFT always
  if (state.placingBuilding) {
    if (e.button === 0) {
      const { x, y } = cellFromEvent(e);
      if (canPlaceBuilding(x, y)) commitBuildingPlacement(x, y);
    }
    return;
  }
  // Pan is always allowed
  if (e.button === panButton()) {
    pan = { startX: e.clientX, startY: e.clientY, sl: elMapScroller.scrollLeft, st: elMapScroller.scrollTop };
    elMapScroller.classList.add('panning');
    e.preventDefault();
    return;
  }

  // Select blocked during active expedition
  if (state.expedition) return;

  if (e.button === selectButton()) {
    e.preventDefault();
    const c = cellFromEvent(e);

    // If a committed selection exists, click outside defers: single click cancels
    // (if the setting allows), drag past threshold starts a new zone.
    if (state.commitedSelection) {
      if (!pointInRect(c.x, c.y, state.commitedSelection)) {
        pendingReselect = { clientX: e.clientX, clientY: e.clientY, cell: c };
      }
      return;
    }

    dragStart = c;
    state.selection = { x1: c.x, y1: c.y, x2: c.x, y2: c.y };
    state.dragging = true;
    elMapScroller.classList.add('selecting');
    renderSelection();
    renderZoneInfo();
  }
});

window.addEventListener('mousemove', (e) => {
  if (pan) {
    const dx = e.clientX - pan.startX;
    const dy = e.clientY - pan.startY;
    elMapScroller.scrollLeft = pan.sl - dx;
    elMapScroller.scrollTop = pan.st - dy;
    clampScroll();
    updateMinimapViewport();
    return;
  }
  if (pendingReselect) {
    const dx = e.clientX - pendingReselect.clientX;
    const dy = e.clientY - pendingReselect.clientY;
    if (Math.hypot(dx, dy) >= RESELECT_DRAG_PX) {
      // Promote to a new selection drag: drop the old committed zone.
      const start = pendingReselect.cell;
      pendingReselect = null;
      closeExpeditionPanel();
      dragStart = start;
      state.selection = { x1: start.x, y1: start.y, x2: start.x, y2: start.y };
      state.dragging = true;
      elMapScroller.classList.add('selecting');
      renderSelection();
      renderZoneInfo();
    }
    return;
  }
  if (state.dragging && dragStart) {
    const c = cellFromEvent(e);
    state.selection.x2 = c.x; state.selection.y2 = c.y;
    renderSelection();
    renderZoneInfo();
  }
});

window.addEventListener('mouseup', (e) => {
  if (pan) {
    pan = null;
    elMapScroller.classList.remove('panning');
    return;
  }
  if (pendingReselect) {
    // Click outside committed zone without drag: deselect only if setting allows.
    pendingReselect = null;
    if (state.settings.deselectOutside) closeExpeditionPanel();
    return;
  }
  if (!state.dragging) return;
  state.dragging = false;
  elMapScroller.classList.remove('selecting');

  const sel = state.selection;
  if (!sel) return;
  const minX = Math.min(sel.x1, sel.x2), maxX = Math.max(sel.x1, sel.x2);
  const minY = Math.min(sel.y1, sel.y2), maxY = Math.max(sel.y1, sel.y2);
  const rect = { x1: minX, y1: minY, x2: maxX, y2: maxY };

  if (rectOverlapsCastle(rect)) {
    state.selection = null; renderSelection(); renderZoneInfo();
    toast('bad', 'Zone invalide', 'La sélection chevauche le château.');
    return;
  }

  state.commitedSelection = rect;
  state.selection = null;
  renderSelection();
  renderZoneInfo();
  openExpeditionPanel();
});

// Block default middle-click, avoid selection outside map when clicking sidebar
elMapScroller.addEventListener('dragstart', (e) => e.preventDefault());

function renderSelection() {
  elSelLayer.innerHTML = '';
  const expMode = !state.selection && !state.commitedSelection && state.expedition && state.expedition.sel;
  const sel = state.selection || state.commitedSelection || (expMode ? state.expedition.sel : null);
  if (!sel) return;
  const minX = Math.min(sel.x1, sel.x2), maxX = Math.max(sel.x1, sel.x2);
  const minY = Math.min(sel.y1, sel.y2), maxY = Math.max(sel.y1, sel.y2);
  const left = minX * TILE, top = minY * TILE;
  const w = (maxX - minX + 1) * TILE, h = (maxY - minY + 1) * TILE;
  const mapW = MAP_SIZE * TILE, mapH = MAP_SIZE * TILE;

  // Darken overlay — 4 rects around selection (only when actively selecting, not during expedition)
  if (!expMode) {
    const dim = (x, y, ww, hh) => {
      if (ww <= 0 || hh <= 0) return;
      const d = document.createElement('div');
      d.className = 'sel-dim-overlay';
      d.style.left = x + 'px'; d.style.top = y + 'px';
      d.style.width = ww + 'px'; d.style.height = hh + 'px';
      elSelLayer.appendChild(d);
    };
    dim(0, 0, mapW, top);
    dim(0, top + h, mapW, mapH - (top + h));
    dim(0, top, left, h);
    dim(left + w, top, mapW - (left + w), h);
  }

  // Selection rect
  const r = document.createElement('div');
  r.className = 'selection-rect' + (state.selection ? ' live' : '') + (expMode ? ' active' : '');
  r.style.left = left + 'px';
  r.style.top = top + 'px';
  r.style.width = w + 'px';
  r.style.height = h + 'px';

  // Label (hide during expedition)
  if (!expMode) {
    const lab = document.createElement('div');
    lab.className = 'sel-dim ' + (minY <= 0 ? 'bottom' : 'top');
    lab.textContent = `${maxX-minX+1} × ${maxY-minY+1} cases`;
    r.appendChild(lab);
  }
  elSelLayer.appendChild(r);

  // Organic route preview from castle to zone center, plus proximity markers.
  // Drawn for live drag, committed selection, and active expedition alike.
  renderRoutePreview(sel, !!expMode);

  // Handles only on committed selection (never during expedition)
  if (!state.commitedSelection) return;

  const cx = left + w / 2, cy = top + h / 2;
  const handles = [
    { cls: 'h-nw', x: left,     y: top,     dir: 'nw' },
    { cls: 'h-n',  x: cx,       y: top,     dir: 'n'  },
    { cls: 'h-ne', x: left + w, y: top,     dir: 'ne' },
    { cls: 'h-e',  x: left + w, y: cy,      dir: 'e'  },
    { cls: 'h-se', x: left + w, y: top + h, dir: 'se' },
    { cls: 'h-s',  x: cx,       y: top + h, dir: 's'  },
    { cls: 'h-sw', x: left,     y: top + h, dir: 'sw' },
    { cls: 'h-w',  x: left,     y: cy,      dir: 'w'  },
  ];
  for (const hdl of handles) {
    const d = document.createElement('div');
    d.className = 'sel-handle ' + hdl.cls;
    d.style.left = hdl.x + 'px';
    d.style.top = hdl.y + 'px';
    d.addEventListener('mousedown', (ev) => beginSelectionEdit(ev, 'resize-' + hdl.dir));
    elSelLayer.appendChild(d);
  }
  // Center move handle
  const mv = document.createElement('div');
  mv.className = 'sel-move';
  mv.style.left = cx + 'px';
  mv.style.top = cy + 'px';
  mv.textContent = '✥';
  mv.addEventListener('mousedown', (ev) => beginSelectionEdit(ev, 'move'));
  elSelLayer.appendChild(mv);

  // Per-cell civ/sol icons inside the zone are intentionally left out: the
  // expedition party is now auto-derived (no manual assignment), and a clean
  // zone reads better.
}

// Draw the curved (visual) route + ! markers in the selection layer.
// Visual curve and event-detection logic are intentionally decoupled:
//  - the curve is the Bezier from buildExpeditionRoute (cosmetic)
//  - the markers come from straight-line proximity (so the player can't
//    nudge the zone to dodge events by reshaping the curve).
// `active` is true once an expedition has launched. In active mode we render
// the clusters that were precomputed at launch time (skipping consumed ones).
function renderRoutePreview(sel, active) {
  const target = { x: (sel.x1 + sel.x2) / 2, y: (sel.y1 + sel.y2) / 2 };
  const route = buildExpeditionRoute(target);

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'exp-route' + (active ? ' active' : ''));
  svg.setAttribute('width', MAP_SIZE * TILE);
  svg.setAttribute('height', MAP_SIZE * TILE);
  const halo = document.createElementNS(NS, 'path');
  halo.setAttribute('d', route.d);
  halo.setAttribute('class', 'exp-route-halo');
  svg.appendChild(halo);
  const line = document.createElementNS(NS, 'path');
  line.setAttribute('d', route.d);
  line.setAttribute('class', 'exp-route-line');
  svg.appendChild(line);
  elSelLayer.appendChild(svg);

  // During active expedition, surviving markers live in state.expedition.clusters.
  // Otherwise we recompute them from the straight line for the planning preview.
  const clusters = active && state.expedition && state.expedition.clusters
    ? state.expedition.clusters.filter(c => !c.consumed)
    : expeditionMarkers(straightLineSamples(target), sel);

  for (const cl of clusters) {
    const m = document.createElement('div');
    m.className = 'exp-marker exp-marker-' + cl.kind;
    m.textContent = '!';
    m.style.left = ((cl.cx + 0.5) * TILE) + 'px';
    m.style.top  = ((cl.cy + 0.5) * TILE) + 'px';
    if (cl.id != null) m.dataset.clusterId = cl.id;
    elSelLayer.appendChild(m);
  }
}

// Kept as a no-op so any leftover call stays safe. The per-cell civ/sol icons
// inside the zone were removed when the party became auto-derived.
function renderExpAssignment() {
  elSelLayer.querySelectorAll('.exp-assign').forEach(n => n.remove());
}

// Populate the expedition panel's scene with little walking civilians and
// soldiers (one sprite per unit, capped). Reuses the peuple sprite styling
// for visual consistency.
const EXP_SCENE_MAX_SPRITES = 18;
function populateExpScene(civils, fighters) {
  const host = document.getElementById('exp-sprites');
  if (!host) return;
  host.innerHTML = '';
  const total = civils + fighters;
  if (total <= 0) return;
  const shown = Math.min(total, EXP_SCENE_MAX_SPRITES);
  const civShown = Math.round((civils / total) * shown);
  const solShown = shown - civShown;
  for (let i = 0; i < civShown; i++) host.appendChild(makePeupleSprite('civ', i, shown));
  for (let i = 0; i < solShown; i++) host.appendChild(makePeupleSprite('sol', civShown + i, shown));
}

// ═══════════════════════════════════════════════════════════════
// SELECTION EDIT (resize / move committed zone)
// ═══════════════════════════════════════════════════════════════

function beginSelectionEdit(ev, mode) {
  ev.preventDefault();
  ev.stopPropagation();
  if (!state.commitedSelection) return;
  const start = { ...state.commitedSelection };
  const startCell = cellFromEvent(ev);

  const onMove = (e) => {
    const c = cellFromEvent(e);
    const dx = c.x - startCell.x;
    const dy = c.y - startCell.y;
    let { x1, y1, x2, y2 } = start;

    if (mode === 'move') {
      const w = x2 - x1, h = y2 - y1;
      x1 = Math.max(0, Math.min(MAP_SIZE - 1 - w, x1 + dx));
      y1 = Math.max(0, Math.min(MAP_SIZE - 1 - h, y1 + dy));
      x2 = x1 + w; y2 = y1 + h;
    } else {
      const dir = mode.slice('resize-'.length);
      if (dir.includes('n')) y1 = Math.max(0, Math.min(y2, y1 + dy));
      if (dir.includes('s')) y2 = Math.max(y1, Math.min(MAP_SIZE - 1, y2 + dy));
      if (dir.includes('w')) x1 = Math.max(0, Math.min(x2, x1 + dx));
      if (dir.includes('e')) x2 = Math.max(x1, Math.min(MAP_SIZE - 1, x2 + dx));
    }

    const rect = { x1, y1, x2, y2 };
    if (rectOverlapsCastle(rect)) return; // reject, keep previous
    state.commitedSelection = rect;
    renderSelection();
    renderZoneInfo();
    refreshExpeditionPanel();
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// Re-render expedition panel when selection changes (distance, cells, costs)
function refreshExpeditionPanel() {
  if (!state.panelOpen || !state.commitedSelection) return;
  // Easiest: reopen
  openExpeditionPanel();
}

// ═══════════════════════════════════════════════════════════════
// EXPEDITION PANEL
// ═══════════════════════════════════════════════════════════════

function zoneCells(sel) {
  const cells = [];
  for (let y = sel.y1; y <= sel.y2; y++) {
    for (let x = sel.x1; x <= sel.x2; x++) {
      const c = cellAt(x, y);
      if (c && c.type !== CASE.CASTLE && c.type !== CASE.MOUNTAIN) cells.push(c);
    }
  }
  return cells;
}

function zoneCenter(sel) {
  return {
    x: (sel.x1 + sel.x2) / 2,
    y: (sel.y1 + sel.y2) / 2,
  };
}

function zoneDistance(sel) {
  const c = zoneCenter(sel);
  return Math.sqrt((c.x - CASTLE_CENTER.x) ** 2 + (c.y - CASTLE_CENTER.y) ** 2);
}

function expDurationMonths(dist) {
  let base;
  if (dist <= 3) base = 1;
  else if (dist <= 7) base = 2;
  else if (dist <= 12) base = 3;
  else base = 4;
  if (typeof courtEffects === 'function') {
    const eff = courtEffects();
    base = Math.max(1, base - (eff.expeditionDurationCut || 0));
  }
  return base;
}

function calcCosts(sendPop, fighters, durationMonths, dist) {
  const ctx = {
    flat: 1,
    population: sendPop,
    explorers: sendPop - fighters,
    fighters: fighters,
    distance: dist,
  };
  const raw = { wheat: 0, water: 0, gold: 0 };
  for (const rule of state.costRules) {
    if (!(rule.resource in raw)) continue;
    const factorValue = ctx[rule.factor] ?? 0;
    const monthMul = rule.perMonth ? durationMonths : 1;
    raw[rule.resource] += rule.amount * factorValue * monthMul;
  }
  const out = {
    wheat: Math.max(COST_MINIMUMS.wheat, Math.round(raw.wheat)),
    water: Math.max(COST_MINIMUMS.water, Math.round(raw.water)),
    gold:  Math.max(COST_MINIMUMS.gold,  Math.round(raw.gold)),
  };
  // Court effects: wheat-free workers + wheat-cost multiplier (Cuisinier, Maître Queux, Membre de Famille).
  if (typeof courtEffects === 'function') {
    const eff = courtEffects();
    out.wheat = Math.max(0, Math.round(out.wheat * eff.expeditionFoodCostMult) - eff.expeditionFreeWorkers);
  }
  return out;
}

// Compute penalties that trigger when aggregate resource cost exceeds stock.
// For each rule whose resource is insufficient, apply its penalty.
function calcPenalties(costs) {
  const penalties = {
    unitsLost: 0,
    stress: 0,
    substitutePay: {},  // { resourceKey: amount }
  };
  for (const rule of state.costRules) {
    if (!(rule.resource in costs)) continue;
    if (state.resources[rule.resource] >= costs[rule.resource]) continue;
    if (!rule.penaltyAmount || rule.penaltyType === 'none') continue;
    const amt = Math.max(0, Math.round(rule.penaltyAmount));
    if (rule.penaltyType === 'units') penalties.unitsLost += amt;
    else if (rule.penaltyType === 'stress') penalties.stress += amt;
    else if (rule.penaltyType === 'substitute') {
      penalties.substitutePay[rule.penaltySub] = (penalties.substitutePay[rule.penaltySub] || 0) + amt;
    }
  }
  return penalties;
}

let panelState = null; // { civils, fighters }  — derived sendPop = civils + fighters
let panelCtx = null;   // { sel, cells, dist, duration, cellsCount, maxFighters, civsAvail, monsterCells }

// Clamp panel state so civils + fighters ≤ cells, each within its avail pool.
function panelClamp() {
  if (!panelState || !panelCtx) return;
  panelState.fighters = Math.max(0, Math.min(panelCtx.maxFighters, panelState.fighters));
  panelState.civils   = Math.max(0, Math.min(panelCtx.civsAvail,   panelState.civils));
  if (panelState.civils + panelState.fighters > panelCtx.cellsCount) {
    panelState.civils = Math.max(0, panelCtx.cellsCount - panelState.fighters);
    if (panelState.civils + panelState.fighters > panelCtx.cellsCount) {
      panelState.fighters = Math.max(0, panelCtx.cellsCount - panelState.civils);
    }
  }
}

// Bump civils by delta, yielding to fighters when zone is full.
function panelBumpCivils(delta) {
  if (!panelState || !panelCtx) return;
  panelState.civils = Math.max(0, Math.min(panelCtx.civsAvail, panelState.civils + delta));
  if (panelState.civils + panelState.fighters > panelCtx.cellsCount) {
    panelState.fighters = Math.max(0, panelCtx.cellsCount - panelState.civils);
  }
}

// Bump fighters by delta, yielding civils when zone is full.
function panelBumpFighters(delta) {
  if (!panelState || !panelCtx) return;
  panelState.fighters = Math.max(0, Math.min(panelCtx.maxFighters, panelState.fighters + delta));
  if (panelState.civils + panelState.fighters > panelCtx.cellsCount) {
    panelState.civils = Math.max(0, panelCtx.cellsCount - panelState.fighters);
  }
}

function openExpeditionPanel() {
  const sel = state.commitedSelection;
  const cells = zoneCells(sel);
  const dist = zoneDistance(sel);
  const duration = expDurationMonths(dist);
  const maxFighters = state.soldiers + state.generals;
  const civsAvail = Math.max(0, state.population - maxFighters);
  const cellsCount = cells.length;
  // Threat count = red clusters detected on the planned trip (path + zone+1).
  // Damage is fully resolved at launch time: deficit = max(0, threats - soldiers
  // sent), split between soldiers and civilians in the party.
  const target = { x: (sel.x1 + sel.x2) / 2, y: (sel.y1 + sel.y2) / 2 };
  const threats = expeditionMarkers(straightLineSamples(target), sel)
    .filter(c => c.kind === 'red').length;
  const civilsToSend  = Math.min(cellsCount, civsAvail);
  const soldiersToSend = Math.min(threats, maxFighters);
  const deficit  = Math.max(0, threats - soldiersToSend);
  const solDeath = Math.min(soldiersToSend, Math.floor(deficit / 2));
  const civDeath = deficit - solDeath;
  panelCtx = { sel, cells, dist, duration, cellsCount, maxFighters, civsAvail,
               threats, soldiersToSend, civilsToSend, solDeath, civDeath };
  // panelState is now fully derived — no longer player-editable.
  panelState = { civils: civilsToSend, fighters: soldiersToSend };

  const renderPanel = () => {
    const sendPop = panelState.civils + panelState.fighters;
    const costs = calcCosts(sendPop, panelState.fighters, duration, dist);
    const penalties = calcPenalties(costs);
    const validUnits = sendPop >= 1 && sendPop <= state.population;
    const hasPenalty = penalties.unitsLost > 0 || penalties.stress > 0 || Object.keys(penalties.substitutePay).length > 0;
    const penaltyParts = [];
    if (penalties.unitsLost) penaltyParts.push(`-${penalties.unitsLost} unité${penalties.unitsLost > 1 ? 's' : ''}`);
    if (penalties.stress) penaltyParts.push(`+${penalties.stress} stress`);
    for (const [r, amt] of Object.entries(penalties.substitutePay)) {
      penaltyParts.push(`-${amt} ${RES[r].label.toLowerCase()}`);
    }

    elSbExp.innerHTML = `
      <div class="exp-modal">
        <div class="exp-header">
          <span class="exp-ornament">⚔️</span>
          <h2>Expédition</h2>
          <span class="exp-ornament">⚔️</span>
        </div>
        <div class="exp-summary">
          <div class="sum-item"><span class="sum-label">Zone</span><span class="sum-value">${sel.x2-sel.x1+1}×${sel.y2-sel.y1+1}<em> (${cells.length} c.)</em></span></div>
          <div class="sum-item"><span class="sum-label">Dist.</span><span class="sum-value">${dist.toFixed(1)}</span></div>
          <div class="sum-item"><span class="sum-label">Durée</span><span class="sum-value">${duration}<em> mois</em></span></div>
        </div>

        <div class="exp-section">
          <div class="sec-head">🚛 <strong>La caravane</strong></div>
          <div class="exp-scene" id="exp-scene">
            <div class="exp-sky"></div>
            <div class="exp-hills"></div>
            <div class="exp-wagon"></div>
            <div class="exp-sprites" id="exp-sprites"></div>
          </div>
          <div class="exp-counts">
            <div class="exp-count" title="Civils envoyés">
              <span class="ec-icon">👤</span>
              <span class="ec-text"><span class="ec-num">${panelState.civils}</span> civil${panelState.civils>1?'s':''}<span class="ec-cap"> / ${cellsCount} cases</span></span>
            </div>
            <div class="exp-count" title="Soldats envoyés">
              <span class="ec-icon">🛡️</span>
              <span class="ec-text"><span class="ec-num">${panelState.fighters}</span> soldat${panelState.fighters>1?'s':''}<span class="ec-cap"> / ${panelCtx.threats} menace${panelCtx.threats>1?'s':''}</span></span>
            </div>
          </div>
          <div class="exp-fixed">
            ${panelCtx.threats === 0 ? 'Aucune menace sur la route'
              : panelState.fighters >= panelCtx.threats
                ? `<span class="exp-good">Soldats suffisants — aucune perte attendue</span>`
                : `<span class="exp-warn">Manque ${panelCtx.threats - panelState.fighters} soldat${panelCtx.threats - panelState.fighters>1?'s':''}</span>`}
            ${panelState.civils < cellsCount
              ? ` · <span class="exp-warn">Pop. insuffisante (${panelState.civils}/${cellsCount})</span>` : ''}
          </div>
        </div>

        ${(panelCtx.solDeath + panelCtx.civDeath) > 0 ? `
        <div class="exp-section exp-losses-preview">
          <div class="sec-head">⚠ <strong>Pertes prévues</strong> — ${panelCtx.solDeath + panelCtx.civDeath}</div>
          <div class="exp-fixed">
            ${panelCtx.solDeath > 0 ? `<span class="exp-warn">🛡 −${panelCtx.solDeath} soldat${panelCtx.solDeath>1?'s':''}</span>` : ''}
            ${panelCtx.solDeath > 0 && panelCtx.civDeath > 0 ? ' · ' : ''}
            ${panelCtx.civDeath > 0 ? `<span class="exp-warn">💀 −${panelCtx.civDeath} civil${panelCtx.civDeath>1?'s':''}</span>` : ''}
          </div>
        </div>` : ''}

        <div class="exp-section">
          <div class="sec-head">💰 <strong>Coûts prévus</strong></div>
          <div class="cost-row" id="cost-row">
            ${Object.entries(costs).map(([k, v]) => {
              const ok = state.resources[k] >= v;
              return `<div class="cost-badge ${ok ? '' : 'insufficient'}" data-res="${k}"><img src="${RES[k].icon}"><div><div class="cost-val">-${v}</div><div class="cost-have">(${state.resources[k]})</div></div></div>`;
            }).join('')}
          </div>
          ${hasPenalty ? `<div class="exp-penalty">⚠ Pénalité si absent : ${penaltyParts.join(' · ')}</div>` : ''}
        </div>

        <div class="exp-actions">
          <button class="btn btn-ghost" id="btn-cancel">Annuler</button>
          <button class="btn btn-primary" id="btn-launch" ${validUnits ? '' : 'disabled'}>Lancer</button>
        </div>
      </div>`;
    elSbExp.hidden = false;
    elSbMiddle.hidden = true;
    state.panelOpen = true;
    wirePanel(duration, dist, cells, sel);
    courtHighlightDeployed(sendPop, panelState.fighters);
    renderExpAssignment();
    populateExpScene(panelState.civils, panelState.fighters);
  };

  const wirePanel = (duration, dist, cells, sel) => {
    $('btn-cancel').onclick = closeExpeditionPanel;
    $('btn-launch').onclick = () => {
      const sendPop = panelState.civils + panelState.fighters;
      const costs = calcCosts(sendPop, panelState.fighters, duration, dist);
      launchExpedition(sel, cells, sendPop, panelState.fighters, duration, costs);
    };
    // Civils & soldats are auto-derived from zone size & threat count, so
    // there are no jauges to wire up and the wheel must be a no-op.
    elSbExp.onwheel = null;
  };

  const wireJauge = (id, cb) => {
    const el = $(id); if (!el) return;
    const onMove = (ev) => {
      const cur = document.getElementById(id);
      if (!cur) return;
      const rect = cur.getBoundingClientRect();
      if (rect.width === 0) return;
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      cb(pct);
    };
    const onDown = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onMove(ev);
      const move = (e) => onMove(e);
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    };
    el.addEventListener('mousedown', onDown);
  };

  renderPanel();
}

function closeExpeditionPanel() {
  elSbExp.hidden = true;
  elSbExp.innerHTML = '';
  elSbMiddle.hidden = false;
  state.panelOpen = false;
  state.commitedSelection = null;
  renderSelection();
  renderExpAssignment();
  renderZoneInfo();
  courtClearDeployedHighlight();
}

// ═══════════════════════════════════════════════════════════════
// EXPEDITION LAUNCH + TICK
// ═══════════════════════════════════════════════════════════════

// When workers < cells, pick which cells get visited.
// Bias toward resource cells (60% weight) over non-resource (40%).
// Uses Efraimidis-Spirakis weighted reservoir sampling, then restores
// spatial order (reading order from zoneCells) so the caravan path stays sane.
const HARVEST_W_RESOURCE = 60;
const HARVEST_W_OTHER = 40;
function pickHarvestCells(cells, n) {
  if (n >= cells.length) return cells.slice();
  if (n <= 0) return [];
  const scored = cells.map((c, i) => {
    const info = CELL_INFO[c.type];
    const isRes = !!(info && info.res) || c.type === CASE.RUINS;
    const w = isRes ? HARVEST_W_RESOURCE : HARVEST_W_OTHER;
    return { c, i, key: Math.pow(rng(), 1 / w) };
  });
  scored.sort((a, b) => b.key - a.key);
  const picked = scored.slice(0, n);
  picked.sort((a, b) => a.i - b.i);
  return picked.map(s => s.c);
}


function launchExpedition(sel, cells, sendPop, fighters, duration, costs) {
  // Cinematic camera: zoom/pan to fit castle + target zone
  focusOnExpedition(sel);

  // Compute penalties based on current stock vs cost, then adjust payments.
  const penalties = calcPenalties(costs);
  const payNow = {};      // amount actually paid from each resource for the main cost
  const unpaid = {};      // cost that couldn't be paid (triggers penalty)
  for (const k of Object.keys(costs)) {
    if (state.resources[k] >= costs[k]) {
      payNow[k] = costs[k];
      unpaid[k] = 0;
    } else {
      payNow[k] = 0;     // penalty replaces payment entirely
      unpaid[k] = costs[k];
    }
  }
  // Merge substitute payments into the pay map.
  for (const [k, amt] of Object.entries(penalties.substitutePay)) {
    payNow[k] = (payNow[k] || 0) + amt;
  }

  // pay costs with flying animation (two-step, grouped gather below top bar)
  const costKeys = Object.keys(payNow).filter(k => payNow[k] > 0);
  costKeys.forEach((key, i) => {
    const due = Math.min(payNow[key], state.resources[key]);  // clamp so we never go negative
    state.resources[key] -= due;
    flyResource(key, -due, $('res-' + key), castleScreenPos(), i, costKeys.length);
    flashSlot(key, 'minus');
  });

  // Apply non-resource penalties.
  if (penalties.unitsLost > 0) {
    const lost = Math.min(penalties.unitsLost, sendPop);
    sendPop -= lost;
    state.unitsLost += lost;
    addJournal(`⚠ Manque de ressources : −${lost} unité${lost > 1 ? 's' : ''} avant le départ`, 'bad');
  }
  if (penalties.stress > 0) {
    state.kingStress = Math.min(100, state.kingStress + penalties.stress);
    addJournal(`⚠ Manque de ressources : +${penalties.stress} stress du roi`, 'bad');
  }
  const unpaidKeys = Object.keys(unpaid).filter(k => unpaid[k] > 0);
  if (unpaidKeys.length) {
    addJournal(`⚠ Non payé : ${unpaidKeys.map(k => `${unpaid[k]} ${RES[k].label.toLowerCase()}`).join(' · ')}`, 'warn');
  }

  renderTopBar();

  // build path (simple straight line from castle to zone center, then visit cells)
  const target = { x: Math.round((sel.x1 + sel.x2) / 2), y: Math.round((sel.y1 + sel.y2) / 2) };
  const outPath = linePath(CASTLE_CENTER, target);
  const visitList = pickHarvestCells(cells, sendPop).map(c => ({ x: c.x, y: c.y }));
  const returnPath = linePath(target, CASTLE_CENTER);

  // Detect markers along a STRAIGHT line from castle to zone center
  // (intentionally decoupled from the visual Bezier so the player cannot
  // dodge events by tweaking the zone to bend the curve).
  const targetExact = { x: (sel.x1 + sel.x2) / 2, y: (sel.y1 + sel.y2) / 2 };
  const clusters = expeditionMarkers(straightLineSamples(targetExact), sel);
  // Caravan animates along the visual Bezier curve; cluster fireT is the
  // parametric t∈[0,1] at which the curve passes closest to the cluster.
  const route = buildExpeditionRoute(targetExact);
  const sampN = route.samples.length;
  for (let i = 0; i < clusters.length; i++) {
    const cl = clusters[i];
    cl.id = i;
    cl.consumed = false;
    const cxp = (cl.cx + 0.5) * TILE, cyp = (cl.cy + 0.5) * TILE;
    let bestIdx = 0, bestD2 = Infinity;
    for (let j = 0; j < sampN; j++) {
      const s = route.samples[j];
      const dx = s.px - cxp, dy = s.py - cyp;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; bestIdx = j; }
    }
    cl.fireT = Math.max(0.01, bestIdx / Math.max(1, sampN - 1));
  }

  // Event policy (positive events temporarily off):
  //   All damage is resolved at launch from the threat count, NOT from per-
  //   cluster rolls. Deficit = max(0, threats - soldiersInParty), split into
  //   solDeath = floor(deficit/2) (capped by soldiers), civDeath = remainder.
  //   Red clusters are tagged in fireT order: first 'defended', then 'civ'
  //   losses, then 'sol' losses — purely visual.
  //   Green clusters keep their ! marker as a planning hint but do nothing.
  const redClusters = clusters.filter(c => c.kind === 'red')
    .slice().sort((a, b) => a.fireT - b.fireT);
  const threats = redClusters.length;
  const deficit = Math.max(0, threats - fighters);
  const preSolDeath = Math.min(fighters, Math.floor(deficit / 2));
  const preCivDeath = deficit - preSolDeath;
  let i = 0;
  const defended = Math.min(threats, fighters);
  for (let k = 0; k < defended; k++) redClusters[i++].outcome = 'defended';
  for (let k = 0; k < preCivDeath; k++) redClusters[i++].outcome = 'civ';
  for (let k = 0; k < preSolDeath; k++) redClusters[i++].outcome = 'sol';

  state.expedition = {
    sel, cells, sendPop, fighters, duration, costs,
    phase: 'out',  // out → visit → return → done
    outPath, visitList, returnPath,
    pathIdx: 0, visitIdx: 0,
    gains: { wheat: 0, water: 0, gold: 0, wood: 0, stone: 0 },
    // Pre-resolved deaths from threat clusters. Combat with monsters left
    // alive in the zone will still add on top of this.
    losses: preSolDeath + preCivDeath,
    events: [],
    caravanPos: { x: CASTLE_CENTER.x, y: CASTLE_CENTER.y },
    journalTitle: `Expé (${sel.x2-sel.x1+1}×${sel.y2-sel.y1+1})`,
    ticksPerCell: 5, // frames
    tickCounter: 0,
    // Cour royale — which special units from the conseil ride along.
    deployedSpecials: courtEligibleForExpedition(sendPop, fighters),
    // Clusters along the straight detection line. Each carries: id, fireT,
    // consumed, optional event (preset). When the curve animation crosses
    // fireT, the cluster is consumed and its event (if any) fires.
    clusters,
    // Damage is computed up-front at launch from the threat count vs soldiers
    // in the party. consumeCluster does NOT mutate these.
    eventSoldierLosses: preSolDeath,
    eventCivLosses: preCivDeath,
    // Curve & timings for the rAF animation along the organic path.
    curve: route.ctrl,
    outDuration: expeditionTripDuration(outPath.length),
    returnDuration: expeditionTripDuration(returnPath.length),
    visitTickMs: 220,
    phaseStart: 0,
    lastVisitTick: 0,
  };

  closeExpeditionPanel();
  spawnCaravan();
  addJournal('📜 Expédition lancée vers une zone ' + `${sel.x2-sel.x1+1}×${sel.y2-sel.y1+1}`, 'info');

  if (expTimer) cancelAnimationFrame(expTimer);
  expTimer = requestAnimationFrame(tickExpedition);
}

// Build a smooth, slightly organic curve from the castle to a target tile.
// Returns: { d: SVG path string in pixel coords; samples: [{px,py}] for proximity tests }.
// Cubic Bezier with two control points perturbed perpendicular to the straight line.
// Bend amount and direction are deterministic for a given target so the path is
// stable while the user drags within a tile, but evolves as the target moves.
function buildExpeditionRoute(target) {
  const sx = (CASTLE_CENTER.x + 0.5) * TILE;
  const sy = (CASTLE_CENTER.y + 0.5) * TILE;
  const tx = (target.x + 0.5) * TILE;
  const ty = (target.y + 0.5) * TILE;
  const dx = tx - sx, dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const hash = (a, b) => {
    const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return (v - Math.floor(v)) - 0.5;
  };
  const wA = hash(target.x, target.y);
  const wB = hash(target.x + 17, target.y - 31);
  const amp = Math.min(len * 0.22, 110);
  const c1x = sx + dx * 0.33 + nx * (amp * 0.55 + amp * wA);
  const c1y = sy + dy * 0.33 + ny * (amp * 0.55 + amp * wA);
  const c2x = sx + dx * 0.66 + nx * (-amp * 0.35 + amp * wB);
  const c2y = sy + dy * 0.66 + ny * (-amp * 0.35 + amp * wB);
  const d = `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`;
  const ctrl = { sx, sy, c1x, c1y, c2x, c2y, tx, ty };
  const N = 64;
  const samples = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, omt = 1 - t;
    const px = omt*omt*omt*sx + 3*omt*omt*t*c1x + 3*omt*t*t*c2x + t*t*t*tx;
    const py = omt*omt*omt*sy + 3*omt*omt*t*c1y + 3*omt*t*t*c2y + t*t*t*ty;
    samples.push({ px, py });
  }
  return { d, samples, ctrl };
}

// Evaluate the cubic Bezier of a route at parametric position t ∈ [0, 1].
function bezierAt(ctrl, t) {
  const omt = 1 - t;
  const px = omt*omt*omt*ctrl.sx + 3*omt*omt*t*ctrl.c1x + 3*omt*t*t*ctrl.c2x + t*t*t*ctrl.tx;
  const py = omt*omt*omt*ctrl.sy + 3*omt*omt*t*ctrl.c1y + 3*omt*t*t*ctrl.c2y + t*t*t*ctrl.ty;
  return { px, py };
}

// Straight-line samples from castle to target tile, used for event detection
// so the player can't dodge events by tweaking the zone to bend the visual curve.
function straightLineSamples(target) {
  const sx = (CASTLE_CENTER.x + 0.5) * TILE;
  const sy = (CASTLE_CENTER.y + 0.5) * TILE;
  const tx = (target.x + 0.5) * TILE;
  const ty = (target.y + 0.5) * TILE;
  const N = 64, samples = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    samples.push({ px: sx + (tx - sx) * t, py: sy + (ty - sy) * t });
  }
  return samples;
}

// For a set of pixel-space samples (the path), return one cluster per group of
// adjacent same-kind cells. Output: [{kind:'red'|'green', cx, cy, cells:[…]}].
// Detection is bicephalous on purpose:
//   - cells inside the zone OR ≤ 1 case from its perimeter always count
//   - cells further out only count if ≤ EXP_MARKER_RANGE cases of a path sample
//     AND the sample is itself outside the zone+1 (so the zone doesn't radiate).
// This keeps the wide path-corridor we want for the trip while preventing the
// zone itself from sweeping a 3-case halo of detection.
// 'red'   = MONSTER or CORRUPTED (camp hostile)
// 'green' = GOLD (mine) or HAMLET (maison)
function expeditionMarkers(samples, sel) {
  const R = EXP_MARKER_RANGE * TILE;
  const R2 = R * R;
  const zb = sel ? {
    x1: Math.max(0, Math.min(sel.x1, sel.x2) - 1),
    y1: Math.max(0, Math.min(sel.y1, sel.y2) - 1),
    x2: Math.min(MAP_SIZE - 1, Math.max(sel.x1, sel.x2) + 1),
    y2: Math.min(MAP_SIZE - 1, Math.max(sel.y1, sel.y2) + 1),
  } : null;
  // Path samples = those outside the zone+1 box (so a sample sitting inside
  // the zone doesn't drag along its R=3 corridor).
  const pathSamples = zb ? samples.filter(s => {
    const cx = s.px / TILE, cy = s.py / TILE;
    return !(cx >= zb.x1 && cx <= zb.x2 + 1 && cy >= zb.y1 && cy <= zb.y2 + 1);
  }) : samples;
  let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity, cMaxY = -Infinity;
  for (const s of samples) {
    if (s.px < cMinX) cMinX = s.px;
    if (s.px > cMaxX) cMaxX = s.px;
    if (s.py < cMinY) cMinY = s.py;
    if (s.py > cMaxY) cMaxY = s.py;
  }
  const ix0 = Math.max(0, Math.floor(cMinX / TILE) - EXP_MARKER_RANGE);
  const ix1 = Math.min(MAP_SIZE - 1, Math.ceil(cMaxX / TILE) + EXP_MARKER_RANGE);
  const iy0 = Math.max(0, Math.floor(cMinY / TILE) - EXP_MARKER_RANGE);
  const iy1 = Math.min(MAP_SIZE - 1, Math.ceil(cMaxY / TILE) + EXP_MARKER_RANGE);
  const hits = new Map(); // "x,y" → kind
  for (let y = iy0; y <= iy1; y++) {
    for (let x = ix0; x <= ix1; x++) {
      const c = cellAt(x, y);
      if (!c) continue;
      // Positive events are off — only threats (red clusters) are detected.
      const isRed = (c.type === CASE.MONSTER || c.type === CASE.CORRUPTED);
      if (!isRed) continue;
      const isGreen = false;
      const inZonePlusOne = !!(zb && x >= zb.x1 && x <= zb.x2 && y >= zb.y1 && y <= zb.y2);
      if (!inZonePlusOne) {
        const cxp = (x + 0.5) * TILE, cyp = (y + 0.5) * TILE;
        let best = Infinity;
        for (const s of pathSamples) {
          const ddx = s.px - cxp, ddy = s.py - cyp;
          const d2 = ddx*ddx + ddy*ddy;
          if (d2 < best) { best = d2; if (best <= R2) break; }
        }
        if (best > R2) continue;
      }
      hits.set(x + ',' + y, { x, y, kind: isRed ? 'red' : 'green' });
    }
  }
  const visited = new Set();
  const clusters = [];
  for (const [k, h] of hits) {
    if (visited.has(k)) continue;
    const stack = [h]; visited.add(k);
    const cluster = { kind: h.kind, cells: [] };
    while (stack.length) {
      const cur = stack.pop();
      cluster.cells.push(cur);
      for (const [ddx, ddy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nk = (cur.x + ddx) + ',' + (cur.y + ddy);
        if (visited.has(nk)) continue;
        const n = hits.get(nk);
        if (!n || n.kind !== cluster.kind) continue;
        visited.add(nk); stack.push(n);
      }
    }
    let scx = 0, scy = 0;
    for (const c of cluster.cells) { scx += c.x; scy += c.y; }
    cluster.cx = scx / cluster.cells.length;
    cluster.cy = scy / cluster.cells.length;
    clusters.push(cluster);
  }
  return clusters;
}

function linePath(a, b) {
  const pts = [];
  let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let guard = 100;
  while (guard-- > 0) {
    pts.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
}

function castleScreenPos() {
  const rect = elMapScroller.getBoundingClientRect();
  return {
    left: rect.left - elMapScroller.scrollLeft + (CASTLE_CENTER.x * TILE + TILE/2) * zoom,
    top:  rect.top  - elMapScroller.scrollTop  + (CASTLE_CENTER.y * TILE + TILE/2) * zoom,
  };
}

let caravanEl = null;
function spawnCaravan() {
  if (caravanEl) caravanEl.remove();
  caravanEl = document.createElement('div');
  caravanEl.className = 'caravan';
  caravanEl.textContent = '🐴';
  caravanEl.style.left = (CASTLE_CENTER.x * TILE + TILE/2 - 12) + 'px';
  caravanEl.style.top = (CASTLE_CENTER.y * TILE + TILE/2 - 12) + 'px';
  elMapLayers.appendChild(caravanEl);
}

// Move caravan to a tile (used during the visit phase, where each step is a
// teleport to the next harvest cell). Re-enables the CSS transition so the
// caravan glides between cells inside the zone.
function moveCaravan(x, y) {
  if (!caravanEl) return;
  caravanEl.classList.remove('flowing');
  caravanEl.style.left = (x * TILE + TILE/2 - 12) + 'px';
  caravanEl.style.top  = (y * TILE + TILE/2 - 12) + 'px';
  state.expedition.caravanPos = { x, y };
}

// Smoothly place the caravan on the Bezier curve at parametric position t.
// Used continuously by rAF during 'out' and 'return' phases, so the caravan
// follows the drawn organic path fluidly.
function moveCaravanCurveT(t) {
  if (!caravanEl) return;
  const exp = state.expedition;
  if (!exp || !exp.curve) return;
  caravanEl.classList.add('flowing');
  const p = bezierAt(exp.curve, Math.max(0, Math.min(1, t)));
  caravanEl.style.left = (p.px - 12) + 'px';
  caravanEl.style.top  = (p.py - 12) + 'px';
  exp.caravanPos = { x: p.px / TILE - 0.5, y: p.py / TILE - 0.5 };
}

let expTimer = null;
// Total animation duration for one curve traversal. Scales with path length
// so short trips stay snappy (~1.5s) and long trips stay readable (~4s).
function expeditionTripDuration(pathLen) {
  return Math.min(4000, Math.max(1500, pathLen * 110));
}

function tickExpedition(ts) {
  if (!state.expedition) return;
  const exp = state.expedition;

  if (exp.phase === 'out') {
    if (!exp.phaseStart) exp.phaseStart = ts;
    const t = Math.min(1, (ts - exp.phaseStart) / exp.outDuration);
    moveCaravanCurveT(t);
    // Fire any cluster whose fireT was just crossed.
    if (exp.clusters) {
      for (const cl of exp.clusters) {
        if (!cl.consumed && t >= cl.fireT) consumeCluster(cl);
      }
    }
    if (t >= 1) {
      exp.phase = 'visit';
      exp.visitIdx = 0;
      exp.phaseStart = 0;
      exp.lastVisitTick = 0;
      consumeRemainingClusters();
    }
  } else if (exp.phase === 'visit') {
    if (!exp.lastVisitTick) exp.lastVisitTick = ts;
    if (ts - exp.lastVisitTick >= (exp.visitTickMs || 220)) {
      exp.lastVisitTick = ts;
      if (exp.visitIdx >= exp.visitList.length) {
        exp.phase = 'return';
        exp.phaseStart = 0;
      } else {
        const v = exp.visitList[exp.visitIdx++];
        moveCaravan(v.x, v.y);
        resolveCell(v.x, v.y);
      }
    }
  } else if (exp.phase === 'return') {
    if (!exp.phaseStart) exp.phaseStart = ts;
    const elapsed = (ts - exp.phaseStart) / exp.returnDuration;
    const t = Math.max(0, 1 - Math.min(1, elapsed));
    moveCaravanCurveT(t);
    if (t <= 0) {
      exp.phase = 'done';
      finishExpedition();
      return;
    }
  }

  updateTimelineProgress();
  expTimer = requestAnimationFrame(tickExpedition);
}

function resolveCell(x, y) {
  const c = cellAt(x, y);
  if (!c) return;
  // Cells already neutralised by an en-route event don't yield twice.
  if (c.consumedByEvent) return;
  const info = CELL_INFO[c.type];
  const exp = state.expedition;

  if (c.type === CASE.WHEAT || c.type === CASE.FOREST || c.type === CASE.QUARRY || c.type === CASE.WATER || c.type === CASE.GOLD) {
    if (c.cooldown > 0 || c.harvested >= 5) {
      showBubble(x, y, c.harvested >= 5 ? '💀 Épuisé' : '💤 En repousse', 'event');
      return;
    }
    const baseAmt = rInt(info.amount[0], info.amount[1]);
    const gainMult = (typeof courtEffects === 'function') ? courtEffects().expeditionGainMult : 1;
    const amt = Math.max(1, Math.round(baseAmt * gainMult));
    exp.gains[info.res] += amt;
    c.harvested = (c.harvested || 0) + 1;
    c.cooldown = info.res === 'wheat' ? 2 : info.res === 'water' ? 2 : info.res === 'wood' ? 4 : info.res === 'stone' ? 5 : 7;
    showBubble(x, y, `+${amt} ${iconChar(info.res)}`, 'good');
    puff(x, y, '✨');
    if (c.harvested >= 5) {
      c.type = CASE.CORRUPTED;
      showBubble(x, y, '☠️ Corruption !', 'event');
    }
  } else if (c.type === CASE.MONSTER || c.type === CASE.CORRUPTED) {
    const power = rInt(info.danger[0], info.danger[1]);
    const eff = (typeof courtEffects === 'function') ? courtEffects() : null;
    const force = exp.fighters * 1.0 + (exp.sendPop - exp.fighters) * 0.3 + (eff ? eff.expeditionFightersBonus : 0);
    const victoryBoost = eff ? eff.combatVictoryBonus : 0;
    const winChance = Math.min(0.98, force / (force + power) + victoryBoost);
    const lossMult = eff ? eff.expeditionLossMult : 1;
    if (rng() < winChance) {
      // win
      const rawLost = Math.max(0, rInt(0, Math.ceil(power * 0.4)));
      const lost = Math.max(0, Math.round(rawLost * lossMult));
      exp.losses += lost;
      exp.gains.gold += rInt(1, 3);
      puff(x, y, '⚔️');
      showBubble(x, y, lost > 0 ? `-${lost} ☠️` : 'Victoire !', lost > 0 ? 'bad' : 'good');
      c.type = CASE.GRASS;
    } else {
      const rawLost = Math.max(1, rInt(Math.ceil(power * 0.5), Math.ceil(power * 1.2)));
      const lost = Math.max(1, Math.round(rawLost * lossMult));
      exp.losses += lost;
      puff(x, y, '💥');
      showBubble(x, y, `-${lost} ☠️`, 'bad');
      state.kingStress += 2;
    }
  } else if (c.type === CASE.RUINS) {
    const gold = rInt(2, 5);
    exp.gains.gold += gold;
    exp.ruinsVisited = (exp.ruinsVisited || 0) + 1;
    puff(x, y, '🏺');
    showBubble(x, y, `+${gold} 💰`, 'good');
    c.type = CASE.GRASS;
  } else if (c.type === CASE.HAMLET) {
    // Tribute (small) and a flag this hamlet was visited — encounter rolls
    // happen at end-of-expedition based on visited counts.
    const gold = rInt(info.amount[0], info.amount[1]);
    exp.gains.gold += gold;
    exp.hamletsVisited = (exp.hamletsVisited || 0) + 1;
    puff(x, y, '🛖');
    showBubble(x, y, `+${gold} 💰`, 'good');
    c.type = CASE.GRASS;
  }
}

// Mark a cluster as consumed: remove its DOM marker (with a quick fade) and,
// if the cluster carries a preset event, fire it with VFX bound to the cluster
// location. Cells in the cluster are flagged so the visit-phase harvesters
// don't redo the event's loot.
function consumeCluster(cl) {
  if (cl.consumed) return;
  cl.consumed = true;
  const node = elSelLayer.querySelector(`.exp-marker[data-cluster-id="${cl.id}"]`);
  if (node) {
    node.classList.add('exp-marker-fading');
    setTimeout(() => node.remove(), 220);
  }
  // Red clusters: the camp is neutralised on the way. Cells flip to grass
  // (sprite is removed from the map) and resolveCell skips them later.
  if (cl.kind === 'red') {
    for (const c of cl.cells) {
      const cell = cellAt(c.x, c.y);
      if (!cell) continue;
      cell.consumedByEvent = true;
      if (cell.type === CASE.MONSTER || cell.type === CASE.CORRUPTED) {
        cell.type = CASE.GRASS;
        const node = elMapLayers.querySelector(`.cell[data-x="${c.x}"][data-y="${c.y}"]`);
        if (node) node.remove();
      }
    }
  }
  const exp = state.expedition;
  if (!exp) return;
  const x = cl.cx, y = cl.cy;
  // Red clusters: outcome was pre-assigned at launch. Just play the cue.
  // Green clusters: silent disappearance for now (positive events disabled).
  if (cl.kind === 'red') {
    if (cl.outcome === 'defended') {
      puff(x, y, '🛡');
      showBubble(x, y, '🛡 Défendu', 'good');
      addJournal('🐺 Embuscade repoussée par les soldats', 'info');
      exp.events.push({ id: 'ambush_def', msg: '🐺 Embuscade repoussée', kind: 'defended' });
    } else if (cl.outcome === 'sol') {
      puff(x, y, '🛡');
      showBubble(x, y, '🛡 −1 soldat', 'bad');
      addJournal('🐺 Embuscade : un soldat est tombé', 'bad');
      exp.events.push({ id: 'ambush_sol', msg: '🐺 Embuscade — soldat tombé', kind: 'sol' });
    } else if (cl.outcome === 'civ') {
      puff(x, y, '💥');
      showBubble(x, y, '−1 ☠️', 'bad');
      addJournal('🐺 Embuscade : un civil tombe', 'bad');
      exp.events.push({ id: 'ambush_civ', msg: '🐺 Embuscade — civil tombé', kind: 'civ' });
    }
  }
}

// Sweep any clusters the caravan didn't physically pass (rounding, short
// outPath) so no orphan ! marker lingers once we leave the out phase.
function consumeRemainingClusters() {
  const exp = state.expedition;
  if (!exp || !exp.clusters) return;
  for (const cl of exp.clusters) if (!cl.consumed) consumeCluster(cl);
}

function finishExpedition() {
  const exp = state.expedition;
  // Snapshot gains/losses before mutation so the report can show them.
  const expSnapshot = {
    gains: { ...exp.gains },
    losses: 0,              // filled below after cap
    sendPop: exp.sendPop,
    fighters: exp.fighters,
    deployedSpecials: (exp.deployedSpecials || []).slice(),
  };

  // flying rewards back to top bar (two-step, grouped at gather point)
  const gainKeys = RES_ORDER.filter(k => (exp.gains[k] || 0) > 0);
  gainKeys.forEach((key, i) => {
    state.resources[key] += exp.gains[key];
    flyResource(key, exp.gains[key], castleScreenPos(), $('res-' + key), i, gainKeys.length);
    flashSlot(key, 'plus');
  });

  // apply unit losses
  let losses = Math.min(exp.losses, exp.sendPop);
  // cap to 80%
  losses = Math.min(losses, Math.floor(exp.sendPop * 0.8));
  expSnapshot.losses = losses;
  let remaining = losses;
  state.unitsLost += losses;
  // 1) Event-driven soldier sacrifices come first — soldiers protected the
  //    party, so they fall before any civilian loss is tallied.
  const evSoldier = Math.min(exp.eventSoldierLosses || 0, remaining, state.soldiers);
  state.soldiers -= evSoldier; state.population -= evSoldier;
  remaining -= evSoldier;
  // 2) Event-driven civilian losses (when no soldier was available to absorb).
  const evCiv = Math.min(exp.eventCivLosses || 0, remaining,
    Math.max(0, state.population - state.soldiers - state.generals));
  state.population -= evCiv;
  remaining -= evCiv;
  // 3) Combat losses follow the legacy civilians-first order.
  const civilians = state.population - state.soldiers - state.generals;
  const takeCiv = Math.min(remaining, Math.max(0, exp.sendPop - exp.fighters - (exp.eventCivLosses || 0)));
  const civDead = Math.min(civilians, takeCiv);
  state.population -= civDead;
  remaining -= civDead;
  const takeSol = Math.min(remaining, state.soldiers);
  state.soldiers -= takeSol;
  state.population -= takeSol;
  remaining -= takeSol;
  if (remaining > 0) {
    const takeGen = Math.min(remaining, state.generals);
    state.generals -= takeGen; state.population -= takeGen;
  }
  // Per-commoner death notification — keeps loss tangible.
  for (let i = 0; i < civDead; i++) {
    addJournal('💀 Un ouvrier n\'est pas revenu.', 'bad');
  }
  for (let i = 0; i < takeSol; i++) {
    addJournal('💀 Un soldat est tombé en expédition.', 'bad');
  }

  state.expsCompleted++;

  // advance time
  advanceMonths(exp.duration);

  // journal entry
  const totalGain = RES_ORDER.reduce((s, k) => s + (exp.gains[k] || 0), 0);
  let tone = 'good';
  if (losses >= 3 || totalGain < 2) tone = 'bad';
  else if (losses > 0) tone = 'mixed';
  const gainText = RES_ORDER.filter(k => exp.gains[k] > 0).map(k => `+${exp.gains[k]} ${iconChar(k)}`).join(' ');
  addJournal(`Retour d'expédition — ${gainText || 'Maigre butin'}${losses > 0 ? ` · -${losses} ☠️` : ''}`, tone);

  // stress adjustment
  const spent = Object.values(exp.costs).reduce((s, v) => s + v, 0);
  if (totalGain < spent / 2) state.kingStress += 2;

  // cleanup
  if (caravanEl) { caravanEl.remove(); caravanEl = null; }
  state.expedition = null;
  // Court: streak, injury/death rolls, acquisition — build report data.
  const courtResults = applyCourtExpeditionOutcome(expSnapshot);
  // v4: encounters can occur in any expedition. Base chance + per-Maison +
  // per-hamlet/ruin bonuses. No more founder unit / protected pop.
  const encounters = rollExpeditionEncounters(exp);
  for (const e of encounters) state.court.offer.push(e);

  renderAll();

  const seasonDue = state.monthsAt > 0 && state.monthsAt % 3 === 0 && state.kingAlive;
  state.court.pendingCeremony = !!seasonDue;

  const eventSnapshot = (exp.events || []).slice();
  setTimeout(() => {
    showExpeditionReport({
      gains: expSnapshot.gains,
      losses: expSnapshot.losses,
      streakUps: courtResults.streakUps,
      casualties: courtResults.casualties,
      events: eventSnapshot,
    });
  }, 650);
}

function iconChar(key) {
  return { wheat: '🌾', water: '💧', gold: '💰', wood: '🪵', stone: '🪨' }[key] || '';
}

// ═══════════════════════════════════════════════════════════════
// TIME
// ═══════════════════════════════════════════════════════════════

function advanceMonths(n) {
  for (let i = 0; i < n; i++) {
    state.monthsAt++;
    // passive production
    for (const b of state.buildings) {
      const def = BUILDINGS.find(x => x.id === b.id);
      for (const k of Object.keys(def.prod)) state.resources[k] += def.prod[k];
    }
    // regrow
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const c = state.map[y][x];
        if (c.cooldown > 0) c.cooldown--;
      }
    }
    // (Pop growth removed — civilians now arrive only as expedition offers
    // and must be welcomed via drag-drop into Le Peuple.)
    // king ages every 12 months
    if (state.monthsAt % 12 === 0) {
      state.kingAge++;
      if (state.kingAge % 5 === 0) state.kingStress = Math.min(100, state.kingStress + 5);
    }
  }
}

// Natural death of the founding "Mère du Roi" — fires once when the king
// reaches the predetermined age. Removes her from Conseil/Cour. Her protected
// pop (+3) was never in state.population, so it just vanishes with her —
// no anonymous-civilian eviction needed.
function triggerMotherDeath() {
  state.court.motherAlive = false;
  // Find and remove her from whichever zone she sits in.
  let removed = false;
  for (let i = 0; i < state.court.conseil.length; i++) {
    const u = state.court.conseil[i];
    if (u && u.defId === 'mother_of_king') { state.court.conseil[i] = null; removed = true; break; }
  }
  if (!removed) for (let i = 0; i < state.court.cour.length; i++) {
    const u = state.court.cour[i];
    if (u && u.defId === 'mother_of_king') { state.court.cour[i] = null; removed = true; break; }
  }
  state.kingStress = Math.min(100, state.kingStress + 8);
  addJournal('👑 La Mère du Roi s\'est éteinte paisiblement. Le royaume est en deuil. Sa maisonnée se disperse.', 'bad');
  toast('bad', 'Décès royal', 'La Mère du Roi a quitté ce monde — sa maisonnée se disperse.');
  // Defensive: if any other founder effect ever raised civSlotsCap and that
  // dropped, evict surplus. With current effects this is a no-op.
  evictExcessAnonymous('mort de la Mère du Roi');
}

// Find the Mother on Conseil/Cour. Returns the unit or null.
function findMotherUnit() {
  for (const u of state.court.conseil) if (u && u.defId === 'mother_of_king') return u;
  for (const u of state.court.cour)    if (u && u.defId === 'mother_of_king') return u;
  return null;
}

// React to an expedition's outcome by adjusting the Mother's stars.
// anyDeath = anonymous deaths > 0 OR any specials died/injured.
function updateMotherStarsFromOutcome(losses, casualties) {
  const mother = findMotherUnit();
  if (!mother) return;
  const anyDeath = (losses > 0) || (casualties && casualties.length > 0);
  if (anyDeath) {
    if (mother.stars > 1) {
      mother.stars = 1;
      addJournal('👑 Le filet royal se brise — la Mère du Roi reprend force lentement (★ remis à 1).', 'warn');
    }
  } else {
    if (mother.stars < 3) {
      mother.stars = Math.min(3, (mother.stars || 1) + 1);
      addJournal(`👑 La maisonnée royale se renforce (★ ${mother.stars} → +${mother.stars} habitants protégés).`, 'good');
    }
  }
}

// If anonymous civilian/soldier count exceeds slot capacity (e.g., after a
// founder death or building destruction), evict the surplus and apply stress.
function evictExcessAnonymous(reason) {
  let evicted = 0;
  while (civCount() > civSlotsCap()) {
    state.population--;
    evicted++;
  }
  while (solCount() > solSlotsCap() && state.soldiers > 0) {
    state.soldiers--;
    state.population--;
    evicted++;
  }
  if (evicted > 0) {
    state.kingStress = Math.min(100, state.kingStress + Math.min(15, evicted * 3));
    addJournal(`💨 ${evicted} habitant${evicted > 1 ? 's partent' : ' part'} faute de logements (${reason}).`, 'bad');
  }
}

// ═══════════════════════════════════════════════════════════════
// SEASON CEREMONY
// ═══════════════════════════════════════════════════════════════

function computeSeasonCosts() {
  // v4: only anonymous inhabitants pay season costs. Specials in Conseil/Cour
  // are decoupled from the population system.
  const civilians = civCount();
  const soldiers = state.soldiers;
  const hasGranary = state.buildings.some(b => b.id === 'granary');
  const wheatMod = hasGranary ? 0.75 : 1;
  const eff = (typeof courtEffects === 'function') ? courtEffects() : null;
  const mult = eff ? eff.seasonCostMult : 1;
  const mulR = v => Math.max(0, Math.ceil(v * mult));
  const lines = [
    { label: `${civilians} habitants`, costs: { wheat: mulR(civilians * 1 * wheatMod), water: mulR(civilians * 0.5) } },
  ];
  if (soldiers) lines.push({ label: `${soldiers} soldats`, costs: { wheat: mulR(soldiers * 0.5 * wheatMod), gold: mulR(soldiers * 1), water: mulR(soldiers * 0.5) } });
  if (state.generals) lines.push({ label: `${state.generals} généraux`, costs: { gold: mulR(state.generals * 2) } });
  if (state.buildings.length) lines.push({ label: `Entretien (${state.buildings.length} bât.)`, costs: { wood: mulR(state.buildings.length / 2) } });
  const totals = { wheat: 0, water: 0, gold: 0, wood: 0 };
  for (const l of lines) for (const k of Object.keys(l.costs)) totals[k] = (totals[k] || 0) + l.costs[k];
  return { lines, totals, civilians };
}

function runSeasonCeremony() {
  const year = currentYear();
  const seasonIdx = ((currentSeasonIdx() - 1) + 4) % 4;
  const season = SEASONS[seasonIdx];
  const { lines, totals, civilians } = computeSeasonCosts();

  // Court support income (Chasseur etc.) — granted before deficit check so it
  // can offset costs.
  const eff = (typeof courtEffects === 'function') ? courtEffects() : null;
  if (eff && eff.seasonExtraIncome) {
    for (const k of Object.keys(eff.seasonExtraIncome)) {
      const amt = Math.round(eff.seasonExtraIncome[k] || 0);
      if (amt > 0 && k in state.resources) {
        state.resources[k] += amt;
        addJournal(`🎁 La cour apporte +${amt} ${iconChar(k) || k}.`, 'good');
      }
    }
  }

  // compute deficits
  const deficits = {};
  for (const k of Object.keys(totals)) {
    if (state.resources[k] < totals[k]) deficits[k] = totals[k] - state.resources[k];
    state.resources[k] = Math.max(0, state.resources[k] - totals[k]);
  }

  // Court stress relief (Brasseur etc.)
  if (eff && eff.seasonStressRelief > 0) {
    const relief = Math.round(eff.seasonStressRelief);
    if (relief > 0) state.kingStress = Math.max(0, state.kingStress - relief);
  }

  // consequences
  const crises = [];
  if (deficits.wheat) {
    const dead = Math.ceil(deficits.wheat / 3);
    crises.push(`⚠️ FAMINE ! ${dead} habitant(s) mort(s) de faim.`);
    const remove = Math.min(dead, civilians);
    state.population -= remove;
    state.kingStress += 5;
  }
  if (deficits.gold) {
    const des = Math.ceil(deficits.gold / 5);
    const remove = Math.min(des, state.soldiers);
    crises.push(`⚠️ DÉSERTIONS ! ${remove} soldat(s) s'enfuient.`);
    state.soldiers -= remove;
    state.population -= remove;
    state.kingStress += 3;
  }
  if (deficits.water) {
    crises.push('⚠️ Soif au royaume. Stress +1.');
    state.kingStress += 1;
  }
  if (deficits.wood) {
    crises.push('⚠️ Les bâtiments craquent. Stress +1.');
    state.kingStress += 1;
  }

  // mortality roll
  const ks = kingStateEntry();
  const rollDied = rng() < ks.mortality;

  renderCeremony(year, season, lines, totals, crises, rollDied);

  renderAll();
}

function renderCeremony(year, season, lines, totals, crises, rollDied) {
  elCeremony.hidden = false;
  const verdictClass = crises.length === 0 ? 'ok' : 'bad';
  const verdictText = crises.length === 0 ? '✅ STABILITÉ' : '⚠️ CRISE';
  elCeremony.innerHTML = `
    <div class="ceremony">
      <h2>${season.glyph} Fin du ${season.name} · An ${year}</h2>
      <div style="font-size:12px; color: var(--ink-3); text-align: center; margin-bottom: 14px;">Paiement des coûts saisonniers</div>
      ${lines.map((l, i) => `
        <div class="ceremony-line" style="animation-delay: ${i * 120}ms;">
          <span>${l.label}</span>
          <span class="costs">${Object.entries(l.costs).map(([k, v]) => `<img src="${RES[k].icon}"><b>-${v}</b>`).join(' · ')}</span>
        </div>`).join('')}
      <div class="ceremony-line" style="font-weight:700; animation-delay: ${lines.length * 120 + 150}ms;">
        <span>Total dépensé</span>
        <span class="costs">${Object.entries(totals).filter(([,v])=>v>0).map(([k,v])=>`<img src="${RES[k].icon}"><b>-${v}</b>`).join(' · ')}</span>
      </div>
      ${crises.map(c => `<div style="color: var(--red-deep); font-size: 13px; margin-top: 10px; animation: lineFade 400ms backwards; animation-delay: ${(lines.length+1) * 120}ms;">${c}</div>`).join('')}
      <div class="ceremony-verdict ${verdictClass}" style="animation: lineFade 400ms backwards; animation-delay: ${(lines.length+2) * 120}ms;">${verdictText}</div>
      ${rollDied ? '<div style="text-align:center; color: var(--red-deep); font-family: var(--font-title); font-size: 18px; letter-spacing: 2px; margin-top: 16px; animation: shake 500ms;">☠️ Le roi s\'éteint…</div>' : ''}
      <div style="display:flex; justify-content:center; margin-top: 18px;">
        <button class="btn btn-primary" id="ceremony-continue">Continuer</button>
      </div>
    </div>`;
  $('ceremony-continue').onclick = () => {
    elCeremony.hidden = true;
    elCeremony.innerHTML = '';
    if (rollDied) { gameOver('Succombé à son âge et à ses tourments'); }
  };
}

// ═══════════════════════════════════════════════════════════════
// BUILDINGS
// ═══════════════════════════════════════════════════════════════

function canPlaceBuilding(x, y) {
  const c = cellAt(x, y);
  if (!c) return false;
  if (c.type !== CASE.GRASS) return false;
  if (isCastle(x, y)) return false;
  if (state.buildings.some(b => b.x === x && b.y === y)) return false;
  // must be in influence zone
  const d = Math.sqrt((x - CASTLE_CENTER.x) ** 2 + (y - CASTLE_CENTER.y) ** 2);
  if (d > INFLUENCE_RADIUS) return false;
  return true;
}

function startPlaceBuilding(id) {
  const def = BUILDINGS.find(b => b.id === id);
  if (!def) return;
  if (!canAfford(def.cost)) { toast('bad', 'Fonds insuffisants', 'Il manque des ressources.'); return; }
  state.placingBuilding = id;
  showPlacingHint(def.name);
  renderMap();
  renderBuildPanel();
}

function cancelPlacement() {
  state.placingBuilding = null;
  hidePlacingHint();
  renderMap();
  renderBuildPanel();
}

let placingHintEl = null;
function showPlacingHint(name) {
  hidePlacingHint();
  placingHintEl = document.createElement('div');
  placingHintEl.className = 'placing-hint';
  placingHintEl.innerHTML = `Placez votre <strong>${name}</strong> dans la zone d'influence — <span style="opacity:0.7;">[Echap pour annuler]</span>`;
  elMapScroller.appendChild(placingHintEl);
}
function hidePlacingHint() { if (placingHintEl) { placingHintEl.remove(); placingHintEl = null; } }

function commitBuildingPlacement(x, y) {
  const def = BUILDINGS.find(b => b.id === state.placingBuilding);
  for (const k of Object.keys(def.cost)) {
    state.resources[k] -= def.cost[k];
    flashSlot(k, 'minus');
  }
  state.buildings.push({ id: def.id, x, y });
  cancelPlacement();
  if (def.id === 'house') {
    // 3 housing slots and 1 brand-new civilian moves in (anonymous, unhoused
    // surplus is clamped elsewhere).
    if (civCount() < civSlotsCap()) state.population += 1;
    addJournal(`🏠 Maison construite — +${def.civSlots} logements, +1 civil rejoint le royaume.`, 'good');
  } else if (def.id === 'barracks') {
    if (solCount() < solSlotsCap()) {
      state.soldiers += 1;
      state.population += 1;
    }
    addJournal(`⚔️ Caserne construite — +${def.solSlots} logements, +1 soldat rejoint la garde.`, 'good');
  } else {
    addJournal(`🔨 ${def.name} construit.`, 'info');
  }
  renderAll();
}

function canAfford(cost) {
  return Object.entries(cost).every(([k, v]) => state.resources[k] >= v);
}

function renderBuildPanel() {
  const list = $('build-list');
  list.innerHTML = BUILDINGS.map(b => {
    const afford = canAfford(b.cost);
    const placing = state.placingBuilding === b.id;
    const costHtml = Object.entries(b.cost).map(([k, v]) => {
      const ok = state.resources[k] >= v;
      return `<span class="bc ${ok ? 'ok' : 'no'}"><img src="${RES[k].icon}" width="16" height="16">${v}</span>`;
    }).join('');
    return `
      <div class="build-item ${afford ? '' : 'cant'}" title="${b.name} — ${b.effect}">
        <div class="build-glyph">${b.glyph}</div>
        <div class="build-name">${b.name}</div>
        <div class="build-cost">${costHtml}</div>
        <button class="build-btn ${placing ? 'placing' : ''}" data-id="${b.id}" ${afford ? '' : 'disabled'}>${placing ? 'Annuler' : 'Construire'}</button>
      </div>`;
  }).join('');
  list.querySelectorAll('.build-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      if (state.placingBuilding === id) cancelPlacement();
      else startPlaceBuilding(id);
    };
  });
  adjustBuildPanelHeight();
}

function buildPanelNaturalHeight() {
  const list = $('build-list');
  const head = $('panel-build').querySelector('.panel-head');
  const headH = head ? head.getBoundingClientRect().height : 0;
  // list is also .panel-scroll with flex:1 — it stretches to fill its parent,
  // so scrollHeight returns the stretched height (not content). Temporarily
  // release the flex stretch to get the intrinsic content height.
  let listH = 0;
  if (list) {
    const prev = list.style.flex;
    list.style.flex = '0 0 auto';
    listH = list.scrollHeight;
    list.style.flex = prev;
  }
  return Math.ceil(listH + headH + 8); // small breathing room
}

function adjustBuildPanelHeight() {
  const pB = $('panel-build');
  if (!pB) return;
  // Skip if the user has manually resized via the grip — their size wins.
  if (pB.dataset.userSized) return;
  const apply = () => {
    if (pB.dataset.userSized) return;
    const natural = buildPanelNaturalHeight();
    pB.style.flex = `0 0 ${natural}px`;
    $('panel-journal').style.flex = '1 1 0';
  };
  apply();
  // Re-apply once cost icons finish loading — scrollHeight is undersized
  // before images report their intrinsic size.
  pB.querySelectorAll('img').forEach(img => {
    if (!img.complete) img.addEventListener('load', apply, { once: true });
  });
}

// ═══════════════════════════════════════════════════════════════
// TIMELINE
// ═══════════════════════════════════════════════════════════════

// Update just the per-month fill bars — called each expedition tick so the
// progress texture advances smoothly without re-rendering the whole timeline.
function updateTimelineProgress() {
  const now = state.monthsAt;
  const seasonStart = now - (now % 3);
  const exp = state.expedition;
  const f = exp ? expeditionProgress() : null;
  const elapsedMonths = (exp && f != null) ? f * exp.duration : 0;
  const seasonEl = $('timeline-season');
  if (!seasonEl) return;
  for (let i = 0; i < 3; i++) {
    const slot = seasonEl.querySelector(`.tl-season-slot[data-i="${i}"]`);
    if (!slot) continue;
    const m = seasonStart + i;
    let fill = 0;
    if (m < now) fill = 1;
    else if (m === now && exp) fill = Math.max(0, Math.min(1, elapsedMonths - (m - now)));
    else if (m > now && exp) {
      const rel = m - now;
      if (rel < exp.duration) fill = Math.max(0, Math.min(1, elapsedMonths - rel));
    }
    slot.style.setProperty('--fill', fill);
  }
}

// Returns progress fraction [0,1] of the active expedition, or null if idle.
function expeditionProgress() {
  const exp = state.expedition;
  if (!exp) return null;
  const outLen = exp.outPath.length;
  const visitLen = exp.visitList.length;
  const retLen = exp.returnPath.length;
  const total = outLen + visitLen + retLen;
  let done = 0;
  if (exp.phase === 'out')    done = exp.pathIdx;
  else if (exp.phase === 'visit') done = outLen + exp.visitIdx;
  else if (exp.phase === 'return') done = outLen + visitLen + exp.pathIdx;
  else if (exp.phase === 'done')   done = total;
  return Math.max(0, Math.min(1, done / total));
}

function renderTimeline() {
  const now = state.monthsAt;
  const seasonStart = now - (now % 3);
  const seasonIdx = currentSeasonIdx();
  const monthInSeason = now % 3; // 0,1,2

  // Expedition: fraction of months elapsed since start of journey
  const exp = state.expedition;
  let expSpan = null;
  if (exp) {
    const f = expeditionProgress();
    const elapsed = f * exp.duration;
    // Expedition started at `now - floor(elapsed)` approximately. We track only
    // the active expedition — its starting month is `now` minus months already
    // counted. Simplest: fill from `now` backward? No — expeditions advance
    // the clock only on completion, so `now` is the month they started.
    expSpan = { startMonth: now, duration: exp.duration, elapsedMonths: elapsed };
  }

  const seasonEl = $('timeline-season');
  // 3 month slots
  for (let i = 0; i < 3; i++) {
    const slot = seasonEl.querySelector(`.tl-season-slot[data-i="${i}"]`);
    const m = seasonStart + i;
    const isPast = m < now;
    const isCurrent = m === now;
    const isFuture = m > now;
    slot.classList.toggle('past', isPast);
    slot.classList.toggle('current', isCurrent);
    slot.classList.toggle('future', isFuture);
    let fill = 0;
    if (isPast) fill = 1;
    else if (expSpan) {
      // slot represents month m. Expedition covers months startMonth..startMonth+duration-1
      const relStart = m - expSpan.startMonth;
      if (relStart >= 0 && relStart < expSpan.duration) {
        const local = expSpan.elapsedMonths - relStart;
        fill = Math.max(0, Math.min(1, local));
      }
    }
    slot.style.setProperty('--fill', fill);
    slot.innerHTML = `
      <span class="tl-month-num">M${i + 1}</span>
      <span class="tl-month-glyph">${SEASONS[seasonIdx].glyph}</span>
    `;
    slot.title = isCurrent ? 'Mois en cours' : (isPast ? 'Mois passé' : 'À venir');
  }

  // Payment slot — previews next tribute cost
  const payEl = $('tl-pay');
  const { totals } = computeSeasonCosts();
  const costChips = Object.entries(totals).filter(([, v]) => v > 0)
    .map(([k, v]) => `<span class="tl-pay-chip"><img src="${RES[k].icon}" width="14" height="14">${v}</span>`)
    .join('');
  payEl.innerHTML = `<span class="tl-pay-label">💰 Tribut</span><span class="tl-pay-costs">${costChips || '—'}</span>`;
  payEl.title = `Paiement à la fin du ${SEASONS[seasonIdx].name}`;

  // Upcoming 3 seasons
  const futureEl = $('timeline-future');
  for (let i = 0; i < 3; i++) {
    const slot = futureEl.querySelector(`.tl-future-slot[data-i="${i}"]`);
    const nextSi = (seasonIdx + 1 + i) % 4;
    const s = SEASONS[nextSi];
    slot.innerHTML = `<span class="tl-f-glyph">${s.glyph}</span><span class="tl-f-name">${s.name}</span>`;
    slot.title = s.name;
  }
}

// ═══════════════════════════════════════════════════════════════
// STATS PANEL
// ═══════════════════════════════════════════════════════════════

function renderStats() {
  const civ = state.population - state.soldiers - state.generals;
  $('stats-list').innerHTML = `
    <div class="stat-row"><span>Civils</span><b>${civ}</b></div>
    <div class="stat-row"><span>Soldats</span><b>${state.soldiers}</b></div>
    <div class="stat-row"><span>Généraux</span><b>${state.generals}</b></div>
    <div class="stat-row"><span>Bâtiments</span><b>${state.buildings.length}</b></div>
    <div class="stat-row"><span>Expéditions</span><b>${state.expsCompleted}</b></div>
    <div class="stat-row"><span>Roi · stress</span><b>${state.kingStress}</b></div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// JOURNAL
// ═══════════════════════════════════════════════════════════════

function addJournal(text, tone = 'good') {
  state.journal.unshift({ text, tone, when: `M${currentMonth()} An${currentYear()}` });
  if (state.journal.length > 40) state.journal.length = 40;
  renderJournal();
}
function renderJournal() {
  const el = $('journal-scroll');
  if (state.journal.length === 0) {
    el.innerHTML = '<div class="hist-empty">Aucune entrée pour l\'instant.</div>';
    return;
  }
  el.innerHTML = state.journal.map((j, i) => {
    const isReturn = j.text.startsWith("Retour d'expédition");
    return `
    <div class="hist-entry ${j.tone}${isReturn ? ' clickable' : ''}" data-idx="${i}">
      <div class="hist-top">
        <span class="hist-title">${j.text}</span>
        <span class="hist-when">${j.when}</span>
      </div>
    </div>`;
  }).join('');
  // Clicking the most recent return-of-expedition entry reopens the report.
  el.querySelectorAll('.hist-entry.clickable').forEach(node => {
    node.onclick = () => {
      if (currentExpReport && !state.court.offerOpen) {
        const back = $('court-offer-backdrop');
        if (back) {
          back.hidden = false;
          state.court.offerOpen = true;
          renderExpeditionReport();
          startExpReportAutoClose();
        }
      }
    };
  });
}
$('journal-clear').onclick = () => { state.journal = []; renderJournal(); };

// ═══════════════════════════════════════════════════════════════
// KING PANEL / FESTIVAL
// ═══════════════════════════════════════════════════════════════

$('king-slot').onclick = () => {
  const ks = kingStateEntry();
  toast('info', `Roi — ${ks.label}`, `Âge: ${state.kingAge} ans · Stress: ${state.kingStress}/100 · Mortalité: ${(ks.mortality*100).toFixed(0)}% /saison`);
};

// ═══════════════════════════════════════════════════════════════
// FX: flying resources, bubbles, puffs, toasts
// ═══════════════════════════════════════════════════════════════

// Two-phase fly: from → gather point (pause) → to
// index/total are optional — used to space multiple concurrent resources at the gather point
function flyResource(key, amount, from, to, index = 0, total = 1) {
  const fromRect = from.getBoundingClientRect ? from.getBoundingClientRect() : { left: from.left - 18, top: from.top - 18, width: 36, height: 36 };
  const toRect = to.getBoundingClientRect ? to.getBoundingClientRect() : { left: to.left - 18, top: to.top - 18, width: 36, height: 36 };
  const sx = fromRect.left + (fromRect.width || 0) / 2;
  const sy = fromRect.top + (fromRect.height || 0) / 2;
  const tx = toRect.left + (toRect.width || 0) / 2;
  const ty = toRect.top + (toRect.height || 0) / 2;
  const sign = amount > 0 ? 'plus' : 'minus';

  // Gather point: midway between from and to, offset horizontally by index so icons line up
  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;
  const spacing = 56;
  const gatherX = midX + (index - (total - 1) / 2) * spacing;
  const gatherY = midY;

  const el = document.createElement('div');
  el.className = `flying sign-${sign}`;
  el.innerHTML = `<img class="fly-icon" src="${RES[key].icon}"><div class="fly-label">${amount > 0 ? '+' : ''}${amount}</div>`;
  el.style.left = sx + 'px'; el.style.top = sy + 'px'; el.style.transform = 'translate(-50%, -50%)';
  elFlightLayer.appendChild(el);

  const D1 = 550;    // from → gather
  const PAUSE = 650; // hold at gather
  const D2 = 700;    // gather → to
  const start = performance.now();
  // Slight stagger so icons don't all start exactly simultaneously
  const stagger = index * 40;

  const ctrlMid1X = (sx + gatherX) / 2 + (Math.random() * 30 - 15);
  const ctrlMid1Y = Math.min(sy, gatherY) - 40;
  const ctrlMid2X = (gatherX + tx) / 2 + (Math.random() * 30 - 15);
  const ctrlMid2Y = Math.min(gatherY, ty) - 50;

  function bezier(t, a, c, b) {
    return (1 - t) ** 2 * a + 2 * (1 - t) * t * c + t * t * b;
  }

  function step(now) {
    const elapsed = now - start - stagger;
    if (elapsed < 0) { requestAnimationFrame(step); return; }

    let px, py, scale = 1, opacity = 1;
    if (elapsed < D1) {
      const t = elapsed / D1;
      const e = 1 - Math.pow(1 - t, 3);
      px = bezier(e, sx, ctrlMid1X, gatherX);
      py = bezier(e, sy, ctrlMid1Y, gatherY);
      scale = 0.8 + e * 0.4;
    } else if (elapsed < D1 + PAUSE) {
      // Pause: gentle bob
      const t = (elapsed - D1) / PAUSE;
      px = gatherX;
      py = gatherY + Math.sin(t * Math.PI * 2) * 3;
      scale = 1.2;
    } else if (elapsed < D1 + PAUSE + D2) {
      const t = (elapsed - D1 - PAUSE) / D2;
      const e = t * t * (3 - 2 * t); // smoothstep
      px = bezier(e, gatherX, ctrlMid2X, tx);
      py = bezier(e, gatherY, ctrlMid2Y, ty);
      scale = 1.2 - e * 0.6;
      if (t > 0.85) opacity = (1 - t) / 0.15;
    } else {
      el.remove();
      return;
    }
    el.style.left = px + 'px';
    el.style.top = py + 'px';
    el.style.transform = `translate(-50%, -50%) scale(${scale})`;
    el.style.opacity = opacity;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function flashSlot(key, sign) {
  const s = $('res-' + key); if (!s) return;
  s.classList.remove('flash-plus', 'flash-minus');
  void s.offsetWidth;
  s.classList.add('flash-' + sign);
}

function showBubble(x, y, text, tone = 'good') {
  const b = document.createElement('div');
  b.className = `bubble bubble-${tone}`;
  b.textContent = text;
  b.style.left = (x * TILE + TILE / 2) + 'px';
  b.style.top = (y * TILE) + 'px';
  elMapLayers.appendChild(b);
  setTimeout(() => b.remove(), 1500);
}

function puff(x, y, sym = '✨') {
  const p = document.createElement('div');
  p.className = 'cloud-puff';
  p.textContent = sym;
  p.style.left = (x * TILE + TILE / 2) + 'px';
  p.style.top = (y * TILE + TILE / 2) + 'px';
  elMapLayers.appendChild(p);
  setTimeout(() => p.remove(), 900);
}

function toast(kind, title, body) {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = `<strong>${title}</strong><span>${body}</span>`;
  elToastWrap.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 320); }, 3200);
}

// ═══════════════════════════════════════════════════════════════
// GAME OVER
// ═══════════════════════════════════════════════════════════════

function gameOver(cause) {
  state.kingAlive = false;
  elGameOver.hidden = false;
  elGameOver.innerHTML = `
    <div class="gameover">
      <h1>💀 Le Roi est Mort</h1>
      <h2>${cause}</h2>
      <div class="go-stats">
        <div class="go-stat"><span>Durée du règne</span><b>${state.kingAge - 25} ans (An ${currentYear()})</b></div>
        <div class="go-stat"><span>Population finale</span><b>${state.population}</b></div>
        <div class="go-stat"><span>Expéditions menées</span><b>${state.expsCompleted}</b></div>
        <div class="go-stat"><span>Unités perdues</span><b>${state.unitsLost}</b></div>
        <div class="go-stat"><span>Bâtiments construits</span><b>${state.buildings.length}</b></div>
      </div>
      <button class="btn btn-primary" id="go-restart">Nouveau règne</button>
    </div>`;
  $('go-restart').onclick = () => location.reload();
}

// ═══════════════════════════════════════════════════════════════
// ESC key
// ═══════════════════════════════════════════════════════════════

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.placingBuilding) cancelPlacement();
    else if (state.panelOpen) closeExpeditionPanel();
  }
});

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

function renderAll() {
  renderTopBar();
  renderMap();
  renderSelection();
  renderTimeline();
  renderJournal();
  renderBuildPanel();
  renderMinimap();
  renderZoneInfo();
  if (typeof renderCourt === 'function') renderCourt();
}

// ═══════════════════════════════════════════════════════════════
// MINIMAP
// ═══════════════════════════════════════════════════════════════

const CELL_COLORS = {
  grass:     '#C9B07A',
  wheat:     '#E8C860',
  forest:    '#4A6B3E',
  quarry:    '#7A6450',
  water:     '#4A7AA8',
  gold:      '#D4A820',
  monster:   '#6B2A2A',
  ruins:     '#5A4838',
  mountain:  '#4A4540',
  corrupted: '#5A2E6E',
  castle:    '#A82828',
};

function renderMinimap() {
  const cv = elMinimap;
  const ctx = cv.getContext('2d');
  const size = cv.width; // match height
  const cell = size / MAP_SIZE;
  ctx.clearRect(0, 0, size, size);
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const c = state.map[y][x];
      ctx.fillStyle = CELL_COLORS[c.type] || CELL_COLORS.grass;
      ctx.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  // Influence halo
  ctx.fillStyle = 'rgba(228,195,116,0.18)';
  ctx.beginPath();
  ctx.arc((CASTLE_CENTER.x + 0.5) * cell, (CASTLE_CENTER.y + 0.5) * cell, INFLUENCE_RADIUS * cell, 0, Math.PI * 2);
  ctx.fill();
  // Buildings
  for (const b of state.buildings) {
    ctx.fillStyle = '#6B4423';
    ctx.fillRect(b.x * cell, b.y * cell, Math.ceil(cell), Math.ceil(cell));
  }
  // Selection (in-drag, committed, or expedition target)
  const sel = state.selection || state.commitedSelection || (state.expedition && state.expedition.sel);
  if (sel) {
    const x1 = Math.min(sel.x1, sel.x2), x2 = Math.max(sel.x1, sel.x2);
    const y1 = Math.min(sel.y1, sel.y2), y2 = Math.max(sel.y1, sel.y2);
    ctx.strokeStyle = '#C9A649';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x1 * cell, y1 * cell, (x2 - x1 + 1) * cell, (y2 - y1 + 1) * cell);
    ctx.fillStyle = 'rgba(228,195,116,0.25)';
    ctx.fillRect(x1 * cell, y1 * cell, (x2 - x1 + 1) * cell, (y2 - y1 + 1) * cell);
  }
  updateMinimapViewport();
}

function updateMinimapViewport() {
  if (!elMinimapWrap || !elMinimapVp) return;
  const wrapRect = elMinimapWrap.getBoundingClientRect();
  if (wrapRect.width === 0) return;
  const worldSize = MAP_SIZE * TILE * zoom;
  const scaleX = wrapRect.width / worldSize;
  const scaleY = wrapRect.height / worldSize;
  const vw = elMapScroller.clientWidth * scaleX;
  const vh = elMapScroller.clientHeight * scaleY;
  const vx = elMapScroller.scrollLeft * scaleX;
  const vy = elMapScroller.scrollTop * scaleY;
  elMinimapVp.style.left = vx + 'px';
  elMinimapVp.style.top = vy + 'px';
  elMinimapVp.style.width = Math.min(wrapRect.width, vw) + 'px';
  elMinimapVp.style.height = Math.min(wrapRect.height, vh) + 'px';
}

// Minimap : click = smooth scroll to point, drag = instant follow
(function() {
  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0;
  const DRAG_THRESHOLD = 4;

  const targetFromEvent = (e) => {
    const rect = elMinimapWrap.getBoundingClientRect();
    const cx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const cy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const worldSize = MAP_SIZE * TILE * zoom;
    return {
      x: cx * worldSize - elMapScroller.clientWidth / 2,
      y: cy * worldSize - elMapScroller.clientHeight / 2,
    };
  };
  const panInstant = (e) => {
    const t = targetFromEvent(e);
    elMapScroller.scrollLeft = t.x;
    elMapScroller.scrollTop = t.y;
    clampScroll();
    updateMinimapViewport();
  };
  elMinimapWrap.addEventListener('mousedown', (e) => {
    dragging = true;
    moved = false;
    startX = e.clientX; startY = e.clientY;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    if (!moved) {
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (dx*dx + dy*dy < DRAG_THRESHOLD*DRAG_THRESHOLD) return;
      moved = true;
    }
    panInstant(e);
  });
  window.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    if (!moved) {
      const t = targetFromEvent(e);
      elMapScroller.scrollTo({ left: t.x, top: t.y, behavior: 'smooth' });
      setTimeout(updateMinimapViewport, 50);
    }
  });
})();

// Wheel zoom on main map (interpolated for smoothness)
let targetZoom = 1;
let zoomAnchor = null; // { wx, wy, sx, sy }
let zoomRaf = null;
function zoomInterp() {
  const diff = targetZoom - zoom;
  if (Math.abs(diff) < 0.002) {
    zoom = targetZoom;
    zoomRaf = null;
  } else {
    zoom = zoom + diff * 0.22;
  }
  applyZoom();
  if (zoomAnchor) {
    elMapScroller.scrollLeft = zoomAnchor.wx * zoom - zoomAnchor.sx;
    elMapScroller.scrollTop  = zoomAnchor.wy * zoom - zoomAnchor.sy;
    clampScroll();
    updateMinimapViewport();
  }
  if (zoomRaf !== null) zoomRaf = requestAnimationFrame(zoomInterp);
}
elMapScroller.addEventListener('wheel', (e) => {
  e.preventDefault();
  // While the expedition panel is open, route wheel to civils/fighters instead
  // of zooming — this catches wheels on selection handles, the move-grip, and
  // anywhere else inside the map that isn't the assignment overlay.
  if (state.panelOpen && state.settings.wheelChangesPop && panelState && panelCtx) {
    const dir = e.deltaY > 0 ? -1 : 1;
    if (e.shiftKey) panelBumpFighters(dir);
    else panelBumpCivils(dir);
    panelClamp();
    refreshExpeditionPanel();
    return;
  }
  const rect = elMapScroller.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const wx = (elMapScroller.scrollLeft + sx) / zoom;
  const wy = (elMapScroller.scrollTop + sy) / zoom;
  zoomAnchor = { wx, wy, sx, sy };
  const factor = Math.pow(1.0015, -e.deltaY);
  targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, targetZoom * factor));
  if (zoomRaf === null) zoomRaf = requestAnimationFrame(zoomInterp);
}, { passive: false });

// Wheel zoom on minimap — same smooth interp, but world-anchored at the minimap
// cursor and targeting the main viewport's center.
elMinimapWrap.addEventListener('wheel', (e) => {
  e.preventDefault();
  const sx = elMapScroller.clientWidth / 2;
  const sy = elMapScroller.clientHeight / 2;
  let wx, wy;
  if (state.settings.zoomFollowsCursor) {
    // Anchor at the world point under the cursor (on the minimap)
    const wrapRect = elMinimapWrap.getBoundingClientRect();
    const mx = e.clientX - wrapRect.left;
    const my = e.clientY - wrapRect.top;
    const worldPx = MAP_SIZE * TILE;
    wx = (mx / wrapRect.width) * worldPx;
    wy = (my / wrapRect.height) * worldPx;
  } else {
    // Keep the current main viewport center in place
    wx = (elMapScroller.scrollLeft + sx) / zoom;
    wy = (elMapScroller.scrollTop + sy) / zoom;
  }
  zoomAnchor = { wx, wy, sx, sy };
  const factor = Math.pow(1.0015, -e.deltaY);
  targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, targetZoom * factor));
  if (zoomRaf === null) zoomRaf = requestAnimationFrame(zoomInterp);
}, { passive: false });

elMapScroller.addEventListener('scroll', updateMinimapViewport);
window.addEventListener('resize', updateMinimapViewport);

// ═══════════════════════════════════════════════════════════════
// ZONE INFO (sidebar top, when selection active)
// ═══════════════════════════════════════════════════════════════

function renderZoneInfo() {
  const sel = state.selection || state.commitedSelection;
  if (!sel) {
    // show minimap mode
    elMinimapWrap.hidden = false;
    elZoneInfo.hidden = true;
    elSbTopTitle.textContent = '🗺️ Carte';
    elSbTopSub.textContent = 'Aperçu du royaume';
    return;
  }
  const x1 = Math.min(sel.x1, sel.x2), x2 = Math.max(sel.x1, sel.x2);
  const y1 = Math.min(sel.y1, sel.y2), y2 = Math.max(sel.y1, sel.y2);
  const w = x2 - x1 + 1, h = y2 - y1 + 1;

  // Tally
  const tally = {};
  const resMax = { wheat: 0, water: 0, wood: 0, stone: 0, gold: 0 };
  let danger = 0, ruins = 0, blocking = 0;
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      const c = cellAt(x, y); if (!c) continue;
      tally[c.type] = (tally[c.type] || 0) + 1;
      const info = CELL_INFO[c.type];
      if (info && info.res && info.amount && (c.harvested || 0) < 5) resMax[info.res] += info.amount[1];
      if (c.type === CASE.MONSTER || c.type === CASE.CORRUPTED) danger++;
      if (c.type === CASE.RUINS) ruins++;
      if (c.type === CASE.MOUNTAIN || c.type === CASE.CASTLE) blocking++;
    }
  }
  const dist = zoneDistance(sel);

  const chips = RES_ORDER.filter(k => resMax[k] > 0).map(k =>
    `<span class="zi-res-chip"><img src="${RES[k].icon}">~${resMax[k]}</span>`
  ).join('');

  const tags = [];
  if (danger)   tags.push(`<span class="zi-tag danger">⚠️ <b>${danger}</b> hostile${danger>1?'s':''}</span>`);
  if (ruins)    tags.push(`<span class="zi-tag">🏺 <b>${ruins}</b> ruine${ruins>1?'s':''}</span>`);
  if (blocking) tags.push(`<span class="zi-tag">🗻 <b>${blocking}</b> bloquée${blocking>1?'s':''}</span>`);

  elMinimapWrap.hidden = true;
  elZoneInfo.hidden = false;
  elSbTopTitle.textContent = state.commitedSelection ? '📍 Zone sélectionnée' : '✏️ Zone en cours';
  elSbTopSub.textContent = state.commitedSelection ? 'Clic en dehors pour annuler' : 'Relâcher pour valider';

  elZoneInfo.innerHTML = `
    <div class="zi-head">
      <span>${w} × ${h} cases</span>
      <span class="zi-dim">dist ${dist.toFixed(1)}</span>
    </div>
    <div class="zi-body">
      <div class="zi-subhead">Récolte estimée</div>
      <div class="zi-res">${chips || '<span style="font-size:12px;color:var(--ink-3)">Aucune ressource</span>'}</div>
      ${tags.length ? `<div class="zi-subhead" style="margin-top:4px;">Particularités</div><div class="zi-tags">${tags.join('')}</div>` : ''}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS MENU
// ═══════════════════════════════════════════════════════════════

function showMapHint(msg) {
  elMapHint.textContent = msg;
  elMapHint.classList.add('show');
  clearTimeout(elMapHint._t);
  elMapHint._t = setTimeout(() => elMapHint.classList.remove('show'), 1800);
}

function applySettingsToUI() {
  elOptDeselect.checked = !!state.settings.deselectOutside;
  elOptMouseSwap.checked = state.mouseMode === 'swapped';
  elOptShowGrid.checked = !!state.settings.showGrid;
  elMapGrid.classList.toggle('hidden', !state.settings.showGrid);
  elOptZoomCursor.checked = !!state.settings.zoomFollowsCursor;
  elOptWheelPop.checked = !!state.settings.wheelChangesPop;
}

function toggleSettingsMenu(force) {
  const willOpen = force !== undefined ? force : elSettingsMenu.hasAttribute('hidden');
  if (willOpen) {
    elSettingsMenu.removeAttribute('hidden');
    elSettingsBtn.classList.add('open');
  } else {
    elSettingsMenu.setAttribute('hidden', '');
    elSettingsBtn.classList.remove('open');
  }
}

elSettingsBtn.addEventListener('mousedown', (e) => e.stopPropagation());
elSettingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSettingsMenu();
});
elSettingsMenu.addEventListener('mousedown', (e) => e.stopPropagation());
elSettingsMenu.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('mousedown', (e) => {
  if (!elSettingsMenu.hasAttribute('hidden')) toggleSettingsMenu(false);
});

elOptDeselect.addEventListener('change', () => {
  state.settings.deselectOutside = elOptDeselect.checked;
});
elOptMouseSwap.addEventListener('change', () => {
  state.mouseMode = elOptMouseSwap.checked ? 'swapped' : 'default';
  const msg = state.mouseMode === 'swapped'
    ? 'Clic G = Sélection · Clic D = Déplacement'
    : 'Clic G = Déplacement · Clic D = Sélection';
  showMapHint(msg);
});
elOptShowGrid.addEventListener('change', () => {
  state.settings.showGrid = elOptShowGrid.checked;
  elMapGrid.classList.toggle('hidden', !state.settings.showGrid);
});
elOptZoomCursor.addEventListener('change', () => {
  state.settings.zoomFollowsCursor = elOptZoomCursor.checked;
});
elOptWheelPop.addEventListener('change', () => {
  state.settings.wheelChangesPop = elOptWheelPop.checked;
});

// ═══════════════════════════════════════════════════════════════
// DEBUG PANEL — expedition cost tuning
// ═══════════════════════════════════════════════════════════════

function refreshExpeditionPanelIfOpen() {
  if (state.panelOpen && state.commitedSelection) {
    openExpeditionPanel();
  }
}

function newCostRuleId() {
  return 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
}

function renderDebugPanel() {
  if (!state.costRules.length) {
    elDebugRows.innerHTML = '<div class="debug-empty">Aucune règle. Les coûts seront au minimum (1/1/0).</div>';
    return;
  }
  const resOptions = COST_RESOURCES.map(r => `<option value="${r}">${RES[r].label}</option>`).join('');
  const factorOptions = COST_FACTORS.map(f => `<option value="${f.key}">${f.label}</option>`).join('');
  elDebugRows.innerHTML = state.costRules.map(rule => `
    <div class="debug-row" data-id="${rule.id}">
      <div class="debug-row-main">
        <select data-field="resource">
          ${COST_RESOURCES.map(r => `<option value="${r}" ${r === rule.resource ? 'selected' : ''}>${RES[r].label}</option>`).join('')}
        </select>
        <input type="number" data-field="amount" value="${rule.amount}" step="0.1">
        <select data-field="factor">
          ${COST_FACTORS.map(f => `<option value="${f.key}" ${f.key === rule.factor ? 'selected' : ''}>× ${f.label}</option>`).join('')}
        </select>
        <label class="debug-row-permonth" title="Multiplier par la durée en mois">
          <input type="checkbox" data-field="perMonth" ${rule.perMonth ? 'checked' : ''}>× mois
        </label>
        <button class="debug-row-del" data-action="delete" title="Supprimer">🗑</button>
      </div>
      <div class="debug-row-penalty">
        <span class="debug-row-penalty-label">Si absent :</span>
        <select data-field="penaltyType">
          ${PENALTY_TYPES.map(p => `<option value="${p.key}" ${p.key === rule.penaltyType ? 'selected' : ''}>${p.label}</option>`).join('')}
        </select>
        <input type="number" data-field="penaltyAmount" value="${rule.penaltyAmount}" step="1" min="0" ${rule.penaltyType === 'none' ? 'disabled' : ''}>
        <select data-field="penaltySub" ${rule.penaltyType === 'substitute' ? '' : 'disabled'}>
          ${COST_SUBSTITUTE_RESOURCES.map(r => `<option value="${r}" ${r === rule.penaltySub ? 'selected' : ''}>${RES[r].label}</option>`).join('')}
        </select>
      </div>
    </div>
  `).join('');
}

function updateCostRule(id, field, rawValue) {
  const rule = state.costRules.find(r => r.id === id);
  if (!rule) return;
  let needsRerender = false;
  if (field === 'amount') {
    const n = parseFloat(rawValue);
    rule.amount = Number.isFinite(n) ? n : 0;
  } else if (field === 'perMonth') {
    rule.perMonth = !!rawValue;
  } else if (field === 'resource' && COST_RESOURCES.includes(rawValue)) {
    rule.resource = rawValue;
  } else if (field === 'factor' && COST_FACTORS.some(f => f.key === rawValue)) {
    rule.factor = rawValue;
  } else if (field === 'penaltyType' && PENALTY_TYPES.some(p => p.key === rawValue)) {
    rule.penaltyType = rawValue;
    needsRerender = true; // disabled state of amount/sub fields depends on it
  } else if (field === 'penaltyAmount') {
    const n = parseFloat(rawValue);
    rule.penaltyAmount = Number.isFinite(n) && n >= 0 ? n : 0;
  } else if (field === 'penaltySub' && COST_SUBSTITUTE_RESOURCES.includes(rawValue)) {
    rule.penaltySub = rawValue;
  }
  saveCostRules();
  if (needsRerender) renderDebugPanel();
  refreshExpeditionPanelIfOpen();
}

function addCostRule() {
  state.costRules.push({
    id: newCostRuleId(),
    resource: 'wheat',
    amount: 1,
    factor: 'flat',
    perMonth: false,
    penaltyType: 'none',
    penaltyAmount: 0,
    penaltySub: 'gold',
  });
  saveCostRules();
  renderDebugPanel();
  refreshExpeditionPanelIfOpen();
}

function removeCostRule(id) {
  state.costRules = state.costRules.filter(r => r.id !== id);
  saveCostRules();
  renderDebugPanel();
  refreshExpeditionPanelIfOpen();
}

function resetCostRules() {
  state.costRules = DEFAULT_COST_RULES.map(r => ({ ...r }));
  try { localStorage.removeItem(COST_RULES_STORAGE_KEY); } catch (_) {}
  renderDebugPanel();
  refreshExpeditionPanelIfOpen();
}

function toggleDebugPanel(force) {
  const willOpen = force !== undefined ? force : elDebugPanel.hasAttribute('hidden');
  if (willOpen) {
    renderDebugPanel();
    elDebugPanel.removeAttribute('hidden');
    elDebugBtn.classList.add('open');
  } else {
    elDebugPanel.setAttribute('hidden', '');
    elDebugBtn.classList.remove('open');
  }
}

elDebugBtn.addEventListener('mousedown', (e) => e.stopPropagation());
elDebugBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDebugPanel();
});
elDebugPanel.addEventListener('mousedown', (e) => e.stopPropagation());
elDebugPanel.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('mousedown', (e) => {
  if (!elDebugPanel.hasAttribute('hidden')) toggleDebugPanel(false);
});

elDebugRows.addEventListener('change', (e) => {
  const row = e.target.closest('.debug-row');
  if (!row) return;
  const id = row.dataset.id;
  const field = e.target.dataset.field;
  if (!field) return;
  const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  updateCostRule(id, field, value);
});
elDebugRows.addEventListener('input', (e) => {
  if (e.target.dataset.field !== 'amount') return;
  const row = e.target.closest('.debug-row');
  if (!row) return;
  updateCostRule(row.dataset.id, 'amount', e.target.value);
});
elDebugRows.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="delete"]');
  if (!btn) return;
  const row = btn.closest('.debug-row');
  if (row) removeCostRule(row.dataset.id);
});
elDebugAdd.addEventListener('click', addCostRule);
elDebugReset.addEventListener('click', resetCostRules);
elDebugClose.addEventListener('click', () => toggleDebugPanel(false));

// ═══════════════════════════════════════════════════════════════
// BUILD PANEL — header click collapses, grip resizes
// ═══════════════════════════════════════════════════════════════

(function wireBuildHead() {
  const pB = $('panel-build');
  let drag = null;
  let suppressNextClick = false;

  elBuildHeadGrip.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pB.classList.contains('collapsed')) return;
    const pJ = $('panel-journal');
    drag = {
      startY: e.clientY,
      hJ: pJ.getBoundingClientRect().height,
      hB: pB.getBoundingClientRect().height,
      // Cap at the natural content height (stable now that the feedback loop
      // is fixed) — user can shrink and re-grow back up to that.
      maxB: buildPanelNaturalHeight(),
      moved: false,
    };
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dy) > 2) drag.moved = true;
    const total = drag.hJ + drag.hB;
    const nB = Math.max(80, Math.min(drag.maxB, drag.hB - dy));
    const nJ = total - nB;
    pB.dataset.userSized = '1';
    $('panel-journal').style.flex = `${nJ} 0 0px`;
    pB.style.flex = `0 0 ${nB}px`;
  });
  window.addEventListener('mouseup', (e) => {
    const wasDrag = drag && drag.moved;
    drag = null;
    // Only swallow the *immediate* click that fires after a real drag,
    // and only if that click would land on the build-head (i.e. mouseup
    // ended over it). Clear the flag shortly after so it can't poison a
    // later, unrelated click.
    if (wasDrag && elBuildHead.contains(e.target)) {
      suppressNextClick = true;
      setTimeout(() => { suppressNextClick = false; }, 50);
    }
  });

  elBuildHead.addEventListener('click', () => {
    if (suppressNextClick) { suppressNextClick = false; return; }
    pB.classList.toggle('collapsed');
  });
})();

// Middle-click shortcut: launch the current expedition when the panel is open.
// preventDefault on mousedown suppresses the browser autoscroll cursor; auxclick
// fires the launch.
document.addEventListener('mousedown', (e) => {
  if (e.button !== 1) return;
  if (!state.panelOpen) return;
  e.preventDefault();
});
document.addEventListener('auxclick', (e) => {
  if (e.button !== 1) return;
  if (!state.panelOpen) return;
  const btn = document.getElementById('btn-launch');
  if (btn && !btn.disabled) btn.click();
});

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

function centerOnCastle() {
  requestAnimationFrame(() => {
    const cx = (CASTLE_CENTER.x * TILE + TILE / 2) * zoom;
    const cy = (CASTLE_CENTER.y * TILE + TILE / 2) * zoom;
    elMapScroller.scrollLeft = cx - elMapScroller.clientWidth / 2;
    elMapScroller.scrollTop = cy - elMapScroller.clientHeight / 2;
    clampScroll();
    updateMinimapViewport();
  });
}

function animateCamera(goalZoom, targetScrollX, targetScrollY, duration = 700) {
  goalZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, goalZoom));
  const startZoom = zoom;
  const startSL = elMapScroller.scrollLeft;
  const startST = elMapScroller.scrollTop;
  const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / duration);
    const ease = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2)/2;
    zoom = startZoom + (goalZoom - startZoom) * ease;
    applyZoom();
    elMapScroller.scrollLeft = startSL + (targetScrollX - startSL) * ease;
    elMapScroller.scrollTop  = startST + (targetScrollY - startST) * ease;
    clampScroll();
    updateMinimapViewport();
    if (p < 1) requestAnimationFrame(step);
    else { targetZoom = goalZoom; }
  }
  requestAnimationFrame(step);
}

function focusOnExpedition(sel) {
  const minX = Math.min(CASTLE.x, sel.x1);
  const maxX = Math.max(CASTLE.x + 2, sel.x2);
  const minY = Math.min(CASTLE.y, sel.y1);
  const maxY = Math.max(CASTLE.y + 2, sel.y2);
  const bx = minX * TILE;
  const by = minY * TILE;
  const bw = (maxX - minX + 1) * TILE;
  const bh = (maxY - minY + 1) * TILE;
  const padding = 100;
  const vw = Math.max(100, elMapScroller.clientWidth - padding * 2);
  const vh = Math.max(100, elMapScroller.clientHeight - padding * 2);
  const targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(vw / bw, vh / bh)));
  const cx = (bx + bw/2) * targetZoom;
  const cy = (by + bh/2) * targetZoom;
  animateCamera(targetZoom, cx - elMapScroller.clientWidth/2, cy - elMapScroller.clientHeight/2, 700);
}

// ═══════════════════════════════════════════════════════════════
// COUR ROYALE — unit catalog, data model, rendering, drag & drop
// ═══════════════════════════════════════════════════════════════
//
// Data model (on state.court):
//   conseil : Array(rows*cols) of unit|null — row-major, reading order.
//   cour    : Array(courSize)  of unit|null — bench.
// A unit is { uid, defId, name, stars, injured }.
// Archetypes (worker/soldier/explorer) determine who substitutes whom when
// an expedition requisitions population. Reading order: left→right, top→bottom
// across conseil only (bench units do NOT deploy).

const COURT_RARITIES = {
  common:    { label: 'Commun',    cls: 'common' },
  rare:      { label: 'Rare',      cls: 'rare' },
  legendary: { label: 'Légendaire', cls: 'legendary' },
};

const COURT_ROLE_LABEL = {
  active:  'Actif (en expé)',
  soutien: 'Soutien (au château)',
  hybride: 'Hybride',
};

const COURT_ARCHETYPE_LABEL = {
  worker:   'ouvrier',
  soldier:  'soldat',
  explorer: 'éclaireur',
};

const COURT_FRAGILITY_LABEL = {
  fragile: 'fragile',
  robust:  'robuste',
  durable: 'durable',
};

// Unit catalog. Effects carry descriptive text for the UI; gameplay wiring
// happens in Phase 3 (section EFFECTS).
const COURT_UNITS = {
  // Starter (not in any pool) — la Mère du Roi, founding member.
  // Cannot be banished, cannot be demoted to Le Peuple. Disappears only on
  // natural death (mid-life event).
  mother_of_king: {
    id: 'mother_of_king', name: 'Mère du Roi', glyph: '👑',
    archetype: 'worker', role: 'soutien',
    rarity: 'legendary', fragility: 'durable', maxStars: 3, pool: null,
    founder: true,
    effect: {
      title: 'Maisonnée royale',
      short: '+N habitants protégés (★★★) — ne meurent jamais. ★+1 par expé sans perte, retour à 1★ à toute mort.',
      long: 'Filet de sécurité dynamique : prospère quand le royaume prospère, vacille quand il saigne.',
    },
  },
  // [v2 legacy — kept for save back-compat but no longer seeded]
  family_member: {
    id: 'family_member', name: 'Membre de Famille', glyph: '🏡',
    archetype: 'worker', role: 'soutien',
    rarity: 'common', fragility: 'robust', maxStars: 3, pool: null,
    effect: {
      title: 'Lien du sang',
      short: 'Les 2 premiers ouvriers en expédition sont gratuits en nourriture.',
      long: 'Filet de sécurité permanent — même à court de ressources, un départ reste possible.',
    },
  },

  // ── Pool INTENDANCE (source: Ferme, Grenier) ─────────────
  cuisinier: {
    id: 'cuisinier', name: 'Cuisinier', glyph: '🍲',
    archetype: 'worker', role: 'soutien',
    rarity: 'common', fragility: 'fragile', maxStars: 3, pool: 'intendance',
    effect: { title: 'Bonne chère', short: 'Les 2 premiers ouvriers en expé coûtent 0 nourriture.', long: '+1 ouvrier gratuit par étoile (max 4 à 3★).' },
  },
  brasseur: {
    id: 'brasseur', name: 'Brasseur', glyph: '🍺',
    archetype: 'worker', role: 'soutien',
    rarity: 'common', fragility: 'fragile', maxStars: 3, pool: 'intendance',
    effect: { title: 'Hydromel', short: '-1 stress du roi par saison.', long: '' },
  },
  intendant: {
    id: 'intendant', name: 'Intendant', glyph: '📜',
    archetype: 'worker', role: 'hybride',
    rarity: 'rare', fragility: 'robust', maxStars: 3, pool: 'intendance',
    effect: { title: 'Gestion avisée', short: 'Soutien : -20% coûts saisonniers. Actif : révèle 2 cases avant départ.', long: '' },
  },
  maitre_queux: {
    id: 'maitre_queux', name: 'Maître Queux', glyph: '👨‍🍳',
    archetype: 'worker', role: 'soutien',
    rarity: 'legendary', fragility: 'durable', maxStars: 5, pool: 'intendance',
    effect: { title: 'Festin royal', short: '-50% coûts nourriture des expés. Débloque l\'événement Festin (-10 stress).', long: '' },
  },

  // ── Pool MILITAIRE (source: Caserne) ─────────────────────
  veteran: {
    id: 'veteran', name: 'Vétéran', glyph: '⚔️',
    archetype: 'soldier', role: 'active',
    rarity: 'common', fragility: 'fragile', maxStars: 3, pool: 'militaire',
    effect: { title: 'Bras armé', short: '+1 force de combat. À 3★, +1 force pour tous les soldats de l\'expé.', long: '' },
  },
  sergent: {
    id: 'sergent', name: 'Sergent', glyph: '🛡️',
    archetype: 'soldier', role: 'active',
    rarity: 'rare', fragility: 'robust', maxStars: 3, pool: 'militaire',
    effect: { title: 'Discipline', short: '-30% pertes en combat.', long: '' },
  },
  capitaine: {
    id: 'capitaine', name: 'Capitaine', glyph: '🎖️',
    archetype: 'soldier', role: 'hybride',
    rarity: 'rare', fragility: 'robust', maxStars: 3, pool: 'militaire',
    effect: { title: 'Commandement', short: 'Soutien : +1 défense du château. Actif : +15% chances de victoire en combat.', long: '' },
  },
  general: {
    id: 'general', name: 'Général', glyph: '⚜️',
    archetype: 'soldier', role: 'active',
    rarity: 'legendary', fragility: 'durable', maxStars: 5, pool: 'militaire',
    effect: { title: 'Aura de commandement', short: '-20% pertes, +15% récoltes. Amplifié par les soldats en cour.', long: '' },
  },

  // ── Pool EXPLORATION (source: Scierie, prov. en attendant l\'Écurie) ──
  eclaireur: {
    id: 'eclaireur', name: 'Éclaireur', glyph: '🏹',
    archetype: 'explorer', role: 'active',
    rarity: 'common', fragility: 'fragile', maxStars: 3, pool: 'exploration',
    effect: { title: 'Œil vif', short: 'Révèle 1 case de la zone avant départ. +1 par étoile.', long: '' },
  },
  traqueur: {
    id: 'traqueur', name: 'Traqueur', glyph: '🐺',
    archetype: 'explorer', role: 'active',
    rarity: 'rare', fragility: 'robust', maxStars: 3, pool: 'exploration',
    effect: { title: 'Sentier dérobé', short: 'Débloque l\'événement Raccourci (-1 mois de durée d\'expé).', long: '' },
  },
  chasseur: {
    id: 'chasseur', name: 'Chasseur', glyph: '🦌',
    archetype: 'explorer', role: 'hybride',
    rarity: 'rare', fragility: 'robust', maxStars: 3, pool: 'exploration',
    effect: { title: 'Gibier', short: 'Soutien : +1 nourriture/saison. Actif : +1 nourriture par case de ressource naturelle.', long: '' },
  },
  explorateur: {
    id: 'explorateur', name: 'Explorateur', glyph: '🧭',
    archetype: 'explorer', role: 'active',
    rarity: 'legendary', fragility: 'durable', maxStars: 5, pool: 'exploration',
    effect: { title: 'Cartographie', short: 'Révèle la zone entière avant départ. Débloque les événements Trouvaille rare.', long: '' },
  },
};

const COURT_POOL_LABEL = {
  intendance:  'Intendance',
  militaire:   'Militaire',
  exploration: 'Exploration',
};

// Procedural names — pool of medieval-flavored first names paired with an
// archetype-specific epithet.
const COURT_FIRST_NAMES = [
  'Aloïs','Jehan','Renaud','Thibault','Garin','Hugues','Perceval','Godefroy',
  'Baudouin','Arnaud','Gauvain','Tristan','Lancelot','Guilhem','Foulques','Raoul',
  'Enguerrand','Aubry','Bertrand','Simon','Geoffroy','Amaury','Ysoré','Girart',
  'Alienor','Eléonore','Bérengère','Gersande','Adélaïde','Constance','Mahaut','Yseult',
  'Iseut','Blanche','Hersende','Clémence','Isabeau','Jehanne','Emeline','Marguerite',
  'Perrette','Agnès','Brunehaut','Radegonde','Sibylle','Aude','Mélisande','Oriane',
];
const COURT_EPITHETS = {
  worker: [
    'le Fidèle','la Patiente','le Frugal','la Travailleuse','le Bon Pain',
    'la Diligente','le Sage','la Prévoyante','le Besogneux','la Feuillue',
    'le Manchot','la Ménagère','le Laborieux','la Constante',
  ],
  soldier: [
    'le Vaillant','la Lame','le Rempart','la Flèche','le Bouclier',
    'le Hardi','la Sanglante','le Cruel','la Preuse','le Farouche',
    'le Fer','la Tranchante','le Loup','la Lionne','le Fidèle de la Garde',
  ],
  explorer: [
    'l\'Errant','la Pisteuse','le Voyageur','la Veilleuse','le Nomade',
    'le Sans-Toit','la Vagabonde','le Vent','la Fugace','le Pèlerin',
    'la Discrète','le Lointain','la Chercheuse','l\'Infatigable',
  ],
};

function courtRandomName(archetype) {
  const first = rPick(COURT_FIRST_NAMES);
  const ep = rPick(COURT_EPITHETS[archetype] || COURT_EPITHETS.worker);
  return `${first} ${ep}`;
}

function courtMakeUnit(defId, opts = {}) {
  const def = COURT_UNITS[defId];
  if (!def) return null;
  return {
    uid: state.court.nextUid++,
    defId,
    name: opts.name || courtRandomName(def.archetype),
    stars: 0,
    injured: false,
  };
}

function courtUnitDef(u) { return u && COURT_UNITS[u.defId]; }

// ── Slot addressing ────────────────────────────────────────────
// Addresses are { zone: 'conseil'|'cour'|'offer', idx: n }
function courtZoneArray(zone) {
  if (zone === 'cour')   return state.court.cour;
  if (zone === 'offer')  return state.court.offer;
  return state.court.conseil;
}
function courtGetAt(addr) {
  const arr = courtZoneArray(addr.zone);
  return arr[addr.idx] || null;
}
function courtSetAt(addr, unit) {
  const arr = courtZoneArray(addr.zone);
  arr[addr.idx] = unit;
}

// Find first empty slot, preferring conseil reading order, then bench.
function courtFirstEmptySlot() {
  for (let i = 0; i < state.court.conseil.length; i++) {
    if (!state.court.conseil[i]) return { zone: 'conseil', idx: i };
  }
  for (let i = 0; i < state.court.cour.length; i++) {
    if (!state.court.cour[i]) return { zone: 'cour', idx: i };
  }
  return null;
}

// Place a unit into a specific slot (or first empty if addr omitted).
// Returns the final address, or null if no space.
function courtPlaceUnit(unit, addr = null) {
  const target = addr || courtFirstEmptySlot();
  if (!target) return null;
  courtSetAt(target, unit);
  return target;
}

// v2 used to seed the Membre de Famille at game start. In v3 the starter is
// instead injected as a scripted free-hire encounter on the first completed
// expedition (see rollExpeditionEncounters). Kept as a no-op for back-compat
// with any save that flipped the starterGranted flag.
function courtGrantStarterIfNeeded() { /* noop in v3 */ }

// ── Encounters (v3) ────────────────────────────────────────────
// Unified arrival flow: every newcomer is an "encounter" — a fully-fledged
// unit (defId, name, effect) that the player can either welcome to the
// village (free, archetype-driven) or hire to the Conseil/Cour (paid in gold,
// rarity-driven). Refusal = close without acting.
//
// Source: zone content (hamlets visited bumps civic encounters, ruins bumps
// narrative encounters) plus scripted events (Membre de Famille on first
// expedition).

// v4 encounter rates. Every expedition rolls a base chance, boosted by
// hamlets/ruins visited in the zone AND by the kingdom's own Maisons (the
// king's reputation grows as the village expands). Special rare-boosting
// houses (Manoirs etc.) are TBD — placeholder hook below.
const ENCOUNTER_BASE_CHANCE = 0.30;
const ENCOUNTER_PER_HAMLET  = 0.25;
const ENCOUNTER_PER_RUINS   = 0.20;
const ENCOUNTER_PER_MAISON  = 0.10;   // each Maison built grows the kingdom's pull
const ENCOUNTER_MAX_PER_EXP = 5;

const HIRE_COST = { common: 3, rare: 10, legendary: 25 };
const COST_DISCOUNT_PER_BLDG = 0.20; // multiplicative; 0.80^N
const COST_DISCOUNT_FLOOR    = 0.50; // never cheaper than 50% of base

// Pool weighting depending on encounter source.
const ENC_POOL_WEIGHTS = {
  hamlet: { intendance: 50, exploration: 35, militaire: 15 },
  ruins:  { exploration: 50, militaire: 35, intendance: 15 },
};
const ENC_RARITY_WEIGHTS = {
  hamlet: { common: 70, rare: 25, legendary: 5 },
  ruins:  { common: 40, rare: 40, legendary: 20 },
};

function courtPickWeighted(items, weightFn) {
  if (!items.length) return null;
  const weights = items.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[0];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickFromTable(table) {
  const keys = Object.keys(table);
  return courtPickWeighted(keys, k => table[k]);
}

// Roll all encounters for a finished expedition. Returns array of unit objects.
function rollExpeditionEncounters(exp) {
  const out = [];

  const hamlets = exp.hamletsVisited || 0;
  const ruins   = exp.ruinsVisited   || 0;
  const maisons = state.buildings.filter(b => b.id === 'house').length;

  // Primary roll: how many encounters trigger. Always firing in any expé so
  // kingdom growth doesn't depend on hamlet/ruins luck.
  let chance = ENCOUNTER_BASE_CHANCE
             + ENCOUNTER_PER_HAMLET * hamlets
             + ENCOUNTER_PER_RUINS  * ruins
             + ENCOUNTER_PER_MAISON * maisons;
  while (out.length < ENCOUNTER_MAX_PER_EXP && rng() < chance) {
    // Pick the source weighted by what was visited. With no hamlets/ruins
    // visited, default to a "road" source (uses hamlet weights as fallback).
    const sourceWeights = { hamlet: 1 + 2 * hamlets, ruins: 0.3 + 2 * ruins };
    const source = pickFromTable(sourceWeights);
    const enc = makeEncounterFrom(source);
    if (enc) out.push(enc);
    // Each subsequent encounter is increasingly less likely (avoid spam).
    chance *= 0.45;
  }
  return out;
}

function makeEncounterFrom(source) {
  const poolKey = pickFromTable(ENC_POOL_WEIGHTS[source] || ENC_POOL_WEIGHTS.hamlet);
  const rarKey  = pickFromTable(ENC_RARITY_WEIGHTS[source] || ENC_RARITY_WEIGHTS.hamlet);
  let candidates = Object.values(COURT_UNITS).filter(u => u.pool === poolKey && u.rarity === rarKey);
  if (!candidates.length) {
    candidates = Object.values(COURT_UNITS).filter(u => u.pool === poolKey);
  }
  if (!candidates.length) return null;
  const picked = candidates[Math.floor(rng() * candidates.length)];
  const unit = courtMakeUnit(picked.id);
  if (unit) unit.encounterSource = source;
  return unit;
}

// Hire-cost calculation. Bâtiments matching the unit pool reduce the cost
// multiplicatively (0.80^N), floored at COST_DISCOUNT_FLOOR.
function encounterHireCost(unit) {
  if (unit.scriptedFreeHire) return 0;
  const def = courtUnitDef(unit);
  if (!def) return 0;
  const base = HIRE_COST[def.rarity] || HIRE_COST.common;
  const matchingBuildings = state.buildings.filter(b => {
    const bd = BUILDINGS.find(x => x.id === b.id);
    return bd && bd.pool && bd.pool === def.pool;
  }).length;
  const mult = Math.max(COST_DISCOUNT_FLOOR, Math.pow(1 - COST_DISCOUNT_PER_BLDG, matchingBuildings));
  return Math.max(0, Math.round(base * mult));
}

// True if the player has neither a free village slot for the encounter's
// archetype nor enough gold to hire it. Used to grey out cards.
function encounterForcedRefusal(unit) {
  if (unit.scriptedFreeHire) return false;
  const def = courtUnitDef(unit);
  if (!def) return true;
  const slotFree = (def.archetype === 'soldier') ? solSlotsFree() > 0 : civSlotsFree() > 0;
  const gold = state.resources.gold || 0;
  const canHire = gold >= encounterHireCost(unit);
  return !slotFree && !canHire;
}

// ── Expedition report (post-expé) ──────────────────────────────
// Shows gains, losses, streak updates, casualties, and a drag-bench for newly
// offered encounters.
let currentExpReport = null;     // cached summary for re-render on drag
let courtReplaceSourceSlot = null; // when dropping offer onto an occupied slot: which conseil/cour unit was displaced

// Decorate an encounter slot on the offer bench with cost, archetype and
// possibly a "forced refusal" overlay if the player can neither welcome nor hire.
function decorateEncounterSlot(slot, unit) {
  slot.classList.add('encounter');
  const def = courtUnitDef(unit);
  if (!def) return;
  // Archetype badge (top-left): village / military.
  const arch = document.createElement('span');
  arch.className = 'enc-arch ' + (def.archetype === 'soldier' ? 'arch-sol' : 'arch-civ');
  arch.textContent = def.archetype === 'soldier' ? '🛡' : '👤';
  arch.title = def.archetype === 'soldier' ? 'Au village → soldat' : 'Au village → civil';
  slot.appendChild(arch);
  // Cost badge (bottom-right) — gold cost for Conseil/Cour hire.
  const cost = encounterHireCost(unit);
  const costEl = document.createElement('span');
  costEl.className = 'enc-cost';
  if (unit.scriptedFreeHire) {
    costEl.classList.add('free');
    costEl.innerHTML = `<span class="enc-cost-amt">Gratuit</span>`;
    costEl.title = 'Membre de la famille — recrutement gratuit (exception unique)';
  } else {
    const canPay = (state.resources.gold || 0) >= cost;
    if (!canPay) costEl.classList.add('cant');
    costEl.innerHTML = `<img src="${RES.gold.icon}" alt="" width="11" height="11"><span class="enc-cost-amt">${cost}</span>`;
    costEl.title = `Recruter au Conseil/Cour : ${cost} or`;
  }
  slot.appendChild(costEl);
  // Forced refusal: no slot AND no gold. Grey out + lock.
  if (encounterForcedRefusal(unit)) {
    slot.classList.add('forced-refused');
    const overlay = document.createElement('span');
    overlay.className = 'enc-forced';
    overlay.textContent = 'Refusée — fonds insuffisants';
    slot.appendChild(overlay);
  }
}

// Auto-close timer + countdown ring state for the floating report.
let expReportTimer = null;
let expReportCountdownRAF = null;
const EXP_REPORT_DURATION_MS = 5000;
let expReportEndAt = 0;
let expReportPaused = false;

function showExpeditionReport(summary) {
  currentExpReport = summary;
  state.court.offerOpen = true;
  const el = $('court-offer-backdrop');
  if (!el) return;
  el.hidden = false;
  renderExpeditionReport();
  startExpReportAutoClose();
}

function startExpReportAutoClose() {
  stopExpReportAutoClose();
  // Don't auto-close while units await placement.
  if (state.court.offer.length > 0) return;
  expReportEndAt = performance.now() + EXP_REPORT_DURATION_MS;
  expReportPaused = false;
  const tick = () => {
    if (!state.court.offerOpen) return;
    if (expReportPaused) {
      expReportEndAt = performance.now() + EXP_REPORT_DURATION_MS;
      updateExpReportCountdown(1);
      expReportCountdownRAF = requestAnimationFrame(tick);
      return;
    }
    const remaining = expReportEndAt - performance.now();
    if (remaining <= 0) {
      closeExpeditionReport();
      return;
    }
    updateExpReportCountdown(remaining / EXP_REPORT_DURATION_MS);
    expReportCountdownRAF = requestAnimationFrame(tick);
  };
  expReportCountdownRAF = requestAnimationFrame(tick);
}

function stopExpReportAutoClose() {
  if (expReportTimer) { clearTimeout(expReportTimer); expReportTimer = null; }
  if (expReportCountdownRAF) { cancelAnimationFrame(expReportCountdownRAF); expReportCountdownRAF = null; }
}

function updateExpReportCountdown(frac) {
  const fg = document.querySelector('.exp-report .er-countdown circle.fg');
  if (!fg) return;
  const C = 2 * Math.PI * 11; // r=11
  fg.style.strokeDasharray = String(C);
  fg.style.strokeDashoffset = String(C * (1 - frac));
}

function renderExpeditionReport() {
  const el = $('court-offer-backdrop');
  const s = currentExpReport;
  if (!el || !s) return;

  const gainParts = RES_ORDER
    .filter(k => (s.gains[k] || 0) > 0)
    .map(k => `<span class="er-gain"><img src="${RES[k].icon}" alt=""><b>+${s.gains[k]}</b></span>`)
    .join('');
  const lossPart = s.losses > 0 ? `<div class="er-losses">☠️ <b>${s.losses}</b> unité${s.losses > 1 ? 's' : ''} perdue${s.losses > 1 ? 's' : ''}</div>` : '';

  const eventPart = (s.events && s.events.length) ? `
    <div class="er-list er-events">
      <div class="er-list-title">⚔️ Embuscades</div>
      ${s.events.map(ev => {
        let effect = '', cls = 'er-good';
        if (ev.kind === 'defended') { effect = '🛡 Repoussée'; cls = 'er-good'; }
        else if (ev.kind === 'sol')  { effect = '🛡 −1 soldat'; cls = 'er-bad'; }
        else if (ev.kind === 'civ')  { effect = '💀 −1 civil'; cls = 'er-bad'; }
        return `<div class="er-row ${cls}">${escapeHtml(ev.msg)} <span class="er-row-sub">${effect}</span></div>`;
      }).join('')}
    </div>` : '';

  const streakPart = (s.streakUps && s.streakUps.length) ? `
    <div class="er-list er-streaks">
      <div class="er-list-title">⭐ Progression</div>
      ${s.streakUps.map(x => `<div class="er-row er-good">${escapeHtml(x.name)} <span class="er-row-sub">★ +1 (${x.stars})</span></div>`).join('')}
    </div>` : '';

  const casualtyPart = (s.casualties && s.casualties.length) ? `
    <div class="er-list er-casualties">
      <div class="er-list-title">⚔️ Pertes à la cour</div>
      ${s.casualties.map(x => x.fate === 'dead'
        ? `<div class="er-row er-bad">💀 ${escapeHtml(x.name)} <span class="er-row-sub">tombé${x.female ? 'e' : ''} au combat</span></div>`
        : `<div class="er-row er-warn">🩹 ${escapeHtml(x.name)} <span class="er-row-sub">fragilisé${x.female ? 'e' : ''}</span></div>`).join('')}
    </div>` : '';

  const benchLen = state.court.offer.length;
  const offerHint = 'Au village (gratuit) <b>OU</b> au Conseil/Cour (en or). Laissée ici = elle repart.';
  const offerPart = benchLen > 0 ? `
    <div class="er-bench-panel">
      <div class="er-bench-title">🎁 Rencontre${benchLen > 1 ? 's' : ''} de l'expédition</div>
      <div class="er-bench-hint">${offerHint}</div>
      <div class="er-bench" id="er-bench"></div>
    </div>` : '';

  const hasOffer = state.court.offer.length > 0;
  const countdownPart = hasOffer ? '' : `
    <div class="er-countdown" aria-hidden="true">
      <svg viewBox="0 0 28 28">
        <circle class="bg" cx="14" cy="14" r="11"/>
        <circle class="fg" cx="14" cy="14" r="11"/>
      </svg>
    </div>`;

  el.innerHTML = `
    <div class="exp-report ${hasOffer ? 'has-offer' : ''}">
      <button class="er-close" id="er-close" title="Fermer" aria-label="Fermer">×</button>
      <div class="er-header">
        <span class="er-orn">⚔️</span>
        <h2>Retour d'expédition</h2>
        <span class="er-orn">⚔️</span>
      </div>
      <div class="er-gains">
        ${gainParts || '<span class="er-meager">Maigre butin…</span>'}
      </div>
      ${lossPart}
      ${eventPart}
      ${streakPart}
      ${casualtyPart}
      ${offerPart}
      ${countdownPart}
    </div>`;

  // Render bench units as regular court-slots so they share drag logic.
  const bench = $('er-bench');
  if (bench) {
    const slots = state.court.offer.map((u, i) => {
      const slot = renderCourtSlot(u, 'offer', i);
      // Decorate with encounter-only badges (cost, archetype, refusal state).
      if (u) decorateEncounterSlot(slot, u);
      return slot;
    });
    bench.replaceChildren(...slots);
    courtWireZone(bench);
  }

  // Hover pauses the auto-close timer; leaving resumes it.
  const card = el.querySelector('.exp-report');
  if (card) {
    card.onmouseenter = () => { expReportPaused = true; };
    card.onmouseleave = () => { expReportPaused = false; };
  }

  const closeBtn = $('er-close');
  if (closeBtn) closeBtn.onclick = (e) => {
    e.stopPropagation();
    closeExpeditionReport();
  };

  // Re-evaluate the auto-close timer: starts only when the bench is empty.
  // (Drops from the bench re-render the report, so this picks up "last unit
  // placed → start the 5s countdown".)
  startExpReportAutoClose();
}

function closeExpeditionReport() {
  stopExpReportAutoClose();
  // Anything still on the bench is refused — narrative line in the journal.
  // No diminishing-returns bookkeeping in v3 (encounters are one-shot).
  if (state.court.offer.length) {
    for (const u of state.court.offer) {
      if (encounterForcedRefusal(u)) {
        addJournal(`💨 ${u.name} repart faute de place et de fonds.`, 'info');
      } else {
        addJournal(`💨 ${u.name} repart, déçu${endingE(u)}.`, 'info');
      }
    }
    state.court.offer = [];
  }
  const el = $('court-offer-backdrop');
  if (el) { el.hidden = true; el.innerHTML = ''; }
  state.court.offerOpen = false;
  // Keep currentExpReport so the journal can re-open it.

  // Drain a deferred season ceremony if one was queued.
  if (state.court.pendingCeremony && state.kingAlive) {
    state.court.pendingCeremony = false;
    setTimeout(() => runSeasonCeremony(), 300);
  }
  renderAll();
}

// Click outside the report card closes it — but only if no offers are pending.
// While units await placement on the bench, the user must use the X.
document.addEventListener('mousedown', (e) => {
  if (!state.court.offerOpen) return;
  if (state.court.offer.length > 0) return;
  const card = document.querySelector('.exp-report');
  if (!card) return;
  if (card.contains(e.target)) return;
  // Don't double-close on the X (its own handler already fires).
  closeExpeditionReport();
}, true);

// Gender-ish suffix heuristic for journal prose (names like "Eléonore la …").
function endingE(unit) {
  const ep = (unit.name || '').split(' ').slice(1).join(' ');
  if (!/^l[ae]\s/i.test(ep)) return '';
  return /^la\s/i.test(ep) ? 'e' : '';
}

// ── Deployment selection ───────────────────────────────────────
// Per GDD §2.2: reading order (L→R, T→B) in the conseil. Workers/explorers
// fill civilian slots, soldiers fill combat slots, both capped by counts.
function courtEligibleForExpedition(sendPop, fighters) {
  const civSlots = Math.max(0, sendPop - fighters);
  const solSlots = fighters;
  const deployedUids = [];
  let cTaken = 0, sTaken = 0;
  for (const u of state.court.conseil) {
    if (!u) continue;
    const def = courtUnitDef(u);
    if (!def) continue;
    if (def.archetype === 'soldier') {
      if (sTaken < solSlots) { deployedUids.push(u.uid); sTaken++; }
    } else {
      // worker + explorer count as civilians
      if (cTaken < civSlots) { deployedUids.push(u.uid); cTaken++; }
    }
  }
  return deployedUids;
}

// Flat lookup across all zones.
function courtUnitByUid(uid) {
  for (const u of state.court.conseil) if (u && u.uid === uid) return { unit: u, zone: 'conseil' };
  for (const u of state.court.cour)    if (u && u.uid === uid) return { unit: u, zone: 'cour' };
  return null;
}

// Remove a unit by uid from any zone.
function courtRemoveByUid(uid) {
  for (let i = 0; i < state.court.conseil.length; i++) {
    if (state.court.conseil[i] && state.court.conseil[i].uid === uid) { state.court.conseil[i] = null; return; }
  }
  for (let i = 0; i < state.court.cour.length; i++) {
    if (state.court.cour[i] && state.court.cour[i].uid === uid) { state.court.cour[i] = null; return; }
  }
}

// Detect a female-coded name for journal prose (look for " la " or epithet starting with "la ").
function courtUnitIsFemale(unit) {
  const rest = (unit.name || '').split(' ').slice(1).join(' ');
  return /^la\s/i.test(rest);
}

// ── Outcome: streak / injury / death ───────────────────────────
// Called after an expedition lands. Returns { streakUps, casualties } for the
// report screen. Mutates state.court in place.
function applyCourtExpeditionOutcome(summary) {
  const out = { streakUps: [], casualties: [] };
  const deployed = (summary.deployedSpecials || []).slice();
  if (!deployed.length) return out;

  // Proportion of losses vs. sent pop drives hit rate for specials.
  const lossRatio = summary.sendPop > 0 ? Math.min(1, summary.losses / summary.sendPop) : 0;
  // Base hit chance per deployed special; fragile specials get ×2 weight.
  const baseHit = lossRatio; // e.g. 2/5 losses → 40% hit roll per special

  for (const uid of deployed) {
    const found = courtUnitByUid(uid);
    if (!found || found.zone !== 'conseil') continue; // only those still in conseil
    const unit = found.unit;
    const def = courtUnitDef(unit);
    if (!def) continue;

    const weight = def.fragility === 'fragile' ? 2 : def.fragility === 'robust' ? 1 : 0.5;
    const hitChance = Math.min(0.85, baseHit * weight);
    const wasHit = baseHit > 0 && rng() < hitChance;

    if (wasHit) {
      const female = courtUnitIsFemale(unit);
      if (def.fragility === 'fragile') {
        courtRemoveByUid(uid);
        addJournal(`☠️ ${unit.name} est tombé${female ? 'e' : ''} au combat.`, 'bad');
        out.casualties.push({ name: unit.name, fate: 'dead', female });
      } else {
        // robust / durable → injured, streak reset
        unit.injured = true;
        unit.stars = 0;
        addJournal(`🩹 ${unit.name} revient blessé${female ? 'e' : ''} — étoiles remises à zéro.`, 'warn');
        out.casualties.push({ name: unit.name, fate: 'injured', female });
      }
    } else {
      const max = def.maxStars || 3;
      if (unit.stars < max) {
        unit.stars++;
        out.streakUps.push({ name: unit.name, stars: unit.stars });
      }
      // Injury heals over a successful outing.
      if (unit.injured) unit.injured = false;
    }
  }
  return out;
}

// ── Live highlight of deployed slots during expedition panel ───
function courtHighlightDeployed(sendPop, fighters) {
  const uids = new Set(courtEligibleForExpedition(sendPop, fighters));
  document.querySelectorAll('#conseil-grid .court-slot').forEach(slot => {
    const uid = Number(slot.dataset.uid);
    if (uid && uids.has(uid)) slot.classList.add('will-deploy');
    else slot.classList.remove('will-deploy');
  });
}
function courtClearDeployedHighlight() {
  document.querySelectorAll('.court-slot.will-deploy').forEach(n => n.classList.remove('will-deploy'));
}

// ── Effects aggregator ─────────────────────────────────────────
// Combines support effects from conseil (100%) + cour (20%). Expedition-only
// effects (combat force, gain/loss mult, duration cut) are kept separate and
// depend on which specials are deployed.
function courtEffects() {
  const ctx = {
    expeditionFreeWorkers: 0,   // absolute wheat-free workers
    expeditionFoodCostMult: 1,  // multiplier on expé wheat cost
    expeditionGainMult: 1,      // multiplier on expé gains
    expeditionLossMult: 1,      // multiplier on expé losses
    expeditionDurationCut: 0,   // months subtracted
    expeditionFightersBonus: 0, // raw combat-force bonus
    seasonCostMult: 1,          // multiplier on all season costs
    seasonStressRelief: 0,      // stress subtracted at season end
    seasonExtraIncome: {},      // per-resource monthly income bonus (season-end)
    castleDefenseBonus: 0,
    combatVictoryBonus: 0,
    civSlotsBonus: 0,           // extra civilian housing from court units
    solSlotsBonus: 0,           // extra soldier housing from court units
    protectedCivPop: 0,         // raw pop bonus, never dies (e.g. Mère du Roi)
  };

  const sources = [];
  for (const u of state.court.conseil) if (u) sources.push({ u, weight: 1 });
  for (const u of state.court.cour)    if (u) sources.push({ u, weight: 0.2 });

  for (const { u, weight } of sources) {
    if (u.injured) continue; // injured emit nothing until healed
    const def = courtUnitDef(u);
    if (!def) continue;
    const stars = u.stars || 0;
    const w = weight;

    switch (def.id) {
      case 'mother_of_king':
        // [v3 legacy — kept for back-compat, no current effect. May return
        // later as a different mechanic.]
        break;
      case 'family_member':
        ctx.expeditionFreeWorkers = Math.max(ctx.expeditionFreeWorkers, Math.round(2 * w));
        break;
      case 'cuisinier': {
        // 2 base + ~⅔ per star, capped at 4 (per GDD: max 4 at 3★).
        const n = Math.min(4, 2 + Math.floor(stars * 2 / 3));
        ctx.expeditionFreeWorkers = Math.max(ctx.expeditionFreeWorkers, Math.round(n * w));
        break;
      }
      case 'maitre_queux':
        ctx.expeditionFoodCostMult *= (1 - 0.5 * w);
        break;
      case 'brasseur':
        ctx.seasonStressRelief += 1 * w;
        break;
      case 'intendant':
        // Support effect — applies always (at 20% when in cour).
        ctx.seasonCostMult *= (1 - 0.20 * w);
        break;
      case 'veteran':
        ctx.expeditionFightersBonus += (1 + (stars >= 3 ? 1 : 0)) * w;
        break;
      case 'sergent':
        ctx.expeditionLossMult *= (1 - 0.30 * w);
        break;
      case 'capitaine':
        // Support side: defense. Active side (victory%) only when in conseil.
        ctx.castleDefenseBonus += 1 * w;
        if (weight === 1) ctx.combatVictoryBonus += 0.15;
        break;
      case 'general': {
        ctx.expeditionLossMult *= (1 - 0.20 * w);
        ctx.expeditionGainMult *= (1 + 0.15 * w);
        // Synergy: +5% gain per healthy soldier sitting in la cour (cap 3).
        const aides = state.court.cour.reduce((n, x) => {
          if (!x || x.injured) return n;
          const d = courtUnitDef(x);
          return n + (d && d.archetype === 'soldier' ? 1 : 0);
        }, 0);
        ctx.expeditionGainMult *= (1 + 0.05 * Math.min(3, aides) * w);
        break;
      }
      case 'traqueur':
        // Active-only: duration cut applies when in conseil.
        if (weight === 1) ctx.expeditionDurationCut = Math.max(ctx.expeditionDurationCut, 1);
        break;
      case 'chasseur':
        // Support: +1 wheat/saison.
        ctx.seasonExtraIncome.wheat = (ctx.seasonExtraIncome.wheat || 0) + 1 * w;
        break;
      case 'eclaireur':
        // Sans système de fog : +5% gain par étoile, actif-only.
        if (weight === 1) ctx.expeditionGainMult *= (1 + 0.05 * Math.max(1, stars));
        break;
      case 'explorateur':
        // Actif : -1 mois, +20% gain. Support : +10% gain.
        if (weight === 1) {
          ctx.expeditionDurationCut = Math.max(ctx.expeditionDurationCut, 1);
          ctx.expeditionGainMult *= 1.20;
        } else {
          ctx.expeditionGainMult *= (1 + 0.10 * w);
        }
        break;
    }
  }
  return ctx;
}

// ── DOM refs ───────────────────────────────────────────────────
const elSidebarRight = $('sidebar-right');
const elSbRBody = $('sb-r-body');
const elSbRCollapse = $('sb-r-collapse');
const elSbRReopen = $('sb-r-reopen');
const elConseilGrid = $('conseil-grid');
const elCourBench = $('cour-bench');
const elUnitTooltip = $('unit-tooltip');

// ── Rendering ──────────────────────────────────────────────────
function renderCourt() {
  if (!elConseilGrid || !elCourBench) return;
  renderCourtZone(elConseilGrid, state.court.conseil, 'conseil');
  renderCourtZone(elCourBench, state.court.cour, 'cour');
  // Re-apply live highlight if the expedition panel is open.
  if (state.panelOpen && typeof panelState !== 'undefined' && panelState) {
    courtHighlightDeployed(panelState.civils + panelState.fighters, panelState.fighters);
  }
  renderPeuple();
}

// ── Le Peuple — village scene ─────────────────────────────────
// Capped at PEUPLE_MAX_SPRITES so the scene stays light even with big pop.
const PEUPLE_MAX_SPRITES = 8;
const PEUPLE_CIV_COLORS = ['#6f9bd8', '#a86bcc', '#3fa86f', '#cc8e3f', '#c95a7a', '#5fa3a3'];
function renderPeuple() {
  const housesEl = document.getElementById('peuple-houses');
  const spritesEl = document.getElementById('peuple-sprites');
  if (!housesEl || !spritesEl) return;
  // Houses: one little drawing per Maison + per Caserne. Position spread across
  // the bottom so they line up like a village skyline.
  const habitations = state.buildings.filter(b => b.id === 'house' || b.id === 'barracks');
  const sceneW = 100; // percent
  housesEl.innerHTML = '';
  if (habitations.length > 0) {
    const step = sceneW / (habitations.length + 1);
    habitations.forEach((b, i) => {
      const node = document.createElement('div');
      node.className = 'p-house' + (b.id === 'barracks' ? ' barracks' : '');
      node.style.left = `calc(${step * (i + 1)}% - 11px)`;
      if (b.id === 'barracks') {
        const flag = document.createElement('div');
        flag.className = 'p-flag';
        node.appendChild(flag);
      }
      housesEl.appendChild(node);
    });
  }
  // Sprites: one per civilian / soldier, capped.
  const civs = civCount();
  const sols = solCount();
  const totalShown = Math.min(civs + sols, PEUPLE_MAX_SPRITES);
  const civShown = Math.round((civs / Math.max(1, civs + sols)) * totalShown);
  const solShown = totalShown - civShown;
  spritesEl.innerHTML = '';
  for (let i = 0; i < civShown; i++) {
    spritesEl.appendChild(makePeupleSprite('civ', i, totalShown));
  }
  for (let i = 0; i < solShown; i++) {
    spritesEl.appendChild(makePeupleSprite('sol', civShown + i, totalShown));
  }
  // Counters — show anonymous-only counts, since Peuple only houses anonymous.
  // Specials are housed in the castle (Conseil/Cour) and shown there.
  const cCap = civSlotsCap(), sCap = solSlotsCap();
  setText('peuple-civ-cur', civs);
  setText('peuple-civ-cap', cCap);
  setText('peuple-sol-cur', sols);
  setText('peuple-sol-cap', sCap);
  document.getElementById('peuple-count-civ')?.classList.toggle('full', civs >= cCap);
  document.getElementById('peuple-count-sol')?.classList.toggle('full', sols >= sCap);
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = String(v); }

function makePeupleSprite(kind, idx, total) {
  const sprite = document.createElement('div');
  sprite.className = 'p-sprite ' + kind;
  // Stagger each sprite's walk lane and timing so they don't overlap perfectly.
  const lane = total <= 1 ? 0.5 : idx / (total - 1);
  const fromPct = 6 + lane * 70;
  const toPct = 24 + lane * 70;
  const dur = 10 + (idx * 1.7) % 8;
  const delay = -((idx * 2.3) % dur);
  sprite.style.setProperty('--walk-from', fromPct + '%');
  sprite.style.setProperty('--walk-to', toPct + '%');
  sprite.style.setProperty('--walk-dur', dur + 's');
  sprite.style.setProperty('--walk-delay', delay + 's');
  sprite.style.bottom = (14 + (idx % 3) * 4) + 'px';
  if (kind === 'civ') {
    const color = PEUPLE_CIV_COLORS[idx % PEUPLE_CIV_COLORS.length];
    sprite.style.setProperty('--civ-color', color);
  }
  const head = document.createElement('div');
  head.className = 'p-head';
  const body = document.createElement('div');
  body.className = 'p-body';
  sprite.appendChild(head);
  sprite.appendChild(body);
  return sprite;
}

function renderCourtZone(hostEl, arr, zone) {
  const cols = zone === 'conseil' ? state.court.conseilCols : state.court.courSize;
  hostEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < arr.length; i++) {
    frag.appendChild(renderCourtSlot(arr[i], zone, i));
  }
  hostEl.replaceChildren(frag);
}

function renderCourtSlot(unit, zone, idx) {
  const slot = document.createElement('div');
  slot.className = 'court-slot' + (unit ? '' : ' empty');
  slot.dataset.zone = zone;
  slot.dataset.idx = String(idx);
  if (unit) {
    const def = courtUnitDef(unit);
    if (def) {
      slot.classList.add('rarity-' + def.rarity);
      const card = document.createElement('div');
      card.className = 'unit-card';
      const portrait = document.createElement('div');
      portrait.className = 'unit-portrait' + (def.fragility === 'fragile' ? ' fragile' : '');
      portrait.textContent = def.glyph;
      const nameEl = document.createElement('div');
      nameEl.className = 'unit-name';
      // Show just the first name (before the space) to fit inside the slot.
      nameEl.textContent = (unit.name || def.name).split(' ')[0];
      const stars = document.createElement('div');
      stars.className = 'unit-stars';
      const maxStars = def.maxStars || 3;
      for (let s = 0; s < maxStars; s++) {
        const star = document.createElement('span');
        star.className = 'star' + (s < unit.stars ? ' on' : '');
        star.textContent = s < unit.stars ? '★' : '☆';
        stars.appendChild(star);
      }
      card.append(portrait, nameEl, stars);
      slot.appendChild(card);
      slot.dataset.uid = String(unit.uid);
      slot.dataset.stars = String(unit.stars || 0);
      if (def.founder) slot.dataset.founder = '1';
      if (unit.injured) portrait.classList.add('injured');
    }
  }
  return slot;
}

// ── Tooltip ────────────────────────────────────────────────────
function courtShowTooltip(unit, x, y) {
  if (!unit || !elUnitTooltip) return;
  const def = courtUnitDef(unit);
  if (!def) return;
  const rarity = COURT_RARITIES[def.rarity];
  const founderTag = def.founder ? `<div class="ut-founder">⚜ Membre fondateur · indéplaçable</div>` : '';
  // Mother's effect: show live current N (= stars) for clarity.
  let effectShort = def.effect.short;
  if (def.id === 'mother_of_king') {
    const n = Math.max(1, Math.min(3, unit.stars || 1));
    effectShort = `+${n} habitant${n > 1 ? 's' : ''} protégé${n > 1 ? 's' : ''} (★ ${unit.stars}/3) — jamais de mort en expé. ★+1 par expé sans perte, retour à 1★ à toute mort.`;
  }
  elUnitTooltip.innerHTML = `
    <div class="ut-head">
      <span>${escapeHtml(unit.name)}</span>
      <span class="ut-rarity ${rarity.cls}">${rarity.label}</span>
    </div>
    <div class="ut-role">${COURT_ROLE_LABEL[def.role] || def.role} · ${COURT_ARCHETYPE_LABEL[def.archetype] || def.archetype}</div>
    ${founderTag}
    <div class="ut-effect">
      <b>${escapeHtml(def.effect.title)}</b><br>${escapeHtml(effectShort)}
    </div>
    <div class="ut-stars">${'★'.repeat(unit.stars)}${'☆'.repeat((def.maxStars||3) - unit.stars)} · ${unit.injured ? 'fragilisée' : (COURT_FRAGILITY_LABEL[def.fragility] || def.fragility)}</div>
  `;
  elUnitTooltip.hidden = false;
  courtPositionTooltip(x, y);
}
function courtPositionTooltip(x, y) {
  if (!elUnitTooltip || elUnitTooltip.hidden) return;
  const rect = elUnitTooltip.getBoundingClientRect();
  const pad = 12;
  let left = x - rect.width - pad;
  let top = y - rect.height / 2;
  if (left < pad) left = x + pad; // flip right if no room left
  if (top < pad) top = pad;
  if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
  elUnitTooltip.style.left = `${left}px`;
  elUnitTooltip.style.top = `${top}px`;
}
function courtHideTooltip() {
  if (elUnitTooltip) elUnitTooltip.hidden = true;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ── Drag & drop (pointer-based, swap or move) ─────────────────
let courtDrag = null; // { uid, from, ghost, pointerId }

function courtStartDrag(e, slot) {
  const zone = slot.dataset.zone;
  const idx = Number(slot.dataset.idx);
  const unit = courtGetAt({ zone, idx });
  if (!unit) return;
  // Forced-refusal cards cannot be dragged.
  if (zone === 'offer' && encounterForcedRefusal(unit)) return;
  const def = courtUnitDef(unit);
  courtHideTooltip();
  const ghost = document.createElement('div');
  ghost.className = 'unit-drag-ghost';
  ghost.textContent = def?.glyph || '?';
  ghost.style.left = e.clientX + 'px';
  ghost.style.top = e.clientY + 'px';
  document.body.appendChild(ghost);
  document.body.classList.add('court-dragging');
  slot.classList.add('dragging');
  courtDrag = {
    uid: unit.uid,
    from: { zone, idx },
    ghost,
    pointerId: e.pointerId,
    sourceEl: slot,
    isEncounter: zone === 'offer',
    isFounder: !!(def && def.founder),
    fromCourt: zone === 'conseil' || zone === 'cour',
  };
  try { slot.setPointerCapture(e.pointerId); } catch (_) {}
}

function courtOnPointerMove(e) {
  if (!courtDrag) return;
  courtDrag.ghost.style.left = e.clientX + 'px';
  courtDrag.ghost.style.top = e.clientY + 'px';
  // Highlight slot under pointer (except source).
  document.querySelectorAll('.court-slot.drag-over').forEach(el => el.classList.remove('drag-over'));
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const targetSlot = el ? el.closest('.court-slot') : null;
  if (targetSlot && targetSlot !== courtDrag.sourceEl) targetSlot.classList.add('drag-over');
  // Drop targets:
  //  - From offer: Peuple (welcome free) or Conseil/Cour slots (paid hire)
  //  - From Conseil/Cour: Peuple (demote) or outside-sidebar (banish)
  const peuple = document.getElementById('peuple-scene');
  const sidebarRight = document.getElementById('sidebar-right');
  const overPeuple = el && peuple && peuple.contains(el);
  const overSidebar = el && sidebarRight && sidebarRight.contains(el);
  if (peuple) {
    peuple.classList.remove('drop-target', 'drop-invalid');
    if ((courtDrag.isEncounter || courtDrag.fromCourt) && overPeuple) {
      const unit = courtGetAt(courtDrag.from);
      const def = unit ? courtUnitDef(unit) : null;
      const isSoldier = def && def.archetype === 'soldier';
      // Founder cannot demote.
      if (courtDrag.isFounder && courtDrag.fromCourt) {
        peuple.classList.add('drop-invalid');
      } else {
        const free = isSoldier ? solSlotsFree() : civSlotsFree();
        peuple.classList.add(free > 0 ? 'drop-target' : 'drop-invalid');
      }
    }
  }
  // Banish: drag from Conseil/Cour outside the sidebar → ghost turns red + trash.
  const banishCandidate = courtDrag.fromCourt && !courtDrag.isFounder && !overSidebar;
  courtDrag.ghost.classList.toggle('banish', banishCandidate);
}

function courtOnPointerUp(e) {
  if (!courtDrag) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const targetSlot = el ? el.closest('.court-slot') : null;
  const peupleEl = document.getElementById('peuple-scene');
  const sidebarRight = document.getElementById('sidebar-right');
  const overPeuple = el && peupleEl && peupleEl.contains(el);
  const overSidebar = el && sidebarRight && sidebarRight.contains(el);
  // Cleanup visuals first (before we re-render).
  document.querySelectorAll('.court-slot.drag-over').forEach(n => n.classList.remove('drag-over'));
  if (peupleEl) peupleEl.classList.remove('drop-target', 'drop-invalid');
  if (courtDrag.ghost && courtDrag.ghost.parentNode) courtDrag.ghost.parentNode.removeChild(courtDrag.ghost);
  if (courtDrag.sourceEl) courtDrag.sourceEl.classList.remove('dragging');

  let touchedOffer = courtDrag.from.zone === 'offer';
  let courtMutated = false;

  // Encounter dropped onto Le Peuple → welcome (free, archetype-driven).
  if (courtDrag.isEncounter && overPeuple) {
    const fromAddr = courtDrag.from;
    const u = courtGetAt(fromAddr);
    const def = u ? courtUnitDef(u) : null;
    if (u && def) {
      const isSoldier = def.archetype === 'soldier';
      const free = isSoldier ? solSlotsFree() : civSlotsFree();
      if (free > 0) {
        state.population++;
        if (isSoldier) state.soldiers++;
        addJournal(isSoldier
          ? `🛡️ ${u.name} rejoint la garde.`
          : `👤 ${u.name} s'installe au village.`, 'good');
        toast('good', isSoldier ? 'Recrue accueillie' : 'Habitant accueilli', `${u.name} pose ses bagages.`);
        courtSetAt(fromAddr, null);
        touchedOffer = true;
      } else {
        toast('bad', 'Plus de place', isSoldier
          ? 'Construis une caserne pour accueillir un soldat.'
          : 'Construis une maison pour loger un habitant.');
      }
    }
  }
  // Court unit dropped onto Le Peuple → demotion (becomes anonymous).
  else if (courtDrag.fromCourt && overPeuple) {
    const fromAddr = courtDrag.from;
    const u = courtGetAt(fromAddr);
    const def = u ? courtUnitDef(u) : null;
    if (u && def) {
      if (courtDrag.isFounder) {
        toast('bad', 'Indéplaçable', `${u.name} ne peut quitter la maisonnée royale.`);
      } else {
        const isSoldier = def.archetype === 'soldier';
        const free = isSoldier ? solSlotsFree() : civSlotsFree();
        if (free > 0) {
          state.population++;
          if (isSoldier) state.soldiers++;
          courtSetAt(fromAddr, null);
          courtMutated = true;
          // Small stress chance.
          let stressNote = '';
          if (rng() < 0.15) {
            state.kingStress = Math.min(100, state.kingStress + 2);
            stressNote = ' Le roi le prend mal (+2 stress).';
          }
          addJournal(`🤝 ${u.name} quitte ses fonctions et rejoint le peuple.${stressNote}`, 'mixed');
          toast('info', 'Démotion', `${u.name} redevient ${isSoldier ? 'un soldat' : 'un habitant'} ordinaire.`);
        } else {
          toast('bad', 'Plus de place', isSoldier
            ? 'Construis une caserne avant de la rétrograder.'
            : 'Construis une maison avant de le rétrograder.');
        }
      }
    }
  }
  // Court unit dropped outside the right sidebar → banishment.
  else if (courtDrag.fromCourt && !overSidebar) {
    const fromAddr = courtDrag.from;
    const u = courtGetAt(fromAddr);
    const def = u ? courtUnitDef(u) : null;
    if (u && def) {
      if (courtDrag.isFounder) {
        toast('bad', 'Indéplaçable', `${u.name} ne peut être bannie.`);
      } else {
        // Stress chance + amount by rarity.
        const stressTable = {
          common:    { chance: 0.35, amount: 5,  msg: ' part en murmurant.' },
          rare:      { chance: 0.50, amount: 10, msg: ' claque la porte du château.' },
          legendary: { chance: 0.70, amount: 15, msg: ' jure de se venger.' },
        };
        const t = stressTable[def.rarity] || stressTable.common;
        let stressNote = '';
        if (rng() < t.chance) {
          state.kingStress = Math.min(100, state.kingStress + t.amount);
          stressNote = ` Le roi en porte le poids (+${t.amount} stress).`;
        }
        courtSetAt(fromAddr, null);
        courtMutated = true;
        addJournal(`🚫 ${u.name}${t.msg}${stressNote}`, 'bad');
        toast('bad', 'Banni du château', u.name);
      }
    }
  }
  else if (targetSlot && targetSlot !== courtDrag.sourceEl) {
    const fromAddr = courtDrag.from;
    const toAddr = { zone: targetSlot.dataset.zone, idx: Number(targetSlot.dataset.idx) };
    if (toAddr.zone === 'offer') touchedOffer = true;
    const a = courtGetAt(fromAddr);
    const b = courtGetAt(toAddr);
    const isHire = fromAddr.zone === 'offer' && (toAddr.zone === 'conseil' || toAddr.zone === 'cour');
    if (isHire && a) {
      // Encounter → Conseil/Cour: pay gold first.
      const cost = encounterHireCost(a);
      if ((state.resources.gold || 0) < cost) {
        toast('bad', 'Pas assez d\'or', `Recruter ${a.name} demande ${cost} or.`);
      } else {
        if (cost > 0) {
          state.resources.gold -= cost;
          flashSlot('gold', 'minus');
        }
        // Place into target; if occupied, displace to offer slot.
        courtSetAt(toAddr, a);
        courtSetAt(fromAddr, b || null);
        const costMsg = cost > 0 ? ` (-${cost} 💰)` : ' (gratuit)';
        addJournal(`✨ ${a.name} rejoint votre ${toAddr.zone === 'conseil' ? 'conseil' : 'cour'}${costMsg}.`, 'good');
        if (b) addJournal(`↪ ${b.name} laisse sa place et rejoint l'antichambre.`, 'info');
      }
    } else {
      // Internal swap (between conseil/cour).
      const movingFromOffer = fromAddr.zone === 'offer' && toAddr.zone !== 'offer' && a;
      const displacingToOffer = toAddr.zone !== 'offer' && b && fromAddr.zone === 'offer';
      courtSetAt(toAddr, a);
      courtSetAt(fromAddr, b);
      if (movingFromOffer) {
        addJournal(`✨ ${a.name} rejoint votre ${toAddr.zone === 'conseil' ? 'conseil' : 'cour'}.`, 'good');
      }
      if (displacingToOffer && b) {
        addJournal(`↪ ${b.name} laisse sa place et rejoint l'antichambre.`, 'info');
      }
    }
    renderCourt();
  }
  // Compact and refresh the expedition report if the offer zone was involved.
  if (touchedOffer) {
    state.court.offer = state.court.offer.filter(u => u);
    renderAll();
    if (state.court.offerOpen) renderExpeditionReport();
  } else if (courtMutated) {
    renderAll();
  }
  courtDrag = null;
  document.body.classList.remove('court-dragging');
}

// Event wiring on the two zones. Delegated via capture so we can intercept
// even when the slot element is re-created by a re-render.
function courtWireZone(hostEl) {
  if (!hostEl || hostEl.dataset.courtWired === '1') return;
  hostEl.dataset.courtWired = '1';

  hostEl.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const slot = e.target.closest('.court-slot');
    if (!slot || slot.classList.contains('empty')) return;
    e.preventDefault();
    courtStartDrag(e, slot);
  });

  // Tooltip on hover (non-drag).
  hostEl.addEventListener('pointerover', (e) => {
    if (courtDrag) return;
    const slot = e.target.closest('.court-slot');
    if (!slot || slot.classList.contains('empty')) return;
    const zone = slot.dataset.zone;
    const idx = Number(slot.dataset.idx);
    const unit = courtGetAt({ zone, idx });
    if (unit) courtShowTooltip(unit, e.clientX, e.clientY);
  });
  hostEl.addEventListener('pointermove', (e) => {
    if (courtDrag) return;
    if (!elUnitTooltip.hidden) courtPositionTooltip(e.clientX, e.clientY);
  });
  hostEl.addEventListener('pointerout', (e) => {
    if (courtDrag) return;
    const related = e.relatedTarget;
    if (!related || !related.closest || !related.closest('.court-slot')) courtHideTooltip();
  });
}

// Global pointer listeners (for drag move/up anywhere on screen).
document.addEventListener('pointermove', courtOnPointerMove);
document.addEventListener('pointerup', courtOnPointerUp);
document.addEventListener('pointercancel', courtOnPointerUp);

// ── Collapse / expand ─────────────────────────────────────────
function courtSetCollapsed(collapsed) {
  state.court.collapsed = !!collapsed;
  if (!elSidebarRight) return;
  elSidebarRight.classList.toggle('collapsed', state.court.collapsed);
  if (elSbRReopen) elSbRReopen.hidden = !state.court.collapsed;
  if (elSbRCollapse) elSbRCollapse.setAttribute('aria-label', state.court.collapsed ? 'Ouvrir la cour' : 'Replier la cour');
}

if (elSbRCollapse) elSbRCollapse.addEventListener('click', () => courtSetCollapsed(true));
if (elSbRReopen)   elSbRReopen.addEventListener('click', () => courtSetCollapsed(false));

// Wire drag & drop zones.
courtWireZone(elConseilGrid);
courtWireZone(elCourBench);

// Initial render + starter grant.
function initCourt() {
  courtGrantStarterIfNeeded();
  renderCourt();
  courtSetCollapsed(state.court.collapsed);
}

// Find the first valid grass cell near the castle (clockwise from east) so the
// starter Maison always lands somewhere predictable.
function findStarterBuildingSpot() {
  for (let r = 1; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = CASTLE_CENTER.x + dx;
        const y = CASTLE_CENTER.y + dy;
        if (canPlaceBuilding(x, y)) return { x, y };
      }
    }
  }
  return null;
}

function init() {
  state.map = generateMap();
  // v4: no founder unit, no auto Maison. Just 4 civilians in the castle and
  // an empty Conseil/Cour. Player grows the kingdom by exploring + welcoming
  // encounters from expeditions.
  addJournal('📜 Un nouveau règne commence. Dessinez une zone pour partir en expédition.', 'info');
  renderAll();
  initCourt();
  applySettingsToUI();
  applyZoom();
  centerOnCastle();
  toast('info', 'Bienvenue, Roi', 'Clic gauche pour déplacer la carte · Clic droit pour sélectionner.');
}

init();
