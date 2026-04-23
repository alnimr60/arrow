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
  RotateCcw as RefreshCw
} from 'lucide-react';
import { Direction, ArrowData, Level, TileData, ToolboxConfig } from './types';
import { getLevel, LEVEL_METADATA } from './levels';
import { soundService } from './services/soundService';

/**
 * Arrow Escape Puzzle
 * A logic game where you untangle arrows by removing them in the correct order.
 */

export default function App() {
  const [currentLevelIdx, setCurrentLevelIdx] = useState(() => {
    const saved = localStorage.getItem('arrow-escape-level');
    return saved ? Math.min(parseInt(saved), LEVEL_METADATA.length - 1) : 0;
  });
  const [maxReachedLevel, setMaxReachedLevel] = useState(() => {
    const saved = localStorage.getItem('arrow-escape-max-level');
    return saved ? parseInt(saved) : 0;
  });
  
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
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  const activeLevelRef = useRef<HTMLButtonElement>(null);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('arrow-escape-muted');
    return saved === 'true';
  });
  
  const currentLevel = useMemo(() => getLevel(currentLevelIdx), [currentLevelIdx]);

  useEffect(() => {
    localStorage.setItem('arrow-escape-muted', isMuted.toString());
  }, [isMuted]);

  useEffect(() => {
    if (currentLevelIdx > maxReachedLevel) {
      setMaxReachedLevel(currentLevelIdx);
      localStorage.setItem('arrow-escape-max-level', currentLevelIdx.toString());
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
          setGameOverReason('time');
          setShowGameOver(true);
          if (!isMuted) soundService.playError();
          return 0;
        }
        return next;
      });
    }, 200); // Reduced frequency for performance

    return () => clearInterval(timer);
  }, [showVictory, showGameOver, isMuted, timeLeft === null]);

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
    setTimeLeft(currentLevel.timeLimit || null);
    localStorage.setItem('arrow-escape-level', currentLevelIdx.toString());
  }, [currentLevelIdx, currentLevel]);

  const hasKeys = useMemo(() => {
    return arrows.some(a => !removedIds.has(a.id) && a.type === 'key');
  }, [arrows, removedIds]);

  // Check if an arrow is blocked by any other remaining arrow or closed gate
  const isBlocked = useCallback((arrow: ArrowData, allArrows: ArrowData[], removed: Set<string>, currentTiles: TileData[]) => {
    if (arrow.type === 'locked' && hasKeys) {
      return true;
    }

    const { x, y, dir } = arrow;
    const remaining = allArrows.filter(a => !removed.has(a.id));
    
    // Check arrows
    const isArrowBlocked = (() => {
      switch (dir) {
        case 'up': return remaining.some(a => a.x === x && a.y < y);
        case 'down': return remaining.some(a => a.x === x && a.y > y);
        case 'left': return remaining.some(a => a.y === y && a.x < x);
        case 'right': return remaining.some(a => a.y === y && a.x > x);
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
    if (removedIds.has(arrow.id) || showVictory || showGameOver) return;

    // Tactical Haptics for iPhone/Mobile
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }

    // Click limit applies to every click on an active arrow
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    if (activeTool === 'rotate') {
      if (toolbox.rotations > 0) {
        useTool('rotate', arrow.id);
        setActiveTool(null);
      }
      return;
    }
    
    if (isBlocked(arrow, arrows, removedIds, tiles)) {
      if (!isMuted) soundService.playError();
      setShakeId(arrow.id);
      setTimeout(() => setShakeId(null), 500);
      
      // IMMEDIATE FAILURE CHECK: Clicks Exhausted on error
      if (currentLevel.clickLimit && newClickCount >= currentLevel.clickLimit) {
        setGameOverReason('clicks');
        setShowGameOver(true);
        if (!isMuted) soundService.playError();
      }
      return;
    }

    if (!isMuted) soundService.playRemove();

    // Save state for undo
    setHistory(prev => [...prev, { 
      arrows: [...arrows], 
      removedIds: new Set(removedIds), 
      tiles: [...tiles], 
      toolbox: { ...toolbox }, 
      clicks: clickCount 
    }]);
    
    const newRemoved = new Set(removedIds);
    newRemoved.add(arrow.id);
    setRemovedIds(newRemoved);
    setHintId(null);

    // Level complete check - clicks failure check
    if (newRemoved.size < arrows.length && currentLevel.clickLimit && newClickCount >= currentLevel.clickLimit) {
      setTimeout(() => {
        // Double check they didn't finish with the last click
        setRemovedIds(current => {
          if (current.size < arrows.length) {
            setGameOverReason('clicks');
            setShowGameOver(true);
            if (!isMuted) soundService.playError();
          }
          return current;
        });
      }, 600);
    }

    // Global Effect: Switch toggles gates
    if (arrow.type === 'switch') {
      setTiles(prev => prev.map(t => (t.type.startsWith('gate') ? { ...t, isOpen: !t.isOpen } : t)));
    }

    // Dynamic Effect: Rotator
    if (arrow.type === 'rotator') {
      const nextArrows = arrows.map(a => {
        const isNeighbor = Math.abs(a.x - arrow.x) + Math.abs(a.y - arrow.y) === 1;
        if (isNeighbor && !newRemoved.has(a.id)) {
          return { ...a, dir: rotateDir(a.dir) };
        }
        return a;
      });
      setArrows(nextArrows);
    }

    // Dynamic Effect: Shifter + Conveyor Physics
    if (arrow.type === 'shifter') {
      const nextArrows = arrows.map(a => {
        if (newRemoved.has(a.id)) return a;

        const isSameCol = a.x === arrow.x && (arrow.dir === 'up' || arrow.dir === 'down');
        const isSameRow = a.y === arrow.y && (arrow.dir === 'left' || arrow.dir === 'right');

        if (isSameCol || isSameRow) {
          let nx = a.x, ny = a.y;
          if (arrow.dir === 'up') ny--;
          if (arrow.dir === 'down') ny++;
          if (arrow.dir === 'left') nx--;
          if (arrow.dir === 'right') nx++;

          // Safe Conveyor logic: Iterative to prevent stack overflow
          const getFinalPlatformPos = (startX: number, startY: number): { x: number, y: number } => {
            let cx = startX, cy = startY;
            const visited = new Set<string>();
            visited.add(`${cx},${cy}`);

            while (true) {
              const tile = tiles.find(t => t.x === cx && t.y === cy);
              if (!tile) break;

              let fx = cx, fy = cy;
              if (tile.type === 'conveyor-up') fy--;
              if (tile.type === 'conveyor-down') fy++;
              if (tile.type === 'conveyor-left') fx--;
              if (tile.type === 'conveyor-right') fx++;

              // Bound check
              if (fx < 0 || fx >= currentLevel.gridSize || fy < 0 || fy >= currentLevel.gridSize) break;
              
              // Blocked check
              const isBlockedAt = arrows.some(other => !newRemoved.has(other.id) && other.x === fx && other.y === fy) ||
                                tiles.some(t => !t.isOpen && (t.type === 'gate-vertical' || t.type === 'gate-horizontal') && t.x === fx && t.y === fy);
              if (isBlockedAt) break;

              // Cycle check
              if (visited.has(`${fx},${fy}`)) break;

              cx = fx;
              cy = fy;
              visited.add(`${cx},${cy}`);
            }
            return { x: cx, y: cy };
          };

          if (nx < 0 || nx >= currentLevel.gridSize || ny < 0 || ny >= currentLevel.gridSize) return a;
          
          const isOccupied = arrows.some(other => !newRemoved.has(other.id) && other.x === nx && other.y === ny) ||
                           tiles.some(t => !t.isOpen && (t.type === 'gate-vertical' || t.type === 'gate-horizontal') && t.x === nx && t.y === ny);

          if (!isOccupied) {
            const final = getFinalPlatformPos(nx, ny);
            return { ...a, x: final.x, y: final.y };
          }
        }
        return a;
      });
      setArrows(nextArrows);
    }

    if (newRemoved.size === arrows.length) {
      setTimeout(() => {
        try {
          if (!isMuted) soundService.playSuccess();
        } catch (e) {
          console.warn("Audio failed to play", e);
        }
        setShowVictory(true);
      }, 800);
    }
  }, [arrows, removedIds, isBlocked, isMuted, currentLevel, tiles, toolbox, clickCount, showVictory, showGameOver]);

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
    if (!isMuted) soundService.playClick();
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
      setCurrentLevelIdx(prev => prev + 1);
    }
  };

  const selectLevel = (idx: number) => {
    if (!isMuted) soundService.playClick();
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

  return (
    <div className="min-h-screen text-[#f8fafc] font-sans flex flex-col">
      {/* Header */}
      <nav 
        className="h-20 lg:h-24 px-6 lg:px-10 flex items-center justify-between border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-40"
        style={{ paddingTop: 'var(--safe-top)', height: 'calc(5rem + var(--safe-top))' }}
      >
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowLevelSelector(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[#22d3ee] transition-all border border-white/5 hover:border-[#22d3ee]/30 group"
          >
            <LayoutGrid size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            <span className="text-sm font-bold uppercase tracking-wider hidden md:block">Stages</span>
          </button>
          <div className="text-xl lg:text-2xl font-extrabold tracking-tighter bg-gradient-to-br from-[#22d3ee] to-[#818cf8] bg-clip-text text-transparent uppercase hidden sm:block">
            Arrow Escape
          </div>
        </div>
        <div className="flex gap-4 lg:gap-8 items-center">
          <button 
            onClick={() => setIsMuted(prev => !prev)}
            className="p-2 text-[#94a3b8] hover:text-[#22d3ee] transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <StatItem label="Stage" value={currentLevelIdx + 1} />
          <StatItem label="Clicks" value={clickCount} />
          <StatItem label="Goal" value={currentLevel.clickLimit || '-'} />
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] p-6 lg:p-10 gap-10 items-start max-w-[1440px] mx-auto w-full" style={{ paddingBottom: 'calc(2.5rem + var(--safe-bottom))' }}>
        {/* Left Sidebar */}
        <aside className="hidden lg:flex flex-col gap-5">
          <div className="glass-panel rounded-[20px] p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-block px-3 py-1 bg-[#22d3ee]/10 text-[#22d3ee] rounded-full text-xs font-bold uppercase tracking-wider">
                Stage {currentLevelIdx + 1}
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
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold">
                    <Move size={12} className="text-indigo-400" />
                    Clicks
                  </div>
                  <div className={`text-xl font-black tabular-nums transition-colors ${currentLevel.clickLimit && clickCount >= currentLevel.clickLimit - 3 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {clickCount}
                    {currentLevel.clickLimit && <span className="text-slate-600 text-sm ml-1">/ {currentLevel.clickLimit}</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold">
                    <Clock size={12} className="text-cyan-400" />
                    Time
                  </div>
                  <div className={`text-xl font-black tabular-nums transition-colors ${timeLeft !== null && timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {timeLeft === null ? '--:--' : (
                      <span className="flex items-baseline gap-0.5">
                        {Math.floor(timeLeft / 60)}:{Math.floor(timeLeft % 60).toString().padStart(2, '0')}
                        <span className="text-[10px] opacity-40">.{Math.floor((timeLeft % 1) * 10)}</span>
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

      <footer className="p-6 text-center text-[10px] text-[#94a3b8] uppercase tracking-[0.2em] opacity-40">
        Arrow Escape Puzzle &bull; Strategy & Logic
      </footer>
    </div>
  );
}

// Memoized Stat Item for efficiency
const StatItem = React.memo(({ label, value }: { label: string, value: string | number }) => {
  return (
    <div className="text-center min-w-[60px]">
      <div className="text-[10px] uppercase text-[#94a3b8] tracking-widest mb-0.5">{label}</div>
      <div className="text-base lg:text-lg font-bold tabular-nums text-white">{value}</div>
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
  // Arrow colors from design
  const colorClass = {
    up: 'text-[#f43f5e]',    // Rose
    right: 'text-[#10b981]',  // Emerald
    down: 'text-[#f59e0b]',   // Amber
    left: 'text-[#3b82f6]'    // Blue
  }[arrow.dir];

  // Using a custom triangle-like icon matching the design's CSS ::after
  return (
    <div 
      className={`relative w-full h-full flex items-center justify-center transition-transform ${colorClass}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <svg width="70%" height="70%" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]">
        <path d="M12 4L4 18H20L12 4Z" />
      </svg>
      {arrow.type === 'rotator' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <RotateCcw size={10} className="text-white/30" />
        </div>
      )}
      {arrow.type === 'shifter' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Move size={10} className="text-white/30" />
        </div>
      )}
      {arrow.type === 'switch' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-1.5 bg-pink-400 rounded-sm rotate-45" />
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
  handleArrowClick, 
  setHoveredArrowId,
  nextLevel,
  handleReset
}: any) => {
  return (
    <section className="flex flex-col items-center justify-center relative touch-none">
      <div 
        className="relative bg-[#0f172a]/50 border-4 border-white/10 rounded-xl p-3 shadow-2xl"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${currentLevel.gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${currentLevel.gridSize}, 1fr)`,
          gap: '8px',
          width: 'min(90vw, 450px)',
          height: 'min(90vw, 450px)',
        }}
      >
        {/* Cell Grid Background */}
        {Array.from({ length: currentLevel.gridSize * currentLevel.gridSize }).map((_, i) => (
          <div key={i} className="bg-slate-800/50 rounded-lg" />
        ))}

        {/* Tiles: Conveyors, Gates, etc. */}
        {tiles.map((tile: TileData, i: number) => (
          <div 
            key={`tile-${i}`}
            className={`
              absolute rounded-lg flex items-center justify-center opacity-60
              ${tile.type.startsWith('conveyor') ? 'bg-slate-700/30' : ''}
              ${tile.type.startsWith('gate') ? (tile.isOpen ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/20 border-2 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]') : ''}
            `}
            style={{
              width: `calc((100% - ${(currentLevel.gridSize - 1) * 8}px - 24px) / ${currentLevel.gridSize})`,
              height: `calc((100% - ${(currentLevel.gridSize - 1) * 8}px - 24px) / ${currentLevel.gridSize})`,
              left: `calc(12px + (100% - 16px) / ${currentLevel.gridSize} * ${tile.x})`,
              top: `calc(12px + (100% - 16px) / ${currentLevel.gridSize} * ${tile.y})`,
            }}
          >
            {tile.type.startsWith('conveyor') && (
              <Move size={16} className={`text-slate-500 ${tile.type === 'conveyor-up' ? '-rotate-90' : tile.type === 'conveyor-down' ? 'rotate-90' : tile.type === 'conveyor-left' ? 'rotate-180' : ''}`} />
            )}
            {tile.type.startsWith('gate') && (
              tile.isOpen ? <div className="w-1 h-full bg-emerald-500/20 rounded-full" /> : <Lock size={12} className="text-red-400" />
            )}
          </div>
        ))}

        {/* Ghost Path Indicator (Launch Beam) */}
        <AnimatePresence>
          {ghostPath && (() => {
            const cellSize = `calc((100% - ${(currentLevel.gridSize - 1) * 8}px - 24px) / ${currentLevel.gridSize})`;
            const cellOffset = `calc(12px + (100% - 16px) / ${currentLevel.gridSize} * ${ghostPath.x})`;
            const cellOffsetTop = `calc(12px + (100% - 16px) / ${currentLevel.gridSize} * ${ghostPath.y})`;
            
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
              style.left = cellOffset;
              style.right = '12px';
              style.top = cellOffsetTop;
              style.height = cellSize;
              style.background = `linear-gradient(to right, ${beamColor}, ${fadeColor})`;
            } else if (ghostPath.dir === 'left') {
              style.left = '12px';
              style.width = `calc(${cellOffset} + ${cellSize} - 12px)`;
              style.top = cellOffsetTop;
              style.height = cellSize;
              style.background = `linear-gradient(to left, ${beamColor}, ${fadeColor})`;
            } else if (ghostPath.dir === 'down') {
              style.left = cellOffset;
              style.width = cellSize;
              style.top = cellOffsetTop;
              style.bottom = '12px';
              style.background = `linear-gradient(to bottom, ${beamColor}, ${fadeColor})`;
            } else if (ghostPath.dir === 'up') {
              style.left = cellOffset;
              style.width = cellSize;
              style.top = '12px';
              style.height = `calc(${cellOffsetTop} + ${cellSize} - 12px)`;
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
                  scale: 0.9,
                  transition: { duration: 0.5, ease: "anticipate" }
                }}
                whileHover={{ scale: isLocked ? 1 : 1.1, backgroundColor: 'rgba(255,255,255,0.05)' }}
                whileTap={{ scale: isLocked ? 1 : 0.9 }}
                onMouseEnter={() => setHoveredArrowId(arrow.id)}
                onMouseLeave={() => setHoveredArrowId(null)}
                onTouchStart={() => setHoveredArrowId(arrow.id)}
                onTouchEnd={() => setHoveredArrowId(null)}
                onClick={() => handleArrowClick(arrow)}
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
                  width: `calc((100% - ${(currentLevel.gridSize - 1) * 8}px - 24px) / ${currentLevel.gridSize})`,
                  height: `calc((100% - ${(currentLevel.gridSize - 1) * 8}px - 24px) / ${currentLevel.gridSize})`,
                  left: `calc(12px + (100% - 16px) / ${currentLevel.gridSize} * ${arrow.x})`,
                  top: `calc(12px + (100% - 16px) / ${currentLevel.gridSize} * ${arrow.y})`,
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
    </section>
  );
});
