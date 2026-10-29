import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  RotateCcw,
  Box,
  Layers,
  Sparkles,
  Play,
  Pause,
  Scan,
  Columns2,
  Crosshair,
  User,
  Eye,
  Sliders,
} from 'lucide-react';

export interface GNMViewerProps {
  imageUrl?: string;
  jawWidth: number; // 0 to 100
  noseWidth: number; // 0 to 100
  noseProfile: number; // 0 to 100
  eyeSize: number; // 0 to 100
  browDensity: number; // 0 to 100
  lipFullness: number; // 0 to 100
  ageYears: number; // 18 to 75
  faceShape?: string;
  chinStyle?: string;
  className?: string;
}

type ViewMode = 'avatar' | 'sketch-blend' | 'wireframe' | 'clay';
type LayoutMode = 'split' | '3d-only' | '2d-only';

export const GNMHeadViewer3D: React.FC<GNMViewerProps> = ({
  imageUrl,
  jawWidth,
  noseWidth,
  noseProfile,
  eyeSize,
  browDensity,
  lipFullness,
  ageYears,
  faceShape = 'Oval Symmetrical',
  chinStyle = 'Balanced',
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const bustMeshRef = useRef<THREE.Mesh | null>(null);
  const wireframeMeshRef = useRef<THREE.Mesh | null>(null);
  const landmarksGroupRef = useRef<THREE.Group | null>(null);
  const eyesGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Stored base vertices and region weights for real-time GNM deformation
  const basePositionsRef = useRef<Float32Array | null>(null);
  const vertexWeightsRef = useRef<{
    mandible: Float32Array;
    chin: Float32Array;
    noseWidth: Float32Array;
    noseBridge: Float32Array;
    noseTip: Float32Array;
    orbit: Float32Array;
    brow: Float32Array;
    lips: Float32Array;
    zygoma: Float32Array;
    forehead: Float32Array;
    shoulders: Float32Array;
  } | null>(null);

  const proceduralTexRef = useRef<THREE.CanvasTexture | null>(null);
  const sketchTexRef = useRef<THREE.Texture | null>(null);

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');
  const [viewMode, setViewMode] = useState<ViewMode>('avatar');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [activeAngle, setActiveAngle] = useState<'front' | 'threeQuarter' | 'profile'>('front');
  const [showMarkers, setShowMarkers] = useState<boolean>(true);

  // Computed Anthropometric metrics for HUD
  const metrics = useMemo(() => {
    const bigonialMm = Math.round(108 + (jawWidth - 50) * 0.45);
    const nasalHeightMm = Math.round(48 + (noseProfile - 50) * 0.2);
    const nasalWidthMm = Math.round(33 + (noseWidth - 50) * 0.25);
    const shoulderBreadthMm = Math.round(440 + (jawWidth - 50) * 0.5);

    let classification = 'Mesocephalic (Harmonic)';
    if (jawWidth > 68) classification = 'Brachycephalic (Square Mandible)';
    else if (jawWidth < 38) classification = 'Dolichocephalic (Narrow V-Chin)';

    return {
      bigonialMm,
      nasalHeightMm,
      nasalWidthMm,
      shoulderBreadthMm,
      classification,
    };
  }, [jawWidth, noseWidth, noseProfile]);

  // Helper: Create High-Detail Procedural Skin & Mocap Suit Texture (NO CAP!)
  const generateProceduralTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // 1. Background / Scalp (Natural Short Hair / Buzzcut, NO CAP)
    const scalpGrad = ctx.createLinearGradient(0, 0, 0, 320);
    scalpGrad.addColorStop(0, '#1c1917'); // Dark espresso short hair
    scalpGrad.addColorStop(0.65, '#292524');
    scalpGrad.addColorStop(1, '#44403c');
    ctx.fillStyle = scalpGrad;
    ctx.fillRect(0, 0, 1024, 340);

    // Hair texture noise (subtle hair follicles)
    ctx.fillStyle = 'rgba(15, 12, 10, 0.35)';
    for (let i = 0; i < 4000; i++) {
      const hx = Math.random() * 1024;
      const hy = Math.random() * 320;
      ctx.fillRect(hx, hy, 1.5, 2.5);
    }

    // 2. Face and Neck Skin (vNorm ~ 0.32 to 0.78, canvas y: 320 to 720)
    const skinGrad = ctx.createLinearGradient(0, 320, 0, 720);
    skinGrad.addColorStop(0, '#f2d3bd'); // Forehead
    skinGrad.addColorStop(0.3, '#ebd0ba');
    skinGrad.addColorStop(0.55, '#f4d5c1'); // Cheeks
    skinGrad.addColorStop(0.85, '#e4bea7'); // Neck
    skinGrad.addColorStop(1, '#d8b098');
    ctx.fillStyle = skinGrad;
    ctx.fillRect(0, 320, 1024, 400);

    // Forehead subtle shadow & temples
    const fGrad = ctx.createRadialGradient(512, 400, 40, 512, 400, 380);
    fGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    fGrad.addColorStop(1, 'rgba(168, 100, 60, 0.12)');
    ctx.fillStyle = fGrad;
    ctx.fillRect(0, 320, 1024, 400);

    // Eyebrows
    ctx.fillStyle = '#26201e';
    ctx.beginPath();
    // Left Eyebrow
    ctx.ellipse(370, 435, 75, 12, -0.08, 0, Math.PI * 2);
    ctx.fill();
    // Right Eyebrow
    ctx.beginPath();
    ctx.ellipse(654, 435, 75, 12, 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Eye sockets shading & subtle eye crease
    ctx.strokeStyle = 'rgba(70, 40, 25, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(370, 480, 40, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(654, 480, 40, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // Nose bridge and alar shading
    ctx.fillStyle = 'rgba(140, 75, 45, 0.18)';
    ctx.beginPath();
    ctx.moveTo(502, 440);
    ctx.lineTo(522, 440);
    ctx.lineTo(538, 550);
    ctx.lineTo(486, 550);
    ctx.closePath();
    ctx.fill();

    // Nostril shadows
    ctx.fillStyle = 'rgba(60, 25, 15, 0.6)';
    ctx.beginPath();
    ctx.ellipse(492, 556, 12, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(532, 556, 12, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Lips & Philtrum
    ctx.fillStyle = '#be6e68'; // Upper lip
    ctx.beginPath();
    ctx.ellipse(512, 604, 52, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#cb7d77'; // Lower lip (fuller)
    ctx.beginPath();
    ctx.ellipse(512, 622, 50, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lip center line
    ctx.strokeStyle = 'rgba(90, 30, 25, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(462, 612);
    ctx.lineTo(562, 612);
    ctx.stroke();

    // Chin cleft / shadow
    ctx.fillStyle = 'rgba(140, 80, 50, 0.18)';
    ctx.beginPath();
    ctx.ellipse(512, 665, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Athletic MoCap Suit (Chest & Shoulders: y = 720 to 1024)
    const suitGrad = ctx.createLinearGradient(0, 720, 0, 1024);
    suitGrad.addColorStop(0, '#18181b'); // Dark charcoal athletic mocap suit
    suitGrad.addColorStop(0.2, '#1e2025');
    suitGrad.addColorStop(1, '#0f1115');
    ctx.fillStyle = suitGrad;
    ctx.fillRect(0, 720, 1024, 304);

    // Collar neckline
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(512, 720, 180, 0, Math.PI);
    ctx.stroke();

    // Clavicle & chest compression suit seams
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(150, 820);
    ctx.lineTo(420, 770);
    ctx.lineTo(512, 800);
    ctx.lineTo(604, 770);
    ctx.lineTo(874, 820);
    ctx.stroke();

    // Center zipper line
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(512, 800);
    ctx.lineTo(512, 1024);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  };

  // 1. Initialize Three.js Scene with Humanoid Bust (Head, Neck, Shoulders)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 460;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1118);
    sceneRef.current = scene;

    // Camera: Portrait view capturing head, neck, and broad shoulders
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50);
    camera.position.set(0, -0.15, 3.1);
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.4;
    controls.maxDistance = 4.2;
    controls.maxPolarAngle = Math.PI / 2 + 0.25;
    controls.minPolarAngle = Math.PI / 6;
    controls.target.set(0, -0.05, 0);
    controlsRef.current = controls;

    // Lighting (Warm Key, Cool Fill, Back Rim)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
    keyLight.position.set(0.6, 2.0, 3.2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.65);
    fillLight.position.set(-2.0, 0.4, 2.2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimLight.position.set(0, 2.8, -2.5);
    scene.add(rimLight);

    const chestBounceLight = new THREE.DirectionalLight(0xffffff, 0.35);
    chestBounceLight.position.set(0, -2.2, 1.8);
    scene.add(chestBounceLight);

    // --- Build Full Humanoid Bust Geometry (Head + Neck + Clavicle + Shoulders) ---
    const RINGS = 64;
    const SEGS = 64;
    const vertexCount = (RINGS + 1) * (SEGS + 1);

    const positions = new Float32Array(vertexCount * 3);
    const basePositions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices: number[] = [];

    // Region weight buffers for real-time vertex deformation
    const wMandible = new Float32Array(vertexCount);
    const wChin = new Float32Array(vertexCount);
    const wNoseWidth = new Float32Array(vertexCount);
    const wNoseBridge = new Float32Array(vertexCount);
    const wNoseTip = new Float32Array(vertexCount);
    const wOrbit = new Float32Array(vertexCount);
    const wBrow = new Float32Array(vertexCount);
    const wLips = new Float32Array(vertexCount);
    const wZygoma = new Float32Array(vertexCount);
    const wForehead = new Float32Array(vertexCount);
    const wShoulders = new Float32Array(vertexCount);

    let vIdx = 0;
    for (let r = 0; r <= RINGS; r++) {
      const vNorm = r / RINGS; // 0 (chest bottom) to 1 (cranial apex)
      // Span y from -1.55 (chest/shoulders) to +1.15 (cranial top)
      const y = -1.55 + vNorm * 2.7;

      for (let s = 0; s <= SEGS; s++) {
        const uNorm = s / SEGS; // 0 to 1
        const theta = (uNorm - 0.5) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const isFront = cosT > -0.1;

        let radX = 0.65;
        let radZ = 0.75;
        let depthShift = 0.0;

        // 1. Torso & Shoulders (vNorm < 0.28, y = -1.55 to -0.80)
        if (vNorm < 0.28) {
          const tBody = vNorm / 0.28;
          // Shoulders flare out wide to 1.55
          const shoulderFlare = Math.pow(1 - tBody, 0.65);
          radX = THREE.MathUtils.lerp(0.48, 1.55, shoulderFlare);
          radZ = THREE.MathUtils.lerp(0.44, 0.68, shoulderFlare);
          depthShift = -0.04 * (1 - tBody);
        }
        // 2. Neck & Trapezius (vNorm 0.28 to 0.44, y = -0.80 to -0.36)
        else if (vNorm < 0.44) {
          const tNeck = (vNorm - 0.28) / 0.16;
          radX = THREE.MathUtils.lerp(0.48, 0.56, tNeck);
          radZ = THREE.MathUtils.lerp(0.46, 0.60, tNeck);
          // Adam's apple / larynx slight protrusion in front center
          if (isFront && cosT > 0.8) {
            depthShift += Math.pow(cosT, 8) * 0.06 * Math.sin(tNeck * Math.PI);
          }
        }
        // 3. Lower Mandible & Chin (vNorm 0.44 to 0.56, y = -0.36 to -0.04)
        else if (vNorm < 0.56) {
          const tJaw = (vNorm - 0.44) / 0.12;
          radX = THREE.MathUtils.lerp(0.56, 0.66, tJaw);
          radZ = THREE.MathUtils.lerp(0.60, 0.76, tJaw);

          if (isFront && cosT > 0.5) {
            const chinFocus = Math.pow(cosT, 4) * (1 - Math.abs(tJaw - 0.4) * 2.5);
            if (chinFocus > 0) depthShift += chinFocus * 0.18;
          }
        }
        // 4. Midface: Mouth, Nose, Cheeks, Eyes (vNorm 0.56 to 0.76, y = -0.04 to +0.50)
        else if (vNorm < 0.76) {
          const tMid = (vNorm - 0.56) / 0.2;
          radX = THREE.MathUtils.lerp(0.66, 0.72, Math.sin(tMid * Math.PI));
          radZ = 0.78;

          // Lips protrusion (vNorm ~ 0.60)
          if (isFront && cosT > 0.7 && Math.abs(vNorm - 0.60) < 0.04) {
            const lipFocus = Math.pow(cosT, 6) * (1 - Math.abs(vNorm - 0.60) / 0.04);
            depthShift += lipFocus * 0.11;
          }

          // Nasal Pyramid (vNorm ~ 0.63 to 0.72)
          if (isFront && cosT > 0.82 && vNorm >= 0.63 && vNorm <= 0.73) {
            const noseLen = (vNorm - 0.63) / 0.1;
            const noseCurve = Math.sin(noseLen * Math.PI);
            const noseFocus = Math.pow(cosT, 12);
            depthShift += noseFocus * (0.28 * noseCurve + 0.08);
          }

          // Zygomatic Cheekbones (vNorm ~ 0.68)
          if (isFront && Math.abs(vNorm - 0.68) < 0.06) {
            const cheekAngle = Math.abs(theta) - 0.65;
            if (Math.abs(cheekAngle) < 0.35) {
              radX += 0.07 * (1 - Math.abs(cheekAngle) / 0.35);
              depthShift += 0.06 * (1 - Math.abs(cheekAngle) / 0.35);
            }
          }

          // Orbital Eye Sockets (vNorm ~ 0.72)
          if (isFront && Math.abs(vNorm - 0.72) < 0.04) {
            const eyeAngle = Math.abs(theta) - 0.38;
            if (Math.abs(eyeAngle) < 0.2) {
              depthShift -= 0.06 * (1 - Math.abs(eyeAngle) / 0.2);
            }
          }
        }
        // 5. Brow Ridge & Forehead (vNorm 0.76 to 0.86, y = +0.50 to +0.77)
        else if (vNorm < 0.86) {
          radX = 0.7;
          radZ = 0.76;
          // Brow ridge
          if (isFront && Math.abs(vNorm - 0.77) < 0.03 && cosT > 0.6) {
            depthShift += Math.pow(cosT, 4) * 0.11;
          }
          depthShift += (0.86 - vNorm) * 0.08;
        }
        // 6. Natural Cranial Dome / Skull (NO CAP! Natural human head contour)
        else {
          const tCrown = (vNorm - 0.86) / 0.14;
          const crownCurve = Math.cos(tCrown * Math.PI * 0.5);
          radX = 0.68 * crownCurve;
          radZ = 0.74 * crownCurve;
          depthShift = -0.04 * tCrown;
        }

        const vx = sinT * radX;
        const vy = y;
        const vz = cosT * radZ + depthShift;

        positions[vIdx * 3] = vx;
        positions[vIdx * 3 + 1] = vy;
        positions[vIdx * 3 + 2] = vz;

        basePositions[vIdx * 3] = vx;
        basePositions[vIdx * 3 + 1] = vy;
        basePositions[vIdx * 3 + 2] = vz;

        // Front-Facing Cylindrical UV Mapping (0.0 at left, 1.0 at right of face)
        const uTex = Math.min(1.0, Math.max(0.0, (uNorm - 0.25) / 0.5));
        const vTex = Math.min(1.0, Math.max(0.0, 1.0 - vNorm));
        uvs[vIdx * 2] = uTex;
        uvs[vIdx * 2 + 1] = vTex;

        // Deformation Influence Weights
        if (vNorm >= 0.44 && vNorm <= 0.60 && cosT > -0.2) {
          wMandible[vIdx] = (1 - Math.abs(vNorm - 0.52) / 0.1) * Math.max(0, cosT + 0.2);
        }
        if (vNorm >= 0.44 && vNorm <= 0.54 && cosT > 0.6) {
          wChin[vIdx] = Math.pow(cosT, 4) * (1 - Math.abs(vNorm - 0.48) / 0.08);
        }
        if (vNorm >= 0.62 && vNorm <= 0.69 && cosT > 0.75) {
          wNoseWidth[vIdx] = Math.pow(cosT, 6) * (1 - Math.abs(vNorm - 0.65) / 0.05);
        }
        if (vNorm >= 0.66 && vNorm <= 0.75 && cosT > 0.85) {
          wNoseBridge[vIdx] = Math.pow(cosT, 8) * (1 - Math.abs(vNorm - 0.70) / 0.05);
        }
        if (vNorm >= 0.63 && vNorm <= 0.67 && cosT > 0.9) {
          wNoseTip[vIdx] = Math.pow(cosT, 14);
        }
        if (vNorm >= 0.70 && vNorm <= 0.75 && cosT > 0.5) {
          const eyeDist = Math.abs(Math.abs(theta) - 0.38);
          if (eyeDist < 0.2) {
            wOrbit[vIdx] = (1 - eyeDist / 0.2) * (1 - Math.abs(vNorm - 0.72) / 0.04);
          }
        }
        if (vNorm >= 0.75 && vNorm <= 0.81 && cosT > 0.4) {
          wBrow[vIdx] = Math.pow(cosT, 3) * (1 - Math.abs(vNorm - 0.77) / 0.04);
        }
        if (vNorm >= 0.57 && vNorm <= 0.63 && cosT > 0.7) {
          wLips[vIdx] = Math.pow(cosT, 6) * (1 - Math.abs(vNorm - 0.60) / 0.04);
        }
        if (vNorm >= 0.64 && vNorm <= 0.73 && cosT > 0.3) {
          const chDist = Math.abs(Math.abs(theta) - 0.65);
          if (chDist < 0.3) {
            wZygoma[vIdx] = (1 - chDist / 0.3) * (1 - Math.abs(vNorm - 0.68) / 0.06);
          }
        }
        if (vNorm >= 0.79 && vNorm <= 0.89) {
          wForehead[vIdx] = (1 - Math.abs(vNorm - 0.84) / 0.06) * Math.max(0, cosT);
        }
        if (vNorm < 0.28) {
          wShoulders[vIdx] = (1 - vNorm / 0.28) * (Math.abs(sinT));
        }

        vIdx++;
      }
    }

    // Triangular faces: OUTWARD-FACING winding order
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s < SEGS; s++) {
        const i0 = r * (SEGS + 1) + s;
        const i1 = i0 + 1;
        const i2 = (r + 1) * (SEGS + 1) + s;
        const i3 = i2 + 1;

        indices.push(i0, i1, i2);
        indices.push(i1, i3, i2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    basePositionsRef.current = basePositions;
    vertexWeightsRef.current = {
      mandible: wMandible,
      chin: wChin,
      noseWidth: wNoseWidth,
      noseBridge: wNoseBridge,
      noseTip: wNoseTip,
      orbit: wOrbit,
      brow: wBrow,
      lips: wLips,
      zygoma: wZygoma,
      forehead: wForehead,
      shoulders: wShoulders,
    };

    // Procedural Skin & Mocap Suit Texture (NO CAP!)
    const procTex = generateProceduralTexture();
    proceduralTexRef.current = procTex;

    const material = new THREE.MeshStandardMaterial({
      map: procTex,
      roughness: 0.65,
      metalness: 0.04,
      side: THREE.FrontSide,
    });

    const bustMesh = new THREE.Mesh(geometry, material);
    scene.add(bustMesh);
    bustMeshRef.current = bustMesh;

    // Overlay Wireframe mesh for GNM Blueprint mode
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const wireframeMesh = new THREE.Mesh(geometry, wireframeMat);
    wireframeMesh.visible = false;
    scene.add(wireframeMesh);
    wireframeMeshRef.current = wireframeMesh;

    // Separate Realistic 3D Anatomical Eyes
    const eyesGroup = new THREE.Group();
    const eyeGeom = new THREE.SphereGeometry(0.062, 24, 24);
    const scleraMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.15,
      metalness: 0.05,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
    const pupilGeom = new THREE.SphereGeometry(0.024, 16, 16);

    // Left Eye
    const leftEye = new THREE.Mesh(eyeGeom, scleraMat);
    leftEye.position.set(-0.25, 0.40, 0.58);
    const leftPupil = new THREE.Mesh(pupilGeom, pupilMat);
    leftPupil.position.set(0, 0, 0.052);
    leftEye.add(leftPupil);
    eyesGroup.add(leftEye);

    // Right Eye
    const rightEye = new THREE.Mesh(eyeGeom, scleraMat);
    rightEye.position.set(0.25, 0.40, 0.58);
    const rightPupil = new THREE.Mesh(pupilGeom, pupilMat);
    rightPupil.position.set(0, 0, 0.052);
    rightEye.add(rightPupil);
    eyesGroup.add(rightEye);

    scene.add(eyesGroup);
    eyesGroupRef.current = eyesGroup;

    // Anthropometric MoCap Tracking Spheres (Exactly like the user's reference image!)
    const landmarksGroup = new THREE.Group();
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.1,
    });
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d, // Dark crimson/black bezel ring like mocap suit
      roughness: 0.5,
    });

    const markerSphere = new THREE.SphereGeometry(0.038, 16, 16);
    const bezelGeom = new THREE.CylinderGeometry(0.048, 0.048, 0.015, 16);

    // Tracking positions from reference image: Forehead/Temples, Chin, Clavicle, Shoulders, Chest
    const markerPositions = [
      new THREE.Vector3(-0.35, 0.85, 0.52), // Left Forehead Temple
      new THREE.Vector3(0.35, 0.85, 0.52), // Right Forehead Temple
      new THREE.Vector3(0, -0.22, 0.74), // Chin (Pogonion)
      new THREE.Vector3(0, -0.68, 0.52), // Clavicle / Upper Chest
      new THREE.Vector3(0, -1.05, 0.50), // Mid-Sternum
      new THREE.Vector3(-0.55, -0.65, 0.32), // Left Inner Shoulder / Clavicle
      new THREE.Vector3(0.55, -0.65, 0.32), // Right Inner Shoulder / Clavicle
      new THREE.Vector3(-1.32, -0.78, 0.15), // Left Outer Shoulder
      new THREE.Vector3(1.32, -0.78, 0.15), // Right Outer Shoulder
    ];

    markerPositions.forEach((pos) => {
      const markerObj = new THREE.Group();
      const sphere = new THREE.Mesh(markerSphere, markerMat);
      const bezel = new THREE.Mesh(bezelGeom, bezelMat);
      bezel.rotation.x = Math.PI / 2;
      markerObj.add(bezel);
      markerObj.add(sphere);
      markerObj.position.copy(pos);
      landmarksGroup.add(markerObj);
    });

    landmarksGroup.visible = true;
    scene.add(landmarksGroup);
    landmarksGroupRef.current = landmarksGroup;

    // Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) {
        if (autoRotate) {
          bustMesh.rotation.y += 0.008;
          if (wireframeMeshRef.current) wireframeMeshRef.current.rotation.y = bustMesh.rotation.y;
          if (landmarksGroupRef.current) landmarksGroupRef.current.rotation.y = bustMesh.rotation.y;
          if (eyesGroupRef.current) eyesGroupRef.current.rotation.y = bustMesh.rotation.y;
        }
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      cameraRef.current.aspect = nw / nh;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (rendererRef.current?.domElement && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      wireframeMat.dispose();
      procTex.dispose();
    };
  }, []);

  // 2. Load 2D Case Sketch Texture when available
  useEffect(() => {
    if (!imageUrl) return;

    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        sketchTexRef.current = tex;

        if (viewMode === 'sketch-blend' && bustMeshRef.current) {
          const mat = bustMeshRef.current.material as THREE.MeshStandardMaterial;
          mat.map = tex;
          mat.bumpMap = tex;
          mat.bumpScale = 0.03;
          mat.needsUpdate = true;
        }
      },
      undefined,
      (err) => console.warn('Sketch texture load note:', err)
    );
  }, [imageUrl, viewMode]);

  // 3. Real-time GNM Morphing: Apply Sliders & Presets to 3D Geometry
  useEffect(() => {
    if (!bustMeshRef.current || !basePositionsRef.current || !vertexWeightsRef.current) return;

    const geometry = bustMeshRef.current.geometry as THREE.BufferGeometry;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const currentPos = posAttr.array as Float32Array;
    const basePos = basePositionsRef.current;
    const w = vertexWeightsRef.current;
    const vCount = basePos.length / 3;

    const dJawWidth = (jawWidth - 50) / 50;
    const dNoseWidth = (noseWidth - 50) / 50;
    const dNoseProfile = (noseProfile - 50) / 50;
    const dEyeSize = (eyeSize - 50) / 50;
    const dBrow = (browDensity - 50) / 50;
    const dLips = (lipFullness - 50) / 50;
    const dAge = (ageYears - 35) / 40;

    let shapeJawX = 0;
    let shapeZygomaX = 0;
    let shapeForeheadX = 0;
    let shapeChinZ = 0;

    const fShape = faceShape.toLowerCase();
    if (fShape.includes('square')) {
      shapeJawX = 0.12;
      shapeForeheadX = 0.08;
      shapeChinZ = 0.05;
    } else if (fShape.includes('round')) {
      shapeZygomaX = 0.1;
      shapeJawX = -0.04;
    } else if (fShape.includes('diamond')) {
      shapeZygomaX = 0.16;
      shapeJawX = -0.08;
      shapeForeheadX = -0.06;
    } else if (fShape.includes('heart')) {
      shapeForeheadX = 0.12;
      shapeJawX = -0.14;
      shapeChinZ = 0.04;
    } else if (fShape.includes('oblong')) {
      shapeJawX = -0.06;
      shapeZygomaX = -0.06;
    } else if (fShape.includes('triangular')) {
      shapeJawX = 0.15;
      shapeForeheadX = -0.1;
    }

    const cStyle = chinStyle.toLowerCase();
    if (cStyle.includes('square') || cStyle.includes('heavy')) {
      shapeJawX += 0.08;
      shapeChinZ += 0.06;
    } else if (cStyle.includes('pointed') || cStyle.includes('sharp')) {
      shapeJawX -= 0.08;
      shapeChinZ += 0.08;
    } else if (cStyle.includes('receding')) {
      shapeChinZ -= 0.1;
    } else if (cStyle.includes('chiseled')) {
      shapeJawX += 0.06;
      shapeChinZ += 0.05;
    }

    for (let i = 0; i < vCount; i++) {
      const idx = i * 3;
      let x = basePos[idx];
      let y = basePos[idx + 1];
      let z = basePos[idx + 2];

      const wMand = w.mandible[i];
      const wCh = w.chin[i];
      const wNW = w.noseWidth[i];
      const wNB = w.noseBridge[i];
      const wNT = w.noseTip[i];
      const wOrb = w.orbit[i];
      const wBr = w.brow[i];
      const wLp = w.lips[i];
      const wZyg = w.zygoma[i];
      const wFh = w.forehead[i];
      const wSh = w.shoulders[i];

      // 1. Mandible / Jawline Expansion
      if (wMand > 0) {
        const deltaJaw = (dJawWidth * 0.18 + shapeJawX) * wMand;
        x += Math.sign(x) * deltaJaw;
      }

      // 2. Chin
      if (wCh > 0) {
        z += (dJawWidth * 0.08 + shapeChinZ) * wCh;
        x += Math.sign(x) * (dJawWidth * 0.04) * wCh;
      }

      // 3. Nose
      if (wNW > 0) {
        x += Math.sign(x) * (dNoseWidth * 0.06) * wNW;
      }
      if (wNB > 0) {
        z += (dNoseProfile * 0.09) * wNB;
      }
      if (wNT > 0) {
        z += (dNoseProfile * 0.08) * wNT;
      }

      // 4. Eyes / Orbits
      if (wOrb > 0) {
        const deltaEye = dEyeSize * 0.04 * wOrb;
        x += Math.sign(x) * deltaEye * 0.5;
        y += deltaEye;
      }

      // 5. Brow Ridge
      if (wBr > 0) {
        z += dBrow * 0.06 * wBr;
        y += dBrow * 0.02 * wBr;
      }

      // 6. Lips
      if (wLp > 0) {
        z += dLips * 0.06 * wLp;
        y += (y < -0.44 ? -1 : 1) * (dLips * 0.025) * wLp;
      }

      // 7. Zygomatic Cheekbones
      if (wZyg > 0) {
        x += Math.sign(x) * shapeZygomaX * wZyg;
        z += shapeZygomaX * 0.5 * wZyg;
      }

      // 8. Forehead
      if (wFh > 0) {
        x += Math.sign(x) * shapeForeheadX * wFh;
      }

      // 9. Shoulders proportional adaptation
      if (wSh > 0) {
        x += Math.sign(x) * (dJawWidth * 0.06) * wSh;
      }

      // 10. Age skin tension
      if (dAge > 0 && wMand > 0) {
        y -= dAge * 0.03 * wMand;
      }

      currentPos[idx] = x;
      currentPos[idx + 1] = y;
      currentPos[idx + 2] = z;
    }

    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    // Scale eye meshes based on eyeSize
    if (eyesGroupRef.current) {
      const eyeScale = 1.0 + dEyeSize * 0.18;
      eyesGroupRef.current.scale.set(eyeScale, eyeScale, eyeScale);
    }
  }, [jawWidth, noseWidth, noseProfile, eyeSize, browDensity, lipFullness, ageYears, faceShape, chinStyle]);

  // 4. View Mode Switcher
  useEffect(() => {
    if (!bustMeshRef.current || !wireframeMeshRef.current) return;

    const mat = bustMeshRef.current.material as THREE.MeshStandardMaterial;

    if (viewMode === 'avatar') {
      bustMeshRef.current.visible = true;
      wireframeMeshRef.current.visible = false;
      mat.map = proceduralTexRef.current;
      mat.bumpMap = null;
      mat.color.setHex(0xffffff);
      mat.roughness = 0.65;
      mat.wireframe = false;
      mat.needsUpdate = true;
      if (eyesGroupRef.current) eyesGroupRef.current.visible = true;
    } else if (viewMode === 'sketch-blend') {
      bustMeshRef.current.visible = true;
      wireframeMeshRef.current.visible = false;
      mat.map = sketchTexRef.current || proceduralTexRef.current;
      mat.bumpMap = sketchTexRef.current;
      mat.bumpScale = 0.025;
      mat.color.setHex(0xffffff);
      mat.roughness = 0.7;
      mat.wireframe = false;
      mat.needsUpdate = true;
      if (eyesGroupRef.current) eyesGroupRef.current.visible = false;
    } else if (viewMode === 'wireframe') {
      bustMeshRef.current.visible = true;
      wireframeMeshRef.current.visible = true;
      mat.map = null;
      mat.color.setHex(0x0c1322);
      mat.roughness = 0.9;
      mat.wireframe = false;
      mat.needsUpdate = true;
      if (eyesGroupRef.current) eyesGroupRef.current.visible = false;
    } else if (viewMode === 'clay') {
      bustMeshRef.current.visible = true;
      wireframeMeshRef.current.visible = false;
      mat.map = null;
      mat.bumpMap = null;
      mat.color.setHex(0xd4d4d8);
      mat.roughness = 0.55;
      mat.metalness = 0.05;
      mat.wireframe = false;
      mat.needsUpdate = true;
      if (eyesGroupRef.current) eyesGroupRef.current.visible = true;
    }
  }, [viewMode]);

  // 5. Toggle Markers
  useEffect(() => {
    if (landmarksGroupRef.current) {
      landmarksGroupRef.current.visible = showMarkers;
    }
  }, [showMarkers]);

  // 6. Preset Camera Angles
  const setCameraAngle = (angle: 'front' | 'threeQuarter' | 'profile') => {
    if (!cameraRef.current || !controlsRef.current || !bustMeshRef.current) return;
    setActiveAngle(angle);

    bustMeshRef.current.rotation.y = 0;
    if (wireframeMeshRef.current) wireframeMeshRef.current.rotation.y = 0;
    if (landmarksGroupRef.current) landmarksGroupRef.current.rotation.y = 0;
    if (eyesGroupRef.current) eyesGroupRef.current.rotation.y = 0;

    if (angle === 'front') {
      cameraRef.current.position.set(0, -0.15, 3.1);
    } else if (angle === 'threeQuarter') {
      cameraRef.current.position.set(1.5, 0.1, 2.7);
    } else if (angle === 'profile') {
      cameraRef.current.position.set(3.1, -0.15, 0);
    }
    controlsRef.current.target.set(0, -0.05, 0);
    controlsRef.current.update();
  };

  const handleResetCamera = () => {
    setCameraAngle('front');
    setAutoRotate(false);
  };

  return (
    <div
      className={`relative w-full h-[540px] bg-noir-950 rounded-2xl border-2 border-noir-800 overflow-hidden shadow-2xl flex flex-col ${className}`}
    >
      {/* Top Header Bar & Dual View Layout Controls */}
      <div className="z-10 px-3.5 py-2.5 bg-noir-950/95 flex items-center justify-between border-b border-noir-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Scan className="w-4 h-4 text-cyan-400 animate-pulse" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-cyan-300">
                GNM 3D Anthropometric Model
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                Head & Shoulders
              </span>
            </div>
            <p className="text-[10px] text-parchment-400 font-mono">
              Natural Scalp (No Cap) &bull; Torso Bust &bull; Real-time Morph
            </p>
          </div>
        </div>

        {/* View Layout Controls: Split (2D + 3D) vs 3D Only vs 2D Only */}
        <div className="flex items-center gap-1 bg-noir-900/90 p-0.5 rounded-lg border border-noir-700/80">
          <button
            type="button"
            onClick={() => setLayoutMode('split')}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
              layoutMode === 'split'
                ? 'bg-crimson-800 text-white shadow-sm'
                : 'text-parchment-300 hover:text-white'
            }`}
            title="Side-by-side 2D Reference & 3D Model"
          >
            <Columns2 className="w-3 h-3" />
            Split (2D + 3D)
          </button>

          <button
            type="button"
            onClick={() => setLayoutMode('3d-only')}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
              layoutMode === '3d-only'
                ? 'bg-crimson-800 text-white shadow-sm'
                : 'text-parchment-300 hover:text-white'
            }`}
            title="Full 3D Model View"
          >
            <Box className="w-3 h-3" />
            3D Bust
          </button>

          <button
            type="button"
            onClick={() => setLayoutMode('2d-only')}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
              layoutMode === '2d-only'
                ? 'bg-crimson-800 text-white shadow-sm'
                : 'text-parchment-300 hover:text-white'
            }`}
            title="Full 2D Reference View"
          >
            <Crosshair className="w-3 h-3" />
            2D Ref
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 w-full h-[calc(100%-48px)] flex overflow-hidden">
        {/* PANE 1: 2D REFERENCE MODEL (Visible in 'split' and '2d-only') */}
        {(layoutMode === 'split' || layoutMode === '2d-only') && (
          <div
            className={`relative h-full flex flex-col bg-noir-900 border-r border-noir-800 p-3 transition-all duration-300 ${
              layoutMode === 'split' ? 'w-5/12' : 'w-full'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono font-bold text-cyan-400 tracking-wider flex items-center gap-1">
                <Crosshair className="w-3 h-3" />
                2D Case Sketch Reference
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-noir-950 border border-noir-700 text-parchment-300">
                Source
              </span>
            </div>

            <div className="relative flex-1 rounded-xl bg-noir-950 border border-noir-800 overflow-hidden flex items-center justify-center p-1 shadow-inner group">
              {imageUrl ? (
                <>
                  <img
                    src={imageUrl}
                    alt="2D Case Reference Sketch"
                    className="w-full h-full object-contain rounded-lg filter contrast-105"
                  />
                  <div className="absolute inset-0 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-cyan-400" />
                    <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-cyan-400" />
                    <div className="absolute inset-3 border border-dashed border-cyan-500 rounded" />
                  </div>
                </>
              ) : (
                <div className="text-center p-4 text-parchment-400 font-mono text-xs space-y-1">
                  <User className="w-8 h-8 mx-auto text-parchment-600 mb-2" />
                  <p className="font-bold text-white">No 2D Sketch Yet</p>
                  <p className="text-[10px] text-parchment-400">Generate a sketch first to reference here</p>
                </div>
              )}

              <div className="absolute bottom-2 left-2 z-10">
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-noir-900/90 text-emerald-400 border border-noir-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  2D Reference Artifact
                </span>
              </div>
            </div>
          </div>
        )}

        {/* PANE 2: 3D GNM HEAD & SHOULDERS BUST (Visible in 'split' and '3d-only') */}
        {(layoutMode === 'split' || layoutMode === '3d-only') && (
          <div
            className={`relative h-full flex flex-col transition-all duration-300 ${
              layoutMode === 'split' ? 'w-7/12' : 'w-full'
            }`}
          >
            {/* Top Right Toolbars: Mode Switcher & Markers Toggle */}
            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 bg-noir-900/90 p-0.5 rounded-lg border border-noir-700/80 backdrop-blur-sm shadow-md">
              <button
                type="button"
                onClick={() => setViewMode('avatar')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'avatar'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-parchment-300 hover:text-white'
                }`}
                title="Realistic Humanoid Bust (No Cap, Clean Hair & Suit)"
              >
                <User className="w-3 h-3" />
                3D Model
              </button>

              <button
                type="button"
                onClick={() => setViewMode('sketch-blend')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'sketch-blend'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-parchment-300 hover:text-white'
                }`}
                title="Overlay 2D Sketch Features"
              >
                <Sparkles className="w-3 h-3" />
                Sketch Blend
              </button>

              <button
                type="button"
                onClick={() => setViewMode('wireframe')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'wireframe'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-parchment-300 hover:text-white'
                }`}
                title="Google GNM Anthropometric Grid"
              >
                <Layers className="w-3 h-3" />
                Grid
              </button>

              <button
                type="button"
                onClick={() => setViewMode('clay')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'clay'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-parchment-300 hover:text-white'
                }`}
                title="Matte Forensic Clay"
              >
                <Box className="w-3 h-3" />
                Clay
              </button>

              <div className="w-[1px] h-3.5 bg-noir-700 mx-0.5" />

              {/* MoCap Markers ON/OFF */}
              <button
                type="button"
                onClick={() => setShowMarkers(!showMarkers)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  showMarkers
                    ? 'bg-amber-600 text-white'
                    : 'text-parchment-400 hover:text-white'
                }`}
                title="Toggle Anthropometric MoCap Tracking Markers"
              >
                Markers {showMarkers ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* 3D WebGL Canvas Mount */}
            <div
              ref={mountRef}
              className="w-full h-full cursor-grab active:cursor-grabbing focus:outline-none"
            />

            {/* Quick Angle Camera Controls */}
            <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1 bg-noir-900/90 p-1 rounded-xl border border-noir-700/80 backdrop-blur-sm shadow-lg">
              <button
                type="button"
                onClick={() => setCameraAngle('front')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  activeAngle === 'front'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-parchment-300 hover:text-white'
                }`}
              >
                0° Front
              </button>
              <button
                type="button"
                onClick={() => setCameraAngle('threeQuarter')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  activeAngle === 'threeQuarter'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-parchment-300 hover:text-white'
                }`}
              >
                45°
              </button>
              <button
                type="button"
                onClick={() => setCameraAngle('profile')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  activeAngle === 'profile'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-parchment-300 hover:text-white'
                }`}
              >
                90°
              </button>

              <div className="w-[1px] h-3.5 bg-noir-700 mx-0.5" />

              <button
                type="button"
                onClick={() => setAutoRotate(!autoRotate)}
                className={`p-1 rounded text-[10px] font-mono transition-all ${
                  autoRotate
                    ? 'bg-cyan-600 text-white'
                    : 'text-parchment-300 hover:text-white hover:bg-noir-800'
                }`}
                title={autoRotate ? 'Pause 360 spin' : 'Auto 360 spin'}
              >
                {autoRotate ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={handleResetCamera}
                className="p-1 rounded text-[10px] text-parchment-300 hover:text-white hover:bg-noir-800 transition-all"
                title="Reset Camera"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* Anthropometric Telemetry HUD */}
            <div className="absolute bottom-2.5 right-2.5 z-10 bg-noir-900/90 px-3 py-1.5 rounded-xl border border-noir-700/80 backdrop-blur-sm pointer-events-none text-right font-mono text-[9px]">
              <div className="flex items-center justify-end gap-1 text-cyan-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>{metrics.classification}</span>
              </div>
              <div className="text-parchment-300 mt-0.5 space-x-2">
                <span>
                  Jaw: <strong className="text-white">{metrics.bigonialMm}mm</strong>
                </span>
                <span>
                  Nose: <strong className="text-white">{metrics.nasalWidthMm}mm</strong>
                </span>
                <span>
                  Shoulders: <strong className="text-white">{metrics.shoulderBreadthMm}mm</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
