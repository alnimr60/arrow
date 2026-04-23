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
  
  // Stable Fisher-Yates Shuffle
  shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/**
 * Procedural Level Generator with Logical Depth Emphasis
 */
export function generateProceduralLevel(levelIdx: number): Level {
  const rng = new SeededRandom(levelIdx + 7777);

  // Faster grid expansion for more logical space
  let gridSize = 4;
  if (levelIdx > 15) gridSize = 5;
  if (levelIdx > 50) gridSize = 6;
  if (levelIdx > 120) gridSize = 7;
  if (levelIdx > 220) gridSize = 8;
  if (levelIdx > 351) gridSize = 9;
  if (levelIdx > 480) gridSize = 10;

  const isElite = (levelIdx + 1) % 5 === 0;
  const isBlitz = (levelIdx + 1) % 7 === 0;

  // Higher density for more "overlap" and blocking chains
  const baseDensity = 0.35;
  const densityGrowth = Math.min(0.25, levelIdx * 0.001);
  const densityMultiplier = baseDensity + densityGrowth + (isElite ? 0.12 : 0);
  const targetCount = Math.floor(gridSize * gridSize * Math.min(0.7, densityMultiplier));

  let attempts = 0;
  while (attempts < 40) {
    attempts++;
    let arrows: ArrowData[] = [];
    let tiles: TileData[] = [];
    const occupied = new Set<string>();

    // Tiles (Gates: Strategic obstacles)
    if (levelIdx > 12 && rng.next() < (isElite ? 0.8 : 0.4)) {
      const tileCount = Math.min(4, Math.floor(levelIdx / 30) + 1);
      for (let j = 0; j < tileCount; j++) {
        const tx = Math.floor(rng.next() * gridSize);
        const ty = Math.floor(rng.next() * gridSize);
        if (!occupied.has(`${tx},${ty}`)) {
          const type: TileType = rng.pick(['gate-vertical', 'gate-horizontal']);
          tiles.push({ x: tx, y: ty, type, isOpen: false });
          occupied.add(`${tx},${ty}`);
        }
      }
    }

    /**
     * INVERSE GENERATION LOGIC:
     * We build the level by picking a location and "backing" an arrow into it.
     * We prioritize placements that block other arrows.
     */
    for (let i = 0; i < targetCount; i++) {
        const candidates: { x: number, y: number, dir: Direction, type: ArrowType, score: number }[] = [];
        
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                if (occupied.has(`${x},${y}`)) continue;
                
                for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
                    // Simulation check: Can this arrow EXIT if it were the only one?
                    // (Inverse: Can it enter from the edge without hitting a tile?)
                    if (!isPathBlocked({ x, y, dir }, [], tiles)) {
                        let score = 10;
                        
                        // LOGICAL DEPTH HEURISTICS:
                        // 1. Prefer picking a spot that BLOCKS an existing arrow
                        const blockersCount = arrows.filter(a => {
                            switch (a.dir) {
                                case 'up': return a.x === x && a.y > y;
                                case 'down': return a.x === x && a.y < y;
                                case 'left': return a.y === y && a.x > x;
                                case 'right': return a.y === y && a.x < x;
                            }
                        }).length;
                        score += blockersCount * 40;

                        // 2. Prefer spots that are themselves blocked by tiles (forcing gate interaction)
                        const tileBlocked = tiles.some(t => {
                            switch (dir) {
                                case 'up': return t.x === x && t.y < y;
                                case 'down': return t.x === x && t.y > y;
                                case 'left': return t.y === y && t.x < x;
                                case 'right': return t.y === y && t.x > x;
                            }
                        });
                        if (tileBlocked) score += 30;

                        // 3. Central bias for denser chains
                        const distFromCenter = Math.abs(x - (gridSize/2)) + Math.abs(y - (gridSize/2));
                        score += (gridSize - distFromCenter) * 5;

                        // Types
                        let type: ArrowType = 'normal';
                        if (levelIdx > 8 && rng.next() < 0.2) type = 'rotator';
                        else if (levelIdx > 18 && rng.next() < 0.15) type = 'shifter';
                        else if (levelIdx > 35 && rng.next() < 0.1) type = 'locked';
                        else if (levelIdx > 50 && rng.next() < 0.05) type = 'switch';

                        score += rng.next() * 10;
                        candidates.push({ x, y, dir, type, score });
                    }
                }
            }
        }

        if (candidates.length === 0) break;
        candidates.sort((a,b) => b.score - a.score);
        
        // Pick from top candidates (higher difficulty = pick top scores)
        const variance = isElite ? 2 : 4;
        const best = candidates[Math.floor(rng.next() * Math.min(candidates.length, variance))];
        
        const newArrow: ArrowData = {
          id: `l${levelIdx}-${i}-${rng.next().toString(36).substr(2, 4)}`,
          x: best.x, y: best.y, dir: best.dir, type: best.type
        };

        // Effects of "placing" (Inverse operation)
        if (newArrow.type === 'rotator') {
            const rotateCCW = (d: Direction): Direction => ({ up: 'left', left: 'down', down: 'right', right: 'up' } as Record<Direction, Direction>)[d];
            arrows = arrows.map(a => (Math.abs(a.x - newArrow.x) + Math.abs(a.y - newArrow.y) === 1) ? { ...a, dir: rotateCCW(a.dir) } : a);
        }
        if (newArrow.type === 'switch') tiles = tiles.map(t => ({ ...t, isOpen: !t.isOpen }));
        
        arrows.push(newArrow);
        occupied.add(`${newArrow.x},${newArrow.y}`);
    }

    // Secondary Logic: Ensure keys exist for locks
    if (arrows.some(a => a.type === 'locked')) {
        const canBeKey = arrows.filter(a => a.type === 'normal');
        if (canBeKey.length > 0) rng.pick(canBeKey).type = 'key';
        else arrows = arrows.filter(a => a.type !== 'locked');
    }

    // Dynamic Toolbox: Rare but powerful rotations/shifts
    const toolbox: ToolboxConfig | undefined = levelIdx > 25 ? {
      rotations: rng.next() < 0.3 ? 1 : 0,
      shifts: levelIdx > 80 && rng.next() < 0.2 ? 1 : 0
    } : undefined;

    const level: Level = {
      gridSize,
      arrows: rng.shuffle(arrows),
      tiles,
      toolbox,
      // TIGHTER LIMITS: Force perfect play
      clickLimit: Math.floor(arrows.length * (isElite ? 1.02 : 1.15)) + (toolbox?.rotations || 0) + (toolbox?.shifts || 0),
      timeLimit: isBlitz ? Math.max(12, arrows.length * 1.1) : Math.max(30, arrows.length * 3)
    };

    if (isSolvable(level)) return level;
  }

  return { gridSize: 4, arrows: HAND_CRAFTED_LEVELS[0].arrows, clickLimit: 12, timeLimit: 60 };
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
