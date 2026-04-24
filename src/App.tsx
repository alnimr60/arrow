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
  Move,
  Volume2,
  VolumeX,
  Clock,
  AlertTriangle,
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

// Sub-component for realistic menu previews
const MenuPreviewBoard = ({ mode, levelIdx }: { mode: 'standard' | 'invisible', levelIdx: number }) => {
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
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'game' | 'timedConfig' | 'timedResult'>('menu');
  const [gameMode, setGameMode] = useState<'standard' | 'invisible' | 'timed'>('standard');
  const [timedFlavor, setTimedFlavor] = useState<'standard' | 'invisible'>('standard');
  const [timedDuration, setTimedDuration] = useState<1 | 3 | 5>(3);
  const [timedScore, setTimedScore] = useState(0);
  const [timedLevelIdx, setTimedLevelIdx] = useState(0);

  const [standardLevelIdx, setStandardLevelIdx] = useState(() => {
    const saved = localStorage.getItem('standard-level');
    return saved ? parseInt(saved) : 0;
  });
  const [invisibleLevelIdx, setInvisibleLevelIdx] = useState(() => {
    const saved = localStorage.getItem('invisible-level');
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

  const currentLevelIdx = gameMode === 'timed' ? timedLevelIdx : (gameMode === 'standard' ? standardLevelIdx : invisibleLevelIdx);
  const maxReachedLevel = gameMode === 'standard' ? standardMaxLevel : (gameMode === 'invisible' ? invisibleMaxLevel : 0);
  const setCurrentLevelIdx = (valOrFn: number | ((prev: number) => number)) => {
    if (gameMode === 'standard') {
      setStandardLevelIdx(valOrFn);
      const next = typeof valOrFn === 'function' ? valOrFn(standardLevelIdx) : valOrFn;
      localStorage.setItem('standard-level', next.toString());
    } else {
      setInvisibleLevelIdx(valOrFn);
      const next = typeof valOrFn === 'function' ? valOrFn(invisibleLevelIdx) : valOrFn;
      localStorage.setItem('invisible-level', next.toString());
    }
  };
  const setMaxReachedLevel = (val: number) => {
    if (gameMode === 'standard') {
      setStandardMaxLevel(val);
      localStorage.setItem('standard-max-level', val.toString());
    } else {
      setInvisibleMaxLevel(val);
      localStorage.setItem('invisible-max-level', val.toString());
    }
  };

  const LEVEL_METADATA = useMemo(() => getLevelMetadata(gameMode), [gameMode]);
  
  const [arrows, setArrows] = useState<ArrowData[]>([]);
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<{ arrows: ArrowData[], removedIds: Set<string>, tiles: TileData[], toolbox: ToolboxConfig, clicks?: number }[]>([]);
  const [toolbox, setToolbox] = useState<ToolboxConfig>({ rotations: 0, shifts: 0 });
  const [activeTool, setActiveTool] = useState<'rotate' | null>(null);
  const [hoveredArrowId, setHoveredArrowId] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [hintId, setHintId] = useState<string | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<'clicks' | 'time' | null>(null);
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
  }, [isMuted]);

  useEffect(() => {
    if (currentLevelIdx > maxReachedLevel && gameMode !== 'timed') {
      setMaxReachedLevel(currentLevelIdx);
    }
  }, [currentLevelIdx, maxReachedLevel]);

  // Timer Effect: Responsive 100ms update for "counting moments"
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || showVictory || showGameOver) return;

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
  }, [showVictory, showGameOver, isMuted, timeLeft === null, gameMode]);

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
    
    if (gameMode === 'timed') {
      if (timeLeft === null) {
        const totalSecs = timedDuration * 60;
        setTimeLeft(totalSecs);
        setTimedTotalSeconds(totalSecs);
      }
    } else {
      setTimeLeft(currentLevel.timeLimit || null);
    }
    
    if (!isMuted) soundService.playLevelStart();
    localStorage.setItem('arrow-escape-level', currentLevelIdx.toString());
  }, [currentLevelIdx, currentLevel, gameMode, timedDuration, isMuted]);

  const hasKeys = useMemo(() => {
    return arrows.some(a => !removedIds.has(a.id) && a.type === 'key');
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
        case 'up': return allArrows.some(a => !removed.has(a.id) && a.x === x && a.y < y);
        case 'down': return allArrows.some(a => !removed.has(a.id) && a.x === x && a.y > y);
        case 'left': return allArrows.some(a => !removed.has(a.id) && a.y === y && a.x < x);
        case 'right': return allArrows.some(a => !removed.has(a.id) && a.y === y && a.x > x);
      }
    })();
    if (isArrowBlocked) return true;

    // Check Gates
    const isGateBlocked = currentTiles.some(t => {
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

  const handleArrowClick = useCallback((arrow: ArrowData) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 250) return;
    lastClickTimeRef.current = now;

    if (removedIds.has(arrow.id) || showVictory || showGameOver) return;

    const blocked = isBlocked(arrow, arrows, removedIds, tiles);

    if (blocked) {
      if (!isMuted) soundService.playError();
      setShakeId(arrow.id);
      setTimeout(() => setShakeId(null), 500);
      
      setClickCount(prev => {
        const next = prev + 1;
        if (currentLevel.clickLimit && next >= currentLevel.clickLimit) {
          setGameOverReason('clicks');
          setShowGameOver(true);
          if (!isMuted) soundService.playError();
        }
        return next;
      });
      return;
    }

    // NOT BLOCKED
    if (!isMuted) {
      soundService.playLaunch();
      soundService.playRemove(arrow.dir);
      if (arrow.type === 'switch') soundService.playSwitch();
      if (arrow.type === 'rotator') soundService.playRotate();
      if (arrow.type === 'shifter') soundService.playShift();
    }

    setClickCount(prev => {
      const next = prev + 1;
      
      // Save history
      setHistory(h => [...h, { 
        arrows: [...arrows], 
        removedIds: new Set(removedIds), 
        tiles: [...tiles], 
        toolbox: { ...toolbox }, 
        clicks: prev 
      }]);

      if (currentLevel.clickLimit && next >= currentLevel.clickLimit && removedIds.size + 1 < arrows.length) {
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
          setTimedScore(s => s + 1);
          if (!isMuted) soundService.playLevelComplete();
          setTimeout(() => {
            setTimedFlavor(Math.random() > 0.5 ? 'standard' : 'invisible');
            setTimedLevelIdx(Math.floor(Math.random() * 1000000));
            setArrows([]);
            setRemovedIds(new Set());
          }, 300);
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
             const isOccupied = prev.some(other => (!removedIds.has(other.id) && other.id !== arrow.id) && other.x === nx && other.y === ny) ||
                              tiles.some(t => !t.isOpen && (t.type === 'gate-vertical' || t.type === 'gate-horizontal') && t.x === nx && t.y === ny);
             if (!isOccupied) return { ...a, x: nx, y: ny };
           }
           return a;
         });
      });
    }

    setHintId(null);
  }, [arrows, isBlocked, isMuted, currentLevel, tiles, toolbox, showVictory, showGameOver, removedIds, gameMode]);

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
    if (!isMuted) soundService.playLevelStart();

    if (gameMode === 'timed') {
      // Reset the WHOLE SESSION for Timed Rush
      setTimedScore(0);
      setTimedLevelIdx(Math.floor(Math.random() * 1000000));
      const totalSecs = timedDuration * 60;
      setTimeLeft(totalSecs);
      setTimedTotalSeconds(totalSecs);
      setShowVictory(false);
      setShowGameOver(false);
      setGameOverReason(null);
      setClickCount(0);
      setHistory([]);
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
    setTimeLeft(currentLevel.timeLimit || null);
  };

  const handleHint = () => {
    if (!isMuted) soundService.playClick();
    const removable = arrows.find(a => !removedIds.has(a.id) && !isBlocked(a, arrows, removedIds));
    if (removable) {
      setHintId(removable.id);
    }
  };

  const nextLevel = () => {
    if (!isMuted) soundService.playClick();
    if (currentLevelIdx < LEVEL_METADATA.length - 1) {
      setCurrentLevelIdx(currentLevelIdx + 1);
    }
  };

  const selectLevel = (idx: number) => {
    if (!isMuted) soundService.playLevelStart();
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
      <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center overflow-hidden font-sans selection:bg-cyan-500/30">
        {/* Removed noise-overlay and scanlines from menu */}
        
        <div className="flex flex-col md:flex-row w-full h-full">
          {/* Left Side: Standard Mode */}
          <motion.button 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 1.2, ease: "circOut" }}
            onClick={() => { setGameMode('standard'); setCurrentScreen('game'); }}
            className="relative w-full md:w-1/3 h-[33.3vh] md:h-screen group flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/5 overflow-hidden transition-all duration-700 hover:z-10"
          >
            {/* Post-processing shader vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-[5]" />
            
            {/* Background Ambient Glow */}
            <div className="absolute inset-0 bg-cyan-950/[0.08] group-hover:bg-cyan-900/[0.15] transition-colors duration-1000" />
            
            {/* Content Wrapper */}
            <div className="relative z-10 flex flex-col items-center text-center px-8 space-y-8">
              <div className="relative">
                <motion.div 
                  whileHover={{ rotate: 90 }}
                  className="text-cyan-400 opacity-60 group-hover:opacity-100 transition-all duration-500"
                >
                  <LayoutGrid size={40} strokeWidth={1} />
                </motion.div>
                {/* Technical Brackets */}
                <div className="panel-corner top-[-10px] left-[-10px] border-t border-l" />
                <div className="panel-corner bottom-[-10px] right-[-10px] border-b border-r" />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white/90 group-hover:text-white transition-all duration-700 chromatic-title uppercase">Standard</h2>
                <div className="h-[1px] w-12 bg-cyan-500/40 mx-auto group-hover:w-32 transition-all duration-700" />
                <p className="text-slate-500 text-[10px] md:text-sm font-medium max-w-[280px] mx-auto uppercase tracking-widest leading-loose opacity-60 group-hover:opacity-100 group-hover:text-slate-300 transition-all">
                  The Logic Engine <br />
                  Tactical untangling in 600 stages
                </p>
              </div>

              {/* Realistic Game Preview */}
              <div className="mt-8 relative group-hover:scale-110 transition-transform duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] pointer-events-none scale-75">
                <MenuPreviewBoard mode="standard" levelIdx={4} />
              </div>

              <div className="pt-6">
                <div className="inline-flex items-center gap-4 px-8 py-3 bg-white/[0.02] rounded-none border border-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:border-cyan-500/50 group-hover:text-cyan-400 transition-all relative">
                  <div className="absolute top-0 left-0 w-1 h-1 bg-cyan-500" />
                  <Trophy size={12} className="opacity-60" />
                  <span>Sector {standardMaxLevel + 1} Logged</span>
                </div>
              </div>
            </div>

            {/* High Contrast Hover Glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          </motion.button>

          {/* Middle Side: Timed Rush */}
          <motion.button 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.1, ease: "circOut" }}
            onClick={() => { setGameMode('timed'); setCurrentScreen('timedConfig'); }}
            className="relative w-full md:w-1/3 h-[33.3vh] md:h-screen group flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/5 overflow-hidden transition-all duration-700 hover:z-10 bg-[#050505]"
          >
            {/* Post-processing shader vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)] z-[5]" />
            
            {/* Background Ambient Glow */}
            <div className="absolute inset-0 bg-amber-950/[0.08] group-hover:bg-amber-900/[0.15] transition-colors duration-1000" />
            
            {/* Content Wrapper */}
            <div className="relative z-10 flex flex-col items-center text-center px-8 space-y-8">
              <div className="relative">
                <motion.div 
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="text-amber-400 opacity-60 group-hover:opacity-100 transition-all duration-500"
                >
                  <Clock size={40} strokeWidth={1} />
                </motion.div>
                {/* Technical Brackets */}
                <div className="panel-corner top-[-10px] left-[-10px] border-t border-l border-amber-500/50" />
                <div className="panel-corner bottom-[-10px] right-[-10px] border-b border-r border-amber-500/50" />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white/90 group-hover:text-white transition-all duration-700 chromatic-title uppercase">Timed Rush</h2>
                <div className="h-[1px] w-12 bg-amber-500/40 mx-auto group-hover:w-32 transition-all duration-700" />
                <p className="text-slate-500 text-[10px] md:text-sm font-medium max-w-[280px] mx-auto uppercase tracking-widest leading-loose opacity-60 group-hover:opacity-100 group-hover:text-slate-300 transition-all">
                  System Overload <br />
                  Infinite generation vs clock
                </p>
              </div>

              <motion.div 
                className="mt-8 relative group-hover:scale-110 transition-transform duration-1000 bg-amber-500/10 p-12 rounded-full border border-amber-500/20 blur-sm group-hover:blur-none"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <RefreshCw size={48} className="text-amber-500/20" />
              </motion.div>

              <div className="pt-6">
                <div className="inline-flex items-center gap-4 px-8 py-3 bg-white/[0.02] rounded-none border border-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:border-amber-500/50 group-hover:text-amber-400 transition-all relative">
                  <div className="absolute top-0 left-0 w-1 h-1 bg-amber-500" />
                  <Clock size={12} className="opacity-60" />
                  <span>Infinite Stream Ready</span>
                </div>
              </div>
            </div>

            {/* High Contrast Hover Glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-amber-500/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          </motion.button>

          {/* Right Side: Invisible Mode */}
          <motion.button 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 1.2, ease: "circOut" }}
            onClick={() => { setGameMode('invisible'); setCurrentScreen('game'); }}
            className="relative w-full md:w-1/3 h-[33.3vh] md:h-screen group flex flex-col items-center justify-center bg-[#000000] overflow-hidden transition-all duration-700 hover:z-10"
          >
            {/* Post-processing shader vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] z-[5]" />
            
            {/* Background Ambient Glow */}
            <div className="absolute inset-0 bg-purple-950/[0.08] group-hover:bg-purple-900/[0.15] transition-colors duration-1000" />
            
            {/* Content Wrapper */}
            <div className="relative z-10 flex flex-col items-center text-center px-8 space-y-8">
              <div className="relative">
                <motion.div 
                  whileHover={{ scale: 1.2 }}
                  className="text-purple-400 opacity-60 group-hover:opacity-100 transition-all duration-500"
                >
                  <EyeOff size={40} strokeWidth={1} />
                </motion.div>
                {/* Technical Brackets */}
                <div className="panel-corner top-[-10px] left-[-10px] border-t border-l" />
                <div className="panel-corner bottom-[-10px] right-[-10px] border-b border-r" />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white/90 group-hover:text-white transition-all duration-700 chromatic-title uppercase">Invisible</h2>
                <div className="h-[1px] w-12 bg-purple-500/40 mx-auto group-hover:w-32 transition-all duration-700" />
                <p className="text-slate-500 text-[10px] md:text-sm font-medium max-w-[280px] mx-auto uppercase tracking-widest leading-loose opacity-60 group-hover:opacity-100 group-hover:text-slate-300 transition-all">
                  The Memory Void <br />
                  Subliminal navigation in 300 stages
                </p>
              </div>

              {/* Realistic Game Preview */}
              <div className="mt-8 relative group-hover:scale-110 transition-transform duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] pointer-events-none scale-75">
                <MenuPreviewBoard mode="invisible" levelIdx={12} />
              </div>

              <div className="pt-6">
                <div className="inline-flex items-center gap-4 px-8 py-3 bg-white/[0.02] rounded-none border border-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 group-hover:border-purple-500/50 group-hover:text-purple-400 transition-all relative">
                  <div className="absolute top-0 left-0 w-1 h-1 bg-purple-500" />
                  <Clock size={12} className="opacity-60" />
                  <span>Core {invisibleMaxLevel + 1} Synchronized</span>
                </div>
              </div>
            </div>

            {/* High Contrast Hover Glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-purple-500/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          </motion.button>
        </div>

        {/* Global UI Overlays */}
        <div className="absolute top-10 left-10 z-50 pointer-events-auto hidden md:block">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex items-center gap-6"
          >
            <div className="flex flex-col">
              <h1 className="text-xl font-black italic uppercase tracking-tighter text-white/90">Arrow Escape</h1>
              <div className="text-[8px] text-cyan-500 font-black uppercase tracking-[0.4em]">Advanced Pulse Logic</div>
            </div>
          </motion.div>
        </div>

        <div className="absolute top-10 right-10 z-50 flex items-center gap-4">
           <button 
              onClick={() => setIsMuted(!isMuted)}
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-none border border-white/10 text-slate-400 hover:text-white transition-all"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
        </div>

        <div className="absolute bottom-6 right-10 z-50 opacity-20 text-[8px] font-black uppercase tracking-[0.5em] text-white">
          System Core 4.3 // Stability Verified
        </div>

        <AnimatePresence mode="wait">
          {currentScreen === 'timedConfig' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-3xl flex items-center justify-center p-6"
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
                    <div className="p-3 bg-[#22d3ee]/10 rounded-lg">
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
              className="fixed inset-0 z-[100] bg-[#000000]/80 backdrop-blur-3xl flex items-center justify-center p-6 overflow-hidden pointer-events-auto"
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
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#22d3ee]/20 to-[#a855f7]/20 blur-xl opacity-30 group-hover:opacity-60 transition-opacity" />
                  <div className="relative glass-panel p-6 md:p-12 flex flex-col items-center gap-1 md:gap-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Stages Synchronized</div>
                    <div className="text-7xl md:text-[9rem] font-black leading-none text-white chromatic-title tabular-nums">
                      {timedScore.toString().padStart(2, '0')}
                    </div>
                    <div className="w-full h-[1px] bg-white/5 my-2" />
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Duration</span>
                        <span className="text-xs md:text-sm font-black text-[#22d3ee]">{timedDuration}M</span>
                      </div>
                      <div className="w-[1px] h-3 bg-white/10" />
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Efficiency</span>
                        <span className="text-xs md:text-sm font-black text-[#a855f7]">{((timedScore / timedDuration) || 0).toFixed(1)}/m</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setTimedScore(0);
                      setTimedLevelIdx(Math.floor(Math.random() * 1000000));
                      const totalSecs = timedDuration * 60;
                      setTimeLeft(totalSecs);
                      setTimedTotalSeconds(totalSecs);
                      setCurrentScreen('game');
                    }}
                    className="flex-1 py-3.5 md:py-4 bg-[#22d3ee] hover:bg-[#22d3ee]/80 text-black text-[10px] md:text-[11px] font-black uppercase tracking-[0.4em] shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-all relative z-[110]"
                  >
                    Relaunch Session
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentScreen('menu');
                    }}
                    className="flex-1 py-3.5 md:py-4 bg-white/5 hover:bg-white/10 text-white text-[10px] md:text-[11px] font-black uppercase tracking-[0.4em] border border-white/10 transition-all relative z-[110]"
                  >
                    System Archive
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
          gameMode === 'standard' ? 'bg-[radial-gradient(circle_at_20%_20%,#083344_0%,transparent_50%)]' : 'bg-[radial-gradient(circle_at_20%_20%,#3b0764_0%,transparent_50%)]'
        }`} />
        <div className={`absolute bottom-0 right-0 w-full h-full opacity-30 transition-colors duration-1000 ${
          gameMode === 'standard' ? 'bg-[radial-gradient(circle_at_80%_80%,#1e1b4b_0%,transparent_50%)]' : 'bg-[radial-gradient(circle_at_80%_80%,#4c1d95_0%,transparent_50%)]'
        }`} />
      </div>

      {/* Timer Bar for Timed Mode */}
      {gameMode === 'timed' && timeLeft !== null && (
        <div className="fixed top-0 left-0 w-full h-1 z-[100] bg-white/5 overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-amber-500 to-orange-600"
            animate={{ width: `${(timeLeft / timedTotalSeconds) * 100}%` }}
            transition={{ ease: "linear", duration: 0.2 }}
          />
        </div>
      )}

      {/* Header */}
      <nav 
        className="h-20 lg:h-24 px-6 lg:px-10 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-3xl sticky top-0 z-40"
        style={{ paddingTop: 'var(--safe-top)', height: 'calc(5rem + var(--safe-top))' }}
      >
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentScreen('menu')}
            className="p-2 text-[#94a3b8] hover:text-white transition-colors"
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
          <div className={`p-2 flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${gameMode === 'invisible' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'}`}>
            {gameMode === 'invisible' ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="hidden sm:inline">{gameMode === 'invisible' ? 'Invisible Mode' : 'Standard Mode'}</span>
          </div>
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
        {/* Left Sidebar */}
        <aside className="hidden lg:flex flex-col gap-5">
          {gameMode === 'timed' && (
             <div className="glass-panel rounded-[20px] p-6 border-amber-500/30">
                <div className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-2">Timed Session</div>
                <div className="text-5xl font-black italic text-white flex items-baseline gap-2">
                   {timedScore}
                   <span className="text-xs uppercase tracking-tighter text-slate-500 not-italic">Stages</span>
                </div>
             </div>
          )}
          <div className="glass-panel rounded-[20px] p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-block px-3 py-1 bg-[#22d3ee]/10 text-[#22d3ee] rounded-full text-xs font-bold uppercase tracking-wider">
                {gameMode === 'timed' ? 'PROCEDURAL' : `Stage ${currentLevelIdx + 1}`}
              </span>
              {currentLevel.strategy && (
                <span className="text-[10px] font-black text-[#818cf8] uppercase tracking-tighter opacity-80">
                  {currentLevel.strategy}
                </span>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-[#818cf8] uppercase tracking-widest mb-2">Core Logic</h3>
                <p className="text-sm text-[#94a3b8] leading-relaxed">
                  An arrow can only launch if its path is clear.
                </p>
              </div>

              {arrows.some(a => a.type === 'rotator' || a.type === 'key' || a.type === 'shifter') && (
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <h3 className="text-xs font-bold text-[#22d3ee] uppercase tracking-widest mb-2">Dynamic Objects</h3>
                  
                  {arrows.some(a => a.type === 'rotator') && (
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                         <RotateCcw size={10} className="text-purple-400" />
                      </div>
                      <p className="text-[11px] text-[#94a3b8]"><b>Rotator:</b> Rotates adjacent arrows 90° on exit.</p>
                    </div>
                  )}

                  {arrows.some(a => a.type === 'key') && (
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                         <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                      </div>
                      <p className="text-[11px] text-[#94a3b8]"><b>Key:</b> Remove to unlock chained arrows.</p>
                    </div>
                  )}

                  {arrows.some(a => a.type === 'shifter') && (
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                         <Move size={10} className="text-cyan-400" />
                      </div>
                      <p className="text-[11px] text-[#94a3b8]"><b>Shifter:</b> Shifts its row/column on exit.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {gameMode !== 'timed' && (
            <div className="glass-panel rounded-[20px] p-6">
              <div className="text-[10px] uppercase text-[#94a3b8] tracking-widest mb-3 font-semibold">Stage Archive</div>
              <button 
                onClick={() => setShowLevelSelector(true)}
                className="w-full py-2.5 mb-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-[#22d3ee] transition-all flex items-center justify-center gap-2"
              >
                <LayoutGrid size={14} />
                Browse All
              </button>
              <div className="text-[10px] uppercase text-[#94a3b8] tracking-widest mb-3 font-semibold opacity-50">Quick Switch</div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 25 }).map((_, i) => {
                  const actualIdx = i + Math.max(0, currentLevelIdx - 10);
                  if (actualIdx >= LEVEL_METADATA.length) return null;
                  return (
                    <button
                      key={actualIdx}
                      onClick={() => selectLevel(actualIdx)}
                      className={`
                        aspect-square rounded-md flex items-center justify-center text-[10px] font-bold transition-all
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

        {/* Center: Game Board - Extracted and Memoized */}
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
          LEVEL_METADATA={LEVEL_METADATA}
          handleArrowClick={handleArrowClick}
          setHoveredArrowId={setHoveredArrowId}
          nextLevel={nextLevel}
          handleReset={handleReset}
        />

        {/* Right Sidebar */ }
        <aside className="flex flex-col gap-5 overflow-hidden">
          <div className="glass-panel rounded-[20px] p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold text-[#818cf8] uppercase tracking-widest px-1">Tactical Operations</h3>
              
              <button
                onClick={handleReset}
                className="w-full py-3.5 bg-gradient-to-r from-[#22d3ee] to-[#818cf8] text-[#0f172a] font-bold rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.25)] flex items-center justify-center gap-2 hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all text-sm"
              >
                <RotateCcw size={18} />
                Restart Mission
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all disabled:opacity-20 disabled:grayscale"
                >
                  <Undo2 size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Undo</span>
                </button>
                <button
                  onClick={handleHint}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                >
                  <Lightbulb size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Hint</span>
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
                  <div className={`text-2xl font-black tabular-nums transition-all ${currentLevel.clickLimit && clickCount >= currentLevel.clickLimit - 3 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {clickCount.toString().padStart(2, '0')}
                    {currentLevel.clickLimit && <span className="text-slate-700 text-xs ml-1 font-bold">/ {currentLevel.clickLimit.toString().padStart(2, '0')}</span>}
                  </div>
                </div>
                <div className="space-y-1 group/stat">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] group-hover/stat:text-cyan-400 transition-colors">
                    <Clock size={12} strokeWidth={2.5} />
                    Time
                  </div>
                  <div className={`text-2xl font-black tabular-nums transition-all ${timeLeft !== null && timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {timeLeft === null ? '--:--' : (
                      <span className="flex items-baseline gap-0.5">
                        {Math.floor(timeLeft / 60)}:{Math.floor(timeLeft % 60).toString().padStart(2, '0')}
                        <span className="text-[12px] opacity-40 font-bold">.{Math.floor((timeLeft % 1) * 10)}</span>
                      </span>
                    )}
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

                  <div className="flex-1 overflow-y-auto px-2 scrollbar-hide grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 pb-8">
                  {LEVEL_METADATA.map((meta, idx) => (
                    <button
                      key={idx}
                      ref={currentLevelIdx === idx ? activeLevelRef : null}
                      onClick={() => selectLevel(idx)}
                      className={`
                        aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all group
                        ${currentLevelIdx === idx 
                          ? 'bg-gradient-to-br from-[#22d3ee] to-[#818cf8] text-[#0f172a] scale-110 shadow-xl shadow-cyan-900/40' 
                          : idx < maxReachedLevel
                            ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                            : 'bg-slate-800/50 border border-white/5 hover:border-[#22d3ee]/50'}
                      `}
                    >
                      <span className="text-lg font-black">{idx + 1}</span>
                      <span className="text-[8px] uppercase tracking-tighter opacity-70 group-hover:opacity-100">{meta.gridSize}x{meta.gridSize}</span>
                      {idx > maxReachedLevel + 5 && (
                        <div className="absolute top-1 right-1 opacity-40">
                          <Lock size={8} />
                        </div>
                      )}
                      {idx < maxReachedLevel && (
                        <div className="absolute top-1 right-1 text-indigo-400/60">
                          <CheckCircle2 size={10} />
                        </div>
                      )}
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

      {/* Mobile Float Controls */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-2xl lg:hidden z-30 shadow-2xl">
        <button onClick={handleUndo} disabled={history.length === 0} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-xl disabled:opacity-20"><Undo2 size={18} /></button>
        <button onClick={handleReset} className="px-6 h-12 flex items-center gap-2 bg-gradient-to-r from-[#22d3ee] to-[#818cf8] text-[#0f172a] font-bold rounded-xl active:scale-95 transition-transform"><RotateCcw size={18} /> Restart</button>
        <button onClick={handleHint} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-xl"><Lightbulb size={18} /></button>
      </div>

      <footer className="p-6 pb-24 lg:pb-6 text-center text-[10px] text-[#94a3b8] uppercase tracking-[0.2em] opacity-40">
        Arrow Escape Puzzle &bull; Strategy & Logic
      </footer>
    </div>
  );
}

// Memoized Stat Item for efficiency
const StatItem = React.memo(({ label, value }: { label: string, value: string | number }) => {
  return (
    <div className="text-center min-w-[70px] lg:min-w-[80px] group/stat">
      <div className="text-[9px] uppercase text-[#94a3b8] font-black tracking-[0.2em] mb-1 group-hover/stat:text-[#22d3ee] transition-colors">{label}</div>
      <div className="text-xl lg:text-2xl font-black tabular-nums text-white chromatic-title leading-tight">
        {typeof value === 'number' ? value.toString().padStart(2, '0') : value}
      </div>
    </div>
  );
});

function ActionButton({ icon, label, onClick, disabled }: { icon: ReactNode, label: string, onClick: () => void, disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 bg-white/5 border border-white/10 text-[#f8fafc] font-semibold rounded-xl flex items-center gap-3 px-5 transition-all hover:bg-white/10 hover:border-[#22d3ee]/30 active:scale-95 disabled:opacity-20 disabled:pointer-events-none"
    >
      <span className="opacity-70">{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

// Optimized Arrow Icon with memo
const ArrowIcon = React.memo(({ arrow }: { arrow: ArrowData }) => {
  const rotation = { up: 0, right: 90, down: 180, left: 270 }[arrow.dir];
  // Arrow colors with higher contrast for high-end look
  const colorClass = {
    up: 'text-[#f43f5e]',    // Rose
    right: 'text-[#10b981]',  // Emerald
    down: 'text-[#f59e0b]',   // Amber
    left: 'text-[#3b82f6]'    // Blue
  }[arrow.dir];

  const specialtyIcon = () => {
    switch (arrow.type) {
      case 'rotator': return <RotateCcw size={10} className="text-white/40" />;
      case 'shifter': return <Move size={10} className="text-white/40" />;
      case 'switch': return <div className="w-1.5 h-1.5 bg-pink-400 rounded-sm rotate-45 shadow-[0_0_8px_rgba(244,114,182,0.6)]" />;
      default: return null;
    }
  };

  return (
    <div 
      className={`relative w-full h-full flex items-center justify-center transition-all duration-300 ${colorClass} group-hover:drop-shadow-[0_0_12px_currentColor]`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <svg width="75%" height="75%" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)]">
        <path d="M12 2L2 19H22L12 2Z" />
      </svg>
      {arrow.type && arrow.type !== 'normal' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="mt-4">
            {specialtyIcon()}
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * GameBoard Component: Memoized to prevent re-renders from timer updates.
 */
const GameBoard = React.memo(({ 
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
  LEVEL_METADATA,
  handleArrowClick, 
  setHoveredArrowId,
  nextLevel,
  handleReset
}: any) => {
  const [pointerPos, setPointerPos] = useState({ x: -1000, y: -1000 });
  const boardRef = useRef<HTMLDivElement>(null);

  const handlePointer = (e: React.PointerEvent) => {
    if (gameMode !== 'invisible' || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    setPointerPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handlePointerLeave = () => {
    if (gameMode === 'invisible') {
      setPointerPos({ x: -1000, y: -1000 });
    }
  };

  return (
    <section className="flex flex-col items-center justify-center relative touch-none py-8">
      <div className="relative group/board">
        {/* Technical Corner Brackets for Board */}
        <div className="panel-corner top-[-10px] left-[-10px] border-t-2 border-l-2 opacity-40 group-hover/board:opacity-100 transition-opacity" />
        <div className="panel-corner bottom-[-10px] right-[-10px] border-b-2 border-r-2 opacity-40 group-hover/board:opacity-100 transition-opacity" />

        <div 
          ref={boardRef}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={handlePointerLeave}
          className="relative bg-[#020617] border-2 border-white/20 rounded-[32px] p-4 shadow-[0_40px_100px_rgba(0,0,0,1)] overflow-hidden"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${currentLevel.gridSize}, 1fr)`,
            gridTemplateRows: `repeat(${currentLevel.gridSize}, 1fr)`,
            gap: '8px',
            width: 'min(90vw, 480px)',
            height: 'min(90vw, 480px)',
            cursor: gameMode === 'invisible' ? 'none' : 'default'
          }}
        >
          {/* Internal Board Ambient Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_100%)] pointer-events-none z-0" />

          {/* Dark Overlay for Invisible Mode */}
          {gameMode === 'invisible' && (
            <div 
              className="absolute inset-0 z-20 pointer-events-none"
              style={{
                background: `radial-gradient(circle 100px at ${pointerPos.x}px ${pointerPos.y}px, transparent 0%, rgba(2, 6, 23, 1) 100%)`
              }}
            />
          )}

          {/* Cell Grid Background - High contrast style */}
          {Array.from({ length: currentLevel.gridSize * currentLevel.gridSize }).map((_, i) => (
            <div key={i} className="bg-slate-900/40 rounded-xl" />
          ))}

          {/* Tiles: Conveyors, Gates, etc. */}
          {tiles.map((tile: TileData, i: number) => {
            const cellSize = `calc((100% - ${(currentLevel.gridSize - 1) * 8}px - 32px) / ${currentLevel.gridSize})`;
            const offsetX = `calc(16px + ${tile.x} * (${cellSize} + 8px))`;
            const offsetY = `calc(16px + ${tile.y} * (${cellSize} + 8px))`;
            
            return (
              <div 
                key={`tile-${i}`}
                className={`
                  absolute rounded-lg flex items-center justify-center opacity-60
                  ${tile.type.startsWith('conveyor') ? 'bg-slate-700/30' : ''}
                  ${tile.type.startsWith('gate') ? (tile.isOpen ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/20 border-2 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]') : ''}
                `}
                style={{
                  width: cellSize,
                  height: cellSize,
                  left: offsetX,
                  top: offsetY,
                }}
              >
                {tile.type.startsWith('conveyor') && (
                  <Move size={16} className={`text-slate-500 ${tile.type === 'conveyor-up' ? '-rotate-90' : tile.type === 'conveyor-down' ? 'rotate-90' : tile.type === 'conveyor-left' ? 'rotate-180' : ''}`} />
                )}
                {tile.type.startsWith('gate') && (
                  tile.isOpen ? <div className="w-1 h-full bg-emerald-500/20 rounded-full" /> : <Lock size={12} className="text-red-400" />
                )}
              </div>
            );
          })}

        {/* Ghost Path Indicator (Launch Beam) */}
        <AnimatePresence>
          {ghostPath && (() => {
            const cellSize = `calc((100% - ${(currentLevel.gridSize - 1) * 8}px - 32px) / ${currentLevel.gridSize})`;
            const offsetX = `calc(16px + ${ghostPath.x} * (${cellSize} + 8px))`;
            const offsetY = `calc(16px + ${ghostPath.y} * (${cellSize} + 8px))`;
            
            const style: React.CSSProperties = {
              position: 'absolute',
              borderRadius: '12px',
              boxShadow: '0 0 15px rgba(34, 211, 238, 0.2)',
              zIndex: 0,
              pointerEvents: 'none',
              overflow: 'hidden'
            };

            const beamColor = 'rgba(34, 211, 238, 0.4)';
            const fadeColor = 'rgba(34, 211, 238, 0)';

            if (ghostPath.dir === 'right') {
              style.left = offsetX;
              style.right = '16px';
              style.top = offsetY;
              style.height = cellSize;
              style.background = `linear-gradient(to right, ${beamColor}, ${fadeColor})`;
            } else if (ghostPath.dir === 'left') {
              style.left = '16px';
              style.width = `calc(${offsetX} + ${cellSize} - 16px)`;
              style.top = offsetY;
              style.height = cellSize;
              style.background = `linear-gradient(to left, ${beamColor}, ${fadeColor})`;
            } else if (ghostPath.dir === 'down') {
              style.left = offsetX;
              style.width = cellSize;
              style.top = offsetY;
              style.bottom = '16px';
              style.background = `linear-gradient(to bottom, ${beamColor}, ${fadeColor})`;
            } else if (ghostPath.dir === 'up') {
              style.left = offsetX;
              style.width = cellSize;
              style.top = '16px';
              style.height = `calc(${offsetY} + ${cellSize} - 16px)`;
              style.background = `linear-gradient(to top, ${beamColor}, ${fadeColor})`;
            }

            return (
              <motion.div 
                key="ghost-beam"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={style}
              >
                <motion.div 
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-full h-full bg-white/5"
                />
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Arrows */}
        <AnimatePresence mode="popLayout">
          {arrows.map((arrow: ArrowData) => {
            if (removedIds.has(arrow.id)) return null;
            
            const isShaking = shakeId === arrow.id;
            const isHinted = hintId === arrow.id;
            const isLocked = arrow.type === 'locked' && hasKeys;

            const cellSize = `calc((100% - ${(currentLevel.gridSize - 1) * 8}px - 32px) / ${currentLevel.gridSize})`;
            const offsetX = `calc(16px + ${arrow.x} * (${cellSize} + 8px))`;
            const offsetY = `calc(16px + ${arrow.y} * (${cellSize} + 8px))`;
            
            return (
              <motion.button
                key={arrow.id}
                layoutId={arrow.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: isLocked ? 0.4 : 1,
                  x: isShaking ? [0, -5, 5, -5, 5, 0] : 0,
                  filter: isLocked ? 'grayscale(1)' : 'grayscale(0)',
                }}
                exit={{ 
                  x: arrow.dir === 'left' ? -500 : arrow.dir === 'right' ? 500 : 0,
                  y: arrow.dir === 'up' ? -500 : arrow.dir === 'down' ? 500 : 0,
                  opacity: 0,
                  transition: { duration: 0.2, ease: "circIn" }
                }}
                whileHover={{ scale: isLocked ? 1 : 1.1, backgroundColor: 'rgba(255,255,255,0.05)' }}
                whileTap={{ scale: isLocked ? 1 : 0.9 }}
                onMouseEnter={() => setHoveredArrowId(arrow.id)}
                onMouseLeave={() => setHoveredArrowId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (removedIds.has(arrow.id) || showVictory || showGameOver) return;
                  setHoveredArrowId(arrow.id);
                  handleArrowClick(arrow);
                }}
                className={`
                  absolute flex items-center justify-center rounded-lg transition-all duration-300
                  ${isHinted ? 'shadow-[0_0_20px_rgba(255,255,255,0.3)] outline outline-2 outline-white/40' : ''}
                  ${activeTool === 'rotate' && !isLocked ? 'outline outline-2 outline-purple-500 animate-pulse' : ''}
                  ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}
                  ${arrow.type === 'switch' ? 'shadow-[0_0_10px_rgba(236,72,153,0.3)]' : ''}
                  ${arrow.type === 'key' ? 'shadow-[0_0_15px_rgba(245,158,11,0.2)]' : ''}
                  z-10
                `}
                style={{
                  width: cellSize,
                  height: cellSize,
                  left: offsetX,
                  top: offsetY,
                  backgroundColor: arrow.type === 'key' ? 'rgba(245, 158, 11, 0.1)' :
                                   arrow.type === 'rotator' ? 'rgba(168, 85, 247, 0.1)' :
                                   arrow.type === 'shifter' ? 'rgba(6, 182, 212, 0.1)' :
                                   arrow.type === 'switch' ? 'rgba(236, 72, 153, 0.1)' :
                                   isHinted ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0)'
                }}
              >
                <ArrowIcon arrow={arrow} />
                {isLocked && <div className="absolute inset-0 flex items-center justify-center"><Lock size={12} className="text-white/40" /></div>}
                {arrow.type === 'key' && <div className="absolute -top-1 -right-1"><div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" /></div>}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Victory Modal */}
        <AnimatePresence>
          {showVictory && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-x-[-4px] inset-y-[-4px] flex flex-col items-center justify-center bg-[#0f172a]/95 backdrop-blur-md z-30 rounded-lg border-2 border-[#22d3ee]/20"
            >
              <motion.div
                animate={{ y: [0, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-yellow-400 mb-4"
              >
                <Trophy size={60} />
              </motion.div>
              <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-2">Stage Clear</h2>
              <div className="text-center italic text-[#94a3b8] text-xs font-medium uppercase tracking-[0.2em] mb-4 opacity-70">
                Stage {currentLevelIdx + 1} / {LEVEL_METADATA.length}
              </div>
              <p className="text-[#94a3b8] font-mono text-xs mb-6 uppercase tracking-[0.3em]">Complexity Resolved</p>
              <button
                onClick={currentLevelIdx < LEVEL_METADATA.length - 1 ? nextLevel : handleReset}
                className="px-10 py-3 bg-gradient-to-r from-[#22d3ee] to-[#818cf8] text-[#0f172a] font-bold rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
              >
                {currentLevelIdx < LEVEL_METADATA.length - 1 ? 'Next Level' : 'Play Again'}
                <ChevronRight size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Over Modal */}
        <AnimatePresence>
          {showGameOver && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-x-[-4px] inset-y-[-4px] flex flex-col items-center justify-center bg-[#0f172a]/95 backdrop-blur-md z-30 rounded-lg border-2 border-red-500/20"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-red-500 mb-4"
              >
                <AlertTriangle size={60} />
              </motion.div>
              <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-2">Game Over</h2>
              <p className="text-red-400 font-mono text-xs mb-6 uppercase tracking-[0.3em]">
                {gameOverReason === 'clicks' ? 'Attempts Exhausted' : 'Temporal Decay'}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleReset}
                  className="px-10 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-xl shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
                >
                  <RefreshCw size={20} />
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </section>
  );
});
