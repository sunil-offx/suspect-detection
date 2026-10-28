import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Box, Play, Pause, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';

interface ModelViewer3DProps {
  modelUrl?: string;
  className?: string;
  height?: string | number;
}

export const ModelViewer3D: React.FC<ModelViewer3DProps> = ({
  modelUrl = '/models/Ch31_nonPBR.fbx',
  className = '',
  height = '420px',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // Keep references to controls & animation mixer across renders
  const controlsRef = useRef<OrbitControls | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth || 400;
    const heightPx = typeof height === 'number' ? height : parseInt(height as string, 10) || 420;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712); // slate-950

    // Subtle atmospheric fog for forensic depth
    scene.fog = new THREE.FogExp2(0x030712, 0.05);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 1000);
    camera.position.set(0, 1.4, 3.2);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minDistance = 0.8;
    controls.maxDistance = 8.0;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Prevent camera going below floor
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.2;
    controlsRef.current = controls;

    // 5. Lighting Setup (Forensic Studio Lighting)
    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    // Key Light (warm studio white)
    const keyLight = new THREE.DirectionalLight(0xfff8ee, 2.5);
    keyLight.position.set(4, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    // Fill Light (cool forensic blue)
    const fillLight = new THREE.DirectionalLight(0x60a5fa, 1.8);
    fillLight.position.set(-4, 5, -2);
    scene.add(fillLight);

    // Cyan Rim Light (silhouette definition)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
    rimLight.position.set(0, 6, -5);
    scene.add(rimLight);

    // Subtle ground spotlight
    const floorSpot = new THREE.SpotLight(0x2563eb, 3.0, 10, Math.PI / 4, 0.4, 1.0);
    floorSpot.position.set(0, 6, 0);
    floorSpot.target.position.set(0, 0, 0);
    scene.add(floorSpot);
    scene.add(floorSpot.target);

    // 6. Ground Pedestal & Forensic Coordinate Grid
    const gridHelper = new THREE.GridHelper(6, 24, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Concentric forensic boundary circle
    const circleGeo = new THREE.RingGeometry(0.8, 0.82, 64);
    const circleMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
    const circleMesh = new THREE.Mesh(circleGeo, circleMat);
    circleMesh.rotation.x = Math.PI / 2;
    circleMesh.position.y = 0.005;
    scene.add(circleMesh);

    // Shadow receiver floor plane
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.001;
    floor.receiveShadow = true;
    scene.add(floor);

    // 7. Load FBX Model
    setLoading(true);
    setError(null);
    const loader = new FBXLoader();

    let mixer: THREE.AnimationMixer | null = null;
    let initialCamPos = camera.position.clone();
    let initialTarget = controls.target.clone();

    loader.load(
      modelUrl,
      (fbx) => {
        // Compute bounding box
        const bbox = new THREE.Box3().setFromObject(fbx);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());

        // Target normal human height ~ 1.8 units
        const modelHeight = size.y || 1;
        const targetHeight = 1.85;
        const scale = targetHeight / modelHeight;
        fbx.scale.setScalar(scale);

        // Recalculate bounding box after scaling
        const scaledBox = new THREE.Box3().setFromObject(fbx);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        // Align horizontally centered and feet resting exactly on grid floor (y=0)
        fbx.position.x = -scaledCenter.x;
        fbx.position.z = -scaledCenter.z;
        fbx.position.y = -scaledBox.min.y;

        // Traverse mesh children to optimize materials, shadows, and normals
        fbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((mat) => {
                if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
                  mat.side = THREE.DoubleSide;
                  mat.needsUpdate = true;
                }
              });
            }
          }
        });

        scene.add(fbx);

        // Position camera to frame the standing suspect
        const headHeight = targetHeight * 0.85;
        controls.target.set(0, headHeight * 0.65, 0);
        camera.position.set(0, headHeight * 0.8, targetHeight * 1.5);
        controls.update();

        initialCamPos = camera.position.clone();
        initialTarget = controls.target.clone();
        resetCameraRef.current = () => {
          camera.position.copy(initialCamPos);
          controls.target.copy(initialTarget);
          controls.update();
        };

        // Handle animation if embedded
        if (fbx.animations && fbx.animations.length > 0) {
          mixer = new THREE.AnimationMixer(fbx);
          mixerRef.current = mixer;
          const action = mixer.clipAction(fbx.animations[0]);
          action.play();
        }

        setLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          const percent = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
          setProgress(percent);
        } else if (xhr.loaded > 0) {
          // If total is not provided by server headers, estimate based on ~53MB
          const estimatedTotal = 53924544;
          const percent = Math.min(99, Math.round((xhr.loaded / estimatedTotal) * 100));
          setProgress(percent);
        }
      },
      (err) => {
        console.error('Failed to load FBX model:', err);
        setError('Unable to load 3D suspect morphology model.');
        setLoading(false);
      }
    );

    // 8. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = typeof height === 'number' ? height : parseInt(height as string, 10) || 420;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 9. Animation Render Loop
    const clock = new THREE.Clock();
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (mixer) {
        mixer.update(delta);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl, height]);

  // Sync autoRotate state with controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col items-center justify-center select-none ${className}`}
      style={{ height }}
    >
      {/* ThreeJS WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Header Overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-800 text-xs font-semibold text-slate-200 shadow-md">
          <Box className="w-3.5 h-3.5 text-blue-400" />
          <span>3D Suspect Morphology</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
            FBX
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setAutoRotate((prev) => !prev)}
            title={autoRotate ? 'Pause 360° Rotation' : 'Start 360° Rotation'}
            className="p-1.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shadow-sm"
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => resetCameraRef.current?.()}
            title="Reset Camera View"
            className="p-1.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3 shadow-lg shadow-blue-500/10">
            <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
          </div>
          <h4 className="text-sm font-semibold text-white tracking-wide">Loading 3D Forensic Suspect Model</h4>
          <p className="text-xs text-slate-400 mt-1">Initializing geometry, materials, and rigging...</p>

          <div className="w-48 bg-slate-800 rounded-full h-1.5 mt-4 overflow-hidden border border-slate-700">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-blue-400 mt-1.5">{progress}%</span>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-10 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
          <p className="text-xs text-slate-300 max-w-xs">{error}</p>
        </div>
      )}

      {/* Bottom Guidance Overlay */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[10px] text-slate-400 tracking-wider">
          Drag to rotate • Scroll to zoom • Right-click to pan
        </span>
      </div>
    </div>
  );
};
