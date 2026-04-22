// Royaume — Kingdom Expeditions
// Vanilla JS prototype. GitHub-Pages friendly (no build step).

'use strict';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const TILE = 44;
const MAP_SIZE = 80;
const CASTLE = { x: 39, y: 39 };          // top-left of 3x3 castle
const CASTLE_CENTER = { x: 40, y: 40 };   // center cell of castle
const INFLUENCE_RADIUS = 7;               // cells

const CASE = {
  GRASS: 'grass', WHEAT: 'wheat', FOREST: 'forest', QUARRY: 'quarry',
  WATER: 'water', GOLD: 'gold', MONSTER: 'monster', RUINS: 'ruins',
  MOUNTAIN: 'mountain', CORRUPTED: 'corrupted', CASTLE: 'castle',
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
};

const SEASONS = [
  { name: 'Printemps', glyph: '🌸' },
  { name: 'Été',       glyph: '☀️' },
  { name: 'Automne',   glyph: '🍂' },
  { name: 'Hiver',     glyph: '❄️' },
];

const BUILDINGS = [
  { id: 'farm',    name: 'Ferme',    glyph: '🌾', cost: { wood: 3, stone: 1 }, effect: '+2 blé/mois',   prod: { wheat: 2 } },
  { id: 'mill',    name: 'Scierie',  glyph: '🪵', cost: { wood: 2, stone: 2 }, effect: '+1 bois/mois',  prod: { wood: 1 } },
  { id: 'barracks',name: 'Caserne',  glyph: '⚔️', cost: { wood: 5, stone: 3 }, effect: 'Forme soldats', prod: {} },
  { id: 'granary', name: 'Grenier',  glyph: '🏛️', cost: { wood: 4, stone: 4 }, effect: '-25% coût nour.', prod: {} },
  { id: 'well',    name: 'Puits',    glyph: '🪣', cost: { stone: 5 },          effect: '+1 eau/mois',   prod: { water: 1 } },
];

const KING_STATES = [
  { max: 20, key: 'good',     label: 'TRÈS BON', mortality: 0.00, cssClass: 'king-good' },
  { max: 40, key: 'good',     label: 'BON',      mortality: 0.01, cssClass: 'king-good' },
  { max: 60, key: 'moyen',    label: 'MOYEN',    mortality: 0.03, cssClass: 'king-moyen' },
  { max: 80, key: 'mauvais',  label: 'MAUVAIS',  mortality: 0.07, cssClass: 'king-mauvais' },
  { max: 100,key: 'critical', label: 'CRITIQUE', mortality: 0.13, cssClass: 'king-critical' },
];

const EXPEDITION_EVENTS = [
  { id: 'oasis',     msg: '☀️ Oasis découverte (+2 💧)',      gain: { water: 2 } },
  { id: 'coffer',    msg: '💰 Coffre abandonné (+4 or)',      gain: { gold: 4 } },
  { id: 'ambush',    msg: '🐺 Embuscade ! −1 unité',          loseUnits: 1 },
  { id: 'sickness',  msg: '🤒 Maladie (−1 unité, −1 nour.)',  loseUnits: 1, loss: { wheat: 1 } },
  { id: 'wild',      msg: '🌾 Champ sauvage (+2 nour.)',      gain: { wheat: 2 } },
  { id: 'roar',      msg: '🐉 Rugissement lointain… (+1 stress)', stress: 1 },
  { id: 'desert',    msg: '👥 Un déserteur s\'enfuit',        loseUnits: 1 },
  { id: 'relic',     msg: '🏺 Relique antique (+3 or)',       gain: { gold: 3 } },
];

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
  population: 5,       // total (habitants + soldats + généraux)
  soldiers: 0,
  generals: 0,
  kingAge: 25,
  kingStress: 15,
  kingAlive: true,
  monthsAt: 0,         // absolute months since start (year 1 = months 0-11)
  map: [],
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
  },
};

// PAN state (not in serializable state)
let pan = null; // { startX, startY, sl, st }

function currentYear() { return Math.floor(state.monthsAt / 12) + 1; }
function currentMonth() { return (state.monthsAt % 12) + 1; }
function currentSeasonIdx() { return Math.floor((state.monthsAt % 12) / 3); }
function isCastle(x, y) { return x >= CASTLE.x && x < CASTLE.x + 3 && y >= CASTLE.y && y < CASTLE.y + 3; }

// ═══════════════════════════════════════════════════════════════
// MAP GEN
// ═══════════════════════════════════════════════════════════════

function generateMap() {
  const map = [];
  // Init all grass
  for (let y = 0; y < MAP_SIZE; y++) {
    const row = [];
    for (let x = 0; x < MAP_SIZE; x++) {
      if (isCastle(x, y)) row.push({ x, y, type: CASE.CASTLE });
      else row.push({ x, y, type: CASE.GRASS, harvested: 0, cooldown: 0 });
    }
    map.push(row);
  }

  const distFromCastle = (x, y) => Math.sqrt((x - CASTLE_CENTER.x) ** 2 + (y - CASTLE_CENTER.y) ** 2);

  // CLUSTERS — grown from seeds. Size scales with distance from castle:
  //   near  = tiny patches (2-4),   far = larger groves / fields
  // { type, count, baseMin, baseMax, farBonus, branchProb, minDistFromCastle }
  const clusterDefs = [
    { type: CASE.WHEAT,    count: 55, baseMin: 2, baseMax: 4, farBonus: 7, branch: 0.72, minDist: 3 },
    { type: CASE.FOREST,   count: 65, baseMin: 2, baseMax: 4, farBonus: 8, branch: 0.75, minDist: 4 },
    { type: CASE.QUARRY,   count: 30, baseMin: 2, baseMax: 3, farBonus: 2, branch: 0.50, minDist: 7 },
    { type: CASE.WATER,    count: 32, baseMin: 2, baseMax: 4, farBonus: 3, branch: 0.68, minDist: 3 },
    { type: CASE.GOLD,     count: 18, baseMin: 1, baseMax: 2, farBonus: 1, branch: 0.45, minDist: 10 },
    { type: CASE.MOUNTAIN, count: 18, baseMin: 3, baseMax: 5, farBonus: 5, branch: 0.72, minDist: 12 },
    { type: CASE.CORRUPTED,count: 8,  baseMin: 2, baseMax: 3, farBonus: 2, branch: 0.55, minDist: 20 },
  ];

  // Size grows with distance: t=0 near castle → [baseMin, baseMax]; t=1 far edge → up to baseMax+farBonus
  const sizeFor = (d, def) => {
    const t = Math.min(1, d / (MAP_SIZE * 0.45));
    const bonus = Math.round(def.farBonus * t * t); // quadratic so big fields are only really far
    return rInt(def.baseMin, def.baseMax + bonus);
  };

  for (const def of clusterDefs) {
    for (let i = 0; i < def.count; i++) {
      for (let a = 0; a < 60; a++) {
        const sx = rInt(1, MAP_SIZE - 2);
        const sy = rInt(1, MAP_SIZE - 2);
        if (isCastle(sx, sy)) continue;
        if (map[sy][sx].type !== CASE.GRASS) continue;
        const d = distFromCastle(sx, sy);
        if (d < def.minDist) continue;
        // Softer rejection so the map fills more uniformly
        const farBias = Math.min(1, d / (MAP_SIZE * 0.5));
        if (rng() > 0.55 + farBias * 0.4) continue;
        growBlob(map, sx, sy, sizeFor(d, def), def.type, def.branch);
        break;
      }
    }
  }

  // SINGLE POINTS — monsters, ruins (never touching each other)
  const pointDefs = [
    { type: CASE.MONSTER, count: 32, minDist: 10 },
    { type: CASE.RUINS,   count: 16, minDist: 12 },
  ];
  for (const def of pointDefs) {
    for (let i = 0; i < def.count; i++) {
      for (let a = 0; a < 50; a++) {
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

  return map;
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
const elOptDeselect = $('opt-deselect-outside');
const elOptMouseSwap = $('opt-mouse-swap');
const elOptShowGrid = $('opt-show-grid');
const elMapHint = $('map-hint');
const elSplitter = $('sb-splitter');

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
  // population
  const civilians = state.population - state.soldiers - state.generals;
  $('pop-civ-value').textContent = civilians;
  $('pop-sol-value').textContent = state.soldiers + state.generals;
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
  if (dist <= 3) return 1;
  if (dist <= 7) return 2;
  if (dist <= 12) return 3;
  return 4;
}

function calcCosts(sendPop, fighters, durationMonths, dist) {
  const explorers = sendPop - fighters;
  return {
    wheat: Math.max(1, Math.round((explorers * 0.3 + fighters * 0.2) * durationMonths)),
    water: Math.max(1, Math.round(sendPop * 0.2 * durationMonths)),
    gold:  Math.max(0, Math.round(fighters * 0.5 * durationMonths)),
  };
}

let panelState = null; // { sendPop, fighters }
let panelCtx = null;   // { sel, cells, dist, duration }

function openExpeditionPanel() {
  const sel = state.commitedSelection;
  const cells = zoneCells(sel);
  const dist = zoneDistance(sel);
  const duration = expDurationMonths(dist);
  panelCtx = { sel, cells, dist, duration };

  const maxFighters = state.soldiers + state.generals;
  const defaultSend = Math.max(1, Math.min(state.population, Math.floor(state.population * 2 / 3)));
  if (!state.panelOpen || !panelState) {
    panelState = {
      sendPop: defaultSend,
      fighters: Math.min(maxFighters, Math.max(0, Math.floor(defaultSend * 0.3))),
    };
  } else {
    // preserve current slider values, clamp to new limits
    panelState.sendPop = Math.max(1, Math.min(state.population, panelState.sendPop));
    panelState.fighters = Math.max(0, Math.min(panelState.fighters, panelState.sendPop, maxFighters));
  }

  const renderPanel = () => {
    const costs = calcCosts(panelState.sendPop, panelState.fighters, duration, dist);
    const canPay = Object.keys(costs).every(k => state.resources[k] >= costs[k]);
    const validUnits = panelState.sendPop >= 1 && panelState.sendPop <= state.population;

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
          <div class="sec-head">👥 <strong>Population engagée : ${panelState.sendPop}</strong> / ${state.population}</div>
          <div class="jauge" id="jauge-pop">
            <div class="jauge-fill exp" style="width:${(panelState.sendPop/state.population)*100}%;"></div>
            <div class="jauge-handle" style="left:${(panelState.sendPop/state.population)*100}%;"></div>
            <div class="jauge-labels"><span>Expé <strong>${panelState.sendPop}</strong></span><span><strong>${state.population - panelState.sendPop}</strong> Château</span></div>
          </div>
        </div>

        <div class="exp-section">
          <div class="sec-head">⚔️ <strong>Composition</strong> — ${panelState.fighters} combattants · ${panelState.sendPop - panelState.fighters} explorateurs</div>
          <div class="jauge" id="jauge-comp">
            <div class="jauge-fill fighters" style="width:${panelState.sendPop > 0 ? (panelState.fighters/panelState.sendPop)*100 : 0}%;"></div>
            <div class="jauge-handle" style="left:${panelState.sendPop > 0 ? (panelState.fighters/panelState.sendPop)*100 : 0}%;"></div>
            <div class="jauge-labels"><span>Combat <strong>${panelState.fighters}</strong></span><span><strong>${panelState.sendPop-panelState.fighters}</strong> Explo</span></div>
          </div>
          <div style="font-size:11px; color: var(--ink-3); margin-top: 4px;">Max combattants dispo : ${maxFighters}</div>
        </div>

        <div class="exp-section">
          <div class="sec-head">💰 <strong>Coûts prévus</strong></div>
          <div class="cost-row" id="cost-row">
            ${Object.entries(costs).map(([k, v]) => {
              const ok = state.resources[k] >= v;
              return `<div class="cost-badge ${ok ? '' : 'insufficient'}" data-res="${k}"><img src="${RES[k].icon}"><div><div class="cost-val">-${v}</div><div class="cost-have">(${state.resources[k]})</div></div></div>`;
            }).join('')}
          </div>
        </div>

        <div class="exp-actions">
          <button class="btn btn-ghost" id="btn-cancel">Annuler</button>
          <button class="btn btn-primary" id="btn-launch" ${canPay && validUnits ? '' : 'disabled'}>Lancer</button>
        </div>
      </div>`;
    elSbExp.hidden = false;
    elSbMiddle.hidden = true;
    state.panelOpen = true;
    wirePanel(duration, dist, cells, sel);
  };

  const wirePanel = (duration, dist, cells, sel) => {
    $('btn-cancel').onclick = closeExpeditionPanel;
    $('btn-launch').onclick = () => {
      const costs = calcCosts(panelState.sendPop, panelState.fighters, duration, dist);
      launchExpedition(sel, cells, panelState.sendPop, panelState.fighters, duration, costs);
    };
    wireJauge('jauge-pop', (pct) => {
      panelState.sendPop = Math.max(1, Math.min(state.population, Math.round(pct * state.population)));
      panelState.fighters = Math.min(panelState.fighters, panelState.sendPop);
      panelState.fighters = Math.min(panelState.fighters, state.soldiers + state.generals);
      renderPanel();
    });
    wireJauge('jauge-comp', (pct) => {
      if (panelState.sendPop === 0) return;
      const f = Math.round(pct * panelState.sendPop);
      panelState.fighters = Math.min(state.soldiers + state.generals, Math.max(0, f));
      renderPanel();
    });
  };

  const wireJauge = (id, cb) => {
    const el = $(id); if (!el) return;
    const onMove = (ev) => {
      // Re-query in case the panel was re-rendered (innerHTML replaced)
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
  renderZoneInfo();
}

// ═══════════════════════════════════════════════════════════════
// EXPEDITION LAUNCH + TICK
// ═══════════════════════════════════════════════════════════════

function launchExpedition(sel, cells, sendPop, fighters, duration, costs) {
  // Save current camera so we can restore it when the expedition ends
  state.cameraBeforeExp = {
    zoom,
    scrollLeft: elMapScroller.scrollLeft,
    scrollTop: elMapScroller.scrollTop,
  };
  // Cinematic camera: zoom/pan to fit castle + target zone
  focusOnExpedition(sel);

  // pay costs with flying animation (two-step, grouped gather below top bar)
  const costKeys = Object.keys(costs).filter(k => costs[k] > 0);
  costKeys.forEach((key, i) => {
    state.resources[key] -= costs[key];
    flyResource(key, -costs[key], $('res-' + key), castleScreenPos(), i, costKeys.length);
    flashSlot(key, 'minus');
  });
  renderTopBar();

  // build path (simple straight line from castle to zone center, then visit cells)
  const target = { x: Math.round((sel.x1 + sel.x2) / 2), y: Math.round((sel.y1 + sel.y2) / 2) };
  const outPath = linePath(CASTLE_CENTER, target);
  const visitList = cells.slice(0, sendPop).map(c => ({ x: c.x, y: c.y }));
  const returnPath = linePath(target, CASTLE_CENTER);

  state.expedition = {
    sel, cells, sendPop, fighters, duration, costs,
    phase: 'out',  // out → visit → return → done
    outPath, visitList, returnPath,
    pathIdx: 0, visitIdx: 0,
    gains: { wheat: 0, water: 0, gold: 0, wood: 0, stone: 0 },
    losses: 0,
    events: [],
    caravanPos: { x: CASTLE_CENTER.x, y: CASTLE_CENTER.y },
    journalTitle: `Expé (${sel.x2-sel.x1+1}×${sel.y2-sel.y1+1})`,
    ticksPerCell: 5, // frames
    tickCounter: 0,
  };

  closeExpeditionPanel();
  spawnCaravan();
  addJournal('📜 Expédition lancée vers une zone ' + `${sel.x2-sel.x1+1}×${sel.y2-sel.y1+1}`, 'info');

  if (expTimer) cancelAnimationFrame(expTimer);
  lastTick = 0;
  expTimer = requestAnimationFrame(tickExpedition);
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

function moveCaravan(x, y) {
  if (!caravanEl) return;
  caravanEl.style.left = (x * TILE + TILE/2 - 12) + 'px';
  caravanEl.style.top  = (y * TILE + TILE/2 - 12) + 'px';
  state.expedition.caravanPos = { x, y };
}

let expTimer = null, lastTick = 0;
const TICK_MS = 280; // ms per step

function tickExpedition(ts) {
  if (!state.expedition) return;
  if (!lastTick) lastTick = ts;
  if (ts - lastTick < TICK_MS) { expTimer = requestAnimationFrame(tickExpedition); return; }
  lastTick = ts;

  const exp = state.expedition;
  if (exp.phase === 'out') {
    exp.pathIdx++;
    if (exp.pathIdx >= exp.outPath.length) {
      exp.phase = 'visit'; exp.visitIdx = 0;
    } else {
      const p = exp.outPath[exp.pathIdx];
      moveCaravan(p.x, p.y);
      // random event chance during travel
      if (rng() < 0.05) triggerRandomEvent();
    }
  } else if (exp.phase === 'visit') {
    if (exp.visitIdx >= exp.visitList.length) {
      exp.phase = 'return'; exp.pathIdx = 0;
    } else {
      const v = exp.visitList[exp.visitIdx++];
      moveCaravan(v.x, v.y);
      resolveCell(v.x, v.y);
    }
  } else if (exp.phase === 'return') {
    exp.pathIdx++;
    if (exp.pathIdx >= exp.returnPath.length) {
      exp.phase = 'done';
      finishExpedition();
      return;
    } else {
      const p = exp.returnPath[exp.pathIdx];
      moveCaravan(p.x, p.y);
    }
  }

  expTimer = requestAnimationFrame(tickExpedition);
}

function resolveCell(x, y) {
  const c = cellAt(x, y);
  if (!c) return;
  const info = CELL_INFO[c.type];
  const exp = state.expedition;

  if (c.type === CASE.WHEAT || c.type === CASE.FOREST || c.type === CASE.QUARRY || c.type === CASE.WATER || c.type === CASE.GOLD) {
    if (c.cooldown > 0 || c.harvested >= 5) {
      showBubble(x, y, c.harvested >= 5 ? '💀 Épuisé' : '💤 En repousse', 'event');
      return;
    }
    const amt = rInt(info.amount[0], info.amount[1]);
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
    const force = exp.fighters * 1.0 + (exp.sendPop - exp.fighters) * 0.3;
    const winChance = force / (force + power);
    if (rng() < winChance) {
      // win
      const lost = Math.max(0, rInt(0, Math.ceil(power * 0.4)));
      exp.losses += lost;
      exp.gains.gold += rInt(1, 3);
      puff(x, y, '⚔️');
      showBubble(x, y, lost > 0 ? `-${lost} ☠️` : 'Victoire !', lost > 0 ? 'bad' : 'good');
      c.type = CASE.GRASS;
    } else {
      const lost = Math.max(1, rInt(Math.ceil(power * 0.5), Math.ceil(power * 1.2)));
      exp.losses += lost;
      puff(x, y, '💥');
      showBubble(x, y, `-${lost} ☠️`, 'bad');
      state.kingStress += 2;
    }
  } else if (c.type === CASE.RUINS) {
    const gold = rInt(2, 5);
    exp.gains.gold += gold;
    puff(x, y, '🏺');
    showBubble(x, y, `+${gold} 💰`, 'good');
    c.type = CASE.GRASS;
  }
}

function triggerRandomEvent() {
  const exp = state.expedition;
  const ev = rPick(EXPEDITION_EVENTS);
  exp.events.push(ev);
  if (ev.gain) for (const k of Object.keys(ev.gain)) exp.gains[k] += ev.gain[k];
  if (ev.loss) for (const k of Object.keys(ev.loss)) exp.gains[k] -= ev.loss[k];
  if (ev.loseUnits) exp.losses += ev.loseUnits;
  if (ev.stress) state.kingStress += ev.stress;
  const p = exp.caravanPos;
  showBubble(p.x, p.y, ev.msg, 'event');
  addJournal(ev.msg, 'info');
}

function finishExpedition() {
  const exp = state.expedition;

  // flying rewards back to top bar (two-step, grouped at gather point)
  const gainKeys = RES_ORDER.filter(k => (exp.gains[k] || 0) > 0);
  gainKeys.forEach((key, i) => {
    state.resources[key] += exp.gains[key];
    flyResource(key, exp.gains[key], castleScreenPos(), $('res-' + key), i, gainKeys.length);
    flashSlot(key, 'plus');
  });

  // apply unit losses (priority: ordinary soldiers → civilians; generals die last)
  let losses = Math.min(exp.losses, exp.sendPop);
  // cap to 80%
  losses = Math.min(losses, Math.floor(exp.sendPop * 0.8));
  let remaining = losses;
  state.unitsLost += losses;
  // civilians first, then soldiers
  const civilians = state.population - state.soldiers - state.generals;
  const takeCiv = Math.min(remaining, Math.max(0, exp.sendPop - exp.fighters));
  state.population -= Math.min(civilians, takeCiv);
  remaining -= Math.min(civilians, takeCiv);
  const takeSol = Math.min(remaining, state.soldiers);
  state.soldiers -= takeSol;
  state.population -= takeSol;
  remaining -= takeSol;
  if (remaining > 0) {
    const takeGen = Math.min(remaining, state.generals);
    state.generals -= takeGen; state.population -= takeGen;
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
  // restore camera to pre-expedition view
  if (state.cameraBeforeExp) {
    const c = state.cameraBeforeExp;
    animateCamera(c.zoom, c.scrollLeft, c.scrollTop, 700);
    state.cameraBeforeExp = null;
  }
  renderAll();

  // season check
  if (state.monthsAt > 0 && state.monthsAt % 4 === 0 && state.kingAlive) {
    setTimeout(() => runSeasonCeremony(), 800);
  }
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
    // pop growth (every 2 months, if surplus)
    if (state.monthsAt % 2 === 0 && state.resources.wheat > 3 && state.resources.water > 2 && state.population < 20) {
      state.population++;
      addJournal('👶 Un habitant rejoint le royaume.', 'info');
    }
    // king ages every 12 months
    if (state.monthsAt % 12 === 0) {
      state.kingAge++;
      if (state.kingAge % 5 === 0) state.kingStress = Math.min(100, state.kingStress + 5);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SEASON CEREMONY
// ═══════════════════════════════════════════════════════════════

function runSeasonCeremony() {
  const year = currentYear();
  const seasonIdx = ((currentSeasonIdx() - 1) + 4) % 4;
  const season = SEASONS[seasonIdx];
  const civilians = state.population - state.soldiers - state.generals;
  const hasGranary = state.buildings.some(b => b.id === 'granary');
  const wheatMod = hasGranary ? 0.75 : 1;

  const lines = [
    { label: `${civilians} habitants`, costs: { wheat: Math.ceil(civilians * 1 * wheatMod), water: Math.ceil(civilians * 0.5) } },
  ];
  if (state.soldiers) lines.push({ label: `${state.soldiers} soldats`, costs: { wheat: Math.ceil(state.soldiers * 0.5 * wheatMod), gold: state.soldiers * 1, water: Math.ceil(state.soldiers * 0.5) } });
  if (state.generals) lines.push({ label: `${state.generals} généraux`, costs: { gold: state.generals * 2 } });
  if (state.buildings.length) lines.push({ label: `Entretien (${state.buildings.length} bât.)`, costs: { wood: Math.ceil(state.buildings.length / 2) } });

  const totals = { wheat: 0, water: 0, gold: 0, wood: 0 };
  for (const l of lines) for (const k of Object.keys(l.costs)) totals[k] = (totals[k] || 0) + l.costs[k];

  // compute deficits
  const deficits = {};
  for (const k of Object.keys(totals)) {
    if (state.resources[k] < totals[k]) deficits[k] = totals[k] - state.resources[k];
    state.resources[k] = Math.max(0, state.resources[k] - totals[k]);
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
  // special effects
  if (def.id === 'barracks') {
    // convert a civilian to soldier immediately (needs gold too)
    if (state.resources.gold >= 3 && state.population - state.soldiers - state.generals >= 1) {
      state.resources.gold -= 3;
      state.soldiers++;
      addJournal('⚔️ Un habitant devient soldat.', 'info');
    }
  }
  cancelPlacement();
  addJournal(`🔨 ${def.name} construit.`, 'info');
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
      return `<span class="bc ${ok ? 'ok' : 'no'}"><img src="${RES[k].icon}">${v}</span>`;
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
  const listH = list ? list.scrollHeight : 0;
  const headH = head ? head.getBoundingClientRect().height : 0;
  return Math.ceil(listH + headH + 18); // 10px bottom padding + breathing room
}

function adjustBuildPanelHeight() {
  const pB = $('panel-build');
  if (!pB) return;
  // Only measure+apply the default once (user can still drag to resize via splitter)
  if (pB.dataset.initialized) return;
  requestAnimationFrame(() => {
    const natural = buildPanelNaturalHeight();
    pB.style.flex = `0 0 ${natural}px`;
    $('panel-journal').style.flex = '1 1 0';
    pB.dataset.initialized = '1';
  });
}

// ═══════════════════════════════════════════════════════════════
// TIMELINE
// ═══════════════════════════════════════════════════════════════

function renderTimeline() {
  const season = SEASONS[currentSeasonIdx()];
  $('ts-year').textContent = `An ${currentYear()}`;
  $('ts-season').textContent = `${season.glyph} ${season.name} · M${currentMonth()}`;

  const track = $('timeline-track');
  // keep only .track-line, rebuild everything else
  track.querySelectorAll('.tick, .event-marker').forEach(n => n.remove());

  // show 24 months from current-3 to current+20
  const from = Math.max(0, state.monthsAt - 3);
  const to = from + 24;
  for (let m = from; m <= to; m++) {
    const pct = ((m - from) / (to - from)) * 100;
    const tick = document.createElement('div');
    const isSeasonBreak = m % 3 === 0;
    const isCurrent = m === state.monthsAt;
    tick.className = 'tick' + (isSeasonBreak ? ' season' : '') + (isCurrent ? ' current' : '');
    tick.style.left = pct + '%';
    if (isSeasonBreak) {
      const lbl = document.createElement('span');
      lbl.className = 'tl-label';
      const si = Math.floor((m % 12) / 3);
      const yr = Math.floor(m / 12) + 1;
      lbl.textContent = `${SEASONS[si].glyph}${m % 12 === 0 ? ' An '+yr : ''}`;
      tick.appendChild(lbl);
    }
    track.appendChild(tick);
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
  el.innerHTML = state.journal.map(j => `
    <div class="hist-entry ${j.tone}">
      <div class="hist-top">
        <span class="hist-title">${j.text}</span>
        <span class="hist-when">${j.when}</span>
      </div>
    </div>`).join('');
}
$('journal-clear').onclick = () => { state.journal = []; renderJournal(); };

// ═══════════════════════════════════════════════════════════════
// KING PANEL / FESTIVAL
// ═══════════════════════════════════════════════════════════════

$('king-slot').onclick = () => {
  const ks = kingStateEntry();
  toast('info', `Roi — ${ks.label}`, `Âge: ${state.kingAge} ans · Stress: ${state.kingStress}/100 · Mortalité: ${(ks.mortality*100).toFixed(0)}% /saison`);
};

$('btn-fete').onclick = () => {
  if (state.festivalUsedYear === currentYear()) { toast('bad', 'Fête déjà organisée', 'Une seule fête par an.'); return; }
  const cost = { wheat: 10, gold: 10, water: 5 };
  if (!canAfford(cost)) { toast('bad', 'Fonds insuffisants', 'Il faut 10 blé · 10 or · 5 eau.'); return; }
  for (const k of Object.keys(cost)) { state.resources[k] -= cost[k]; flashSlot(k, 'minus'); }
  state.kingStress = Math.max(0, state.kingStress - 15);
  state.festivalUsedYear = currentYear();
  addJournal('🎉 Fête royale — le peuple se réjouit.', 'good');
  toast('good', 'Fête royale !', 'Stress du roi réduit de 15.');
  renderAll();
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

// ═══════════════════════════════════════════════════════════════
// SIDEBAR SPLITTER
// ═══════════════════════════════════════════════════════════════

(function wireSplitter() {
  let drag = null;
  elSplitter.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const pJ = $('panel-journal');
    const pB = $('panel-build');
    drag = {
      startY: e.clientY,
      hJ: pJ.getBoundingClientRect().height,
      hB: pB.getBoundingClientRect().height,
      maxB: buildPanelNaturalHeight(),
    };
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const total = drag.hJ + drag.hB;
    let nB = Math.max(80, Math.min(drag.maxB, drag.hB - dy));
    let nJ = total - nB;
    const pB = $('panel-build');
    pB.dataset.userSized = '1';
    $('panel-journal').style.flex = `${nJ} 0 0px`;
    pB.style.flex = `0 0 ${nB}px`;
  });
  window.addEventListener('mouseup', () => { drag = null; });
})();

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

function init() {
  state.map = generateMap();
  addJournal('📜 Un nouveau règne commence. Dessinez une zone pour partir en expédition.', 'info');
  renderAll();
  applySettingsToUI();
  applyZoom();
  centerOnCastle();
  toast('info', 'Bienvenue, Roi', 'Clic gauche pour déplacer la carte · Clic droit pour sélectionner.');
}

init();
