
import * as THREE from 'three';
import { ShapeType } from '../types';

const randomPointInSphere = (radius: number) => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius;
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    r * sinPhi * Math.cos(theta),
    r * sinPhi * Math.sin(theta),
    r * Math.cos(phi)
  );
};

export const generateParticles = (shape: ShapeType, count: number): Float32Array => {
  const positions = new Float32Array(count * 3);
  const setPoint = (i: number, x: number, y: number, z: number) => {
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  };

  for (let i = 0; i < count; i++) {
    switch (shape) {
      case ShapeType.HEART: {
        // Parametric Heart with Thick Border + Fade to Center
        const t = Math.random() * Math.PI * 2;
        
        // Basic Heart Curve
        // x = 16sin^3(t)
        // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        
        // Distribution Logic:
        // 70% of particles form a "thick border" (scale ~ 1.0)
        // 30% of particles fill the center with a gradient (scale < 1.0)
        
        let scale = 1.0;
        let z = 0;

        const r = Math.random();
        
        if (r < 0.7) {
            // Thick Border
            // Scale between 0.9 and 1.1 roughly
            scale = 0.95 + Math.random() * 0.15;
            // Low Z depth for border (crisp edge)
            z = (Math.random() - 0.5) * 1.5;
        } else {
            // Center Gradient (Fading inwards)
            // Power function pushes values towards 1, making it sparse at center (0)
            scale = Math.pow(Math.random(), 0.5); 
            // More volume/depth in the center
            z = (Math.random() - 0.5) * 8.0 * scale; 
        }

        x *= scale;
        y *= scale;

        // Scale down to fit view
        setPoint(i, x * 0.15, y * 0.15, z * 0.15);
        break;
      }

      case ShapeType.ROSE: {
        // Rose Side View with Stem
        
        // 15% of particles for the stem
        const isStem = Math.random() < 0.15;

        if (isStem) {
          // Stem generation
          // y goes from -1.5 (base of flower) down to -4.0
          const h = Math.random(); // 0 to 1
          const y = -1.5 - (h * 2.5);
          
          // Slight curve/wave to the stem
          const curveX = Math.sin(y * 2.0) * 0.1;
          
          // Thickness
          const r = Math.random() * 0.08;
          const theta = Math.random() * Math.PI * 2;
          
          // Add thorns occasionally
          let x = curveX + r * Math.cos(theta);
          let z = r * Math.sin(theta);

          // Simple thorns
          if (Math.random() < 0.05) {
             x += (Math.random() - 0.5) * 0.4;
             z += (Math.random() - 0.5) * 0.4;
          }

          setPoint(i, x, y, z);

        } else {
          // Flower Head generation (Rising bloom)
          const v = Math.random(); 
          const u = Math.random() * Math.PI * 2; 
          
          // Cup shape profile
          let r = Math.pow(v, 0.6) * 1.5;
          
          // Petals
          const petal = Math.sin(u * 3.0 + v * 10.0);
          r += petal * 0.2 * v; 

          const x = r * Math.cos(u);
          const z = r * Math.sin(u);
          const y = (v * 3.0) - 1.5;

          setPoint(i, x, y, z);
        }
        break;
      }

      case ShapeType.SATURN: {
        // Planet + Rings
        const isRing = Math.random() > 0.4;
        
        if (isRing) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 3 + Math.random() * 2; 
          setPoint(i, Math.cos(angle) * dist, (Math.random() - 0.5) * 0.1, Math.sin(angle) * dist);
        } else {
          const p = randomPointInSphere(1.8);
          setPoint(i, p.x, p.y, p.z);
        }
        break;
      }

      case ShapeType.DL: {
        // Block Letters "DL" with Thick Outlines
        
        const isD = i < count / 2;
        
        // Helper to scatter points for a "thick outline" look
        // returns true if point was set
        
        if (isD) {
            // --- LETTER D ---
            // Centered approx at x = -2
            // Vertical Bar: x=[-2.5, -1.5], y=[-1.5, 1.5]
            // Arch: Semicircle from y=1.5 to y=-1.5 attached to x=-1.5
            
            const r = Math.random();
            const D_CenterX = -1.8;
            
            if (r < 0.7) {
                // OUTLINE (70%)
                if (Math.random() < 0.4) {
                    // Vertical Back Stroke Outline
                    // x approx -2.5
                    const x = -2.5 + (Math.random() - 0.5) * 0.2;
                    const y = (Math.random() - 0.5) * 3.0;
                    setPoint(i, x, y, (Math.random() - 0.5) * 0.3);
                } else {
                    // Curved Front Stroke Outline
                    // Semi-circle arc: Center (-2.0, 0), Radius ~ 1.5
                    const angle = (Math.random() - 0.5) * Math.PI; // -PI/2 to PI/2
                    const rad = 1.5 + (Math.random() - 0.5) * 0.2; // Thick line
                    const x = -2.0 + rad * Math.cos(angle);
                    const y = rad * Math.sin(angle);
                    setPoint(i, x, y, (Math.random() - 0.5) * 0.3);
                }
            } else {
                // INTERIOR FILL (30% - Fading to center)
                // Random point inside D
                // Vertical part or Arc part
                if (Math.random() < 0.5) {
                    // Vertical fill
                    const x = -2.5 + Math.random() * 0.5;
                    const y = (Math.random() - 0.5) * 2.8;
                    setPoint(i, x, y, (Math.random() - 0.5) * 0.5);
                } else {
                    // Arc fill
                    const angle = (Math.random() - 0.5) * Math.PI;
                    const rad = Math.random() * 1.5;
                    const x = -2.0 + rad * Math.cos(angle);
                    const y = rad * Math.sin(angle);
                    // Only keep if x > -2.0 (right side)
                    setPoint(i, Math.max(x, -2.0), y, (Math.random() - 0.5) * 0.5);
                }
            }
        } else {
            // --- LETTER L ---
            // Centered approx at x = 1.5
            // Vertical Block: x=[1.0, 1.5], y=[-1.5, 1.5]
            // Horizontal Block: x=[1.5, 2.5], y=[-1.5, -1.0]
            
            const r = Math.random();
            
            if (r < 0.7) {
                // OUTLINE (70%)
                // We pick a random point on the perimeter of the 'L' shape
                // L Polygon has 6 sides.
                const side = Math.floor(Math.random() * 6);
                let x=0, y=0;
                const jitter = 0.1; // Thickness of border
                
                switch(side) {
                    case 0: // Left Vertical
                        x = 1.0 + (Math.random()-0.5)*jitter; 
                        y = (Math.random() - 0.5) * 3.0; // -1.5 to 1.5
                        break;
                    case 1: // Top
                        x = 1.0 + Math.random() * 0.5; // 1.0 to 1.5
                        y = 1.5 + (Math.random()-0.5)*jitter;
                        break;
                    case 2: // Inner Vertical
                        x = 1.5 + (Math.random()-0.5)*jitter;
                        y = -1.0 + Math.random() * 2.5; // -1.0 to 1.5
                        break;
                    case 3: // Inner Horizontal
                        x = 1.5 + Math.random() * 1.0; // 1.5 to 2.5
                        y = -1.0 + (Math.random()-0.5)*jitter;
                        break;
                    case 4: // Right Tip
                        x = 2.5 + (Math.random()-0.5)*jitter;
                        y = -1.5 + Math.random() * 0.5; // -1.5 to -1.0
                        break;
                    case 5: // Bottom
                        x = 1.0 + Math.random() * 1.5; // 1.0 to 2.5
                        y = -1.5 + (Math.random()-0.5)*jitter;
                        break;
                }
                setPoint(i, x, y, (Math.random() - 0.5) * 0.3);
            } else {
                // INTERIOR FILL (30%)
                if (Math.random() < 0.6) {
                    // Vertical Bar Fill
                    const x = 1.0 + Math.random() * 0.5;
                    const y = (Math.random() - 0.5) * 3.0;
                    setPoint(i, x, y, (Math.random() - 0.5) * 0.5);
                } else {
                    // Horizontal Bar Fill
                    const x = 1.5 + Math.random() * 1.0;
                    const y = -1.5 + Math.random() * 0.5;
                    setPoint(i, x, y, (Math.random() - 0.5) * 0.5);
                }
            }
        }
        break;
      }

      case ShapeType.TREE: {
        // Christmas Tree
        if (Math.random() > 0.95) {
           const p = randomPointInSphere(0.3);
           setPoint(i, p.x, p.y + 2.2, p.z); 
        } else {
           const h = Math.random(); 
           const maxR = (1.0 - h) * 1.8;
           const r = Math.sqrt(Math.random()) * maxR;
           const theta = Math.random() * Math.PI * 2;
           const y = h * 4.0 - 2.0;
           const spiralOffset = Math.sin(y * 10 + theta * 5) * 0.1;
           const x = (r + spiralOffset) * Math.cos(theta);
           const z = (r + spiralOffset) * Math.sin(theta);
           setPoint(i, x, y, z);
        }
        break;
      }
      
      default:
        setPoint(i, 0, 0, 0);
    }
  }

  return positions;
};
