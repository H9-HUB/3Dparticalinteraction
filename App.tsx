import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { initializeHandDetection, detectHands, calculateGestureData, GestureData } from './services/vision';
import ParticleMesh from './components/ParticleMesh';
import { ShapeType } from './types';

// Icons
const FullscreenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
);

const App: React.FC = () => {
  // --- State ---
  const [activeShape, setActiveShape] = useState<ShapeType>(ShapeType.HEART);
  const [particleColor, setParticleColor] = useState<string>('#ff007f'); 
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectedHands, setDetectedHands] = useState(0);

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  // Ref now stores both expansion amount and vertical lift position
  const gestureRef = useRef<GestureData>({ expansion: 0, lift: 0.5 });
  const requestRef = useRef<number>();

  // --- Hand Detection Loop ---
  const startDetection = useCallback(async () => {
    // 等待 videoRef 在短时间内就绪（避免 mount 时偶发为 null）
    let waitCount = 0;
    while (!videoRef.current && waitCount < 10) {
      await new Promise((r) => setTimeout(r, 50));
      waitCount++;
    }
    if (!videoRef.current) {
      setError('内部错误：无法获取 video 引用。请刷新页面。');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      // 给初始化加一个超时，避免依赖 CDN 卡住 UI
      const initPromise = initializeHandDetection();
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('init_timeout')), 8000));
      await Promise.race([initPromise, timeout]);

      // Start Video Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' } 
      });
      (videoRef.current as HTMLVideoElement).srcObject = stream as MediaStream;
      await videoRef.current.play();
      
      setIsTracking(true);
      setError(null);
      setLoading(false);
 
      // Detection Loop
      const loop = () => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          try {
            const result = detectHands(videoRef.current, Date.now());
            
            if (result && (result as any).landmarks) {
              setDetectedHands((result as any).landmarks.length);
              const data = calculateGestureData(result);
              gestureRef.current = data; 
            } else {
               setDetectedHands(0);
            }
          } catch (e) {
            console.error('detectHands error', e);
            setDetectedHands(0);
          }
        }
        requestRef.current = requestAnimationFrame(loop);
      };
      loop();

    } catch (err: any) {
      console.error(err);
      const msg = err?.message ?? String(err);
      if (msg === 'init_timeout' || /wasm|cdn|fetch|network|ERR/i.test(msg)) {
        setError('网络/加载超时：MediaPipe 模块无法加载（CDN 不可达）。可尝试本地安装依赖或检查网络。');
      } else if (err?.name === 'NotAllowedError' || /permission|denied/i.test(msg)) {
        setError('相机访问被拒绝。请允许摄像头权限并刷新页面。');
      } else {
        setError('初始化失败：' + msg);
      }
      setLoading(false);
      setIsTracking(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    startDetection();
    return () => {
      if (typeof requestRef.current === 'number') cancelAnimationFrame(requestRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const s = videoRef.current.srcObject as MediaStream;
        s.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [startDetection]);

  // --- Handlers ---
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const shapes = [
    { type: ShapeType.HEART, label: 'Heart' },
    { type: ShapeType.ROSE, label: 'Rose' },
    { type: ShapeType.SATURN, label: 'Saturn' },
    { type: ShapeType.DL, label: 'DL' },
    { type: ShapeType.TREE, label: 'Christmas Tree' },
  ];

  return (
    <div className="relative w-full h-full bg-black text-white font-sans overflow-hidden">
      
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 10], fov: 60 }} gl={{ antialias: false, powerPreference: "high-performance" }}>
          <color attach="background" args={['#020202']} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <ambientLight intensity={0.5} />
          {/* Note: Key is important to re-mount mesh if shape changes completely */}
          <ParticleMesh 
            key={activeShape}
            shape={activeShape} 
            color={particleColor} 
            count={20000} 
            gestureRef={gestureRef} 
          />
          <OrbitControls enableZoom={true} enablePan={false} autoRotate={false} />
        </Canvas>
      </div>

      {/* Hidden Video for MediaPipe */}
      <video
        ref={videoRef}
        className="absolute bottom-4 right-4 w-32 h-24 object-cover opacity-30 z-10 rounded-lg pointer-events-none transform scale-x-[-1] border border-white/20"
        playsInline
        muted
      />

      {/* UI Overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Header */}
        <div className="flex justify-between items-start pointer-events-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 filter drop-shadow-lg">
              ZenParticles 3D
            </h1>
            <div className="text-xs font-mono mt-2 space-y-1">
              <p className={loading ? "text-yellow-400" : "text-green-400"}>
                {loading ? "● Initializing System..." : "● System Active"}
              </p>
              <p className={detectedHands > 0 ? "text-blue-400" : "text-gray-500"}>
                {detectedHands > 0 ? `● Hands Detected: ${detectedHands}` : "○ No Hands Detected"}
              </p>
            </div>
            {error && <p className="text-sm text-red-500 mt-1 font-bold bg-black/50 p-1 rounded">{error}</p>}
          </div>
          <button 
            onClick={toggleFullscreen}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-colors text-white"
          >
            <FullscreenIcon />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="self-center mb-6 pointer-events-auto animate-fade-in-up">
          <div className="flex flex-col items-center gap-5 bg-black/60 backdrop-blur-xl p-5 rounded-3xl border border-white/10 shadow-2xl">
            
            {/* Shape Selector */}
            <div className="flex flex-wrap justify-center gap-2">
              {shapes.map((s) => (
                <button
                  key={s.type}
                  onClick={() => setActiveShape(s.type)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 transform 
                    ${activeShape === s.type 
                      ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.5)] scale-105' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Separator */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

            {/* Color Picker & Indicators */}
            <div className="flex items-center gap-8 w-full justify-center px-4">
              
              <div className="flex flex-col items-center gap-2">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Color</label>
                <div 
                  className="relative overflow-hidden w-10 h-10 rounded-full ring-2 ring-offset-2 ring-offset-black ring-white/30 cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: particleColor }}
                >
                  <input 
                    type="color" 
                    value={particleColor}
                    onChange={(e) => setParticleColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              </div>

              {/* Gesture Indicator (Visual feedback) */}
              <div className="flex flex-col items-center gap-2 w-32">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Expansion</span>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-white/10">
                  <GestureBar gestureRef={gestureRef} color={particleColor} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component to visualize the gesture ref
const GestureBar = ({ gestureRef, color }: { gestureRef: React.MutableRefObject<GestureData>, color: string }) => {
  const barRef = useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    let animId: number;
    const update = () => {
      if (barRef.current) {
        // Only show expansion factor in bar
        const val = gestureRef.current.expansion;
        barRef.current.style.width = `${val * 100}%`;
        barRef.current.style.backgroundColor = color;
        barRef.current.style.boxShadow = `0 0 ${val * 10}px ${color}`;
      }
      animId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(animId);
  }, [gestureRef, color]);

  return <div ref={barRef} className="h-full transition-all duration-75 ease-out w-0 rounded-full" />;
};

export default App;
