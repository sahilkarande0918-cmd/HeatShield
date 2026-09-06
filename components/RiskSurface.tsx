'use client';

/**
 * The hero centrepiece: an abstracted risk surface.
 *
 * A grid of cells whose height and colour are driven by a slowly evolving
 * noise field, coloured with the same five-stop ramp the real map uses. It is
 * not real data and does not pretend to be — it is the *shape* of the product:
 * a city is not one temperature, it is a surface with dangerous pockets.
 *
 * One draw call, one ShaderMaterial, ~25k vertices. This is the only R3F on
 * the site; everything else uses CSS transforms.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(q.matches);
    const on = () => setReduced(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return reduced;
}
import * as THREE from 'three';

const VERT = /* glsl */ `
  uniform float uTime;
  varying float vHeight;
  varying vec2 vUv;

  // Ashima 2D simplex noise (public domain).
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865, 0.366025403, -0.577350269, 0.024390243);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p){
    float s = 0.0, amp = 0.5;
    for(int i = 0; i < 4; i++){ s += amp * snoise(p); p *= 2.03; amp *= 0.5; }
    return s;
  }

  void main(){
    vUv = uv;
    vec2 p = position.xy * 0.55;
    // Two fields drifting at different speeds: a slow structural one (the
    // built city, which doesn't move) and a faster one (today's weather).
    float base = fbm(p + vec2(11.0, 4.0));
    float drift = fbm(p * 1.7 - vec2(uTime * 0.05, uTime * 0.028));
    float h = base * 0.72 + drift * 0.42;

    // Fall off toward the edges so the surface reads as an object, not a tile.
    float r = length(position.xy) / 3.4;
    h *= smoothstep(1.05, 0.15, r);

    vHeight = h;
    vec3 pos = vec3(position.xy, h * 0.78);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uRamp[5];
  uniform float uReveal;
  varying float vHeight;
  varying vec2 vUv;

  vec3 ramp(float t){
    t = clamp(t, 0.0, 1.0) * 4.0;
    int i = int(floor(t));
    float f = fract(t);
    if(i >= 4) return uRamp[4];
    if(i == 3) return mix(uRamp[3], uRamp[4], f);
    if(i == 2) return mix(uRamp[2], uRamp[3], f);
    if(i == 1) return mix(uRamp[1], uRamp[2], f);
    return mix(uRamp[0], uRamp[1], f);
  }

  void main(){
    float t = smoothstep(-1.15, 1.45, vHeight);
    vec3 col = ramp(t);

    // Grid cells: this is a per-cell risk surface, so let the cells show.
    vec2 g = abs(fract(vUv * 44.0) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.06, min(g.x, g.y));
    col = mix(col, col + 0.16, line * 0.5);

    // Only the hot pockets are opaque; the calm majority of the city recedes.
    float a = smoothstep(0.02, 0.72, t) * 0.95 + 0.03;
    gl_FragColor = vec4(col, a * uReveal);
  }
`;

const RAMP = ['#372c68', '#8a2681', '#d32d48', '#f77a00', '#f6d32b'].map(
  (h) => new THREE.Color(h),
);

function Surface({ animate }: { animate: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { invalidate } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uRamp: { value: RAMP },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (!mat.current) return;
    if (animate) mat.current.uniforms.uTime.value += delta;
    // Reveal is the one orchestrated moment: the surface resolves out of the dark.
    const r = mat.current.uniforms.uReveal;
    if (r.value < 1) r.value = Math.min(1, r.value + delta * 0.55);
    else if (!animate) invalidate();
    void state;
  });

  return (
    <mesh rotation={[-1.02, 0, -0.36]} position={[0, -0.35, 0]}>
      <planeGeometry args={[7.4, 7.4, 150, 150]} />
      <shaderMaterial
        ref={mat}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export default function RiskSurface() {
  const animate = !useReducedMotion();
  // WebGL cannot render on the server, and the fold is legible without it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // A dropped WebGL context (integrated GPU under load, a laptop switching
  // graphics, a projector) must not leave a broken canvas on the fold. The
  // Marquee hero is legitimate as pure typography, so we just stand down.
  const [lost, setLost] = useState(false);
  if (lost || !mounted) return null;

  return (
    <Canvas
      camera={{ position: [0, 0.1, 4.6], fov: 42 }}
      dpr={[1, 1.75]}
      frameloop={animate ? 'always' : 'demand'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      aria-hidden="true"
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', () => setLost(true));
      }}
    >
      <Surface animate={animate} />
    </Canvas>
  );
}
