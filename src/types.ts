export type Direction = 'up' | 'down' | 'left' | 'right';
export type ArrowType = 'normal' | 'rotator' | 'key' | 'locked' | 'shifter' | 'switch';

export type TileType = 'none' | 'conveyor-up' | 'conveyor-down' | 'conveyor-left' | 'conveyor-right' | 'gate-vertical' | 'gate-horizontal';

export interface TileData {
  x: number;
  y: number;
  type: TileType;
  isOpen?: boolean; // For gates
}

export interface ArrowData {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  type?: ArrowType;
}

export interface ToolboxConfig {
  rotations: number;
  shifts: number;
}

export interface Level {
  gridSize: number;
  arrows: ArrowData[];
  tiles?: TileData[];
  toolbox?: ToolboxConfig;
  clickLimit?: number;
  timeLimit?: number;
}
