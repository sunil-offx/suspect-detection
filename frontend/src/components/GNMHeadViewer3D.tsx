import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  RotateCcw,
  Maximize2,
  Box,
  Layers,
  Sparkles,
  Camera,
  Play,
  Pause,
  Compass,
  Scan,
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
  const headMeshRef = useRef<THREE.Mesh | null>(null);
  const wireframeMeshRef = useRef<THREE.Mesh | null>(null);
  const landmarksGroupRef = useRef<THREE.Group | null>(null);
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
  } | null>(null);

  const textureRef = useRef<THREE.Texture | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('textured');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [activeAngle, setActiveAngle] = useState<'front' | 'threeQuarter' | 'profile' | 'custom'>('threeQuarter');
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  // Computed Anthropometric metrics for HUD
  const metrics = useMemo(() => {
    const bigonialMm = Math.round(108 + (jawWidth - 50) * 0.45);
    const nasalHeightMm = Math.round(48 + (noseProfile - 50) * 0.2);
    const nasalWidthMm = Math.round(33 + (noseWidth - 50) * 0.25);
    const morphologicalRatio = ((bigonialMm / 138) * 100).toFixed(1);

    let classification = 'Mesocephalic (Harmonic)';
    if (jawWidth > 68) classification = 'Brachycephalic (Euryprosopic)';
    else if (jawWidth < 38) classification = 'Dolichocephalic (Leptoprosopic)';

    return {
      bigonialMm,
      nasalHeightMm,
      nasalWidthMm,
      morphologicalRatio,
      classification,
    };
  }, [jawWidth, noseWidth, noseProfile]);

  // 1. Initialize Three.js Scene and GNM Parametric Head Geometry
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 380;
    const height = container.clientHeight || 420;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10); // Noir forensic navy background
    sceneRef.current = scene;

    // Subtle atmospheric fog for 3D depth
    scene.fog = new THREE.FogExp2(0x0a0c10, 0.12);

    // Camera: Portrait FOV 36 to prevent wide-angle distortion
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0.7, 0.2, 2.7);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 4.5;
    controls.maxPolarAngle = Math.PI / 2 + 0.35;
    controls.minPolarAngle = Math.PI / 6;
    controls.target.set(0, 0.05, 0);
    controlsRef.current = controls;

    // Studio Forensic Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Key Light (45-degree angle forensic key)
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    keyLight.position.set(2, 2, 3);
    scene.add(keyLight);

    // Fill Light (Cool forensic contrast fill)
    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.6);
    fillLight.position.set(-2, 1, 1.5);
    scene.add(fillLight);

    // Rim Light (Separates head silhouette from dark background)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimLight.position.set(0, 3, -2.5);
    scene.add(rimLight);

    // Chin / Mandibular Bounce Light
    const bounceLight = new THREE.DirectionalLight(0xffffff, 0.3);
    bounceLight.position.set(0, -2, 2);
    scene.add(bounceLight);

    // --- Build Google GNM Parametric Head Mesh ---
    const RINGS = 48; // vertical slices
    const SEGS = 48; // radial segments
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

    let vIdx = 0;
    for (let r = 0; r <= RINGS; r++) {
      const vNorm = r / RINGS; // 0 (neck bottom) to 1 (cranial apex)
      // Anatomical vertical span: -1.15 to +1.15
      const y = -1.15 + vNorm * 2.3;

      for (let s = 0; s <= SEGS; s++) {
        const uNorm = s / SEGS; // 0 to 1
        const theta = (uNorm - 0.5) * Math.PI * 2; // -PI to +PI, front is theta = 0

        // Base anthropometric skull profile
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const isFront = cosT > -0.15; // Frontal face hemisphere

        // Default head ellipsoidal radius
        let radX = 0.68;
        let radZ = 0.82;
        let depthShift = 0.0;

        // --- Sculpt Anatomical Regions ---
        if (vNorm < 0.16) {
          // Neck base
          radX = 0.44;
          radZ = 0.48;
          depthShift = -0.12;
        } else if (vNorm < 0.38) {
          // Mandible, chin, lower jaw
          const tJaw = (vNorm - 0.16) / 0.22;
          radX = THREE.MathUtils.lerp(0.46, 0.64, tJaw);
          radZ = THREE.MathUtils.lerp(0.5, 0.72, tJaw);
          depthShift = 0.05 * tJaw;

          if (isFront && cosT > 0.5) {
            // Chin protrusion & apex
            const chinFocus = Math.pow(cosT, 4) * (1 - Math.abs(tJaw - 0.25) * 3);
            if (chinFocus > 0) {
              depthShift += chinFocus * 0.18;
            }
          }
        } else if (vNorm < 0.65) {
          // Midface: Mouth, nose, cheeks, eyes
          const tMid = (vNorm - 0.38) / 0.27;
          radX = THREE.MathUtils.lerp(0.64, 0.72, Math.sin(tMid * Math.PI));
          radZ = 0.78;

          // Mouth & Philtrum protrusion (vNorm ~ 0.42 to 0.48)
          if (isFront && cosT > 0.7 && Math.abs(vNorm - 0.45) < 0.06) {
            const lipFocus = Math.pow(cosT, 6) * (1 - Math.abs(vNorm - 0.45) / 0.06);
            depthShift += lipFocus * 0.12;
          }

          // Nasal Pyramid (vNorm ~ 0.48 to 0.62, front center)
          if (isFront && cosT > 0.82 && vNorm >= 0.48 && vNorm <= 0.63) {
            const noseLen = (vNorm - 0.48) / 0.15;
            const noseCurve = Math.sin(noseLen * Math.PI);
            const noseFocus = Math.pow(cosT, 12);
            depthShift += noseFocus * (0.28 * noseCurve + 0.08);
          }

          // Zygomatic arches (cheekbones) (vNorm ~ 0.54, theta ~ +-40 deg)
          if (isFront && Math.abs(vNorm - 0.54) < 0.08) {
            const cheekAngle = Math.abs(theta) - 0.65;
            if (Math.abs(cheekAngle) < 0.4) {
              radX += 0.07 * (1 - Math.abs(cheekAngle) / 0.4);
              depthShift += 0.06 * (1 - Math.abs(cheekAngle) / 0.4);
            }
          }

          // Orbital eye sockets (vNorm ~ 0.58 to 0.64, theta ~ +-24 deg)
          if (isFront && Math.abs(vNorm - 0.61) < 0.05) {
            const eyeAngle = Math.abs(theta) - 0.38;
            if (Math.abs(eyeAngle) < 0.22) {
              depthShift -= 0.07 * (1 - Math.abs(eyeAngle) / 0.22); // recessed eye socket
            }
          }
        } else if (vNorm < 0.82) {
          // Brow ridge & Forehead
          radX = 0.7;
          radZ = 0.76;
          // Superciliary arch (brow ridge)
          if (isFront && Math.abs(vNorm - 0.69) < 0.04 && cosT > 0.6) {
            depthShift += Math.pow(cosT, 4) * 0.11;
          }
          // Forehead slope
          depthShift += (0.82 - vNorm) * 0.1;
        } else {
          // Cranial vault / crown
          const tCrown = (vNorm - 0.82) / 0.18;
          const crownRadius = Math.cos(tCrown * Math.PI * 0.5);
          radX = 0.7 * crownRadius;
          radZ = 0.76 * crownRadius;
          depthShift = -0.05 * tCrown;
        }

        const vx = sinT * radX;
        const vz = cosT * radZ + depthShift;
        const vy = y;

        positions[vIdx * 3] = vx;
        positions[vIdx * 3 + 1] = vy;
        positions[vIdx * 3 + 2] = vz;

        basePositions[vIdx * 3] = vx;
        basePositions[vIdx * 3 + 1] = vy;
        basePositions[vIdx * 3 + 2] = vz;

        // Front-facing UV mapping for 2D composite sketch alignment
        // Front quadrant is theta in [-PI/2, PI/2], mapped to UV [0.1, 0.9]
        let uCoord: number;
        if (isFront) {
          uCoord = 0.5 + (sinT / (radX || 1)) * 0.42;
        } else {
          uCoord = uNorm;
        }
        // Match vertical proportions to portrait sketch
        const vCoord = Math.min(1.0, Math.max(0.0, (vNorm - 0.12) / 0.82));
        uvs[vIdx * 2] = Math.min(1.0, Math.max(0.0, uCoord));
        uvs[vIdx * 2 + 1] = vCoord;

        // Compute Morph Influence Weights for this vertex
        // Mandible
        if (vNorm >= 0.16 && vNorm <= 0.42 && cosT > -0.2) {
          wMandible[vIdx] = (1 - Math.abs(vNorm - 0.28) / 0.15) * Math.max(0, cosT + 0.2);
        }
        // Chin
        if (vNorm >= 0.16 && vNorm <= 0.32 && cosT > 0.6) {
          wChin[vIdx] = Math.pow(cosT, 4) * (1 - Math.abs(vNorm - 0.22) / 0.1);
        }
        // Nose Width & Alae
        if (vNorm >= 0.47 && vNorm <= 0.56 && cosT > 0.75) {
          wNoseWidth[vIdx] = Math.pow(cosT, 6) * (1 - Math.abs(vNorm - 0.51) / 0.06);
        }
        // Nose Bridge
        if (vNorm >= 0.53 && vNorm <= 0.64 && cosT > 0.85) {
          wNoseBridge[vIdx] = Math.pow(cosT, 8) * (1 - Math.abs(vNorm - 0.58) / 0.07);
        }
        // Nose Tip
        if (vNorm >= 0.49 && vNorm <= 0.54 && cosT > 0.9) {
          wNoseTip[vIdx] = Math.pow(cosT, 14);
        }
        // Orbits / Eyes
        if (vNorm >= 0.57 && vNorm <= 0.65 && cosT > 0.5) {
          const eyeDist = Math.abs(Math.abs(theta) - 0.38);
          if (eyeDist < 0.2) {
            wOrbit[vIdx] = (1 - eyeDist / 0.2) * (1 - Math.abs(vNorm - 0.61) / 0.05);
          }
        }
        // Brow
        if (vNorm >= 0.66 && vNorm <= 0.73 && cosT > 0.4) {
          wBrow[vIdx] = Math.pow(cosT, 3) * (1 - Math.abs(vNorm - 0.69) / 0.05);
        }
        // Lips
        if (vNorm >= 0.39 && vNorm <= 0.48 && cosT > 0.7) {
          wLips[vIdx] = Math.pow(cosT, 6) * (1 - Math.abs(vNorm - 0.44) / 0.06);
        }
        // Zygoma (Cheeks)
        if (vNorm >= 0.48 && vNorm <= 0.62 && cosT > 0.3) {
          const chDist = Math.abs(Math.abs(theta) - 0.65);
          if (chDist < 0.3) {
            wZygoma[vIdx] = (1 - chDist / 0.3) * (1 - Math.abs(vNorm - 0.55) / 0.08);
          }
        }
        // Forehead
        if (vNorm >= 0.72 && vNorm <= 0.86) {
          wForehead[vIdx] = (1 - Math.abs(vNorm - 0.79) / 0.08) * Math.max(0, cosT);
        }

        vIdx++;
      }
    }

    // Build triangular faces
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s < SEGS; s++) {
        const i0 = r * (SEGS + 1) + s;
        const i1 = i0 + 1;
        const i2 = (r + 1) * (SEGS + 1) + s;
        const i3 = i2 + 1;

        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
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
    };

    // Default Material: High-contrast shaded forensic clay
    const material = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.6,
      metalness: 0.08,
      flatShading: false,
    });

    const headMesh = new THREE.Mesh(geometry, material);
    scene.add(headMesh);
    headMeshRef.current = headMesh;

    // Overlay Wireframe mesh for GNM Blueprint mode
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const wireframeMesh = new THREE.Mesh(geometry, wireframeMat);
    wireframeMesh.visible = false;
    scene.add(wireframeMesh);
    wireframeMeshRef.current = wireframeMesh;

    // Anthropometric Landmark Points (Google GNM feature points)
    const landmarksGroup = new THREE.Group();
    const landmarkMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const landmarkSphere = new THREE.SphereGeometry(0.022, 12, 12);

    // Anatomical anchor indices: Chin, Gonions, Nose tip, Pupils, Nasion
    const landmarkPositions = [
      new THREE.Vector3(0, -0.62, 0.75), // Pogonion (Chin tip)
      new THREE.Vector3(0.55, -0.42, 0.28), // Left Gonion (Jaw corner)
      new THREE.Vector3(-0.55, -0.42, 0.28), // Right Gonion
      new THREE.Vector3(0, 0.05, 0.96), // Pronasale (Nose tip)
      new THREE.Vector3(0, 0.22, 0.78), // Nasion (Nasal root)
      new THREE.Vector3(0.26, 0.26, 0.62), // Left Pupil
      new THREE.Vector3(-0.26, 0.26, 0.62), // Right Pupil
      new THREE.Vector3(0.58, 0.08, 0.58), // Left Zygion (Cheekbone)
      new THREE.Vector3(-0.58, 0.08, 0.58), // Right Zygion
      new THREE.Vector3(0, -0.15, 0.78), // Labrale Superius (Upper lip)
    ];

    landmarkPositions.forEach((pos) => {
      const pt = new THREE.Mesh(landmarkSphere, landmarkMat);
      pt.position.copy(pos);
      landmarksGroup.add(pt);
    });

    landmarksGroup.visible = false;
    scene.add(landmarksGroup);
    landmarksGroupRef.current = landmarksGroup;

    // Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) {
        if (autoRotate) {
          headMesh.rotation.y += 0.008;
          if (wireframeMeshRef.current) wireframeMeshRef.current.rotation.y = headMesh.rotation.y;
          if (landmarksGroupRef.current) landmarksGroupRef.current.rotation.y = headMesh.rotation.y;
        }
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
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
      if (rendererRef.current?.domElement) {
        container.removeChild(rendererRef.current.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      wireframeMat.dispose();
      landmarkSphere.dispose();
      landmarkMat.dispose();
    };
  }, []);

  // 2. Load 2D Case Sketch Texture onto 3D Anthropometric Mesh
  useEffect(() => {
    if (!imageUrl || !headMeshRef.current) return;

    setImageLoaded(false);
    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        textureRef.current = tex;

        if (headMeshRef.current) {
          const mat = headMeshRef.current.material as THREE.MeshStandardMaterial;
          mat.map = tex;
          mat.bumpMap = tex;
          mat.bumpScale = 0.025; // Subtle graphite pencil relief
          mat.roughness = 0.72;
          mat.metalness = 0.04;
          mat.needsUpdate = true;
        }
        setImageLoaded(true);
      },
      undefined,
      (err) => {
        console.warn('Failed to load 2D texture for 3D GNM conversion:', err);
      }
    );
  }, [imageUrl]);

  // 3. Real-time GNM Morphing: Apply Sliders & Presets to 3D Geometry
  useEffect(() => {
    if (!headMeshRef.current || !basePositionsRef.current || !vertexWeightsRef.current) return;

    const geometry = headMeshRef.current.geometry as THREE.BufferGeometry;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const currentPos = posAttr.array as Float32Array;
    const basePos = basePositionsRef.current;
    const w = vertexWeightsRef.current;
    const vCount = basePos.length / 3;

    // Morph Scale Factors (centered at 50% = 0.0)
    const dJawWidth = (jawWidth - 50) / 50; // -1 to +1
    const dNoseWidth = (noseWidth - 50) / 50;
    const dNoseProfile = (noseProfile - 50) / 50;
    const dEyeSize = (eyeSize - 50) / 50;
    const dBrow = (browDensity - 50) / 50;
    const dLips = (lipFullness - 50) / 50;
    const dAge = (ageYears - 35) / 40; // -0.4 to +1.0

    // Face Shape Morph Offsets
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

    // Chin Style Morph Offsets
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

    // Vertex-level displacement loop
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

      // 1. Mandible / Jawline Expansion & Gonial Angle
      if (wMand > 0) {
        const deltaJaw = (dJawWidth * 0.18 + shapeJawX) * wMand;
        x += Math.sign(x) * deltaJaw;
      }

      // 2. Chin projection & width
      if (wCh > 0) {
        z += (dJawWidth * 0.08 + shapeChinZ) * wCh;
        x += Math.sign(x) * (dJawWidth * 0.04) * wCh;
      }

      // 3. Nose Morph
      if (wNW > 0) {
        x += Math.sign(x) * (dNoseWidth * 0.06) * wNW;
      }
      if (wNB > 0) {
        z += (dNoseProfile * 0.09) * wNB; // Aquiline bump vs straight bridge
      }
      if (wNT > 0) {
        z += (dNoseProfile * 0.08) * wNT; // Tip projection
      }

      // 4. Eyes & Orbits
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

      // 8. Forehead & Temples
      if (wFh > 0) {
        x += Math.sign(x) * shapeForeheadX * wFh;
      }

      // 9. Age Skin Tension & Sagging
      if (dAge > 0 && wMand > 0) {
        y -= dAge * 0.03 * wMand; // slight jowl relaxation
      }

      currentPos[idx] = x;
      currentPos[idx + 1] = y;
      currentPos[idx + 2] = z;
    }

    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }, [jawWidth, noseWidth, noseProfile, eyeSize, browDensity, lipFullness, ageYears, faceShape, chinStyle]);

  // 4. View Mode Switcher: Textured vs Wireframe vs Clay
  useEffect(() => {
    if (!headMeshRef.current || !wireframeMeshRef.current || !landmarksGroupRef.current) return;

    const mat = headMeshRef.current.material as THREE.MeshStandardMaterial;

    if (viewMode === 'textured') {
      headMeshRef.current.visible = true;
      wireframeMeshRef.current.visible = false;
      landmarksGroupRef.current.visible = false;
      mat.map = textureRef.current;
      mat.bumpMap = textureRef.current;
      mat.color.setHex(0xffffff);
      mat.roughness = 0.72;
      mat.wireframe = false;
      mat.needsUpdate = true;
    } else if (viewMode === 'wireframe') {
      headMeshRef.current.visible = true;
      wireframeMeshRef.current.visible = true;
      landmarksGroupRef.current.visible = true;
      mat.map = null;
      mat.bumpMap = null;
      mat.color.setHex(0x0f172a); // dark solid backing
      mat.roughness = 0.9;
      mat.wireframe = false;
      mat.needsUpdate = true;
    } else if (viewMode === 'clay') {
      headMeshRef.current.visible = true;
      wireframeMeshRef.current.visible = false;
      landmarksGroupRef.current.visible = false;
      mat.map = null;
      mat.bumpMap = null;
      mat.color.setHex(0xd4d4d8); // classic neutral forensic clay
      mat.roughness = 0.55;
      mat.metalness = 0.05;
      mat.wireframe = false;
      mat.needsUpdate = true;
    }
  }, [viewMode]);

  // 5. Preset Camera Angles
  const setCameraAngle = (angle: 'front' | 'threeQuarter' | 'profile') => {
    if (!cameraRef.current || !controlsRef.current || !headMeshRef.current) return;
    setActiveAngle(angle);

    // Reset rotation if autoRotate was on
    headMeshRef.current.rotation.y = 0;
    if (wireframeMeshRef.current) wireframeMeshRef.current.rotation.y = 0;
    if (landmarksGroupRef.current) landmarksGroupRef.current.rotation.y = 0;

    if (angle === 'front') {
      cameraRef.current.position.set(0, 0.05, 2.7);
    } else if (angle === 'threeQuarter') {
      cameraRef.current.position.set(1.4, 0.25, 2.3);
    } else if (angle === 'profile') {
      cameraRef.current.position.set(2.7, 0.05, 0);
    }
    controlsRef.current.target.set(0, 0.05, 0);
    controlsRef.current.update();
  };

  const handleResetCamera = () => {
    setCameraAngle('threeQuarter');
    setAutoRotate(false);
  };

  return (
    <div
      className={`relative w-full h-[440px] bg-noir-950 rounded-2xl border-2 border-noir-800 overflow-hidden shadow-2xl flex flex-col ${className}`}
    >
      {/* Top Header & Forensic Telemetry Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 px-3.5 py-2.5 bg-gradient-to-b from-noir-950/95 via-noir-950/80 to-transparent flex items-center justify-between border-b border-noir-800/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Scan className="w-4 h-4 text-cyan-400 animate-pulse" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-cyan-300">
                GNM 3D Reconstruction
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                Google GNM Parametric
              </span>
            </div>
            <p className="text-[10px] text-parchment-400 font-mono">
              2D-to-3D Anthropometric Cranial Mesh
            </p>
          </div>
        </div>

        {/* View Mode Toggle: Textured vs Wireframe vs Clay */}
        <div className="flex items-center gap-1 bg-noir-900/90 p-0.5 rounded-lg border border-noir-700/80">
          <button
            type="button"
            onClick={() => setViewMode('textured')}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
              viewMode === 'textured'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-parchment-300 hover:text-white'
            }`}
            title="Project 2D case composite onto 3D model"
          >
            <Sparkles className="w-3 h-3" />
            2D-to-3D
          </button>

          <button
            type="button"
            onClick={() => setViewMode('wireframe')}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
              viewMode === 'wireframe'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-parchment-300 hover:text-white'
            }`}
            title="Google GNM Anthropometric Cranial Grid"
          >
            <Layers className="w-3 h-3" />
            GNM Grid
          </button>

          <button
            type="button"
            onClick={() => setViewMode('clay')}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
              viewMode === 'clay'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-parchment-300 hover:text-white'
            }`}
            title="Sculpted forensic clay surface"
          >
            <Box className="w-3 h-3" />
            Clay
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Mount */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing focus:outline-none"
      />

      {/* Interactive Floating Quick-Angle Controller */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 bg-noir-900/90 p-1 rounded-xl border border-noir-700/80 backdrop-blur-sm shadow-lg">
        <button
          type="button"
          onClick={() => setCameraAngle('front')}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
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
          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
            activeAngle === 'threeQuarter'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-parchment-300 hover:text-white'
          }`}
        >
          45° Perspective
        </button>
        <button
          type="button"
          onClick={() => setCameraAngle('profile')}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
            activeAngle === 'profile'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-parchment-300 hover:text-white'
          }`}
        >
          90° Profile
        </button>

        <div className="w-[1px] h-4 bg-noir-700 mx-0.5" />

        {/* Auto Rotate Toggle */}
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-1.5 rounded-lg text-[10px] font-mono transition-all ${
            autoRotate
              ? 'bg-cyan-600 text-white'
              : 'text-parchment-300 hover:text-white hover:bg-noir-800'
          }`}
          title={autoRotate ? 'Pause rotation' : 'Auto 360 rotation'}
        >
          {autoRotate ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </button>

        {/* Reset Camera */}
        <button
          type="button"
          onClick={handleResetCamera}
          className="p-1.5 rounded-lg text-[10px] text-parchment-300 hover:text-white hover:bg-noir-800 transition-all"
          title="Reset 3D camera"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Real-time Anthropometric Telemetry Overlay (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-10 bg-noir-900/90 px-3 py-2 rounded-xl border border-noir-700/80 backdrop-blur-sm pointer-events-none text-right font-mono text-[10px]">
        <div className="flex items-center justify-end gap-1.5 text-cyan-400 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>{metrics.classification}</span>
        </div>
        <div className="text-parchment-300 mt-0.5 space-x-2">
          <span>
            Jaw: <strong className="text-white">{metrics.bigonialMm} mm</strong>
          </span>
          <span>
            Nose: <strong className="text-white">{metrics.nasalWidthMm} mm</strong>
          </span>
          <span>
            Age: <strong className="text-white">{ageYears}y</strong>
          </span>
        </div>
      </div>

      {/* Floating 2D-to-3D Texture Status Pill */}
      {viewMode === 'textured' && (
        <div className="absolute top-12 left-3 z-10 pointer-events-none">
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-noir-900/90 border border-cyan-800/60 text-cyan-300 flex items-center gap-1 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {imageUrl ? 'Case Sketch UV-Mapped to 3D' : 'Baseline Anthropometric GNM Texture'}
          </span>
        </div>
      )}
    </div>
  );
};
