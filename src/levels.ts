import { Direction, ArrowData, Level, ArrowType, TileData, ToolboxConfig, TileType } from './types';

/**
 * Checks if an arrow's path is blocked by a list of current arrows or closed gates.
 */
function isPathBlocked(arrow: { x: number, y: number, dir: Direction }, others: ArrowData[], tiles: TileData[] = []): boolean {
  const { x, y, dir } = arrow;
  
  // Check arrows
  const arrowBlocked = others.some(a => {
    switch (dir) {
      case 'up': return a.x === x && a.y < y;
      case 'down': return a.x === x && a.y > y;
      case 'left': return a.y === y && a.x < x;
      case 'right': return a.y === y && a.x > x;
    }
  });
  if (arrowBlocked) return true;

  // Check Gates
  const gateBlocked = tiles.some(t => {
    if (t.isOpen) return false;
    const isGate = t.type === 'gate-vertical' || t.type === 'gate-horizontal';
    if (!isGate) return false;

    switch (dir) {
      case 'up': return t.x === x && t.y < y;
      case 'down': return t.x === x && t.y > y;
      case 'left': return t.y === y && t.x < x;
      case 'right': return t.y === y && t.x > x;
    }
  });

  return gateBlocked;
}

/**
 * Forward Solver to verify if a level is solvable.
 */
function isSolvable(level: Level): boolean {
  let removedIds = new Set<string>();
  let currentTiles = level.tiles ? [...level.tiles] : [];

  const canRemove = (arrow: ArrowData, remaining: ArrowData[], tiles: TileData[]): boolean => {
    // Lock logic
    if (arrow.type === 'locked') {
      if (remaining.some(a => a.type === 'key')) return false;
    }

    // Path logic
    const { x, y, dir } = arrow;
    const others = remaining.filter(a => a.id !== arrow.id);
    return !isPathBlocked({ x, y, dir }, others, tiles);
  };

  const getNextState = (state: ArrowData[], removed: Set<string>, tiles: TileData[]): { newState: ArrowData[], newTiles: TileData[] } | null => {
    const nextRemoved = state.find(a => !removed.has(a.id) && canRemove(a, state.filter(s => !removed.has(s.id)), tiles));
    if (!nextRemoved) return null;
    
    removed.add(nextRemoved.id);
    let newState = [...state];
    let newTiles = [...tiles];
    
    // Process effects
    if (nextRemoved.type === 'switch') {
      newTiles = newTiles.map(t => ({ ...t, isOpen: !t.isOpen }));
    }

    if (nextRemoved.type === 'rotator') {
      const rotateCW = (d: Direction): Direction => ({ up: 'right', right: 'down', down: 'left', left: 'up' } as Record<Direction, Direction>)[d];
      newState = newState.map(a => {
        if (removed.has(a.id)) return a;
        if (Math.abs(a.x - nextRemoved.x) + Math.abs(a.y - nextRemoved.y) === 1) {
          return { ...a, dir: rotateCW(a.dir) };
        }
        return a;
      });
    }

    if (nextRemoved.type === 'shifter') {
      newState = newState.map(a => {
        if (removed.has(a.id)) return a;
        const isSameCol = a.x === nextRemoved.x && (nextRemoved.dir === 'up' || nextRemoved.dir === 'down');
        const isSameRow = a.y === nextRemoved.y && (nextRemoved.dir === 'left' || nextRemoved.dir === 'right');
        if (isSameCol || isSameRow) {
          let nx = a.x, ny = a.y;
          if (nextRemoved.dir === 'up') ny--;
          if (nextRemoved.dir === 'down') ny++;
          if (nextRemoved.dir === 'left') nx--;
          if (nextRemoved.dir === 'right') nx++;
          
          // Safe Conveyor logic: Iterative to prevent stack overflow
          const getFinalPlatformPos = (startX: number, startY: number): { x: number, y: number } => {
            let cx = startX, cy = startY;
            const visited = new Set<string>();
            visited.add(`${cx},${cy}`);

            while (true) {
              const tile = newTiles.find(t => t.x === cx && t.y === cy);
              if (!tile) break;

              let fx = cx, fy = cy;
              if (tile.type === 'conveyor-up') fy--;
              if (tile.type === 'conveyor-down') fy++;
              if (tile.type === 'conveyor-left') fx--;
              if (tile.type === 'conveyor-right') fx++;

              // Bound check
              if (fx < 0 || fx >= level.gridSize || fy < 0 || fy >= level.gridSize) break;
              
              // Blocked check
              const blocked = newState.some(other => !removed.has(other.id) && other.x === fx && other.y === fy) ||
                            newTiles.some(t => !t.isOpen && (t.type === 'gate-vertical' || t.type === 'gate-horizontal') && t.x === fx && t.y === fy);
              if (blocked) break;

              // Cycle check
              if (visited.has(`${fx},${fy}`)) break;

              cx = fx;
              cy = fy;
              visited.add(`${cx},${cy}`);
            }
            return { x: cx, y: cy };
          };

          if (nx >= 0 && nx < level.gridSize && ny >= 0 && ny < level.gridSize) {
             const occupied = newState.some(other => !removed.has(other.id) && other.x === nx && other.y === ny) ||
                              newTiles.some(t => !t.isOpen && (t.type === 'gate-vertical' || t.type === 'gate-horizontal') && t.x === nx && t.y === ny);
             if (!occupied) {
                const finalPos = getFinalPlatformPos(nx, ny);
                return { ...a, x: finalPos.x, y: finalPos.y };
             }
          }
        }
        return a;
      });
    }
    return { newState, newTiles };
  };

  let state = [...level.arrows];
  let iterations = 0;
  while (removedIds.size < level.arrows.length && iterations < 1000) {
    const result = getNextState(state, removedIds, currentTiles);
    if (!result) break;
    state = result.newState;
    currentTiles = result.newTiles;
    iterations++;
  }

  return removedIds.size === level.arrows.length;
}

/**
 * Seeded PRNG to ensure levels are consistent across sessions but diverse across indices.
 */
class SeededRandom {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  range(min: number, max: number): number { return min + this.next() * (max - min); }
}

/**
 * Procedural Level Generator with Archetypes and Inverse Physics
 */
export function generateProceduralLevel(levelIdx: number): Level {
  const rng = new SeededRandom(levelIdx + 12345); // Offset to avoid simple patterns

  // Level Flavors: Diversity in pacing (Zig-Zag complexity)
  const isElite = (levelIdx + 1) % 5 === 0;
  const isBlitz = (levelIdx + 1) % 7 === 0;
  const isGiga = (levelIdx + 1) % 11 === 0;

  // Distribute grid expansion across 100 levels
  let gridSize = Math.min(10, 4 + Math.floor(levelIdx / 12));
  if (isGiga) gridSize = Math.min(10, gridSize + 1);

  // Density logic: Non-linear waves
  const wave = Math.sin(levelIdx / 5) * 0.1;
  const densityMultiplier = (isElite ? 0.6 : 0.35) + (levelIdx * 0.003) + wave;
  const targetCount = Math.floor(gridSize * gridSize * Math.min(0.75, densityMultiplier));

  // Expanded Archetypes for unique visual "fingerprints"
  const archetypes = [
    'cluster', 'orchard', 'symmetry', 'crossfire', 'perimeter', 
    'spiral', 'vortex', 'checkerboard', 'columns', 'rows', 'dense-core', 'scattered'
  ];
  const archetype = rng.pick(archetypes);

  let attempts = 0;
  while (attempts < 30) {
    attempts++;
    let arrows: ArrowData[] = [];
    let tiles: TileData[] = [];
    const occupied = new Set<string>();

    // Gradually introduce Tiles (Gates and Conveyors)
    const tileChance = isElite ? 0.8 : 0.4;
    if (levelIdx > 20 && rng.next() < tileChance) {
      const tileCount = Math.min(6, Math.floor(levelIdx / 15) + (isElite ? 2 : 0));
      for (let j = 0; j < tileCount; j++) {
        const tx = Math.floor(rng.next() * gridSize);
        const ty = Math.floor(rng.next() * gridSize);
        if (!occupied.has(`${tx},${ty}`)) {
          const types: TileType[] = ['conveyor-up', 'conveyor-down', 'conveyor-left', 'conveyor-right', 'gate-vertical', 'gate-horizontal'];
          const tType = rng.pick(types);
          const isOpen = tType.startsWith('gate') ? rng.next() < 0.5 : undefined;
          tiles.push({ x: tx, y: ty, type: tType, isOpen });
          occupied.add(`${tx},${ty}`);
        }
      }
    }

    for (let i = 0; i < targetCount; i++) {
      const candidates: { x: number, y: number, dir: Direction, type: ArrowType, score: number }[] = [];
      const types: ArrowType[] = ['normal'];
      
      if (levelIdx > 8) types.push('rotator');
      if (levelIdx > 18) types.push('shifter');
      if (levelIdx > 35) types.push('locked');
      if (levelIdx > 50 && rng.next() < 0.3) types.push('switch');

      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          if (occupied.has(`${x},${y}`)) continue;
          for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
            if (!isPathBlocked({ x, y, dir }, arrows, tiles)) {
              let score = 0;
              
              // Enhanced Archetype Heuristics
              const centerX = gridSize / 2;
              const centerY = gridSize / 2;
              const distFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

              switch (archetype) {
                case 'cluster':
                  arrows.forEach(ar => { if (Math.abs(ar.x - x) + Math.abs(ar.y - y) === 1) score += 20; });
                  break;
                case 'spiral':
                  const angle = Math.atan2(y - centerY, x - centerX);
                  const expectedAngle = (distFromCenter * 2) % (Math.PI * 2);
                  if (Math.abs(angle - expectedAngle) < 0.5) score += 30;
                  break;
                case 'vortex':
                  // Arrows point in a tangent direction to the center
                  const dx = x - centerX;
                  const dy = y - centerY;
                  if (dir === 'up' && dx > 0) score += 20;
                  if (dir === 'down' && dx < 0) score += 20;
                  if (dir === 'left' && dy < 0) score += 20;
                  if (dir === 'right' && dy > 0) score += 20;
                  break;
                case 'checkerboard':
                  if ((x + y) % 2 === 0) score += 40;
                  break;
                case 'columns':
                  if (x % 2 === 0) score += 30;
                  break;
                case 'rows':
                  if (y % 2 === 0) score += 30;
                  break;
                case 'dense-core':
                  score += (gridSize - distFromCenter) * 10;
                  break;
                case 'scattered':
                  score += distFromCenter * 5;
                  arrows.forEach(ar => { if (Math.abs(ar.x - x) + Math.abs(ar.y - y) < 3) score -= 10; });
                  break;
                case 'symmetry':
                  if (occupied.has(`${gridSize - 1 - x},${gridSize - 1 - y}`)) score += 40;
                  break;
                case 'crossfire':
                  arrows.forEach(ar => { if ((ar.x === x || ar.y === y) && (ar.dir === 'up' || ar.dir === 'down') !== (dir === 'up' || dir === 'down')) score += 25; });
                  break;
                case 'perimeter':
                  if (x === 0 || x === gridSize - 1 || y === 0 || y === gridSize - 1) score += 30;
                  break;
              }

              score += rng.next() * 15;
              types.forEach(type => candidates.push({ x, y, dir, type, score }));
            }
          }
        }
      }

      if (candidates.length === 0) break;
      candidates.sort((a, b) => b.score - a.score);
      const complexityFactor = isElite ? 2 : 6;
      const best = candidates[Math.floor(rng.next() * Math.min(candidates.length, complexityFactor))];
      
      const newArrow: ArrowData = {
        id: `l${levelIdx}-${i}-${rng.next().toString(36).substr(2, 4)}`,
        x: best.x, y: best.y, dir: best.dir, type: best.type
      };

      // APPLY INVERSE PHYSICS
      if (newArrow.type === 'rotator') {
        const rotateCCW = (d: Direction): Direction => ({ up: 'left', left: 'down', down: 'right', right: 'up' } as Record<Direction, Direction>)[d];
        arrows = arrows.map(a => (Math.abs(a.x - newArrow.x) + Math.abs(a.y - newArrow.y) === 1) ? { ...a, dir: rotateCCW(a.dir) } : a);
      }
      if (newArrow.type === 'switch') tiles = tiles.map(t => ({ ...t, isOpen: !t.isOpen }));
      if (newArrow.type === 'shifter') {
        arrows = arrows.map(a => {
          const isSameCol = a.x === newArrow.x && (newArrow.dir === 'up' || newArrow.dir === 'down');
          const isSameRow = a.y === newArrow.y && (newArrow.dir === 'left' || newArrow.dir === 'right');
          if (isSameCol || isSameRow) {
            let nx = a.x, ny = a.y;
            if (newArrow.dir === 'up') ny++; if (newArrow.dir === 'down') ny--; if (newArrow.dir === 'left') nx++; if (newArrow.dir === 'right') nx--;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !occupied.has(`${nx},${ny}`)) {
              occupied.delete(`${a.x},${a.y}`); occupied.add(`${nx},${ny}`); return { ...a, x: nx, y: ny };
            }
          }
          return a;
        });
      }

      arrows.push(newArrow);
      occupied.add(`${newArrow.x},${newArrow.y}`);
    }

    // Key management
    if (arrows.some(a => a.type === 'locked')) {
      const candidatesForKey = arrows.filter(a => a.type === 'normal' || a.type === 'rotator' || a.type === 'shifter');
      if (candidatesForKey.length > 0) candidatesForKey[candidatesForKey.length - 1].type = 'key';
      else arrows.forEach(a => a.type = 'normal');
    }

    const toolbox: ToolboxConfig | undefined = levelIdx > 25 ? {
      rotations: Math.floor(rng.next() * (isElite ? 1 : 2)) + 1,
      shifts: levelIdx > 50 ? Math.floor(rng.next() * 2) : 0
    } : undefined;

    const level: Level = { 
      gridSize, 
      arrows: arrows.sort(() => rng.next() - 0.5), 
      tiles, toolbox,
      clickLimit: Math.ceil(arrows.length * (isBlitz ? 1.05 : 1.3)),
      timeLimit: isBlitz ? Math.max(20, arrows.length * 1.5) : Math.max(30, arrows.length * 3)
    };
    if (isSolvable(level)) return level;
  }

  return { gridSize: 4, arrows: HAND_CRAFTED_LEVELS[0].arrows, clickLimit: 10, timeLimit: 60 };
}

export const HAND_CRAFTED_LEVELS: Level[] = [
  {
    gridSize: 4,
    arrows: [
      { id: '1-1', x: 1, y: 1, dir: 'right' },
      { id: '1-2', x: 2, y: 1, dir: 'right' },
    ],
    clickLimit: 10,
    timeLimit: 120
  },
  {
    gridSize: 4,
    arrows: [
      { id: 'rot-1', x: 1, y: 1, dir: 'up', type: 'rotator' },
      { id: 'rot-2', x: 1, y: 0, dir: 'left' },
    ],
    clickLimit: 15,
    timeLimit: 150
  },
  {
    gridSize: 4,
    arrows: [
      { id: 'key-1', x: 1, y: 1, dir: 'up', type: 'key' },
      { id: 'lock-1', x: 2, y: 1, dir: 'right', type: 'locked' },
    ],
    clickLimit: 15,
    timeLimit: 180
  },
];

const TOTAL_LEVELS_COUNT = 600;
export const LEVELS: Level[] = [...HAND_CRAFTED_LEVELS];

for (let i = HAND_CRAFTED_LEVELS.length; i < TOTAL_LEVELS_COUNT; i++) {
  LEVELS.push(generateProceduralLevel(i));
}
