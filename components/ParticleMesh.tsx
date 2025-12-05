
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { generateParticles } from '../utils/geometry';
import { ShapeType } from '../types';
import { GestureData } from '../services/vision';

interface ParticleMeshProps {
  shape: ShapeType;
  color: string;
  count: number;
  gestureRef: React.MutableRefObject<GestureData>;
}

const ParticleMesh: React.FC<ParticleMeshProps> = ({ shape, color, count, gestureRef }) => {
  const meshRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate particle positions
  const { positions, randomness } = useMemo(() => {
    const pos = generateParticles(shape, count);
    const rand = new Float32Array(count * 3); 
    // Create an explosion direction vector for every particle
    for (let i = 0; i < count * 3; i += 3) {
      const x = (Math.random() - 0.5);
      const y = (Math.random() - 0.5);
      const z = (Math.random() - 0.5);
      const len = Math.sqrt(x*x + y*y + z*z) || 1;
      rand[i] = x / len;
      rand[i+1] = y / len;
      rand[i+2] = z / len;
    }
    return { positions: pos, randomness: rand };
  }, [shape, count]);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      meshRef.current.geometry.setAttribute('aRandom', new THREE.BufferAttribute(randomness, 3));
      meshRef.current.geometry.attributes.position.needsUpdate = true;
      
      // Reset rotation when shape changes to Heart or DL
      if (shape === ShapeType.HEART || shape === ShapeType.DL) {
        meshRef.current.rotation.y = 0;
      }
    }
  }, [positions, randomness, shape]);

  // Stable uniforms object
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExpansion: { value: 0 },
    uColor: { value: new THREE.Color(color) },
  }), []); 

  // Update uniforms in the frame loop
  useFrame((state) => {
    if (materialRef.current) {
      // Update Time
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      
      // Update Color instantly
      materialRef.current.uniforms.uColor.value.set(color);
      
      // --- Update Expansion (Interaction) ---
      const currentExpansion = materialRef.current.uniforms.uExpansion.value;
      const targetExpansion = gestureRef.current.expansion;
      
      // LINEAR/SYMMETRIC SPEED
      // Removed the asymmetric check (fast close/slow open). 
      // Using a constant 0.1 provides a responsive linear feel.
      const lerpSpeed = 0.1; 

      materialRef.current.uniforms.uExpansion.value = THREE.MathUtils.lerp(
        currentExpansion, 
        targetExpansion, 
        lerpSpeed
      );
    }
    
    if (meshRef.current) {
      // 1. Continuous Y rotation (Spin) - DISABLED FOR HEART AND DL
      if (shape !== ShapeType.HEART && shape !== ShapeType.DL) {
        meshRef.current.rotation.y += 0.001;
      }

      // 2. Interactive Tilt (X rotation) based on Hand Lift
      // lift 0 (Top) -> Look up/Object tilts back (negative X)
      // lift 1 (Bottom) -> Look down/Object tilts forward (positive X)
      // Map 0..1 to -0.5..0.5 radians
      const targetTilt = (gestureRef.current.lift - 0.5) * 1.5; 
      
      // Smoothly interpolate the tilt
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        targetTilt,
        0.05
      );
    }
  });

  const vertexShader = `
    uniform float uTime;
    uniform float uExpansion;
    attribute vec3 aRandom;
    varying float vAlpha;
    
    // Rotation helper
    vec3 rotateY(vec3 v, float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return vec3(v.x * c - v.z * s, v.y, v.x * s + v.z * c);
    }

    void main() {
      vec3 pos = position;
      
      // --- LOGIC CHANGE: LINEAR ---
      // Removed smoothstep threshold and cubic easing.
      // uExpansion maps directly linearly to the effect.
      float ease = uExpansion;
      
      // 1. Breathing/Idle animation
      float breathing = sin(uTime * 2.0 + pos.y * 0.5) * 0.05 * (1.0 - ease);
      
      // Reduced spreadRadius to keep particles on screen
      float spreadRadius = 12.0; 
      
      // Add turbulence so they spiral out slightly
      vec3 turbulence = vec3(
        sin(uTime * 5.0 + pos.z),
        cos(uTime * 4.0 + pos.x),
        sin(uTime * 6.0 + pos.y)
      ) * 0.5 * ease;

      // Calculate new position
      // Original position + (Random Direction * Expansion Amount) + Turbulence
      vec3 explosion = aRandom * (ease * spreadRadius);
      
      // Rotate the base shape slightly as it explodes
      vec3 rotatedPos = rotateY(pos, ease * 3.14);
      
      vec3 finalPos = rotatedPos + explosion + turbulence + (pos * breathing);

      vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
      
      // Size calculation
      // Larger size makes them look like glowing orbs
      gl_PointSize = 200.0 * (1.0 / -mvPosition.z);
      
      // Pass alpha to fragment
      // Brighter when exploding
      vAlpha = 0.5 + (ease * 0.5);

      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor;
    varying float vAlpha;
    
    void main() {
      // Circular particle logic
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      
      if (dist > 0.5) discard;
      
      // Radial Gradient / Glow
      // Very hot center (white), colored edge
      float strength = (0.05 / (dist + 0.05)) - 0.1;
      strength = clamp(strength, 0.0, 1.0);
      
      // Mix core white with uniform color
      vec3 finalColor = mix(uColor, vec3(1.0, 1.0, 1.0), strength * 0.8); // 80% white core influence
      
      gl_FragColor = vec4(finalColor, strength * vAlpha);
    }
  `;

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={randomness.length / 3}
          array={randomness}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
      />
    </points>
  );
};

export default ParticleMesh;
