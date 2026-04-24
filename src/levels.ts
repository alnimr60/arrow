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

type GenerationStrategy = 'Critical Chain' | 'Dependency Web' | 'Sparse but Critical' | 'Clustered Challenge';

/**
 * Procedural Level Generator with Strategic Architectures
 */
export function generateProceduralLevel(levelIdx: number, mode: 'standard' | 'invisible' = 'standard'): Level {
  // Unique seed per mode + level combination
  const seed = mode === 'standard' ? levelIdx + 7777 : levelIdx + 14000;
  const rng = new SeededRandom(seed);

  // Grid scaling - Adjusted for mode and 300 levels
  let gridSize = 4;
  if (mode === 'standard') {
    if (levelIdx > 15) gridSize = 5;
    if (levelIdx > 50) gridSize = 6;
    if (levelIdx > 120) gridSize = 7;
    if (levelIdx > 220) gridSize = 8;
    if (levelIdx > 351) gridSize = 9;
    if (levelIdx > 480) gridSize = 10;
  } else {
    // Invisible mode starts small and stays manageable longer due to higher difficulty
    if (levelIdx > 20) gridSize = 5;
    if (levelIdx > 70) gridSize = 6;
    if (levelIdx > 150) gridSize = 7;
    if (levelIdx > 250) gridSize = 8;
  }

  // Strategy Selection
  const strategies: GenerationStrategy[] = ['Critical Chain', 'Dependency Web', 'Sparse but Critical', 'Clustered Challenge'];
  const strategy = strategies[levelIdx % strategies.length];

  const isElite = (levelIdx + 1) % 5 === 0;
  const isBlitz = (levelIdx + 1) % 7 === 0;

  // Density and target count
  const baseDensity = strategy === 'Sparse but Critical' ? 0.2 : 0.35;
  const densityGrowth = Math.min(0.3, levelIdx * 0.002);
  const densityMultiplier = baseDensity + densityGrowth + (isElite ? 0.15 : 0);
  const targetCount = Math.floor(gridSize * gridSize * Math.min(0.8, densityMultiplier));

  let attempts = 0;
  while (attempts < 60) {
    attempts++;
    let arrows: ArrowData[] = [];
    let tiles: TileData[] = [];
    const occupied = new Set<string>();

    // Tiles (Gates)
    const gateChance = strategy === 'Sparse but Critical' ? 0.7 : (isElite ? 0.8 : 0.4);
    if (levelIdx > 12 && rng.next() < gateChance) {
      const tileCount = Math.min(6, Math.floor(levelIdx / 25) + 1);
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
     * INVERSE GENERATION WITH STRATEGIES
     */
    const currentTargetCount = attempts > 50 ? Math.floor(targetCount * 0.7) : targetCount;
    
    for (let i = 0; i < currentTargetCount; i++) {
        const candidates: { x: number, y: number, dir: Direction, type: ArrowType, score: number }[] = [];
        
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                if (occupied.has(`${x},${y}`)) continue;
                
                // Strategy-specific spatial constraints
                if (strategy === 'Clustered Challenge') {
                  // Bias towards clusters (simple quadrant logic)
                  const quadIdx = Math.floor(i / (currentTargetCount / 3));
                  const isRight = quadIdx === 1 || quadIdx === 2;
                  const isBottom = quadIdx >= 2;
                  if (isRight && x < gridSize / 2) continue;
                  if (!isRight && x >= gridSize / 2) continue;
                  if (isBottom && y < gridSize / 2) continue;
                  if (!isBottom && y >= gridSize / 2) continue;
                }

                for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
                    if (!isPathBlocked({ x, y, dir }, [], tiles)) {
                        let score = 10;
                        
                        const blocksList = arrows.filter(a => {
                            switch (a.dir) {
                                case 'up': return a.x === x && a.y > y;
                                case 'down': return a.x === x && a.y < y;
                                case 'left': return a.y === y && a.x > x;
                                case 'right': return a.y === y && a.x < x;
                            }
                        });

                        const blockedByOthers = arrows.some(a => {
                            switch (dir) {
                                case 'up': return a.x === x && a.y < y;
                                case 'down': return a.x === x && a.y > y;
                                case 'left': return a.y === y && a.x < x;
                                case 'right': return a.y === y && a.x > x;
                            }
                        });

                        if (!blockedByOthers) {
                          // APPLY STRATEGY LOGIC TO SCORING
                          if (strategy === 'Critical Chain') {
                            // Favor blocking the EXACT last arrow placed to build a linear chain
                            const lastArrow = arrows[arrows.length - 1];
                            if (lastArrow && blocksList.some(a => a.id === lastArrow.id)) {
                              score += 100;
                            } else if (arrows.length > 0) {
                              score -= 30; // Penalize non-chain extensions
                            }
                          } else if (strategy === 'Dependency Web') {
                            // Favor blocking arrows that are ALREADY blocking others (deep tree)
                            const deepBlocks = blocksList.filter(target => 
                              arrows.some(other => {
                                switch(target.dir) {
                                  case 'up': return other.x === target.x && other.y > target.y;
                                  case 'down': return other.x === target.x && other.y < target.y;
                                  case 'left': return other.y === target.y && other.x > target.x;
                                  case 'right': return other.y === target.y && other.x < target.x;
                                }
                              })
                            ).length;
                            score += deepBlocks * 50;
                            // Also favor blocking MULTIPLE arrows at once
                            score += blocksList.length * 20;
                          } else if (strategy === 'Sparse but Critical') {
                            // Favor placements that overlap multiple paths
                            score += blocksList.length * 60;
                          } else {
                            // Default / Clustered
                            score += blocksList.length * 40;
                          }
                        } else {
                          score -= 50; 
                        }

                        // Boundary check: Prefer inner placements for complex puzzles
                        const distFromEdge = Math.min(x, gridSize - 1 - x, y, gridSize - 1 - y);
                        score += distFromEdge * 15;

                        score += rng.next() * 10;
                        candidates.push({ x, y, dir, type: 'normal', score });
                    }
                }
            }
        }

        if (candidates.length === 0) break;
        candidates.sort((a,b) => b.score - a.score);
        
        // Elite levels pick more strictly from the best candidates
        const variance = isElite ? 1 : Math.max(1, Math.floor(candidates.length / 4));
        const best = candidates[Math.floor(rng.next() * variance)];
        
        let type: ArrowType = best.type;
        // Adjust type probabilities by strategy
        const typeRoll = rng.next();
        if (strategy === 'Sparse but Critical') {
          if (levelIdx > 20 && typeRoll < 0.25) type = 'rotator';
          else if (levelIdx > 30 && typeRoll < 0.4) type = 'shifter';
        } else {
          if (levelIdx > 8 && typeRoll < 0.15) type = 'rotator';
          else if (levelIdx > 18 && typeRoll < 0.25) type = 'shifter';
          else if (levelIdx > 35 && typeRoll < 0.3) type = 'locked';
          else if (levelIdx > 50 && typeRoll < 0.35) type = 'switch';
        }

        const newArrow: ArrowData = {
          id: `l${levelIdx}-${i}-${rng.next().toString(36).substr(2, 4)}`,
          x: best.x, y: best.y, dir: best.dir, type
        };

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
      strategy,
      // TIGHTER LIMITS: Force perfect play
      clickLimit: Math.floor(arrows.length * (isElite ? 1.02 : 1.15)) + (toolbox?.rotations || 0) + (toolbox?.shifts || 0),
      timeLimit: isBlitz ? Math.max(12, arrows.length * 1.1) : Math.max(30, arrows.length * 3)
    };

    if (isSolvable(level)) {
      // Final check: Don't return tiny levels for high indices
      if (levelIdx > 10 && level.arrows.length < 5) continue;
      return level;
    }
  }

  // Robust fallback: Generates a guaranteed solvable 5x5 level if complex generation fails
  const fallbackRng = new SeededRandom(levelIdx + 555);
  const fallbackArrows: ArrowData[] = [];
  const startX = Math.floor(fallbackRng.next() * 2);
  const startY = Math.floor(fallbackRng.next() * 2);
  
  for (let i = 0; i < 7; i++) {
    fallbackArrows.push({
      id: `f-${levelIdx}-${i}`,
      x: (startX + i) % 5,
      y: (startY + Math.floor(i / 2)) % 5,
      dir: fallbackRng.pick(['up', 'down', 'left', 'right']),
      type: 'normal'
    });
  }

  return { 
    gridSize: 5, 
    arrows: fallbackArrows,
    clickLimit: 12,
    timeLimit: 60,
    strategy: 'Safety Fallback'
  };
}

export const HAND_CRAFTED_LEVELS: Level[] = [
  {
    gridSize: 4,
    arrows: [
      { id: '1-1', x: 1, y: 1, dir: 'right' },
      { id: '1-2', x: 2, y: 1, dir: 'right' },
    ],
    clickLimit: 10,
    timeLimit: 120,
    strategy: 'Tutorial'
  },
  {
    gridSize: 4,
    arrows: [
      { id: 'rot-1', x: 1, y: 1, dir: 'up', type: 'rotator' },
      { id: 'rot-2', x: 1, y: 0, dir: 'left' },
    ],
    clickLimit: 15,
    timeLimit: 150,
    strategy: 'Tutorial'
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

const TOTAL_STANDARD_LEVELS = 600;
const TOTAL_INVISIBLE_LEVELS = 300;

const standardLevels: (Level | null)[] = new Array(TOTAL_STANDARD_LEVELS).fill(null);
const invisibleLevels: (Level | null)[] = new Array(TOTAL_INVISIBLE_LEVELS).fill(null);

HAND_CRAFTED_LEVELS.forEach((level, i) => {
  if (i < TOTAL_STANDARD_LEVELS) standardLevels[i] = level;
});

/**
 * Get level by index and mode, generating it lazily if not already created.
 */
export function getLevel(idx: number, mode: 'standard' | 'invisible' = 'standard'): Level {
  const isStandard = mode === 'standard';
  const levels = isStandard ? standardLevels : invisibleLevels;
  const total = isStandard ? TOTAL_STANDARD_LEVELS : TOTAL_INVISIBLE_LEVELS;

  if (idx < 0 || idx >= total) return HAND_CRAFTED_LEVELS[0];
  
  if (!levels[idx]) {
    // Pass the mode to generation so it can handle progression correctly
    levels[idx] = generateProceduralLevel(idx, mode);
  }
  return levels[idx]!;
}

/**
 * Metadata for all levels (e.g. for level selector UI)
 */
export const getLevelMetadata = (mode: 'standard' | 'invisible' = 'standard') => {
  const total = mode === 'standard' ? TOTAL_STANDARD_LEVELS : TOTAL_INVISIBLE_LEVELS;
  return Array.from({ length: total }).map((_, i) => {
    let gridSize = 4;
    // Standard progression
    if (mode === 'standard') {
      if (i > 15) gridSize = 5;
      if (i > 50) gridSize = 6;
      if (i > 120) gridSize = 7;
      if (i > 220) gridSize = 8;
      if (i > 351) gridSize = 9;
      if (i > 480) gridSize = 10;
    } else {
      // Invisible mode progression (now 300 stages)
      if (i > 20) gridSize = 5;
      if (i > 70) gridSize = 6;
      if (i > 150) gridSize = 7;
      if (i > 250) gridSize = 8;
    }
    return { id: i, gridSize };
  });
};
