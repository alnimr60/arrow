import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Dimensions, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  Modal, 
  Platform,
  Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { 
  LayoutGrid, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  RotateCw, 
  Box, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  X,
  History,
  Timer,
  MousePointer2,
  Cpu
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from './lib/tailwind';
import { Direction, ArrowData, Level, TileData, ToolboxConfig } from './types';
import { LEVELS } from './levels';

// Simple Haptic helper
const triggerHaptic = (type: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(type);
  }
};

const UI_WIDTH = Dimensions.get('window').width;
const UI_HEIGHT = Dimensions.get('window').height;

const StatItem = ({ label, value }: { label: string, value: string | number }) => (
  <View style={tw`items-center px-3`}>
    <Text style={tw`text-[10px] text-text-dim uppercase font-bold tracking-widest`}>{label}</Text>
    <Text style={tw`text-white font-black text-lg`}>{value}</Text>
  </View>
);

const getRotation = (dir: Direction) => {
  switch (dir) {
    case 'up': return '0deg';
    case 'right': return '90deg';
    case 'down': return '180deg';
    case 'left': return '270deg';
    default: return '0deg';
  }
};

export default function App() {
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [arrows, setArrows] = useState<ArrowData[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [toolbox, setToolbox] = useState<ToolboxConfig>({ rotations: 0, shifts: 0 });
  const [clickCount, setClickCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<'time' | 'clicks' | null>(null);
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [maxReachedLevel, setMaxReachedLevel] = useState(0);
  const [activeTool, setActiveTool] = useState<'rotate' | 'shift' | null>(null);

  const currentLevel = LEVELS[currentLevelIdx];

  // Persistence
  useEffect(() => {
    AsyncStorage.getItem('maxLevel').then(val => {
      if (val) setMaxReachedLevel(parseInt(val));
    });
  }, []);

  const saveMaxLevel = (lvl: number) => {
    if (lvl > maxReachedLevel) {
      setMaxReachedLevel(lvl);
      AsyncStorage.setItem('maxLevel', lvl.toString());
    }
  };

  const initLevel = useCallback((idx: number) => {
    const level = LEVELS[idx];
    setArrows([...level.arrows]);
    setRemovedIds(new Set());
    setTiles(level.tiles ? JSON.parse(JSON.stringify(level.tiles)) : []);
    setToolbox(level.toolbox ? { ...level.toolbox } : { rotations: 0, shifts: 0 });
    setClickCount(0);
    setTimeLeft(level.timeLimit || 60);
    setHasStarted(false);
    setShowVictory(false);
    setShowGameOver(false);
    setGameOverReason(null);
    setHistory([]);
    setActiveTool(null);
  }, []);

  useEffect(() => {
    initLevel(currentLevelIdx);
  }, [currentLevelIdx, initLevel]);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (hasStarted && timeLeft > 0 && !showVictory && !showGameOver) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0.1) {
            setGameOverReason('time');
            setShowGameOver(true);
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [hasStarted, timeLeft, showVictory, showGameOver]);

  const isBlocked = (arrow: ArrowData, all: ArrowData[], removed: Set<string>, curTiles: TileData[]) => {
    const { x, y, dir } = arrow;
    
    // Check arrows
    const others = all.filter(a => !removed.has(a.id) && a.id !== arrow.id);
    const arrowBlocked = others.some(a => {
      if (dir === 'up') return a.x === x && a.y < y;
      if (dir === 'down') return a.x === x && a.y > y;
      if (dir === 'left') return a.y === y && a.x < x;
      if (dir === 'right') return a.y === y && a.x > x;
      return false;
    });
    if (arrowBlocked) return true;

    // Check Gates
    const gateBlocked = curTiles.some(t => {
      if (t.isOpen) return false;
      const isGate = t.type === 'gate-vertical' || t.type === 'gate-horizontal';
      if (!isGate) return false;
      if (dir === 'up') return t.x === x && t.y < y;
      if (dir === 'down') return t.x === x && t.y > y;
      if (dir === 'left') return t.y === y && t.x < x;
      if (dir === 'right') return t.y === y && t.x > x;
      return false;
    });

    return gateBlocked;
  };

  const handleArrowClick = (arrow: ArrowData) => {
    if (removedIds.has(arrow.id) || showVictory || showGameOver) return;
    
    if (!hasStarted) setHasStarted(true);
    triggerHaptic();

    // TOOL LOGIC
    if (activeTool === 'rotate' && toolbox.rotations > 0) {
      setHistory(prev => [...prev, { arrows: [...arrows], removedIds: new Set(removedIds), toolbox: { ...toolbox }, tiles: JSON.parse(JSON.stringify(tiles)), clicks: clickCount }]);
      setArrows(prev => prev.map(a => a.id === arrow.id ? { ...a, dir: rotateDir(a.dir) } : a));
      setToolbox(prev => ({ ...prev, rotations: prev.rotations - 1 }));
      setActiveTool(null);
      setClickCount(prev => prev + 1);
      return;
    }

    // GAMEPLAY LOGIC
    // Lock Check
    if (arrow.type === 'locked') {
      const keysRemaining = arrows.some(a => !removedIds.has(a.id) && a.type === 'key');
      if (keysRemaining) {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
        return;
      }
    }

    if (isBlocked(arrow, arrows, removedIds, tiles)) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }

    // Capture state for undo
    setHistory(prev => [...prev, { 
      arrows: JSON.parse(JSON.stringify(arrows)), 
      removedIds: new Set(removedIds), 
      toolbox: { ...toolbox }, 
      tiles: JSON.parse(JSON.stringify(tiles)), 
      clicks: clickCount 
    }]);

    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    // Remove logic
    const newRemoved = new Set(removedIds);
    newRemoved.add(arrow.id);
    setRemovedIds(newRemoved);

    // MECHANICS EFFECTS
    let newArrows = [...arrows];
    let newTiles = JSON.parse(JSON.stringify(tiles));

    // Switch: Toggles all gates
    if (arrow.type === 'switch') {
      newTiles = newTiles.map((t: TileData) => 
        t.type.startsWith('gate') ? { ...t, isOpen: !t.isOpen } : t
      );
    }

    // Rotator: Rotates neighbors
    if (arrow.type === 'rotator') {
      const rotateCW = (d: Direction): Direction => ({ up: 'right', right: 'down', down: 'left', left: 'up' } as Record<Direction, Direction>)[d];
      newArrows = newArrows.map(a => {
        if (newRemoved.has(a.id)) return a;
        if (Math.abs(a.x - arrow.x) + Math.abs(a.y - arrow.y) === 1) {
          return { ...a, dir: rotateCW(a.dir) };
        }
        return a;
      });
    }

    // Shifter: Moves others in path
    if (arrow.type === 'shifter') {
      newArrows = newArrows.map(a => {
        if (newRemoved.has(a.id)) return a;
        const isSameCol = a.x === arrow.x && (arrow.dir === 'up' || arrow.dir === 'down');
        const isSameRow = a.y === arrow.y && (arrow.dir === 'left' || arrow.dir === 'right');
        if (isSameCol || isSameRow) {
          let nx = a.x, ny = a.y;
          if (arrow.dir === 'up') ny--;
          if (arrow.dir === 'down') ny++;
          if (arrow.dir === 'left') nx--;
          if (arrow.dir === 'right') nx++;
          
          // Basic bounds check for shifters in real-time
          if (nx >= 0 && nx < currentLevel.gridSize && ny >= 0 && ny < currentLevel.gridSize) {
             const occupied = newArrows.some(other => !newRemoved.has(other.id) && other.id !== a.id && other.x === nx && other.y === ny);
             if (!occupied) {
               return { ...a, x: nx, y: ny };
             }
          }
        }
        return a;
      });
    }

    setArrows(newArrows);
    setTiles(newTiles);

    // Win condition
    if (newRemoved.size === arrows.length) {
      setShowVictory(true);
      saveMaxLevel(currentLevelIdx + 1);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    } else if (currentLevel.clickLimit && newClickCount >= currentLevel.clickLimit) {
      setGameOverReason('clicks');
      setShowGameOver(true);
    }
  };

  const rotateDir = (d: Direction): Direction => {
    const order: Direction[] = ['up', 'right', 'down', 'left'];
    return order[(order.indexOf(d) + 1) % 4];
  };

  const undo = () => {
    if (history.length === 0) return;
    triggerHaptic();
    const last = history[history.length - 1];
    setArrows(last.arrows);
    setRemovedIds(last.removedIds);
    setToolbox(last.toolbox);
    setTiles(last.tiles);
    setClickCount(last.clicks);
    setHistory(prev => prev.slice(0, -1));
  };

  const boardSize = Math.min(UI_WIDTH * 0.9, 450);
  const cellSize = boardSize / currentLevel.gridSize;

  return (
    <SafeAreaView style={tw`flex-1 bg-bg-main`}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={tw`h-16 border-b border-white/10 flex-row items-center justify-between px-4`}>
        <TouchableOpacity 
          onPress={() => setShowLevelSelector(true)}
          style={tw`bg-white/5 p-2 rounded-xl border border-white/10 flex-row items-center`}
        >
          <LayoutGrid size={18} color="#22d3ee" />
          <Text style={tw`text-white/60 ml-2 font-bold text-xs uppercase tracking-widest`}>Levels</Text>
        </TouchableOpacity>

        <View style={tw`flex-row items-center`}>
          <StatItem label="Stage" value={currentLevelIdx + 1} />
          <StatItem label="Clicks" value={`${clickCount}/${currentLevel.clickLimit || '∞'}`} />
        </View>

        <TouchableOpacity 
          onPress={() => setIsMuted(!isMuted)}
          style={tw`p-2 bg-white/5 rounded-full`}
        >
          {isMuted ? <VolumeX size={18} color="#94a3b8" /> : <Volume2 size={18} color="#22d3ee" />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={tw`flex-grow items-center justify-center p-4`}>
        {/* Game Stats Bar */}
        <View style={tw`w-full flex-row justify-between items-center mb-6 px-2`}>
           <View style={tw`flex-row items-center bg-white/10 px-5 py-2.5 rounded-3xl border border-white/20 shadow-lg`}>
              <Timer size={18} color="#22d3ee" style={tw`mr-2`} />
              <Text style={tw`text-white font-black text-xl tabular-nums`}>{timeLeft.toFixed(1)}s</Text>
           </View>
           
           <TouchableOpacity 
             onPress={() => initLevel(currentLevelIdx)}
             style={tw`p-3.5 bg-white/10 rounded-3xl border border-white/20 shadow-lg`}
           >
             <RotateCcw size={22} color="#22d3ee" />
           </TouchableOpacity>
        </View>

        {/* Board Container */}
        <View style={[tw`bg-slate-900 border-4 border-slate-800 rounded-[40px] p-2 relative shadow-2xl overflow-hidden`, { width: boardSize + 20, height: boardSize + 20 }]}>
           {/* Grid Pattern */}
           {[...Array(currentLevel.gridSize)].map((_, i) => (
             <React.Fragment key={i}>
                <View style={[tw`absolute bg-white/5`, { left: (i + 1) * cellSize + 8, top: 10, bottom: 10, width: 2 }]} />
                <View style={[tw`absolute bg-white/5`, { top: (i + 1) * cellSize + 8, left: 10, right: 10, height: 2 }]} />
             </React.Fragment>
           ))}

           {/* Tiles (Gates and Conveyors) */}
           {tiles.map((tile, tidx) => (
             <View
               key={`tile-${tidx}`}
               style={[
                 tw`absolute items-center justify-center`,
                 { 
                   width: cellSize * 1, 
                   height: cellSize * 1,
                   left: tile.x * cellSize + 10,
                   top: tile.y * cellSize + 10,
                 }
               ]}
             >
               {tile.type.startsWith('gate') && (
                 <View style={[
                   tw`border-4 rounded-xl`, 
                   { width: cellSize * 0.9, height: cellSize * 0.9, borderColor: tile.isOpen ? '#22d3ee20' : '#f8717180' },
                   tile.isOpen && tw`bg-accent-cyan/5`
                 ]}>
                    <Lock size={cellSize * 0.3} color={tile.isOpen ? '#22d3ee40' : '#ef4444'} style={tw`m-auto`} />
                 </View>
               )}
               {tile.type.startsWith('conveyor') && (
                 <View style={[
                   tw`bg-white/5 rounded-full`, 
                   { 
                     width: cellSize * 0.7, height: cellSize * 0.7,
                     transform: [{ rotate: tile.type === 'conveyor-up' ? '0deg' : tile.type === 'conveyor-right' ? '90deg' : tile.type === 'conveyor-down' ? '180deg' : '270deg' }]
                    }
                 ]}>
                    <ArrowRight size={cellSize * 0.4} color="#ffffff10" style={tw`m-auto`} />
                 </View>
               )}
             </View>
           ))}

           {/* Arrows */}
           {arrows.map((arrow) => {
             if (removedIds.has(arrow.id)) return null;
             const isLocked = arrow.type === 'locked' && arrows.some(a => !removedIds.has(a.id) && a.type === 'key');
             
             return (
               <TouchableOpacity
                 key={arrow.id}
                 activeOpacity={0.8}
                 onPress={() => handleArrowClick(arrow)}
                 style={[
                   tw`absolute items-center justify-center rounded-2xl shadow-lg border-b-4`,
                   { 
                     width: cellSize * 0.82, 
                     height: cellSize * 0.82,
                     left: arrow.x * cellSize + (cellSize * 0.09) + 10,
                     top: arrow.y * cellSize + (cellSize * 0.09) + 10,
                     backgroundColor: '#1e293b',
                     borderColor: '#0f172a',
                   },
                   arrow.type === 'rotator' && tw`bg-indigo-900 border-indigo-950`,
                   arrow.type === 'key' && tw`bg-amber-900 border-amber-950`,
                   arrow.type === 'switch' && tw`bg-emerald-900 border-emerald-950`,
                   arrow.type === 'shifter' && tw`bg-fuchsia-900 border-fuchsia-950`,
                   isLocked && tw`opacity-50 grayscale bg-slate-800`
                 ]}
               >
                 {/* Visual Indicators */}
                 <View style={[
                   tw`w-full h-full items-center justify-center`,
                   { transform: [{ rotate: getRotation(arrow.dir) }] }
                 ]}>
                    {arrow.type === 'locked' ? (
                      <Lock size={cellSize * 0.45} color={isLocked ? "#94a3b8" : "#22d3ee"} />
                    ) : arrow.type === 'rotator' ? (
                      <RotateCw size={cellSize * 0.45} color="#818cf8" />
                    ) : arrow.type === 'switch' ? (
                      <Cpu size={cellSize * 0.45} color="#34d399" />
                    ) : arrow.type === 'shifter' ? (
                      <MousePointer2 size={cellSize * 0.45} color="#e879f9" />
                    ) : (
                      <Box size={cellSize * 0.55} color={arrow.type === 'key' ? '#fbbf24' : '#22d3ee'} style={tw`absolute opacity-20`} />
                    )}
                    
                    {/* The Visual Arrow */}
                    {arrow.type !== 'locked' && (
                       <View style={tw`items-center`}>
                          <View style={[tw`bg-white h-2 rounded-full`, { width: cellSize * 0.1, marginBottom: -2 }]} />
                          <ArrowRight 
                            size={cellSize * 0.5} 
                            color={arrow.type === 'key' ? '#fbbf24' : arrow.type === 'shifter' ? '#e879f9' : '#22d3ee'} 
                            style={{ transform: [{ rotate: '-90deg' }] }} // Adjusted for ArrowRight to point UP baseline
                          />
                       </View>
                    )}
                 </View>
               </TouchableOpacity>
             );
           })}
        </View>

        {/* Toolbox */}
        <View style={tw`flex-row gap-5 mt-10`}>
           <TouchableOpacity 
             onPress={() => setActiveTool(activeTool === 'rotate' ? null : 'rotate')}
             disabled={toolbox.rotations <= 0}
             style={tw`flex-row items-center bg-white/5 p-4 rounded-3xl border-2 ${activeTool === 'rotate' ? 'border-accent-purple bg-accent-purple/20' : 'border-white/10'} ${toolbox.rotations <= 0 ? 'opacity-20' : 'opacity-100'}`}
           >
              <RotateCw size={22} color="#818cf8" />
              <View style={tw`ml-3`}>
                <Text style={tw`text-white font-black text-lg`}>{toolbox.rotations}</Text>
                <Text style={tw`text-text-dim text-[8px] font-bold uppercase`}>Rotations</Text>
              </View>
           </TouchableOpacity>

           <TouchableOpacity 
             onPress={undo}
             disabled={history.length === 0}
             style={tw`flex-row items-center bg-white/5 p-4 rounded-3xl border-2 border-white/10 ${history.length === 0 ? 'opacity-20' : 'opacity-100'}`}
           >
              <History size={22} color="#22d3ee" />
              <View style={tw`ml-3`}>
                <Text style={tw`text-white font-black text-xs uppercase tracking-tighter`}>Recall</Text>
                <Text style={tw`text-text-dim text-[8px] font-bold uppercase`}>Undo Move</Text>
              </View>
           </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Level Selector Modal */}
      <Modal visible={showLevelSelector} animationType="slide" transparent={true}>
         <View style={tw`flex-1 bg-bg-main/95 p-6`}>
            <View style={tw`flex-row justify-between items-center mb-10`}>
               <View>
                 <Text style={tw`text-white text-3xl font-black italic uppercase tracking-tighter`}>Level Archive</Text>
                 <Text style={tw`text-text-dim text-sm font-medium`}>Total Challenges: {LEVELS.length}</Text>
               </View>
               <TouchableOpacity onPress={() => setShowLevelSelector(false)} style={tw`p-3 bg-white/5 rounded-full`}>
                 <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={tw`flex-row flex-wrap gap-3 pb-10`}>
               {LEVELS.map((level, idx) => (
                 <TouchableOpacity
                   key={idx}
                   onPress={() => { setCurrentLevelIdx(idx); setShowLevelSelector(false); }}
                   style={[
                     tw`w-16 h-16 rounded-2xl items-center justify-center border`,
                     currentLevelIdx === idx ? tw`bg-accent-cyan border-accent-cyan` : idx < maxReachedLevel ? tw`bg-indigo-500/10 border-indigo-500/30` : tw`bg-slate-800/50 border-white/5`
                   ]}
                 >
                   <Text style={[tw`text-lg font-black`, currentLevelIdx === idx ? tw`text-bg-main` : tw`text-white`]}>{idx + 1}</Text>
                   {idx < maxReachedLevel && <CheckCircle2 size={10} color="#818cf8" style={tw`absolute top-1 right-1`} />}
                 </TouchableOpacity>
               ))}
            </ScrollView>
         </View>
      </Modal>

      {/* Victory Modal */}
      <Modal visible={showVictory} transparent={true} animationType="fade">
         <View style={tw`flex-1 bg-black/80 items-center justify-center p-8`}>
            <View style={tw`bg-[#1e293b] w-full p-8 rounded-3xl border-2 border-accent-cyan items-center`}>
               <CheckCircle2 size={64} color="#22d3ee" style={tw`mb-4`} />
               <Text style={tw`text-white text-3xl font-black italic uppercase text-center mb-2`}>Sector Cleared</Text>
               <Text style={tw`text-text-dim text-center mb-8`}>Extraction successful. Moving to next target.</Text>
               
               <TouchableOpacity 
                 onPress={() => setCurrentLevelIdx(prev => Math.min(LEVELS.length - 1, prev + 1))}
                 style={tw`bg-accent-cyan w-full py-4 rounded-xl items-center`}
               >
                 <Text style={tw`text-bg-main font-black uppercase`}>Next Mission</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* Game Over Modal */}
      <Modal visible={showGameOver} transparent={true} animationType="fade">
         <View style={tw`flex-1 bg-black/80 items-center justify-center p-8`}>
            <View style={tw`bg-[#1e293b] w-full p-8 rounded-3xl border-2 border-red-500 items-center`}>
               <X size={64} color="#ef4444" style={tw`mb-4`} />
               <Text style={tw`text-white text-3xl font-black italic uppercase text-center mb-2`}>Mission Failed</Text>
               <Text style={tw`text-text-dim text-center mb-8`}>
                 {gameOverReason === 'time' ? 'Chronometer expired.' : 'Resources depleted.'}
               </Text>
               
               <TouchableOpacity 
                 onPress={() => initLevel(currentLevelIdx)}
                 style={tw`bg-red-500 w-full py-4 rounded-xl items-center`}
               >
                 <Text style={tw`text-white font-black uppercase`}>Re-Engage</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

    </SafeAreaView>
  );
}
