import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { api } from '../api/client';
import {
  RotateCcw,
  Box,
  Sparkles,
  Play,
  Pause,
  Scan,
  Columns2,
  Crosshair,
  User,
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

  // References to Character model meshes and bones
  const characterModelRef = useRef<THREE.Group | null>(null);
  const headBoneRef = useRef<THREE.Object3D | null>(null);
  const bodyMeshRef = useRef<THREE.SkinnedMesh | null>(null);
  const hatMeshRef = useRef<THREE.SkinnedMesh | THREE.Mesh | null>(null);
  const eyesMeshRef = useRef<THREE.SkinnedMesh | THREE.Mesh | null>(null);
  const teethMeshRef = useRef<THREE.SkinnedMesh | THREE.Mesh | null>(null);
  const browsMeshRef = useRef<THREE.SkinnedMesh | THREE.Mesh | null>(null);
  const carunculaMeshRef = useRef<THREE.SkinnedMesh | THREE.Mesh | null>(null);
  const originalTextureRef = useRef<THREE.Texture | null>(null);
  const compositedTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const lastBakedKeyRef = useRef<string | null>(null);
  const baseImgRef = useRef<CanvasImageSource | null>(null);

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
  const [textureStatus, setTextureStatus] = useState<'idle' | 'baking' | 'pasted' | 'failed'>('idle');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [activeAngle, setActiveAngle] = useState<'front' | 'threeQuarter' | 'profile'>('front');
  const [showCap, setShowCap] = useState<boolean>(false); // Default: without their cap!
  const [modelLoading, setModelLoading] = useState<boolean>(true);
  const [modelReady, setModelReady] = useState<boolean>(false);

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

  // 1. Initialize Three.js Scene and Load character.glb
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 460;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    sceneRef.current = scene;

    // Camera: Focused bust framing of suspect's face and upper shoulders
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);
    camera.position.set(0, 1.56, 0.88);
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.45;
    controls.maxDistance = 2.4;
    controls.maxPolarAngle = Math.PI / 2 + 0.25;
    controls.minPolarAngle = Math.PI / 6;
    controls.target.set(0, 1.54, 0.02);
    controlsRef.current = controls;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.45);
    keyLight.position.set(0.6, 2.3, 2.2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.75);
    fillLight.position.set(-1.8, 1.6, 1.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(0, 2.5, -1.8);
    scene.add(rimLight);

    const chinLight = new THREE.DirectionalLight(0xffffff, 0.4);
    chinLight.position.set(0, 0.8, 1.2);
    scene.add(chinLight);

    // Load character.glb (converted directly from character.fbx)
    setModelLoading(true);
    const loader = new GLTFLoader();
    loader.load(
      '/models/character.glb',
      (gltf) => {
        const model = gltf.scene;
        characterModelRef.current = model;

        // Obtain Head Bone for skeletal craniofacial morphing
        const headBone = model.getObjectByName('mixamorig:Head');
        if (headBone) {
          headBoneRef.current = headBone;
        }

        // Traverse model to configure meshes and force 100% solidity
        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.renderOrder = 0;

            // Force solid opacity and depth writing on ALL materials (prevents see-through)
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat: any) => {
              if (mat) {
                mat.transparent = false;
                mat.opacity = 1.0;
                mat.depthWrite = true;
                mat.depthTest = true;
                mat.alphaTest = 0;
                mat.needsUpdate = true;
              }
            });

            const name = child.name.toLowerCase();

            // 1. Hat mesh (Hidden by default, "without their cap")
            if (name.includes('hat')) {
              hatMeshRef.current = child;
              child.visible = false;
            }

            // 2. Eyes mesh (Keep visible and solid so 3D eyes are present from all angles!)
            if (name.includes('eye')) {
              eyesMeshRef.current = child;
              child.visible = true;
              const eyeMats = Array.isArray(child.material) ? child.material : [child.material];
              eyeMats.forEach((m: any) => {
                if (m) {
                  m.transparent = false;
                  m.opacity = 1.0;
                  m.depthWrite = true;
                  m.depthTest = true;
                  m.roughness = 0.15;
                  m.needsUpdate = true;
                }
              });
            }

            // 3. Teeth mesh (Hide so cartoon teeth do not poke through closed mouth)
            if (name.includes('teeth')) {
              teethMeshRef.current = child;
              child.visible = false;
            }

            // 4. Brows and Lashes mesh (Hide so they do not overlap 2D sketch brows)
            if (name.includes('brows') || name.includes('lashes')) {
              browsMeshRef.current = child;
              child.visible = false;
            }

            // 5. Caruncula (Inner eye corner - keep visible and solid)
            if (name.includes('caruncula')) {
              carunculaMeshRef.current = child;
              child.visible = true;
              const carMats = Array.isArray(child.material) ? child.material : [child.material];
              carMats.forEach((m: any) => {
                if (m) {
                  m.transparent = false;
                  m.opacity = 1.0;
                  m.depthWrite = true;
                  m.depthTest = true;
                }
              });
            }

            // 6. Body mesh (contains head, face, neck, and torso)
            if (name.includes('body')) {
              const bodyMesh = child as THREE.SkinnedMesh;
              bodyMeshRef.current = bodyMesh;

              const bodyMat = (mats.find((m: any) => m.name === 'Body_MAT') || mats[0]) as THREE.MeshStandardMaterial;
              const reflectorMat = mats.find((m: any) => m.name === 'Reflectors');

              if (bodyMat) {
                bodyMat.transparent = false;
                bodyMat.opacity = 1.0;
                bodyMat.depthWrite = true;
                bodyMat.depthTest = true;
                if (bodyMat.map) {
                  originalTextureRef.current = bodyMat.map;
                }
              }

              if (reflectorMat) {
                reflectorMat.visible = false; // Never show mocap tracking balls
              }

              const geom = bodyMesh.geometry;
              const posAttr = geom.attributes.position;
              const vCount = posAttr.count;
              const basePos = new Float32Array(posAttr.array);
              basePositionsRef.current = basePos;

              // Precompute facial region weights with continuous Gaussian radial falloffs
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

                if (y >= 1.44 && y <= 1.76 && z > 0.005) {
                  // Mandible / Jawline
                  const dyJaw = (y - 1.51) / 0.08;
                  const dxJaw = (Math.abs(x) - 0.048) / 0.045;
                  const dzJaw = (z - 0.035) / 0.06;
                  const dSqJaw = dyJaw * dyJaw + dxJaw * dxJaw + dzJaw * dzJaw;
                  if (dSqJaw < 2.5) {
                    mandible.push({ idx: i, weight: Math.exp(-dSqJaw) });
                  }

                  // Chin
                  const dyChin = (y - 1.485) / 0.045;
                  const dxChin = x / 0.032;
                  const dzChin = (z - 0.055) / 0.04;
                  const dSqChin = dyChin * dyChin + dxChin * dxChin + dzChin * dzChin;
                  if (dSqChin < 2.5) {
                    chin.push({ idx: i, weight: Math.exp(-dSqChin) });
                  }

                  // Nose Width
                  const dyNoseW = (y - 1.595) / 0.05;
                  const dxNoseW = x / 0.032;
                  const dzNoseW = (z - 0.065) / 0.035;
                  const dSqNoseW = dyNoseW * dyNoseW + dxNoseW * dxNoseW + dzNoseW * dzNoseW;
                  if (dSqNoseW < 2.5) {
                    noseWidthArr.push({ idx: i, weight: Math.exp(-dSqNoseW) });
                  }

                  // Nose Profile
                  const dyNoseP = (y - 1.61) / 0.06;
                  const dxNoseP = x / 0.022;
                  const dzNoseP = (z - 0.068) / 0.035;
                  const dSqNoseP = dyNoseP * dyNoseP + dxNoseP * dxNoseP + dzNoseP * dzNoseP;
                  if (dSqNoseP < 2.5) {
                    noseProfileArr.push({ idx: i, weight: Math.exp(-dSqNoseP) });
                  }

                  // Zygoma / Cheeks
                  const dyZyg = (y - 1.625) / 0.045;
                  const dxZyg = (Math.abs(x) - 0.06) / 0.035;
                  const dzZyg = (z - 0.03) / 0.05;
                  const dSqZyg = dyZyg * dyZyg + dxZyg * dxZyg + dzZyg * dzZyg;
                  if (dSqZyg < 2.5) {
                    zygoma.push({ idx: i, weight: Math.exp(-dSqZyg) });
                  }

                  // Brow ridge
                  const dyBrow = (y - 1.69) / 0.035;
                  const dxBrow = (Math.abs(x) - 0.035) / 0.038;
                  const dzBrow = (z - 0.055) / 0.035;
                  const dSqBrow = dyBrow * dyBrow + dxBrow * dxBrow + dzBrow * dzBrow;
                  if (dSqBrow < 2.5) {
                    brows.push({ idx: i, weight: Math.exp(-dSqBrow) });
                  }

                  // Lips
                  const dyLip = (y - 1.545) / 0.03;
                  const dxLip = x / 0.032;
                  const dzLip = (z - 0.06) / 0.03;
                  const dSqLip = dyLip * dyLip + dxLip * dxLip + dzLip * dzLip;
                  if (dSqLip < 2.5) {
                    lips.push({ idx: i, weight: Math.exp(-dSqLip) });
                  }

                  // Eyes socket region
                  const dyEye = (y - 1.64) / 0.03;
                  const dxEye = (Math.abs(x) - 0.038) / 0.025;
                  const dzEye = (z - 0.04) / 0.03;
                  const dSqEye = dyEye * dyEye + dxEye * dxEye + dzEye * dzEye;
                  if (dSqEye < 2.5) {
                    eyesArr.push({ idx: i, weight: Math.exp(-dSqEye) });
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

        // Pose arms naturally down along the torso so hands never protrude into bust view
        const leftArm = model.getObjectByName('mixamorig:LeftArm');
        const rightArm = model.getObjectByName('mixamorig:RightArm');
        if (leftArm) {
          leftArm.rotation.set(0, 0, -1.28);
        }
        if (rightArm) {
          rightArm.rotation.set(0, 0, 1.28);
        }

        scene.add(model);
        setModelLoading(false);
        setModelReady(true);
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
    };
  }, []);

  // Helper: Bulletproof image source loader that handles Blob, DataURL, API files, and CORS
  const fetchImageSource = async (url: string): Promise<CanvasImageSource> => {
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load blob/data image'));
        img.src = url;
      });
    }

    if (url.includes('/api/files/') || url.startsWith('/')) {
      try {
        const res = await api.get(url, { responseType: 'blob' });
        if (res.data && res.data.size > 0) {
          if (typeof createImageBitmap === 'function') {
            try {
              return await createImageBitmap(res.data);
            } catch (e) {
              console.warn('createImageBitmap failed, trying FileReader:', e);
            }
          }
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = reader.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(res.data);
          });
        }
      } catch (e) {
        console.warn('api.get blob fetch failed, trying fetch fallback:', e);
      }
    }

    try {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        if (typeof createImageBitmap === 'function') {
          try {
            return await createImageBitmap(blob);
          } catch (e) {}
        }
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = reader.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {}

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        const retryImg = new Image();
        retryImg.onload = () => resolve(retryImg);
        retryImg.onerror = () => reject(new Error(`Failed to load image from ${url}`));
        retryImg.src = url;
      };
      img.src = url;
    });
  };

  // Helper: Load base 2048x2048 diffuse map
  const loadBaseDiffuseTexture = async (): Promise<CanvasImageSource> => {
    try {
      const res = await fetch('/models/mocap_diffuse_extracted.png');
      if (res.ok) {
        const blob = await res.blob();
        if (typeof createImageBitmap === 'function') {
          return await createImageBitmap(blob);
        }
      }
    } catch (e) {}

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = '/models/mocap_diffuse_extracted.png';
    });
  };

  // 2. Make 2D Image into a Three.js Texture and Add directly to 3D Model Face
  const applyFaceTexture = async (imgUrl?: string) => {
    if (!bodyMeshRef.current || !imgUrl) return;

    const mats = Array.isArray(bodyMeshRef.current.material)
      ? bodyMeshRef.current.material
      : [bodyMeshRef.current.material];
    const bodyMat = (mats.find((m: any) => m.name === 'Body_MAT') || mats[0]) as THREE.MeshStandardMaterial;
    const reflectorMat = mats.find((m: any) => m.name === 'Reflectors');

    if (reflectorMat) {
      reflectorMat.visible = false;
    }

    if (!bodyMat) return;

    // Keep 3D eyes solid and visible so they are never missing
    if (eyesMeshRef.current) {
      eyesMeshRef.current.visible = true;
      const eyeMats = Array.isArray((eyesMeshRef.current as any).material)
        ? (eyesMeshRef.current as any).material
        : [(eyesMeshRef.current as any).material];
      eyeMats.forEach((m: any) => {
        if (m) {
          m.transparent = false;
          m.opacity = 1.0;
          m.depthWrite = true;
          m.depthTest = true;
          m.roughness = 0.15;
          m.needsUpdate = true;
        }
      });
    }
    if (carunculaMeshRef.current) carunculaMeshRef.current.visible = true;
    if (teethMeshRef.current) teethMeshRef.current.visible = false;
    if (browsMeshRef.current) browsMeshRef.current.visible = false;

    // Cache key incorporates image URL and jaw width so texture adapts to morphological changes
    const dJaw = (jawWidth - 50) / 50;
    const dNoseP = (noseProfile - 50) / 50;
    const bakeKey = `${imgUrl}__j${Math.round(jawWidth)}__n${Math.round(noseProfile)}`;

    if (compositedTextureRef.current && lastBakedKeyRef.current === bakeKey) {
      bodyMat.map = compositedTextureRef.current;
      bodyMat.map.needsUpdate = true;
      bodyMat.needsUpdate = true;
      setTextureStatus('pasted');
      return;
    }

    setTextureStatus('baking');

    try {
      const sketchSource = await fetchImageSource(imgUrl);

      if (!baseImgRef.current) {
        baseImgRef.current = await loadBaseDiffuseTexture();
      }
      const baseSource = baseImgRef.current;

      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 2048;
      const ctx = canvas.getContext('2d')!;

      // Draw base skin and suit
      ctx.drawImage(baseSource, 0, 0, 2048, 2048);

      // Dynamically scale face texture patch according to jaw width and profile
      const destW = Math.round(760 * (1.0 + dJaw * 0.14));
      const destH = Math.round(880 * (1.0 + dNoseP * 0.08));
      const destX = Math.round(546 - destW * 0.5);
      const destY = Math.round(692 - destH * 0.40);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = destW;
      tempCanvas.height = destH;
      const tctx = tempCanvas.getContext('2d')!;

      tctx.drawImage(sketchSource, 0, 0, destW, destH);

      // Feather edges with smooth elliptical gradient
      tctx.globalCompositeOperation = 'destination-in';
      const cx = destW * 0.5;
      const cy = destH * 0.48;
      const rx = destW * 0.46;
      const ry = destH * 0.48;

      tctx.save();
      tctx.translate(cx, cy);
      tctx.scale(rx, ry);
      const grad = tctx.createRadialGradient(0, 0, 0.40, 0, 0, 1.0);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      grad.addColorStop(0.68, 'rgba(0, 0, 0, 0.98)');
      grad.addColorStop(0.86, 'rgba(0, 0, 0, 0.60)');
      grad.addColorStop(0.96, 'rgba(0, 0, 0, 0.15)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      tctx.fillStyle = grad;
      tctx.beginPath();
      tctx.arc(0, 0, 1.0, 0, Math.PI * 2);
      tctx.fill();
      tctx.restore();

      // Paste onto facial UV region on diffuse map
      ctx.drawImage(tempCanvas, destX, destY);

      // Create Three.js Texture directly from the canvas
      const faceTexture = new THREE.CanvasTexture(canvas);
      faceTexture.colorSpace = THREE.SRGBColorSpace;
      faceTexture.flipY = false;
      faceTexture.wrapS = THREE.ClampToEdgeWrapping;
      faceTexture.wrapT = THREE.ClampToEdgeWrapping;
      faceTexture.generateMipmaps = true;
      faceTexture.minFilter = THREE.LinearMipmapLinearFilter;
      faceTexture.magFilter = THREE.LinearFilter;
      faceTexture.needsUpdate = true;

      compositedTextureRef.current = faceTexture;
      lastBakedKeyRef.current = bakeKey;

      bodyMat.map = faceTexture;
      bodyMat.map.needsUpdate = true;
      bodyMat.transparent = false;
      bodyMat.opacity = 1.0;
      bodyMat.depthWrite = true;
      bodyMat.depthTest = true;
      bodyMat.needsUpdate = true;

      if (Array.isArray(bodyMeshRef.current?.material)) {
        bodyMeshRef.current.material = [...bodyMeshRef.current.material];
      }

      setTextureStatus('pasted');
    } catch (err) {
      console.error('Failed to paste 2D face texture:', err);
      setTextureStatus('failed');
    }
  };

  // Re-apply face texture whenever imageUrl or modelReady changes
  useEffect(() => {
    if (modelReady && imageUrl) {
      applyFaceTexture(imageUrl);
    }
  }, [imageUrl, modelReady]);

  // 3. Real-time Facial Structure Morphing on character.fbx based on suspect parameters
  useEffect(() => {
    if (!bodyMeshRef.current || !basePositionsRef.current || !facialIndicesRef.current) return;

    const geom = bodyMeshRef.current.geometry;
    const posAttr = geom.attributes.position;
    const currentPos = posAttr.array as Float32Array;
    const basePos = basePositionsRef.current;
    const fac = facialIndicesRef.current;

    // Reset base positions
    currentPos.set(basePos);

    // Compute slider deltas (-1.0 to +1.0 centered at 50)
    const dJaw = (jawWidth - 50) / 50;
    const dNoseW = (noseWidth - 50) / 50;
    const dNoseP = (noseProfile - 50) / 50;
    const dEye = (eyeSize - 50) / 50;
    const dBrow = (browDensity - 50) / 50;
    const dLip = (lipFullness - 50) / 50;

    let shapeJawX = 0;
    let shapeChinZ = 0;
    let shapeChinY = 0;
    let shapeZygX = 0;
    let shapeHeadX = 0;
    let shapeHeadY = 0;
    let shapeHeadZ = 0;

    const fShape = (faceShape || '').toLowerCase();
    if (fShape.includes('square')) {
      shapeJawX = 0.016;
      shapeChinZ = 0.008;
      shapeHeadX = 0.07;
      shapeHeadZ = 0.04;
    } else if (fShape.includes('diamond')) {
      shapeZygX = 0.018;
      shapeJawX = -0.010;
      shapeHeadX = 0.04;
      shapeHeadY = 0.03;
    } else if (fShape.includes('round')) {
      shapeZygX = 0.014;
      shapeJawX = 0.008;
      shapeHeadX = 0.06;
      shapeHeadY = -0.04;
    } else if (fShape.includes('heart')) {
      shapeJawX = -0.014;
      shapeChinZ = 0.009;
      shapeHeadX = -0.05;
      shapeHeadZ = 0.03;
    } else if (fShape.includes('oblong')) {
      shapeJawX = -0.008;
      shapeHeadX = -0.04;
      shapeHeadY = 0.07;
    }

    const cStyle = (chinStyle || '').toLowerCase();
    if (cStyle.includes('square') || cStyle.includes('heavy')) {
      shapeJawX += 0.012;
      shapeChinZ += 0.010;
      shapeHeadX += 0.05;
      shapeHeadZ += 0.03;
    } else if (cStyle.includes('pointed') || cStyle.includes('sharp')) {
      shapeJawX -= 0.012;
      shapeChinZ += 0.012;
      shapeChinY -= 0.008;
      shapeHeadX -= 0.05;
      shapeHeadZ += 0.04;
    } else if (cStyle.includes('receding')) {
      shapeChinZ -= 0.014;
      shapeHeadZ -= 0.05;
    }

    // 1. Mandible / Jaw Width (Visibly flares outwards on X and forwards on Z)
    fac.mandible.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      const x0 = basePos[pIdx];
      const deltaX = (dJaw * 0.026 + shapeJawX) * weight;
      const deltaZ = (dJaw * 0.012) * weight;
      currentPos[pIdx] = x0 + Math.sign(x0) * deltaX;
      currentPos[pIdx + 2] = basePos[pIdx + 2] + deltaZ;
    });

    // 2. Chin projection & vertical length
    fac.chin.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      const deltaZ = (dJaw * 0.020 + shapeChinZ) * weight;
      const deltaY = (shapeChinY) * weight;
      currentPos[pIdx + 1] = basePos[pIdx + 1] + deltaY;
      currentPos[pIdx + 2] = basePos[pIdx + 2] + deltaZ;
    });

    // 3. Nose Width
    fac.noseWidth.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      const x0 = basePos[pIdx];
      currentPos[pIdx] = x0 + Math.sign(x0) * (dNoseW * 0.016) * weight;
    });

    // 4. Nose Profile (Dorsal hump & bridge projection)
    fac.noseProfile.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      currentPos[pIdx + 2] = basePos[pIdx + 2] + (dNoseP * 0.024) * weight;
    });

    // 5. Zygoma (Cheekbones)
    fac.zygoma.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      const x0 = basePos[pIdx];
      currentPos[pIdx] = x0 + Math.sign(x0) * (shapeZygX * 1.5 + (jawWidth > 60 ? 0.012 : -0.008)) * weight;
    });

    // 6. Brow Ridge
    fac.brows.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      currentPos[pIdx + 2] = basePos[pIdx + 2] + (dBrow * 0.014) * weight;
    });

    // 7. Lips
    fac.lips.forEach(({ idx, weight }) => {
      const pIdx = idx * 3;
      currentPos[pIdx + 2] = basePos[pIdx + 2] + (dLip * 0.015) * weight;
    });

    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
    geom.computeBoundingSphere();

    // 8. Scale Head Bone so entire head skeleton and eyes deform in sync
    if (headBoneRef.current) {
      headBoneRef.current.scale.set(
        1.0 + dJaw * 0.16 + shapeHeadX,
        1.0 + (50 - jawWidth) * 0.03 + shapeHeadY,
        1.0 + dNoseP * 0.08 + shapeHeadZ
      );
    }

    // 9. Scale Eyes mesh
    if (eyesMeshRef.current) {
      eyesMeshRef.current.scale.set(
        1.0 + dEye * 0.12,
        1.0 + dEye * 0.15,
        1.0 + dEye * 0.10
      );
    }
  }, [jawWidth, noseWidth, noseProfile, eyeSize, browDensity, lipFullness, ageYears, faceShape, chinStyle]);

  // 4. Toggle Hat / Cap visibility ("without their cap as reference")
  useEffect(() => {
    if (hatMeshRef.current) {
      hatMeshRef.current.visible = showCap;
    }
  }, [showCap]);

  // 5. Preset Camera Angles
  const setCameraAngle = (angle: 'front' | 'threeQuarter' | 'profile') => {
    if (!cameraRef.current || !controlsRef.current || !characterModelRef.current) return;
    setActiveAngle(angle);

    characterModelRef.current.rotation.y = 0;

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
                character.fbx 3D Suspect Reconstruction
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                Morphology Adaptive
              </span>
            </div>
            <p className="text-[10px] text-parchment-400 font-mono">
              2D Face Pasted on 3D Bust &bull; Real-time Anatomical Morph &bull; Natural Scalp (No Cap)
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
                2D Case Sketch (Source)
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                Pasted to 3D
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
                  <p className="text-[10px] text-parchment-400">Generate a sketch to paste its face on the 3D model</p>
                </div>
              )}

              <div className="absolute bottom-2 left-2 z-10">
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-noir-900/90 text-emerald-400 border border-noir-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  2D Face Projection Active
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
            {/* Top Right Toolbars: Clean Cap Toggle Only */}
            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 bg-slate-900/95 p-1 rounded-lg border border-slate-700/80 backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={() => setShowCap(!showCap)}
                className={`px-3 py-1 rounded text-[11px] font-mono font-bold transition-all ${
                  showCap
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700'
                }`}
                title="Toggle Cap on/off"
              >
                Cap: {showCap ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Top Left Live Status Pill in 3D Viewport */}
            <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
              {textureStatus === 'pasted' && (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/80 shadow-md flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  2D Face Texture Baked & Active
                </span>
              )}
              {textureStatus === 'baking' && (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-amber-950/90 text-amber-300 border border-amber-500/80 shadow-md flex items-center gap-1.5 animate-pulse">
                  <div className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  Baking 2D Sketch Texture...
                </span>
              )}
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
