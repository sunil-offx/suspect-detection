import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
  Sliders,
  Check,
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

type ViewMode = 'textured' | 'wireframe' | 'clay';
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
  const animFrameIdRef = useRef<number | null>(null);

  // References to the loaded Character model meshes
  const characterModelRef = useRef<THREE.Group | null>(null);
  const bodyMeshRef = useRef<THREE.SkinnedMesh | null>(null);
  const hatMeshRef = useRef<THREE.SkinnedMesh | THREE.Mesh | null>(null);
  const eyesMeshRef = useRef<THREE.SkinnedMesh | THREE.Mesh | null>(null);
  const landmarksGroupRef = useRef<THREE.Group | null>(null);

  // Base positions and vertex indices for real-time morphing of character.fbx
  const basePositionsRef = useRef<Float32Array | null>(null);
  const facialIndicesRef = useRef<{
    mandible: { idx: number; weight: number }[];
    chin: { idx: number; weight: number }[];
    noseWidth: { idx: number; weight: number }[];
    noseProfile: { idx: number; weight: number }[];
    zygoma: { idx: number; weight: number }[];
    brows: { idx: number; weight: number }[];
    lips: { idx: number; weight: number }[];
    eyes: { idx: number; weight: number }[];
  } | null>(null);

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');
  const [viewMode, setViewMode] = useState<ViewMode>('textured');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [activeAngle, setActiveAngle] = useState<'front' | 'threeQuarter' | 'profile'>('front');
  const [showCap, setShowCap] = useState<boolean>(false); // Default: without their cap!
  const [showMarkers, setShowMarkers] = useState<boolean>(true); // MoCap tracking spheres
  const [modelLoading, setModelLoading] = useState<boolean>(true);

  // Anthropometric Metrics for HUD
  const metrics = useMemo(() => {
    const bigonialMm = Math.round(112 + (jawWidth - 50) * 0.45);
    const nasalHeightMm = Math.round(52 + (noseProfile - 50) * 0.2);
    const nasalWidthMm = Math.round(35 + (noseWidth - 50) * 0.25);
    const shoulderBreadthMm = Math.round(450 + (jawWidth - 50) * 0.5);

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

  // 1. Initialize Three.js Scene and Load character.glb (converted from character.fbx)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 460;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1118); // Dark studio navy background
    sceneRef.current = scene;

    // Camera: Centered on the character's head and shoulders
    // Mixamo character is ~1.79m tall. Head is at y ~ 1.55m - 1.75m. Shoulders at y ~ 1.38m.
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);
    camera.position.set(0, 1.56, 0.88); // Close-up bust framing
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Orbit Controls: Focus target is the suspect's face center
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.45;
    controls.maxDistance = 2.4;
    controls.maxPolarAngle = Math.PI / 2 + 0.25;
    controls.minPolarAngle = Math.PI / 6;
    controls.target.set(0, 1.54, 0.02);
    controlsRef.current = controls;

    // Lighting (Warm Key, Cool Fill, Back Rim Light)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
    keyLight.position.set(0.6, 2.3, 2.2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.7);
    fillLight.position.set(-1.8, 1.6, 1.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimLight.position.set(0, 2.5, -1.8);
    scene.add(rimLight);

    const chinLight = new THREE.DirectionalLight(0xffffff, 0.35);
    chinLight.position.set(0, 0.8, 1.2);
    scene.add(chinLight);

    // Anthropometric MoCap Tracking Spheres (forehead, chin, shoulders, chest)
    const landmarksGroup = new THREE.Group();
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.05,
    });
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x881337, // dark crimson bezel ring
      roughness: 0.6,
    });
    const markerSphere = new THREE.SphereGeometry(0.018, 16, 16);
    const bezelGeom = new THREE.CylinderGeometry(0.024, 0.024, 0.006, 16);

    const markerPositions = [
      new THREE.Vector3(-0.065, 1.70, 0.092), // Left Forehead Temple
      new THREE.Vector3(0.065, 1.70, 0.092),  // Right Forehead Temple
      new THREE.Vector3(0, 1.48, 0.108),       // Chin (Pogonion)
      new THREE.Vector3(0, 1.34, 0.082),       // Clavicle / Upper Chest
      new THREE.Vector3(0, 1.22, 0.088),       // Mid-Sternum
      new THREE.Vector3(-0.19, 1.37, 0.015),   // Left Shoulder Joint
      new THREE.Vector3(0.19, 1.37, 0.015),    // Right Shoulder Joint
      new THREE.Vector3(-0.38, 1.34, -0.01),   // Left Outer Arm
      new THREE.Vector3(0.38, 1.34, -0.01),    // Right Outer Arm
    ];

    markerPositions.forEach((pos) => {
      const obj = new THREE.Group();
      const sphere = new THREE.Mesh(markerSphere, markerMat);
      const bezel = new THREE.Mesh(bezelGeom, bezelMat);
      bezel.rotation.x = Math.PI / 2;
      obj.add(bezel);
      obj.add(sphere);
      obj.position.copy(pos);
      landmarksGroup.add(obj);
    });

    landmarksGroup.visible = true;
    scene.add(landmarksGroup);
    landmarksGroupRef.current = landmarksGroup;

    // Load character.glb (converted directly from character.fbx)
    setModelLoading(true);
    const loader = new GLTFLoader();
    loader.load(
      '/models/character.glb',
      (gltf) => {
        const model = gltf.scene;
        characterModelRef.current = model;

        // Traverse model to configure meshes and prepare deformation buffers
        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const name = child.name.toLowerCase();

            // 1. Identify Hat mesh and hide it by default ("without their cap")
            if (name.includes('hat')) {
              hatMeshRef.current = child;
              child.visible = false; // Cap hidden by default
            }

            // 2. Identify Eyes mesh
            if (name.includes('eye')) {
              eyesMeshRef.current = child;
            }

            // 3. Identify Body mesh (contains head, face, neck, and shoulders)
            if (name.includes('body')) {
              bodyMeshRef.current = child as THREE.SkinnedMesh;

              const geom = child.geometry;
              const posAttr = geom.attributes.position;
              const vCount = posAttr.count;
              const basePos = new Float32Array(posAttr.array);
              basePositionsRef.current = basePos;

              // Precompute facial region indices based on coordinate bounds
              const mandible: { idx: number; weight: number }[] = [];
              const chin: { idx: number; weight: number }[] = [];
              const noseWidthArr: { idx: number; weight: number }[] = [];
              const noseProfileArr: { idx: number; weight: number }[] = [];
              const zygoma: { idx: number; weight: number }[] = [];
              const brows: { idx: number; weight: number }[] = [];
              const lips: { idx: number; weight: number }[] = [];
              const eyesArr: { idx: number; weight: number }[] = [];

              for (let i = 0; i < vCount; i++) {
                const x = basePos[i * 3];
                const y = basePos[i * 3 + 1];
                const z = basePos[i * 3 + 2];

                // Face region is y in [1.45, 1.76] and z > 0.015 (front of head)
                if (y >= 1.45 && y <= 1.76 && z > 0.015) {
                  // Mandible / Jawline: lower face lateral
                  if (y >= 1.47 && y <= 1.58 && Math.abs(x) > 0.028) {
                    const w = Math.min(1.0, (Math.abs(x) - 0.028) / 0.035);
                    mandible.push({ idx: i, weight: w });
                  }
                  // Chin: center lower jaw
                  if (y >= 1.46 && y <= 1.53 && Math.abs(x) < 0.03 && z > 0.05) {
                    chin.push({ idx: i, weight: 1.0 });
                  }
                  // Nose Width: alar wings
                  if (y >= 1.56 && y <= 1.63 && Math.abs(x) < 0.032 && z > 0.055) {
                    noseWidthArr.push({ idx: i, weight: 1.0 });
                  }
                  // Nose Profile: bridge & tip projection
                  if (y >= 1.56 && y <= 1.67 && Math.abs(x) < 0.022 && z > 0.05) {
                    noseProfileArr.push({ idx: i, weight: 1.0 });
                  }
                  // Zygoma / Cheeks
                  if (y >= 1.59 && y <= 1.66 && Math.abs(x) >= 0.045 && Math.abs(x) <= 0.085) {
                    zygoma.push({ idx: i, weight: 1.0 });
                  }
                  // Brow ridge
                  if (y >= 1.66 && y <= 1.72 && z > 0.055) {
                    brows.push({ idx: i, weight: 1.0 });
                  }
                  // Lips
                  if (y >= 1.52 && y <= 1.57 && Math.abs(x) < 0.032 && z > 0.058) {
                    lips.push({ idx: i, weight: 1.0 });
                  }
                  // Eyes
                  if (y >= 1.62 && y <= 1.66 && Math.abs(x) >= 0.022 && Math.abs(x) <= 0.05) {
                    eyesArr.push({ idx: i, weight: 1.0 });
                  }
                }
              }

              facialIndicesRef.current = {
                mandible,
                chin,
                noseWidth: noseWidthArr,
                noseProfile: noseProfileArr,
                zygoma,
                brows,
                lips,
                eyes: eyesArr,
              };
            }
          }
        });

        scene.add(model);
        setModelLoading(false);
      },
      undefined,
      (err) => {
        console.error('Error loading character.glb:', err);
        setModelLoading(false);
      }
    );

    // Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) {
        if (autoRotate && characterModelRef.current) {
          characterModelRef.current.rotation.y += 0.008;
          if (landmarksGroupRef.current) landmarksGroupRef.current.rotation.y = characterModelRef.current.rotation.y;
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
      markerSphere.dispose();
      bezelGeom.dispose();
      markerMat.dispose();
      bezelMat.dispose();
    };
  }, []);

  // 2. Real-time Facial Structure Morphing on the character.fbx Mesh
  useEffect(() => {
    if (!bodyMeshRef.current || !basePositionsRef.current || !facialIndicesRef.current) return;

    const geom = bodyMeshRef.current.geometry;
    const posAttr = geom.attributes.position;
    const currentPos = posAttr.array as Float32Array;
    const basePos = basePositionsRef.current;
    const fac = facialIndicesRef.current;

    // Reset base positions first for face vertices
    currentPos.set(basePos);

    // Compute slider deltas (-1.0 to +1.0 centered at 50)
    const dJaw = (jawWidth - 50) / 50;
    const dNoseW = (noseWidth - 50) / 50;
    const dNoseP = (noseProfile - 50) / 50;
    const dEye = (eyeSize - 50) / 50;
    const dBrow = (browDensity - 50) / 50;
    const dLip = (lipFullness - 50) / 50;

    // Face Shape Modifiers
    let shapeJawX = 0;
    let shapeZygX = 0;
    let shapeChinZ = 0;

    const fShape = faceShape.toLowerCase();
    if (fShape.includes('square')) {
      shapeJawX = 0.007;
      shapeChinZ = 0.003;
    } else if (fShape.includes('diamond')) {
      shapeZygX = 0.008;
      shapeJawX = -0.004;
    } else if (fShape.includes('round')) {
      shapeZygX = 0.006;
      shapeJawX = -0.002;
    } else if (fShape.includes('heart')) {
      shapeJawX = -0.006;
      shapeChinZ = 0.003;
    } else if (fShape.includes('oblong')) {
      shapeJawX = -0.003;
    }

    const cStyle = chinStyle.toLowerCase();
    if (cStyle.includes('square') || cStyle.includes('heavy')) {
      shapeJawX += 0.004;
      shapeChinZ += 0.004;
    } else if (cStyle.includes('pointed') || cStyle.includes('sharp')) {
      shapeJawX -= 0.004;
      shapeChinZ += 0.005;
    } else if (cStyle.includes('receding')) {
      shapeChinZ -= 0.006;
    }

    // 1. Mandible / Jaw Width deformation
    fac.mandible.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      const x0 = basePos[pIdx];
      const delta = (dJaw * 0.009 + shapeJawX) * weight;
      currentPos[pIdx] = x0 + Math.sign(x0) * delta;
    });

    // 2. Chin projection
    fac.chin.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      currentPos[pIdx + 2] = basePos[pIdx + 2] + (dJaw * 0.005 + shapeChinZ) * weight;
    });

    // 3. Nose Width
    fac.noseWidth.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      const x0 = basePos[pIdx];
      currentPos[pIdx] = x0 + Math.sign(x0) * (dNoseW * 0.004) * weight;
    });

    // 4. Nose Profile (bridge & tip)
    fac.noseProfile.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      currentPos[pIdx + 2] = basePos[pIdx + 2] + (dNoseP * 0.007) * weight;
    });

    // 5. Zygoma (Cheekbones)
    fac.zygoma.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      const x0 = basePos[pIdx];
      currentPos[pIdx] = x0 + Math.sign(x0) * (shapeZygX) * weight;
    });

    // 6. Brow Ridge
    fac.brows.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      currentPos[pIdx + 2] = basePos[pIdx + 2] + (dBrow * 0.004) * weight;
    });

    // 7. Lips
    fac.lips.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      currentPos[pIdx + 2] = basePos[pIdx + 2] + (dLip * 0.004) * weight;
    });

    // 8. Eyes
    fac.eyes.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      currentPos[pIdx + 1] = basePos[pIdx + 1] + (dEye * 0.002) * weight;
    });

    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
  }, [jawWidth, noseWidth, noseProfile, eyeSize, browDensity, lipFullness, ageYears, faceShape, chinStyle]);

  // 3. Toggle Hat / Cap visibility
  useEffect(() => {
    if (hatMeshRef.current) {
      hatMeshRef.current.visible = showCap;
    }
  }, [showCap]);

  // 4. Toggle Landmarks / MoCap Markers visibility
  useEffect(() => {
    if (landmarksGroupRef.current) {
      landmarksGroupRef.current.visible = showMarkers;
    }
  }, [showMarkers]);

  // 5. View Mode (Textured / Wireframe / Clay)
  useEffect(() => {
    if (!characterModelRef.current) return;

    characterModelRef.current.traverse((child: any) => {
      if (child.isMesh && child.material) {
        if (viewMode === 'wireframe') {
          child.material.wireframe = true;
        } else {
          child.material.wireframe = false;
        }
      }
    });
  }, [viewMode]);

  // 6. Preset Camera Angles
  const setCameraAngle = (angle: 'front' | 'threeQuarter' | 'profile') => {
    if (!cameraRef.current || !controlsRef.current || !characterModelRef.current) return;
    setActiveAngle(angle);

    characterModelRef.current.rotation.y = 0;
    if (landmarksGroupRef.current) landmarksGroupRef.current.rotation.y = 0;

    if (angle === 'front') {
      cameraRef.current.position.set(0, 1.56, 0.88);
    } else if (angle === 'threeQuarter') {
      cameraRef.current.position.set(0.55, 1.60, 0.75);
    } else if (angle === 'profile') {
      cameraRef.current.position.set(0.85, 1.56, 0.02);
    }
    controlsRef.current.target.set(0, 1.54, 0.02);
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
                character.fbx 3D Model
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                Native Mixamo Model
              </span>
            </div>
            <p className="text-[10px] text-parchment-400 font-mono">
              Bust to Shoulders &bull; Natural Scalp (No Cap) &bull; Real-time Morph
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
        {/* PANE 1: 2D REFERENCE MODEL */}
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

        {/* PANE 2: 3D character.fbx BUST VIEWPORT */}
        {(layoutMode === 'split' || layoutMode === '3d-only') && (
          <div
            className={`relative h-full flex flex-col transition-all duration-300 ${
              layoutMode === 'split' ? 'w-7/12' : 'w-full'
            }`}
          >
            {/* Top Right Toolbars: Mode, Cap Toggle & Markers Toggle */}
            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 bg-noir-900/90 p-0.5 rounded-lg border border-noir-700/80 backdrop-blur-sm shadow-md">
              <button
                type="button"
                onClick={() => setViewMode('textured')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'textured'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-parchment-300 hover:text-white'
                }`}
                title="Default Textured 3D Model"
              >
                <User className="w-3 h-3" />
                Textured
              </button>

              <button
                type="button"
                onClick={() => setViewMode('wireframe')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'wireframe'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-parchment-300 hover:text-white'
                }`}
                title="Anatomical Wireframe Grid"
              >
                <Layers className="w-3 h-3" />
                Grid
              </button>

              <div className="w-[1px] h-3.5 bg-noir-700 mx-0.5" />

              {/* Toggle Cap Button (Default: OFF / Without their cap) */}
              <button
                type="button"
                onClick={() => setShowCap(!showCap)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  showCap
                    ? 'bg-emerald-600 text-white'
                    : 'bg-noir-800 text-parchment-300 hover:text-white border border-noir-700'
                }`}
                title="Toggle Cap on/off"
              >
                Cap: {showCap ? 'ON' : 'OFF'}
              </button>

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

            {/* Model Loading Spinner */}
            {modelLoading && (
              <div className="absolute inset-0 bg-noir-950/80 flex flex-col items-center justify-center text-parchment-200 font-mono text-xs gap-2 z-20">
                <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span>Loading character.fbx 3D model...</span>
              </div>
            )}

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
