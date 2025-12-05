
export enum ShapeType {
  HEART = 'HEART',
  ROSE = 'ROSE',
  SATURN = 'SATURN',
  DL = 'DL',
  TREE = 'TREE',
}

export interface ParticleConfig {
  count: number;
  color: string;
  size: number;
  shape: ShapeType;
  expansion: number; // Controlled by gesture (0.0 to 1.0)
}

export interface HandGestureState {
  isTracking: boolean;
  gestureFactor: number; // 0.0 (closed/close) to 1.0 (open/far)
  numHands: number;
}
