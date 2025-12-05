import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

let handLandmarker: HandLandmarker | null = null;

export const initializeHandDetection = async (): Promise<HandLandmarker> => {
  if (handLandmarker) return handLandmarker;

  const vision = await FilesetResolver.forVisionTasks(
    // Use the latest WASM version to ensure compatibility
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 2
  });

  return handLandmarker;
};

export const detectHands = (video: HTMLVideoElement, startTimeMs: number): HandLandmarkerResult | null => {
  if (!handLandmarker) return null;
  try {
    return handLandmarker.detectForVideo(video, startTimeMs);
  } catch (e) {
    return null;
  }
};

export interface GestureData {
  expansion: number; // 0.0 (closed) to 1.0 (open)
  lift: number;      // 0.0 (top) to 1.0 (bottom) - Vertical position of hands
}

/**
 * Calculates gesture data based on hand landmarks.
 */
export const calculateGestureData = (result: HandLandmarkerResult): GestureData => {
  let expansion = 0;
  let lift = 0.5; // Default center

  if (!result.landmarks || result.landmarks.length === 0) {
    return { expansion, lift };
  }

  // --- Calculate Expansion (Spread) ---
  
  // Case: 2 Hands - Distance between wrists
  if (result.landmarks.length === 2) {
    const hand1 = result.landmarks[0][0]; // Wrist
    const hand2 = result.landmarks[1][0]; // Wrist
    
    // Expansion logic
    const dx = hand1.x - hand2.x;
    const dy = hand1.y - hand2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const minD = 0.15;
    const maxD = 0.50;
    const raw = (distance - minD) / (maxD - minD);
    expansion = Math.min(Math.max(raw, 0), 1);

    // Lift logic (Average Y of both hands)
    // MediaPipe Y: 0 is top, 1 is bottom
    lift = (hand1.y + hand2.y) / 2;
  }
  
  // Case: 1 Hand - Thumb to Pinky spread
  else if (result.landmarks.length === 1) {
    const hand = result.landmarks[0];
    const thumbTip = hand[4];
    const pinkyTip = hand[20];
    const wrist = hand[0];
    const middleMCP = hand[9];

    // Expansion logic
    const spreadDx = thumbTip.x - pinkyTip.x;
    const spreadDy = thumbTip.y - pinkyTip.y;
    const spread = Math.sqrt(spreadDx * spreadDx + spreadDy * spreadDy);
    
    const sizeDx = middleMCP.x - wrist.x;
    const sizeDy = middleMCP.y - wrist.y;
    const handSize = Math.sqrt(sizeDx * sizeDx + sizeDy * sizeDy) || 0.1;
    
    const normalizedSpread = spread / handSize;
    const minSpread = 0.5;
    const maxSpread = 1.2;
    const raw = (normalizedSpread - minSpread) / (maxSpread - minSpread);
    expansion = Math.min(Math.max(raw, 0), 1);

    // Lift logic (Wrist Y)
    lift = wrist.y;
  }

  return { expansion, lift };
};