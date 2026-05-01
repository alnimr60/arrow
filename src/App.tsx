/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Lightbulb, 
  CheckCircle2,
  Undo2,
  Trophy,
  LayoutGrid,
  X,
  Lock,
  Key,
  Move,
  Volume2,
  VolumeX,
  Clock,
  Play,
  AlertTriangle,
  Settings,
  RotateCcw as RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { Direction, ArrowData, Level, TileData, ToolboxConfig } from './types';
import { getLevel, getLevelMetadata, generateProceduralLevel } from './levels';
import { soundService } from './services/soundService';

/**
 * Arrow Escape Puzzle
 * A logic game where you untangle arrows by removing them in the correct order.
 */

// Noise Overlay for technical texture - Simplified for performance
const NoiseOverlay = React.memo(() => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  if (isMobile) return null; // Disable filter on mobile for better FPS

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none opacity-[0.03] mix-blend-overlay">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    </div>
  );
});

// Realistic Menu Previews - Memoized to prevent re-renders
const MenuPreviewBoard = React.memo(({ mode, levelIdx }: { mode: 'standard' | 'invisible', levelIdx: number }) => {
  const level = useMemo(() => getLevel(levelIdx, mode), [levelIdx, mode]);
  const [pointerPos, setPointerPos] = useState({ x: 150, y: 150 });
  const boardRef = useRef<HTMLDivElement>(null);

  // Auto-move flashlight for invisible mode preview - smoother path
  useEffect(() => {
    if (mode !== 'invisible') return;
    let frame = 0;
    const animate = () => {
      frame += 0.015;
      // Figure-8 pattern to scan more area
      const x = 160 + Math.sin(frame) * 90;
      const y = 160 + Math.sin(frame * 0.5) * 90;
      setPointerPos({ x, y });
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [mode]);

  return (
    <div className="relative group/preview">
      {/* Technical Brackets for Previews */}
      <div className="panel-corner top-[-10px] left-[-10px] border-t-2 border-l-2 opacity-20 group-hover/preview:opacity-100 transition-opacity" />
      <div className="panel-corner bottom-[-10px] right-[-10px] border-b-2 border-r-2 opacity-20 group-hover/preview:opacity-100 transition-opacity" />

      <div 
        ref={boardRef}
        className={`relative bg-[#020617] border-2 border-white/20 rounded-[32px] p-3 shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-none scale-100 md:scale-125 lg:scale-[1.4] transition-all duration-700`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${level.gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${level.gridSize}, 1fr)`,
          gap: '6px',
          width: '300px',
          height: '300px',
        }}
      >
        {/* Dynamic Grid Glow - Shader effect */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_100%)] z-0" />
        
        {/* Grid Background Cells - Matches actual game */}
        {Array.from({ length: level.gridSize * level.gridSize }).map((_, i) => (
          <div key={i} className="bg-slate-900/40 rounded-xl" />
        ))}

        {/* Invisible Overlay */}
        {mode === 'invisible' && (
          <div 
            className="absolute inset-0 z-30 pointer-events-none"
            style={{
              background: `radial-gradient(circle 80px at ${pointerPos.x}px ${pointerPos.y}px, transparent 0%, rgba(2, 6, 23, 1) 100%)`
            }}
          />
        )}

      {/* Arrows - Same visual logic as GameBoard */}
      {level.arrows.map((arrow: ArrowData) => {
        const cellSize = (300 - 24 - (level.gridSize - 1) * 6) / level.gridSize;
        return (
          <div
            key={arrow.id}
            className="absolute flex items-center justify-center rounded-lg z-10"
            style={{
              width: `${cellSize}px`,
              height: `${cellSize}px`,
              left: `${12 + arrow.x * (cellSize + 6)}px`,
              top: `${12 + arrow.y * (cellSize + 6)}px`,
              backgroundColor: arrow.type === 'key' ? 'rgba(245, 158, 11, 0.1)' :
                               arrow.type === 'rotator' ? 'rgba(168, 85, 247, 0.1)' :
                               arrow.type === 'shifter' ? 'rgba(6, 182, 212, 0.1)' :
                               arrow.type === 'switch' ? 'rgba(236, 72, 153, 0.1)' : 'transparent'
            }}
          >
            <ArrowIcon arrow={arrow} />
            {arrow.type === 'locked' && <Lock size={12} className="text-white/40" />}
            {arrow.type === 'key' && <div className="absolute -top-1 -right-1"><div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" /></div>}
          </div>
        );
      })}
      </div>
    </div>
  );
});

const GLOW_STYLE = "shadow-[0_0_15px_rgba(34,211,238,0.2)]";
const PANEL_STYLE = "bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem]";

// Simplified HUD Components to minimize re-renders
const StaticHUD = React.memo(({ gameTitle, systemInfo, isMuted, onToggleMute }: { gameTitle: string, systemInfo: string, isMuted: boolean, onToggleMute: () => void }) => {
  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-50 border-[8px] md:border-[16px] border-black border-opacity-40" />
      <div className="fixed inset-4 md:inset-8 pointer-events-none z-50 border border-white/5 rounded-[2rem]" />
      
      <div className="fixed top-8 left-8 md:top-14 md:left-14 z-[60] flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-[#22d3ee] rounded-full animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
          <h1 className="text-xl font-black italic uppercase tracking-tighter text-white/90">{gameTitle}</h1>
        </div>
        <div className="text-[9px] text-[#22d3ee] font-black uppercase tracking-[0.4em] opacity-60">{systemInfo}</div>
      </div>

      <div className="fixed top-8 right-8 md:top-14 md:right-14 z-[60] pointer-events-auto">
        <button 
          onClick={onToggleMute}
          className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all group"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </>
  );
});

// Memoized Time Display to isolate timer re-renders
const TimeDisplay = React.memo(({ timeLeft }: { timeLeft: number | null }) => {
  if (timeLeft === null) return <span className="text-white">--:--</span>;
  
  const mins = Math.floor(timeLeft / 60);
  const secs = Math.floor(timeLeft % 60);
  const ms = Math.floor((timeLeft % 1) * 10);
  
  return (
    <span className="flex items-baseline gap-0.5 text-white">
      {mins}:{secs.toString().padStart(2, '0')}
      <span className="text-[12px] opacity-40 font-bold">.{ms}</span>
    </span>
  );
});

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'game' | 'timedConfig' | 'timedResult'>('menu');
  const [gameMode, setGameMode] = useState<'standard' | 'invisible' | 'timed' | 'premove'>('standard');
  const [timedFlavor, setTimedFlavor] = useState<'standard' | 'invisible'>('standard');
  const [timedDuration, setTimedDuration] = useState<1 | 3 | 5>(3);
  const [timedScore, setTimedScore] = useState(0);
  const [lastSessionDuration, setLastSessionDuration] = useState<number>(3);
  const [timedLevelIdx, setTimedLevelIdx] = useState(0);

  const [standardLevelIdx, setStandardLevelIdx] = useState(() => {
    const saved = localStorage.getItem('standard-level');
    return saved ? parseInt(saved) : 0;
  });
  const [invisibleLevelIdx, setInvisibleLevelIdx] = useState(() => {
    const saved = localStorage.getItem('invisible-level');
    return saved ? parseInt(saved) : 0;
  });
  const [premoveLevelIdx, setPremoveLevelIdx] = useState(() => {
    const saved = localStorage.getItem('premove-level');
    return saved ? parseInt(saved) : 0;
  });

  const [standardMaxLevel, setStandardMaxLevel] = useState(() => {
    const saved = localStorage.getItem('standard-max-level');
    return saved ? parseInt(saved) : 0;
  });
  const [invisibleMaxLevel, setInvisibleMaxLevel] = useState(() => {
    const saved = localStorage.getItem('invisible-max-level');
    return saved ? parseInt(saved) : 0;
  });
  const [premoveMaxLevel, setPremoveMaxLevel] = useState(() => {
    const saved = localStorage.getItem('premove-max-level');
    return saved ? parseInt(saved) : 0;
  });

  const lastScoredTimedLevelRef = useRef<number | null>(null);
  const lastExecutedIndexRef = useRef<number>(-1);

  const currentLevelIdx = gameMode === 'timed' ? timedLevelIdx : 
                         gameMode === 'standard' ? standardLevelIdx : 
                         gameMode === 'invisible' ? invisibleLevelIdx : premoveLevelIdx;
  const maxReachedLevel = gameMode === 'standard' ? standardMaxLevel : 
                          gameMode === 'invisible' ? invisibleMaxLevel : 
                          gameMode === 'premove' ? premoveMaxLevel : 0;
  const setCurrentLevelIdx = (valOrFn: number | ((prev: number) => number)) => {
    if (gameMode === 'standard') {
      setStandardLevelIdx(valOrFn);
      const next = typeof valOrFn === 'function' ? valOrFn(standardLevelIdx) : valOrFn;
      localStorage.setItem('standard-level', next.toString());
    } else if (gameMode === 'invisible') {
      setInvisibleLevelIdx(valOrFn);
      const next = typeof valOrFn === 'function' ? valOrFn(invisibleLevelIdx) : valOrFn;
      localStorage.setItem('invisible-level', next.toString());
    } else if (gameMode === 'premove') {
      setPremoveLevelIdx(valOrFn);
      const next = typeof valOrFn === 'function' ? valOrFn(premoveLevelIdx) : valOrFn;
      localStorage.setItem('premove-level', next.toString());
    }
  };
  const setMaxReachedLevel = (val: number) => {
    if (gameMode === 'standard') {
      setStandardMaxLevel(val);
      localStorage.setItem('standard-max-level', val.toString());
    } else if (gameMode === 'invisible') {
      setInvisibleMaxLevel(val);
      localStorage.setItem('invisible-max-level', val.toString());
    } else if (gameMode === 'premove') {
      setPremoveMaxLevel(val);
      localStorage.setItem('premove-max-level', val.toString());
    }
  };

  const LEVEL_METADATA = useMemo(() => getLevelMetadata(gameMode), [gameMode]);
  
  const [arrows, setArrows] = useState<ArrowData[]>([]);
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<{ arrows: ArrowData[], removedIds: Set<string>, tiles: TileData[], toolbox: ToolboxConfig, clicks?: number }[]>([]);
  const [toolbox, setToolbox] = useState<ToolboxConfig>({ rotations: 0, shifts: 0 });
  const [activeTool, setActiveTool] = useState<'rotate' | null>(null);
  const [premoveQueue, setPremoveQueue] = useState<string[]>([]);
  const [isExecutingPremove, setIsExecutingPremove] = useState(false);
  const [execIndex, setExecIndex] = useState(-1);
  const [hoveredArrowId, setHoveredArrowId] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [hintId, setHintId] = useState<string | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<'clicks' | 'time' | 'blocked' | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timedTotalSeconds, setTimedTotalSeconds] = useState(0);
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  const activeLevelRef = useRef<HTMLButtonElement>(null);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('arrow-escape-muted');
    return saved === 'true';
  });
  
  const lastClickTimeRef = useRef(0);
  
  const currentLevel = useMemo(() => {
    if (gameMode === 'timed') {
      return generateProceduralLevel(timedLevelIdx, timedFlavor, true);
    }
    return getLevel(currentLevelIdx, gameMode);
  }, [currentLevelIdx, gameMode, timedLevelIdx, timedFlavor]);

  useEffect(() => {
    localStorage.setItem('arrow-escape-muted', isMuted.toString());
    if (!isMuted) {
      soundService.resume();
    }
  }, [isMuted]);

  // Audio Context wake-up on focus/visibility
  useEffect(() => {
    const handleFocus = () => {
      if (!isMuted) soundService.resume();
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !isMuted) {
        soundService.resume();
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isMuted]);

  useEffect(() => {
    if (currentLevelIdx > maxReachedLevel && gameMode !== 'timed') {
      setMaxReachedLevel(currentLevelIdx);
    }
  }, [currentLevelIdx, maxReachedLevel]);

  // Scroll to top and lock scroll on screens (Important for mobile UX)
  useEffect(() => {
    // Scroll to top immediately on screen change
    window.scrollTo(0, 0);
    document.body.scrollTo(0, 0);
    document.documentElement.scrollTo(0, 0);

    // Handle scroll locking for overlays
    const isOverlayActive = currentScreen === 'timedConfig' || currentScreen === 'timedResult';
    
    if (isOverlayActive) {
      // Save current scroll and lock
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none'; 
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }

    // Secondary safety scroll
    const scrollTask = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
    
    return () => {
      cancelAnimationFrame(scrollTask);
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [currentScreen, gameMode]);

  // Timer Effect: Responsive 100ms update for "counting moments"
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || showVictory || showGameOver || currentScreen !== 'game') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null;
        const next = Math.max(0, prev - 0.1);
        
        if (next <= 0 && !showVictory) {
          clearInterval(timer);
          if (gameMode === 'timed') {
            setCurrentScreen('timedResult');
            if (!isMuted) soundService.playSuccess(); // End of game sound
          } else {
            setGameOverReason('time');
            setShowGameOver(true);
            if (!isMuted) soundService.playError();
          }
          return 0;
        }
        return next;
      });
    }, 100); 

    return () => clearInterval(timer);
  }, [showVictory, showGameOver, isMuted, timeLeft === null, gameMode, currentScreen]);

  // Initial Level
  useEffect(() => {
    setArrows(currentLevel.arrows);
    setTiles(currentLevel.tiles || []);
    setToolbox(currentLevel.toolbox || { rotations: 0, shifts: 0 });
    setRemovedIds(new Set());
    setHistory([]);
    setHintId(null);
    setShowVictory(false);
    setShowGameOver(false);
    setGameOverReason(null);
    setClickCount(0);
    setPremoveQueue([]);
    setIsExecutingPremove(false);
    setExecIndex(-1);
    lastExecutedIndexRef.current = -1;
    
    if (gameMode === 'timed') {
      if (timeLeft === null) {
        const totalSecs = timedDuration * 60;
        setTimeLeft(totalSecs);
        setTimedTotalSeconds(totalSecs);
        setLastSessionDuration(timedDuration);
        setTimedScore(0);
        lastScoredTimedLevelRef.current = null;
      }
    } else {
      setTimeLeft(currentLevel.timeLimit || null);
    }
    
    if (!isMuted) soundService.playLevelStart();
    localStorage.setItem('arrow-escape-level', currentLevelIdx.toString());
  }, [currentLevelIdx, currentLevel, gameMode, timedDuration]);

  const hasKeys = useMemo(() => {
    return (arrows || []).some(a => !removedIds.has(a.id) && a.type === 'key');
  }, [arrows, removedIds]);

  // Check if an arrow is blocked by any other remaining arrow or closed gate
  const isBlocked = useCallback((arrow: ArrowData, allArrows: ArrowData[], removed: Set<string>, currentTiles: TileData[]) => {
    if (arrow.type === 'locked' && hasKeys) {
      return true;
    }

    const { x, y, dir } = arrow;
    
    // Check arrows without filter for speed
    const isArrowBlocked = (() => {
      switch (dir) {
        case 'up': return (allArrows || []).some(a => !removed.has(a.id) && a.x === x && a.y < y);
        case 'down': return (allArrows || []).some(a => !removed.has(a.id) && a.x === x && a.y > y);
        case 'left': return (allArrows || []).some(a => !removed.has(a.id) && a.y === y && a.x < x);
        case 'right': return (allArrows || []).some(a => !removed.has(a.id) && a.y === y && a.x > x);
      }
    })();
    if (isArrowBlocked) return true;

    // Check Gates
    const isGateBlocked = (currentTiles || []).some(t => {
      if (t.isOpen) return false;
      if (t.type !== 'gate-vertical' && t.type !== 'gate-horizontal') return false;
      switch (dir) {
        case 'up': return t.x === x && t.y < y;
        case 'down': return t.x === x && t.y > y;
        case 'left': return t.y === y && t.x < x;
        case 'right': return t.y === y && t.x > x;
      }
    });

    return isGateBlocked;
  }, [hasKeys]);

  const rotateDir = (dir: Direction): Direction => {
    const next: Record<Direction, Direction> = {
      up: 'right',
      right: 'down',
      down: 'left',
      left: 'up'
    };
    return next[dir];
  };

  const launchArrow = useCallback((arrow: ArrowData) => {
    if (!isMuted) {
      soundService.playLaunch();
      soundService.playRemove(arrow.dir);
      if (arrow.type === 'switch') soundService.playSwitch();
      if (arrow.type === 'rotator') soundService.playRotate();
      if (arrow.type === 'shifter') soundService.playShift();
    }

    // Save history
    setHistory(h => [...h, { 
      arrows: [...arrows], 
      removedIds: new Set(removedIds), 
      tiles: [...tiles], 
      toolbox: { ...toolbox }, 
      clicks: clickCount 
    }]);

    setClickCount(prev => {
      const next = prev + 1;
      
      if (gameMode !== 'timed' && gameMode !== 'premove' && currentLevel.clickLimit && next >= currentLevel.clickLimit && removedIds.size + 1 < arrows.length) {
        setGameOverReason('clicks');
        setShowGameOver(true);
        if (!isMuted) soundService.playError();
      }
      return next;
    });

    setRemovedIds(prev => {
      const next = new Set(prev);
      next.add(arrow.id);

      // Victory check
      if (next.size === arrows.length) {
          if (gameMode === 'timed') {
            if (lastScoredTimedLevelRef.current !== timedLevelIdx) {
              lastScoredTimedLevelRef.current = timedLevelIdx;
              setTimedScore(s => s + 1);
              if (!isMuted) soundService.playLevelComplete();
            }
            // Transition immediately
            setTimedFlavor(Math.random() > 0.5 ? 'standard' : 'invisible');
            setTimedLevelIdx(Math.floor(Math.random() * 1000000));
          } else {
            setTimeout(() => {
              if (!isMuted) soundService.playSuccess();
              setShowVictory(true);
            }, 200);
          }
      }
      return next;
    });

    // Handle special effects
    if (arrow.type === 'switch') {
      setTiles(prev => prev.map(t => (t.type.startsWith('gate') ? { ...t, isOpen: !t.isOpen } : t)));
    }

    if (arrow.type === 'rotator') {
      setArrows(prev => prev.map(a => {
        const isNeighbor = Math.abs(a.x - arrow.x) + Math.abs(a.y - arrow.y) === 1;
        if (isNeighbor && !removedIds.has(a.id) && a.id !== arrow.id) {
          return { ...a, dir: rotateDir(a.dir) };
        }
        return a;
      }));
    }

    if (arrow.type === 'shifter') {
      setArrows(prev => {
         return prev.map(a => {
           if (removedIds.has(a.id) || a.id === arrow.id) return a;
           const isSameCol = a.x === arrow.x && (arrow.dir === 'up' || arrow.dir === 'down');
           const isSameRow = a.y === arrow.y && (arrow.dir === 'left' || arrow.dir === 'right');
           if (isSameCol || isSameRow) {
             let nx = a.x, ny = a.y;
             if (arrow.dir === 'up') ny--; if (arrow.dir === 'down') ny++;
             if (arrow.dir === 'left') nx--; if (arrow.dir === 'right') nx++;
             if (nx < 0 || nx >= currentLevel.gridSize || ny < 0 || ny >= currentLevel.gridSize) return a;
             const isOccupied = (prev || []).some(other => (!removedIds.has(other.id) && other.id !== arrow.id) && other.x === nx && other.y === ny) ||
                               (tiles || []).some(t => !t.isOpen && (t.type === 'gate-vertical' || t.type === 'gate-horizontal') && t.x === nx && t.y === ny);
             if (!isOccupied) return { ...a, x: nx, y: ny };
           }
           return a;
         });
      });
    }

    setHintId(null);
  }, [arrows, removedIds, tiles, toolbox, isMuted, gameMode, currentLevel]);

  const executionStateRef = useRef({ arrows, removedIds, tiles, isBlocked, launchArrow, isMuted });

  useEffect(() => {
    executionStateRef.current = { arrows, removedIds, tiles, isBlocked, launchArrow, isMuted };
  });

  const executePremove = useCallback(() => {
    if (premoveQueue.length === 0 || isExecutingPremove) return;
    soundService.resume();
    setIsExecutingPremove(true);
    setExecIndex(0);
    lastExecutedIndexRef.current = -1;
  }, [premoveQueue, isExecutingPremove]);

  // Reactive execution loop
  useEffect(() => {
    if (!isExecutingPremove || execIndex < 0 || execIndex >= premoveQueue.length) {
      if (isExecutingPremove && execIndex >= premoveQueue.length) {
        setIsExecutingPremove(false);
        setExecIndex(-1);
        setPremoveQueue([]);
        lastExecutedIndexRef.current = -1;
      }
      return;
    }

    // Protection against infinite loops: only execute if the index has advanced
    if (execIndex <= lastExecutedIndexRef.current) return;
    lastExecutedIndexRef.current = execIndex;

    const { arrows: curArrows, removedIds: curRemovedIds, tiles: curTiles, isBlocked: curIsBlocked, launchArrow: curLaunchArrow, isMuted: curIsMuted } = executionStateRef.current;

    const arrowId = premoveQueue[execIndex];
    const arrow = curArrows.find(a => a.id === arrowId);
    
    if (!arrow || curRemovedIds.has(arrow.id)) {
      setExecIndex(prev => prev + 1);
      return;
    }

    const blocked = curIsBlocked(arrow, curArrows, curRemovedIds, curTiles);

    if (blocked) {
      if (!curIsMuted) soundService.playError();
      setShakeId(arrow.id);
      setTimeout(() => setShakeId(null), 500);
      setGameOverReason('blocked');
      setShowGameOver(true);
      setIsExecutingPremove(false);
      setExecIndex(-1);
      lastExecutedIndexRef.current = -1;
      return;
    }

    curLaunchArrow(arrow);
    
    const timer = setTimeout(() => {
      setExecIndex(prev => prev + 1);
    }, 120); 

    return () => clearTimeout(timer);
  }, [isExecutingPremove, execIndex, premoveQueue]);

  const handleArrowClick = useCallback((arrow: ArrowData) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 100) return;
    lastClickTimeRef.current = now;

    if (removedIds.has(arrow.id) || showVictory || showGameOver || isExecutingPremove) return;

    if (gameMode === 'premove') {
      if (!isMuted) soundService.playClick();
      setPremoveQueue(prev => {
        if (prev.includes(arrow.id)) {
          return prev.filter(id => id !== arrow.id);
        }
        return [...prev, arrow.id];
      });
      return;
    }

    const blocked = isBlocked(arrow, arrows, removedIds, tiles);

    if (blocked) {
      if (!isMuted) soundService.playError();
      setShakeId(arrow.id);
      setTimeout(() => setShakeId(null), 500);
      
      setClickCount(prev => {
        const next = prev + 1;
        if (gameMode !== 'timed' && gameMode !== 'premove' && currentLevel.clickLimit && next >= currentLevel.clickLimit) {
          setGameOverReason('clicks');
          setShowGameOver(true);
          if (!isMuted) soundService.playError();
        }
        return next;
      });
      return;
    }

    launchArrow(arrow);
  }, [arrows, isBlocked, isMuted, currentLevel, tiles, toolbox, showVictory, showGameOver, removedIds, gameMode, isExecutingPremove, premoveQueue, launchArrow]);

  const useTool = (type: 'rotate' | 'shift', targetArrowId: string) => {
    if (!isMuted) soundService.playClick();

    // Tactical Haptics for iPhone/Mobile
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(20);
    }
    setHistory(prev => [...prev, { 
      arrows: [...arrows], 
      removedIds: new Set(removedIds), 
      tiles: [...tiles], 
      toolbox: { ...toolbox },
      clicks: clickCount
    }]);
    
    if (type === 'rotate' && toolbox.rotations > 0) {
      setArrows(prev => prev.map(a => a.id === targetArrowId ? { ...a, dir: rotateDir(a.dir) } : a));
      setToolbox(prev => ({ ...prev, rotations: prev.rotations - 1 }));
    }
    // Shifter tool could be implemented similarly if needed
  };

  const handleUndo = () => {
    if (history.length === 0 || showVictory) return;
    if (!isMuted) soundService.playClick();
    const last = history[history.length - 1] as any;
    setArrows(last.arrows);
    setRemovedIds(last.removedIds);
    setTiles(last.tiles);
    setToolbox(last.toolbox);
    if (last.clicks !== undefined) setClickCount(last.clicks);
    else if (last.moves !== undefined) setClickCount(last.moves); // Support legacy history
    setHistory(prev => prev.slice(0, -1));
    setShowVictory(false);
    setShowGameOver(false);
    setGameOverReason(null);
    setHintId(null);
  };

  const handleReset = () => {
    soundService.resume();
    if (!isMuted) soundService.playLevelStart();

    if (gameMode === 'timed') {
      // Robust reset for timed mode
      setTimedFlavor(Math.random() > 0.5 ? 'standard' : 'invisible');
      setTimedLevelIdx(Math.floor(Math.random() * 1000000));
      // Reset state immediately and clear queue
      setArrows([]);
      setTiles([]);
      setRemovedIds(new Set());
      setHistory([]);
      setClickCount(0);
      setHintId(null);
      setHoveredArrowId(null);
      setShowVictory(false);
      setShowGameOver(false);
      setGameOverReason(null);
      setPremoveQueue([]);
      setIsExecutingPremove(false);
      setExecIndex(-1);
      lastExecutedIndexRef.current = -1;

      // In TimedResult -> Start, session state needs to be initialized
      if (currentScreen === 'timedResult') {
        const totalSecs = timedDuration * 60;
        setTimeLeft(totalSecs);
        setTimedTotalSeconds(totalSecs);
        setTimedScore(0);
        lastScoredTimedLevelRef.current = null;
      }
      return;
    }

    setArrows(currentLevel.arrows);
    setTiles(currentLevel.tiles || []);
    setToolbox(currentLevel.toolbox || { rotations: 0, shifts: 0 });
    setRemovedIds(new Set());
    setHistory([]);
    setHintId(null);
    setShowVictory(false);
    setShowGameOver(false);
    setGameOverReason(null);
    setClickCount(0);
    setHoveredArrowId(null);
    setTimeLeft(currentLevel.timeLimit || null);
    setPremoveQueue([]);
    setIsExecutingPremove(false);
    setExecIndex(-1);
    lastExecutedIndexRef.current = -1;
  };

  const handleHint = () => {
    if (!isMuted) soundService.playClick();
    const removable = arrows.find(a => !removedIds.has(a.id) && !isBlocked(a, arrows, removedIds));
    if (removable) {
      setHintId(removable.id);
    }
  };

  const lastNextLevelTimeRef = useRef(0);
  const nextLevel = () => {
    const now = Date.now();
    if (now - lastNextLevelTimeRef.current < 500) return;
    lastNextLevelTimeRef.current = now;

    soundService.resume();
    if (!isMuted) soundService.playClick();
    if (currentLevelIdx < LEVEL_METADATA.length - 1 && showVictory) {
      setShowVictory(false);
      setHoveredArrowId(null);
      // Clear queue and state immediately to prevent "ghost" executions on next level
      setPremoveQueue([]);
      setIsExecutingPremove(false);
      setExecIndex(-1);
      lastExecutedIndexRef.current = -1;
      setCurrentLevelIdx(currentLevelIdx + 1);
    }
  };

  const selectLevel = (idx: number) => {
    if (!isMuted) soundService.playLevelStart();
    setHoveredArrowId(null);
    setCurrentLevelIdx(idx);
    setShowLevelSelector(false);
  };

  // Auto-scroll to current level when menu opens
  useEffect(() => {
    if (showLevelSelector && activeLevelRef.current) {
      setTimeout(() => {
        activeLevelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [showLevelSelector]);

  // Center: Game Board
  const ghostPath = useMemo(() => {
    if (!hoveredArrowId || activeTool) return null;
    const arrow = arrows.find(a => a.id === hoveredArrowId);
    if (!arrow || removedIds.has(arrow.id)) return null;
    // Only show path for launchable arrows
    if (isBlocked(arrow, arrows, removedIds, tiles)) return null;
    return arrow;
  }, [hoveredArrowId, arrows, removedIds, tiles, isBlocked, activeTool]);

  if (currentScreen === 'menu' || currentScreen === 'timedConfig' || currentScreen === 'timedResult') {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans selection:bg-[#22d3ee]/30 relative overflow-x-hidden">
        <NoiseOverlay />
        
        <div className="w-full flex-1 flex flex-col items-center justify-center p-6 perspective-[2000px]">
        <StaticHUD 
          gameTitle="ARROW ESCAPE"
          systemInfo="System Core 4.3 // Optimal"
          isMuted={isMuted}
          onToggleMute={() => {
            const nextMuted = !isMuted;
            setIsMuted(nextMuted);
            if (!nextMuted) soundService.resume();
          }}
        />

        {/* Main Content: 3D Mode Gallery */}
        <div className="flex flex-wrap w-full max-w-7xl h-full items-center justify-center gap-4 md:gap-6 px-6 md:px-12 relative z-10 pt-24 pb-12 md:pt-0">
          
          {/* Mode 1: Standard */}
          <motion.div 
            initial={{ opacity: 0, x: -50, rotateY: 30 }}
            animate={{ opacity: 1, x: 0, rotateY: -10 }}
            whileHover={{ rotateY: 0, z: 50, scale: 1.02 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="relative w-full md:w-[23%] aspect-[16/10] md:h-[55vh] group/mode cursor-pointer perspective-[1000px] preserve-3d"
            onClick={() => { soundService.resume(); setGameMode('standard'); setCurrentScreen('game'); }}
          >
            <div className="absolute inset-0 bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all group-hover/mode:border-[#22d3ee]/40 group-hover/mode:shadow-[0_0_60px_rgba(34,211,238,0.1)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.1)_0%,transparent_70%)]" />
              <div className="relative h-full flex flex-col p-6">
                <div className="mb-auto">
                  <div className="text-[8px] font-black uppercase tracking-[0.5em] text-[#22d3ee] mb-2 opacity-70">Protocol 01</div>
                  <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-white group-hover/mode:chromatic-title transition-all">Standard</h2>
                </div>
                <div className="flex-1 flex items-center justify-center py-2">
                  <div className="scale-[0.45] md:scale-60 group-hover/mode:scale-75 transition-transform duration-700">
                    <MenuPreviewBoard mode="standard" levelIdx={4} />
                  </div>
                </div>
                <div className="mt-auto pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="text-[7px] font-black text-white/40 uppercase tracking-widest">Sector Logged</div>
                    <div className="text-sm font-black italic text-[#22d3ee]">{standardMaxLevel + 1}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Mode 2: Timed Rush */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            whileHover={{ z: 100, scale: 1.05 }}
            transition={{ duration: 1.2, delay: 0.1, ease: "easeOut" }}
            className="relative w-full md:w-[25%] aspect-[16/10] md:h-[65vh] group/mode cursor-pointer z-20 perspective-[1000px] preserve-3d"
            onClick={() => { soundService.resume(); setGameMode('timed'); setCurrentScreen('timedConfig'); }}
          >
            <div className="absolute inset-0 bg-[#0f0f0f] border-2 border-white/10 rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] transition-all group-hover/mode:border-amber-500/50 group-hover/mode:shadow-[0_0_80px_rgba(245,158,11,0.2)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.15)_0%,transparent_70%)] opacity-0 group-hover/mode:opacity-100 transition-opacity" />
              <div className="relative h-full flex flex-col p-6 md:p-10">
                <div className="mb-auto text-center">
                  <div className="text-[8px] font-black uppercase tracking-[0.5em] text-amber-500 mb-2">Protocol 02 // Critical</div>
                  <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white chromatic-title transition-all leading-tight">Timed Rush</h2>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }} className="relative">
                    <div className="absolute inset-0 bg-amber-500 blur-3xl opacity-20" />
                    <Clock size={48} className="text-amber-500 relative z-10" strokeWidth={1.5} />
                  </motion.div>
                </div>
                <div className="mt-auto space-y-4 text-center">
                  <div className="py-3 rounded-2xl border-2 border-amber-500/20 bg-amber-500/5 text-amber-500 text-[10px] font-black uppercase tracking-[0.4em]">
                    Initiate Stream
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Mode 3: Premove Challenge (New Piece) */}
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0, rotateY: 5 }}
            whileHover={{ z: 80, scale: 1.05, rotateY: 0 }}
            transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
            className="relative w-full md:w-[23%] aspect-[16/10] md:h-[60vh] group/mode cursor-pointer z-10 perspective-[1000px] preserve-3d"
            onClick={() => { soundService.resume(); setGameMode('premove'); setCurrentScreen('game'); }}
          >
            <div className="absolute inset-0 bg-[#080808] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all group-hover/mode:border-emerald-500/40 group-hover/mode:shadow-[0_0_60px_rgba(16,185,129,0.1)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.1)_0%,transparent_70%)] opacity-0 group-hover/mode:opacity-100 transition-opacity" />
              <div className="relative h-full flex flex-col p-6">
                <div className="mb-auto">
                  <div className="text-[8px] font-black uppercase tracking-[0.5em] text-emerald-400 mb-2 opacity-70">Protocol 04</div>
                  <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-white group-hover/mode:chromatic-title transition-all">Premove</h2>
                </div>
                <div className="flex-1 flex items-center justify-center">
                   <div className="relative">
                      <motion.div 
                        animate={{ 
                          pathLength: [0, 1],
                          opacity: [0, 1, 0]
                        }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="flex flex-col gap-2"
                      >
                         <div className="w-10 h-1 border border-emerald-500/40" />
                         <div className="w-10 h-1 border border-emerald-500/40 opacity-60" />
                         <div className="w-10 h-1 border border-emerald-500/40 opacity-30" />
                      </motion.div>
                   </div>
                </div>
                <div className="mt-auto space-y-3">
                   <div className="text-[7px] text-emerald-400 font-bold uppercase tracking-widest opacity-50 px-1 text-center">Batch Execution Mode</div>
                   <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="text-[7px] font-black text-white/40 uppercase tracking-widest">Sync Efficiency</div>
                    <div className="text-sm font-black italic text-emerald-400">{premoveMaxLevel + 1}</div>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Mode 4: Invisible */}
          <motion.div 
            initial={{ opacity: 0, x: 50, rotateY: -30 }}
            animate={{ opacity: 1, x: 0, rotateY: 10 }}
            whileHover={{ rotateY: 0, z: 50, scale: 1.02 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="relative w-full md:w-[23%] aspect-[16/10] md:h-[55vh] group/mode cursor-pointer perspective-[1000px] preserve-3d"
            onClick={() => { soundService.resume(); setGameMode('invisible'); setCurrentScreen('game'); }}
          >
            <div className="absolute inset-0 bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all group-hover/mode:border-purple-500/40 group-hover/mode:shadow-[0_0_60px_rgba(168,85,247,0.1)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.1)_0%,transparent_70%)]" />
              <div className="relative h-full flex flex-col p-6">
                <div className="mb-auto">
                  <div className="text-[8px] font-black uppercase tracking-[0.5em] text-purple-400 mb-2 opacity-70">Protocol 03</div>
                  <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-white group-hover/mode:chromatic-title transition-all">Invisible</h2>
                </div>
                <div className="flex-1 flex items-center justify-center py-2">
                  <div className="scale-[0.45] md:scale-60 group-hover/mode:scale-75 transition-transform duration-700 blur-[2px] group-hover/mode:blur-0">
                    <MenuPreviewBoard mode="invisible" levelIdx={12} />
                  </div>
                </div>
                <div className="mt-auto pt-4 border-t border-white/5 text-right">
                  <div className="flex items-center justify-between">
                    <div className="text-[7px] font-black text-white/40 uppercase tracking-widest">Memory Sync</div>
                    <div className="text-sm font-black italic text-purple-400">{invisibleMaxLevel + 1}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        </div>

        <AnimatePresence mode="wait">
          {currentScreen === 'timedConfig' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 md:backdrop-blur-xl flex items-center justify-center p-4 md:p-6 overflow-hidden"
            >
              <div className="absolute inset-0 bg-[#22d3ee]/5 pointer-events-none" />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-xl glass-panel p-10 relative overflow-hidden"
              >
                {/* Decorative Accents */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#22d3ee]" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#22d3ee]" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#22d3ee]" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#22d3ee]" />

                <div className="flex flex-col items-center text-center space-y-8 relative z-10">
                  <div className="space-y-1">
                    <h2 className="text-5xl font-black italic uppercase tracking-tighter chromatic-title text-white">Timed Rush</h2>
                    <p className="text-[#22d3ee] text-[10px] font-black uppercase tracking-[0.5em] opacity-80">Protocol Initialization</p>
                  </div>

                  <div className="w-full h-[1px] bg-white/10" />

                  {/* Mixed Mode Notice */}
                  <div className="w-full p-6 bg-white/5 border border-white/10 flex items-center gap-6 text-left group hover:border-[#22d3ee]/30 transition-all">
                    <div className="p-3 bg-[#22d3ee]/10 rounded-lg shrink-0">
                      <RefreshCw size={24} className="text-[#22d3ee] animate-spin-slow" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Mixed Reality Active</span>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-relaxed">
                        Standard & Invisible modes will alternate randomly every stage.
                      </p>
                    </div>
                  </div>

                  {/* Duration Selection */}
                  <div className="w-full space-y-4">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-[#94a3b8] text-left ml-1">Engagement Duration</div>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 3, 5].map(t => (
                        <button 
                          key={t}
                          onClick={() => setTimedDuration(t as any)}
                          className={`
                            group relative py-5 border transition-all 
                            ${timedDuration === t 
                              ? 'border-[#22d3ee] bg-[#22d3ee]/10 text-white' 
                              : 'border-white/10 bg-white/5 text-slate-500 hover:border-white/30 hover:bg-white/10'}
                          `}
                        >
                          <div className={`absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#22d3ee] rounded-full scale-0 transition-transform ${timedDuration === t ? 'scale-100' : ''}`} />
                          <div className="text-2xl font-black italic tracking-tighter">{t}M</div>
                          <div className="text-[8px] font-black uppercase tracking-widest opacity-60">Session</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 w-full pt-4">
                    <button 
                      onClick={() => setCurrentScreen('menu')}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-white/40 border border-white/10 transition-all"
                    >
                      Return
                    </button>
                    <button 
                      onClick={() => {
                        soundService.resume();
                        const totalSecs = timedDuration * 60;
                        setTimedFlavor(Math.random() > 0.5 ? 'standard' : 'invisible');
                        setTimedLevelIdx(Math.floor(Math.random() * 1000000));
                        setTimedScore(0);
                        setTimeLeft(totalSecs); // Set immediately for robust reactivity
                        setTimedTotalSeconds(totalSecs);
                        setCurrentScreen('game');
                      }}
                      className="flex-[2] py-4 bg-[#22d3ee] hover:bg-[#22d3ee]/80 text-black text-[12px] font-black uppercase tracking-[0.4em] transition-all shadow-[0_0_40px_rgba(34,211,238,0.2)]"
                    >
                      Launch Stream
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {currentScreen === 'timedResult' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-[#000000]/80 md:backdrop-blur-xl flex items-center justify-center p-4 md:p-6 overflow-hidden pointer-events-auto"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#22d3ee]/5 to-transparent pointer-events-none" />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center space-y-4 md:space-y-8 w-full max-w-xl relative z-10 px-4"
              >
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-[7px] font-black uppercase tracking-[0.4em] text-red-500">Operation Terminated</span>
                  </div>
                  <h2 className="text-4xl md:text-7xl font-black italic uppercase tracking-tighter chromatic-title text-white">Performance Log</h2>
                </div>

                <div className="w-full relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#22d3ee]/20 to-[#a855f7]/20 blur-xl opacity-30 group-hover:opacity-60 transition-opacity rounded-[3rem]" />
                  <div className="relative glass-panel p-6 md:p-12 flex flex-col items-center gap-1 md:gap-2 rounded-[3.5rem] border border-white/10">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Stages Synchronized</div>
                    <div className="text-7xl md:text-[9rem] font-black leading-none text-white chromatic-title tabular-nums">
                      {timedScore.toString().padStart(2, '0')}
                    </div>
                    <div className="w-full h-[1px] bg-white/5 my-2" />
                    
                    {/* Inline Duration Selection */}
                    <div className="w-full py-6 space-y-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#22d3ee]">Next Mission</div>
                        <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500">Select Active Window</div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        {[1, 3, 5].map(t => (
                          <button 
                            key={t}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimedDuration(t as any);
                              if (!isMuted) soundService.playClick();
                            }}
                            className={`
                              group relative py-3 rounded-2xl border transition-all overflow-hidden
                              ${timedDuration === t 
                                ? 'border-[#22d3ee] bg-[#22d3ee]/10 text-white shadow-[0_0_20px_rgba(34,211,238,0.1)]' 
                                : 'border-white/5 bg-white/5 text-slate-500 hover:border-white/20 hover:bg-white/10'}
                            `}
                          >
                            {timedDuration === t && (
                              <motion.div 
                                layoutId="active-duration"
                                className="absolute inset-0 bg-gradient-to-tr from-[#22d3ee]/10 to-transparent pointer-events-none"
                              />
                            )}
                            <div className={`relative flex flex-col items-center transition-transform group-active:scale-95`}>
                              <span className="text-xl md:text-2xl font-black italic tracking-tighter leading-none mb-0.5">{t}</span>
                              <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Minutes</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="w-full h-[1px] bg-white/5 my-1" />
                    <div className="flex items-center gap-10 mt-2">
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-1">Duration</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm md:text-lg font-black text-[#22d3ee]">{lastSessionDuration}</span>
                          <span className="text-[8px] font-black text-[#22d3ee]/40 uppercase">Min</span>
                        </div>
                      </div>
                      <div className="w-[1px] h-6 bg-white/10" />
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-1">Efficiency</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm md:text-lg font-black text-[#a855f7]">{(timedScore / lastSessionDuration || 0).toFixed(1)}</span>
                          <span className="text-[8px] font-black text-[#a855f7]/40 uppercase">E/M</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                      setCurrentScreen('game');
                    }}
                    className="flex-1 py-4 md:py-5 bg-[#22d3ee] hover:bg-[#22d3ee]/80 text-black text-[10px] md:text-[11px] font-black uppercase tracking-[0.4em] shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-all rounded-3xl relative z-[110]"
                  >
                    Relaunch Session
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentScreen('menu');
                    }}
                    className="flex-1 py-4 md:py-5 bg-white/5 hover:bg-white/10 text-white text-[10px] md:text-[11px] font-black uppercase tracking-[0.4em] border border-white/10 transition-all rounded-3xl relative z-[110]"
                  >
                    Exit to Hub
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-[#f8fafc] font-sans flex flex-col relative overflow-hidden">
      {/* Noise overlay removed for game screen */}
      
      {/* Cinematic Background Shaders */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={`absolute top-0 left-0 w-full h-full opacity-30 transition-colors duration-1000 ${
          gameMode === 'standard' ? 'bg-[radial-gradient(circle_at_20%_20%,#083344_0%,transparent_50%)]' : 
          gameMode === 'premove' ? 'bg-[radial-gradient(circle_at_20%_20%,#064e3b_0%,transparent_50%)]' :
          'bg-[radial-gradient(circle_at_20%_20%,#3b0764_0%,transparent_50%)]'
        }`} />
        <div className={`absolute bottom-0 right-0 w-full h-full opacity-30 transition-colors duration-1000 ${
          gameMode === 'standard' ? 'bg-[radial-gradient(circle_at_80%_80%,#1e1b4b_0%,transparent_50%)]' : 
          gameMode === 'premove' ? 'bg-[radial-gradient(circle_at_80%_80%,#06201b_0%,transparent_50%)]' :
          'bg-[radial-gradient(circle_at_80%_80%,#4c1d95_0%,transparent_50%)]'
        }`} />
      </div>

      {/* Prominent Timer Bar for any mode with timeLeft */}
      {timeLeft !== null && (
        <div 
          className="fixed left-0 w-full z-[300] pointer-events-none"
          style={{ top: 0 }}
        >
          <div className="w-full h-1.5 sm:h-2 lg:h-3 bg-black/40 backdrop-blur-md relative overflow-hidden">
            <motion.div 
              className={`h-full shadow-[0_0_20px_rgba(245,158,11,0.6)] ${
                timeLeft < 15 
                  ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600 animate-pulse' 
                  : timeLeft < 30
                    ? 'bg-gradient-to-r from-orange-400 to-red-500'
                    : 'bg-gradient-to-r from-[#22d3ee] via-amber-500 to-orange-600'
              }`}
              initial={false}
              animate={{ width: `${(timeLeft / (gameMode === 'timed' ? timedTotalSeconds : (currentLevel.timeLimit || 60))) * 100}%` }}
              transition={{ ease: "linear", duration: 0.2 }}
            />
          </div>
          {timeLeft < 30 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.2, 0] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute inset-0 bg-red-500/10 pointer-events-none"
            />
          )}
        </div>
      )}

      {/* Header */}
      <nav 
        className="h-20 lg:h-24 px-6 lg:px-12 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-3xl sticky top-0 z-40 rounded-b-[2rem]"
        style={{ paddingTop: 'var(--safe-top)', height: 'calc(5.5rem + var(--safe-top))' }}
      >
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setCurrentScreen('menu')}
            className="p-3 text-[#94a3b8] hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5"
            title="Return to Menu"
          >
            <ChevronLeft size={24} />
          </button>
          {gameMode !== 'timed' && (
            <button 
              onClick={() => setShowLevelSelector(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[#22d3ee] transition-all border border-white/5 hover:border-[#22d3ee]/30 group"
            >
              <LayoutGrid size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              <span className="text-sm font-bold uppercase tracking-wider hidden md:block">Stages</span>
            </button>
          )}
        </div>
        <div className="flex gap-4 lg:gap-8 items-center">
          {(() => {
            const effectivelyInvisible = gameMode === 'invisible' || (gameMode === 'timed' && timedFlavor === 'invisible');
            return (
              <div className={`p-2 flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                effectivelyInvisible ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 
                gameMode === 'premove' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              }`}>
                {effectivelyInvisible ? <EyeOff size={16} /> : gameMode === 'premove' ? <RotateCcw size={16} /> : <Eye size={16} />}
                <span className="hidden sm:inline">{effectivelyInvisible ? 'Invisible' : gameMode === 'premove' ? 'Premove' : 'Standard'} Mode</span>
              </div>
            );
          })()}
          <button 
            onClick={() => setIsMuted(prev => !prev)}
            className="p-2 text-[#94a3b8] hover:text-[#22d3ee] transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <StatItem label={gameMode === 'timed' ? "Score" : "Stage"} value={gameMode === 'timed' ? timedScore : currentLevelIdx + 1} />
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] p-6 lg:p-10 gap-10 items-start max-w-[1440px] mx-auto w-full">
        {/* Left Sidebar (Mission History & Archive) */}
        <aside className="flex flex-col gap-5 order-3 lg:order-1">
          {gameMode !== 'timed' && (
            <div className="glass-panel hidden lg:block rounded-[2rem] p-8 border border-white/5 shadow-xl">
              <div className="text-[10px] uppercase text-[#94a3b8] tracking-widest mb-4 font-semibold">Stage Archive</div>
              <button 
                onClick={() => setShowLevelSelector(true)}
                className="w-full py-3.5 mb-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-[#22d3ee] transition-all flex items-center justify-center gap-2"
              >
                <LayoutGrid size={14} />
                Browse Archive
              </button>
              <div className="text-[10px] uppercase text-[#94a3b8] tracking-widest mb-4 font-semibold opacity-50">Operational Log</div>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 25 }).map((_, i) => {
                  const actualIdx = i + Math.max(0, currentLevelIdx - 10);
                  if (actualIdx >= LEVEL_METADATA.length) return null;
                  return (
                    <button
                      key={actualIdx}
                      onClick={() => selectLevel(actualIdx)}
                      className={`
                        aspect-square rounded-xl flex items-center justify-center text-[10px] font-bold transition-all
                        ${currentLevelIdx === actualIdx 
                          ? 'bg-[#22d3ee]/20 border border-[#22d3ee] text-[#22d3ee]' 
                          : 'bg-slate-800/80 border border-white/5 text-[#94a3b8] hover:border-white/20 hover:text-white'}
                      `}
                    >
                      {actualIdx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Center: Game Board */}
        <GameBoard 
          currentLevel={currentLevel}
          tiles={tiles}
          ghostPath={ghostPath}
          arrows={arrows}
          removedIds={removedIds}
          shakeId={shakeId}
          hintId={hintId}
          hasKeys={hasKeys}
          activeTool={activeTool}
          showVictory={showVictory}
          showGameOver={showGameOver}
          gameOverReason={gameOverReason}
          currentLevelIdx={currentLevelIdx}
          gameMode={gameMode}
          timedFlavor={timedFlavor}
          LEVEL_METADATA={LEVEL_METADATA}
          handleArrowClick={handleArrowClick}
          hoveredArrowId={hoveredArrowId}
          setHoveredArrowId={setHoveredArrowId}
          nextLevel={nextLevel}
          handleReset={handleReset}
          premoveQueue={premoveQueue}
          execIndex={execIndex}
          isExecutingPremove={isExecutingPremove}
          executePremove={executePremove}
        />

        {/* Right Sidebar (Active Controls & Logic) */}
        <aside className="flex flex-col gap-6 overflow-hidden order-2 lg:order-3">
          {/* Tactical Controls */}
          <div className="glass-panel rounded-[2rem] p-8 border border-white/5 shadow-xl flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-[10px] font-black text-[#818cf8] uppercase tracking-[0.2em] px-1">Tactical Operations</h3>
              
              <button
                onClick={handleReset}
                className="w-full py-4 bg-gradient-to-r from-[#22d3ee] to-[#818cf8] text-[#0f172a] font-black uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.2)] flex items-center justify-center gap-2 hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all text-[11px]"
              >
                <RotateCcw size={16} />
                {gameMode === 'timed' ? 'Reset Board' : 'Restart Session'}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all disabled:opacity-20 disabled:grayscale"
                >
                  <Undo2 size={16} />
                  <span className="text-[9px] font-black uppercase tracking-wider">Undo</span>
                </button>
                <button
                  onClick={handleHint}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                >
                  <Lightbulb size={16} />
                  <span className="text-[9px] font-black uppercase tracking-wider">Hint</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 pt-5 border-t border-white/5">
              {(toolbox.rotations > 0 || toolbox.shifts > 0) ? (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Equipment</h4>
                  {toolbox.rotations > 0 && (
                    <button 
                      onClick={() => setActiveTool(activeTool === 'rotate' ? null : 'rotate')}
                      className={`
                        w-full py-2.5 rounded-xl border flex items-center justify-between px-4 transition-all
                        ${activeTool === 'rotate' 
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                          : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <RotateCcw size={14} className={activeTool === 'rotate' ? 'animate-spin-slow' : ''} />
                        <span className="text-xs font-bold uppercase tracking-wider">Rotator Gear</span>
                      </div>
                      <span className="text-sm font-black opacity-60">x{toolbox.rotations}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="px-1 italic text-[10px] text-slate-600">Standard issue deployment: No extra gear.</div>
              )}
            </div>

            <div className="space-y-4 pt-5 border-t border-white/5">
              <div className="text-[10px] uppercase text-[#94a3b8] tracking-widest font-bold px-1">Mission Telemetry</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 group/stat">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] group-hover/stat:text-indigo-400 transition-colors">
                    <Move size={12} strokeWidth={2.5} />
                    Clicks
                  </div>
                  <div className={`text-2xl font-black tabular-nums transition-all ${gameMode !== 'timed' && currentLevel.clickLimit && clickCount >= currentLevel.clickLimit - 3 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {clickCount.toString().padStart(2, '0')}
                    {gameMode !== 'timed' && currentLevel.clickLimit && <span className="text-slate-700 text-xs ml-1 font-bold">/ {currentLevel.clickLimit.toString().padStart(2, '0')}</span>}
                  </div>
                </div>
                <div className="space-y-1 group/stat">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] group-hover/stat:text-cyan-400 transition-colors">
                    <Clock size={12} strokeWidth={2.5} />
                    Time
                  </div>
                  <div className={`text-2xl font-black tabular-nums transition-all ${timeLeft !== null && timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    <TimeDisplay timeLeft={timeLeft} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold px-1">
                  <span>Clearing Progress</span>
                  <span className="text-white font-black">{Math.round((removedIds.size / (arrows.length || 1)) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(removedIds.size / (arrows.length || 1)) * 100}%` }}
                    className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Logic & Score Overlay Info */}
          <div className="flex flex-col gap-5">
            {gameMode === 'timed' && (
              <div className="glass-panel rounded-[20px] p-6 border-amber-500/30">
                <div className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-2">Timed Session</div>
                <div className="text-5xl font-black italic text-white flex items-baseline gap-2">
                  {timedScore}
                  <span className="text-xs uppercase tracking-tighter text-slate-500 not-italic">Stages</span>
                </div>
              </div>
            )}

            <div className="glass-panel rounded-[20px] p-6 border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex px-3 py-1 bg-[#22d3ee]/10 text-[#22d3ee] rounded-full text-[9px] font-black uppercase tracking-wider">
                  {gameMode === 'timed' ? 'PROCEDURAL' : `STAGE ${currentLevelIdx + 1}`}
                </span>
                <h3 className="text-[10px] font-black text-[#22d3ee] uppercase tracking-[0.2em]">Dependency Web</h3>
              </div>
              
              <div className="space-y-4">
                <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                  <span className="text-white font-bold opacity-80 underline decoration-[#22d3ee]/30 underline-offset-2">Logic:</span> Arrows require an unobstructed vector for successful departure.
                </p>

                {(arrows || []).some(a => a.type === 'rotator' || a.type === 'key' || a.type === 'shifter') && (
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    {(arrows || []).some(a => a.type === 'rotator') && (
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <RotateCcw size={10} className="text-purple-400" />
                        </div>
                        <p className="text-[11px] text-[#94a3b8]"><b>Rotator:</b> Adjusts adjacent vectors on exit.</p>
                      </div>
                    )}

                    {(arrows || []).some(a => a.type === 'key') && (
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                        </div>
                        <p className="text-[11px] text-[#94a3b8]"><b>Encoder:</b> Vital for decrypting locked chains.</p>
                      </div>
                    )}

                    {(arrows || []).some(a => a.type === 'shifter') && (
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Move size={10} className="text-cyan-400" />
                        </div>
                        <p className="text-[11px] text-[#94a3b8]"><b>Shifter:</b> Axis redistribution protocol.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Level Selector Modal */}
      <AnimatePresence>
        {showLevelSelector && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/95 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-panel w-full max-w-4xl max-h-[80vh] rounded-[32px] overflow-hidden flex flex-col p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Level Archive</h2>
                  <p className="text-[#94a3b8] text-sm font-medium">Select your challenge</p>
                </div>
                <button 
                  onClick={() => setShowLevelSelector(false)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-[#94a3b8] hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

                  <div className="flex-1 overflow-y-auto px-2 scrollbar-hide grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 pb-8">
                  {LEVEL_METADATA.map((meta, idx) => (
                    <button
                      key={idx}
                      ref={currentLevelIdx === idx ? activeLevelRef : null}
                      onClick={() => selectLevel(idx)}
                      className={`
                        aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all
                        ${currentLevelIdx === idx 
                          ? 'bg-cyan-500 text-black scale-105 shadow-lg shadow-cyan-900/20' 
                          : idx < maxReachedLevel
                            ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                            : 'bg-slate-800/40 border border-white/5 text-slate-500 hover:border-white/20'}
                      `}
                    >
                      <span className="text-sm font-bold">{idx + 1}</span>
                      {idx > maxReachedLevel + 5 && <Lock size={8} className="absolute top-1 right-1 opacity-30" />}
                      {idx <= maxReachedLevel && idx !== currentLevelIdx && <CheckCircle2 size={8} className="absolute top-1 right-1 text-indigo-400/40" />}
                    </button>
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/5 flex gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-cyan-500" />
                  <span className="text-slate-400">Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-500/30" />
                  <span className="text-slate-400">Cleared</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-slate-800" />
                  <span className="text-slate-400">Available</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function StatItem({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-lg font-black text-white italic tracking-tighter leading-none">{value}</span>
    </div>
  );
}

function ArrowIcon({ arrow, size = 28 }: { arrow: ArrowData, size?: number }) {
  const rotation: Record<Direction, number> = {
    up: 0,
    right: 90,
    down: 180,
    left: 270
  };

  const colors: Record<string, string> = {
    standard: 'text-rose-500',
    locked: 'text-slate-700',
    key: 'text-amber-500',
    switch: 'text-pink-500',
    rotator: 'text-purple-500',
    shifter: 'text-cyan-500'
  };

  return (
    <motion.div
      animate={{ rotate: rotation[arrow.dir] }}
      className={colors[arrow.type] || 'text-white'}
    >
      <ArrowUp size={size} strokeWidth={4} />
    </motion.div>
  );
}

function GameBoard({ 
  currentLevel, 
  tiles, 
  ghostPath, 
  arrows, 
  removedIds, 
  shakeId, 
  hintId, 
  hasKeys, 
  activeTool, 
  showVictory, 
  showGameOver, 
  gameOverReason, 
  currentLevelIdx, 
  gameMode, 
  timedFlavor, 
  LEVEL_METADATA, 
  handleArrowClick,
  hoveredArrowId,
  setHoveredArrowId,
  nextLevel,
  handleReset,
  premoveQueue,
  execIndex,
  isExecutingPremove,
  executePremove
}: any) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [flashlightPos, setFlashlightPos] = useState({ x: 0, y: 0 });

  const isActuallyInvisible = gameMode === 'invisible' || (gameMode === 'timed' && timedFlavor === 'invisible');

  useEffect(() => {
    if (!isActuallyInvisible) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setFlashlightPos({
        x: clientX - rect.left,
        y: clientY - rect.top
      });
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchstart', handleMove);
    window.addEventListener('touchmove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchstart', handleMove);
      window.removeEventListener('touchmove', handleMove);
    };
  }, [isActuallyInvisible]);

  return (
    <div className="flex flex-col items-center gap-10 py-4 order-1 lg:order-2">
      {/* Board Container */}
      <div className="relative group/board">
        {/* Dynamic Glow Brackets */}
        <div className="absolute -inset-10 pointer-events-none opacity-20 group-hover/board:opacity-40 transition-opacity duration-700">
           <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-cyan-500 rounded-tl-3xl" />
           <div className="absolute top-0 right-0 w-20 h-20 border-t-2 border-r-2 border-cyan-500 rounded-tr-3xl" />
           <div className="absolute bottom-0 left-0 w-20 h-20 border-b-2 border-l-2 border-cyan-500 rounded-bl-3xl" />
           <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-cyan-500 rounded-br-3xl" />
        </div>

        <motion.div 
          ref={boardRef}
          className={`
            relative bg-[#020617] border-2 border-white/20 rounded-[40px] p-4 md:p-6 shadow-[0_40px_120px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-700
            ${isExecutingPremove ? 'ring-4 ring-emerald-500/30' : ''}
          `}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${currentLevel.gridSize}, 1fr)`,
            gridTemplateRows: `repeat(${currentLevel.gridSize}, 1fr)`,
            gap: '8px',
            width: 'min(85vw, 600px)',
            height: 'min(85vw, 600px)',
          }}
        >
          {/* Static Background Grid */}
          {Array.from({ length: currentLevel.gridSize * currentLevel.gridSize }).map((_, i) => (
            <div key={i} className="bg-slate-900/40 rounded-2xl border border-white/[0.02]" />
          ))}

          {/* Flashlight Overlay for Invisible Mode */}
          {isActuallyInvisible && !showVictory && (
            <div 
              className="absolute inset-0 z-30 pointer-events-none transition-opacity duration-500"
              style={{
                background: `radial-gradient(circle 120px at ${flashlightPos.x}px ${flashlightPos.y}px, transparent 0%, rgba(2, 6, 23, 1) 100%)`
              }}
            />
          )}

          {/* Tiles (Gates) */}
          {(tiles || []).map((tile: TileData) => (
            <div
              key={tile.id}
              className={`absolute inset-0 flex items-center justify-center transition-all duration-500 z-20 ${tile.isOpen ? 'opacity-10 opacity-0 scale-90' : 'opacity-100'}`}
              style={{
                width: `calc((100% - ${(currentLevel.gridSize + 1) * 8}px) / ${currentLevel.gridSize})`,
                height: `calc((100% - ${(currentLevel.gridSize + 1) * 8}px) / ${currentLevel.gridSize})`,
                left: `calc(16px + ${tile.x} * ((100% - ${(currentLevel.gridSize + 1) * 8}px) / ${currentLevel.gridSize} + 8px))`,
                top: `calc(16px + ${tile.y} * ((100% - ${(currentLevel.gridSize + 1) * 8}px) / ${currentLevel.gridSize} + 8px))`,
              }}
            >
              <div className={`w-full h-full rounded-2xl border-4 flex items-center justify-center bg-slate-950/80 ${tile.type === 'gate-vertical' ? 'border-pink-500/50' : 'border-indigo-500/50'}`}>
                {tile.type === 'gate-vertical' ? <X className="text-pink-500" size={32} /> : <AlertTriangle className="text-indigo-500" size={32} />}
              </div>
            </div>
          ))}

          {/* Ghost Path Indicator */}
          <AnimatePresence>
            {ghostPath && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute z-0 pointer-events-none"
                style={{
                  width: ghostPath.dir === 'left' || ghostPath.dir === 'right' ? '200%' : '20px',
                  height: ghostPath.dir === 'up' || ghostPath.dir === 'down' ? '200%' : '20px',
                  background: `linear-gradient(${
                    ghostPath.dir === 'up' ? 'to top' : 
                    ghostPath.dir === 'down' ? 'to bottom' : 
                    ghostPath.dir === 'left' ? 'to left' : 'to right'
                  }, rgba(34,211,238,0.15), transparent)`,
                  left: `calc(16px + ${ghostPath.x} * ((100% - ${(currentLevel.gridSize + 1) * 8}px) / ${currentLevel.gridSize} + 8px) + 50% - 10px)`,
                  top: `calc(16px + ${ghostPath.y} * ((100% - ${(currentLevel.gridSize + 1) * 8}px) / ${currentLevel.gridSize} + 8px) + 50% - 10px)`,
                  transformOrigin: 'center center',
                  transform: `translate(${
                    ghostPath.dir === 'left' ? '-100%' : 
                    ghostPath.dir === 'right' ? '0' : '0'
                  }, ${
                    ghostPath.dir === 'up' ? '-100%' : 
                    ghostPath.dir === 'down' ? '0' : '0'
                  })`
                }}
              />
            )}
          </AnimatePresence>

          {/* Arrows */}
          {arrows.map((arrow: ArrowData) => (
            <motion.button
              key={arrow.id}
              layoutId={arrow.id}
              onClick={() => handleArrowClick(arrow)}
              onMouseEnter={() => setHoveredArrowId(arrow.id)}
              onMouseLeave={() => setHoveredArrowId(null)}
              initial={false}
              animate={{ 
                opacity: removedIds.has(arrow.id) ? 0 : 1,
                scale: removedIds.has(arrow.id) ? 1.5 : (hintId === arrow.id ? 1.15 : 1),
                x: removedIds.has(arrow.id) ? (arrow.dir === 'left' ? -1000 : arrow.dir === 'right' ? 1000 : 0) : (shakeId === arrow.id ? [0, -5, 5, -5, 5, 0] : 0),
                y: removedIds.has(arrow.id) ? (arrow.dir === 'up' ? -1000 : arrow.dir === 'down' ? 1000 : 0) : 0,
                rotate: (shakeId === arrow.id ? [0, -2, 2, -2, 2, 0] : 0)
              }}
              transition={{ 
                type: removedIds.has(arrow.id) ? "tween" : "spring", 
                duration: removedIds.has(arrow.id) ? 0.4 : 0.4,
                ease: "easeIn"
              }}
              className={`
                absolute flex items-center justify-center rounded-2xl z-10 cursor-pointer overflow-hidden
                ${removedIds.has(arrow.id) ? 'pointer-events-none' : ''}
                ${premoveQueue.includes(arrow.id) ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_15px_rgba(52,211,153,0.4)]' : ''}
                ${execIndex >= 0 && premoveQueue[execIndex] === arrow.id ? 'scale-110 ring-4 ring-white' : ''}
                ${hintId === arrow.id ? 'ring-2 ring-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]' : ''}
              `}
              style={{
                width: `calc((100% - ${(currentLevel.gridSize + 1) * 8}px) / ${currentLevel.gridSize})`,
                height: `calc((100% - ${(currentLevel.gridSize + 1) * 8}px) / ${currentLevel.gridSize})`,
                left: `calc(16px + ${arrow.x} * ((100% - ${(currentLevel.gridSize + 1) * 8}px) / ${currentLevel.gridSize} + 8px))`,
                top: `calc(16px + ${arrow.y} * ((100% - ${(currentLevel.gridSize + 1) * 8}px) / ${currentLevel.gridSize} + 8px))`,
                backgroundColor: arrow.type === 'key' ? 'rgba(245, 158, 11, 0.15)' :
                                 arrow.type === 'rotator' ? 'rgba(168, 85, 247, 0.15)' :
                                 arrow.type === 'shifter' ? 'rgba(6, 182, 212, 0.15)' :
                                 arrow.type === 'switch' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255, 255, 255, 0.03)'
              }}
            >
              {/* Internal Glass Highlight */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              
              <ArrowIcon arrow={arrow} size={currentLevel.gridSize > 6 ? 24 : 32} />
              
              {/* Type Indicators */}
              {arrow.type === 'locked' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                  <Lock size={16} className={hasKeys ? 'text-white animate-pulse' : 'text-slate-500'} />
                </div>
              )}
              {arrow.type === 'key' && (
                <div className="absolute top-1 right-1">
                  <div className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                </div>
              )}
              
              {/* Premove Index Badge */}
              {gameMode === 'premove' && premoveQueue.indexOf(arrow.id) !== -1 && (
                <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 text-black text-[8px] font-black rounded-full flex items-center justify-center">
                  {premoveQueue.indexOf(arrow.id) + 1}
                </div>
              )}
            </motion.button>
          ))}

          {/* Overlays */}
          <AnimatePresence>
            {showVictory && (
              <motion.div 
                initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-cyan-500/10"
              >
                <motion.div 
                  initial={{ scale: 0.5, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-black/80 p-10 rounded-[3rem] border border-cyan-500/30 flex flex-col items-center gap-6 shadow-[0_0_100px_rgba(34,211,238,0.2)]"
                >
                  <Trophy size={64} className="text-cyan-400" />
                  <div className="text-center">
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white chromatic-title">Clearance Confirmed</h2>
                    <p className="text-cyan-400/60 text-[10px] font-black uppercase tracking-[0.4em] mt-1">Sector {currentLevelIdx + 1} Secured</p>
                  </div>
                  <button 
                    onClick={nextLevel}
                    className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-[0_0_30px_rgba(34,211,238,0.3)]"
                  >
                    Next Stage
                  </button>
                </motion.div>
              </motion.div>
            )}

            {showGameOver && (
              <motion.div 
                initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-500/10"
              >
                <motion.div 
                  initial={{ scale: 0.5, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-black/80 p-10 rounded-[3rem] border border-red-500/30 flex flex-col items-center gap-6 shadow-[0_0_100px_rgba(239,68,68,0.2)]"
                >
                  <AlertTriangle size={64} className="text-red-500" />
                  <div className="text-center">
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">System Error</h2>
                    <p className="text-red-500/60 text-[10px] font-black uppercase tracking-[0.4em] mt-1">
                      {gameOverReason === 'clicks' ? 'Deployment Exhausted' : 
                       gameOverReason === 'time' ? 'Connection Timeout' : 'Vector Blocked'}
                    </p>
                  </div>
                  <button 
                    onClick={handleReset}
                    className="w-full py-4 bg-red-500 hover:bg-red-400 text-black font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-[0_0_30px_rgba(239,68,68,0.3)]"
                  >
                    Retry Mission
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Premove Launch Control */}
      {gameMode === 'premove' && !showVictory && !showGameOver && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <button 
            disabled={premoveQueue.length === 0 || isExecutingPremove}
            onClick={executePremove}
            className={`
              px-12 py-5 rounded-[2rem] font-black uppercase tracking-[0.5em] text-sm transition-all flex items-center gap-4
              ${premoveQueue.length > 0 && !isExecutingPremove 
                ? 'bg-emerald-500 text-black shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95' 
                : 'bg-white/5 text-white/20 border border-white/10 cursor-not-allowed'}
            `}
          >
            <Play size={20} fill="currentColor" />
            Execute Sequence
          </button>
          <div className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.3em]">
            {isExecutingPremove ? `Syncing Vector ${execIndex + 1} of ${premoveQueue.length}` : `${premoveQueue.length} Operations in Buffer`}
          </div>
        </motion.div>
      )}
    </div>
  );
}
