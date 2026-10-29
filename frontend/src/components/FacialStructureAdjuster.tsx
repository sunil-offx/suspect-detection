import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Sparkles,
  RotateCcw,
  RefreshCw,
  User,
  Eye,
  Check,
  ChevronDown,
  Info,
  Box,
  Compass,
} from 'lucide-react';
import { GNMHeadViewer3D } from './GNMHeadViewer3D';

export interface FacialFeatureDeltas {
  face_shape?: string;
  jawline?: string;
  hair_style?: string;
  hair_color?: string;
  eye_shape?: string;
  eyebrows?: string;
  nose_shape?: string;
  lips?: string;
  facial_hair?: string;
  build?: string;
  estimated_age?: string;
  accessories?: string;
  scars_marks?: string;
  [key: string]: string | undefined;
}

interface Props {
  initialFeatures: Record<string, string | null>;
  onApplyAdjustments: (deltas: FacialFeatureDeltas, summaryText: string) => Promise<void>;
  isGenerating?: boolean;
  currentImageUrl?: string;
}

export const FacialStructureAdjuster: React.FC<Props> = ({
  initialFeatures,
  onApplyAdjustments,
  isGenerating = false,
  currentImageUrl,
}) => {
  // Current feature deltas
  const [features, setFeatures] = useState<FacialFeatureDeltas>({});

  // Active category tab: 'jaw' | 'eyes' | 'nose' | 'lips' | 'hair'
  const [activeTab, setActiveTab] = useState<'jaw' | 'eyes' | 'nose' | 'lips' | 'hair'>('jaw');

  // Blueprint display mode: '3d-gnm' (default) | '2d-blueprint'
  const [blueprintMode, setBlueprintMode] = useState<'3d-gnm' | '2d-blueprint'>('3d-gnm');

  // Interactive numeric sliders for morphological wireframe morphing (0 to 100)
  const [jawWidth, setJawWidth] = useState<number>(50); // 0 = sharp narrow chin, 100 = wide heavy square jaw
  const [noseWidth, setNoseWidth] = useState<number>(50); // 0 = slender narrow, 100 = broad flared
  const [noseProfile, setNoseProfile] = useState<number>(50); // 0 = button/upturned, 100 = aquiline/hooked
  const [eyeSize, setEyeSize] = useState<number>(50); // 0 = narrow/hooded, 100 = wide/prominent
  const [browDensity, setBrowDensity] = useState<number>(50); // 0 = thin/sparse, 100 = heavy/bushy
  const [lipFullness, setLipFullness] = useState<number>(50); // 0 = thin compressed, 100 = full pout
  const [ageYears, setAgeYears] = useState<number>(30); // 18 to 75

  // Initialize from existing report features
  useEffect(() => {
    const clean: FacialFeatureDeltas = {};
    Object.entries(initialFeatures).forEach(([k, v]) => {
      if (v && v !== 'unspecified' && v !== 'null') {
        clean[k] = v;
      }
    });
    setFeatures(clean);

    // Seed sliders based on existing values if recognized
    if (clean.jawline?.toLowerCase().includes('square') || clean.jawline?.toLowerCase().includes('wide')) {
      setJawWidth(75);
    } else if (clean.jawline?.toLowerCase().includes('pointed') || clean.jawline?.toLowerCase().includes('narrow') || clean.jawline?.toLowerCase().includes('v-shape')) {
      setJawWidth(25);
    }

    if (clean.nose_shape?.toLowerCase().includes('broad') || clean.nose_shape?.toLowerCase().includes('wide')) {
      setNoseWidth(75);
    } else if (clean.nose_shape?.toLowerCase().includes('narrow') || clean.nose_shape?.toLowerCase().includes('thin')) {
      setNoseWidth(25);
    }

    if (clean.lips?.toLowerCase().includes('full') || clean.lips?.toLowerCase().includes('thick')) {
      setLipFullness(75);
    } else if (clean.lips?.toLowerCase().includes('thin') || clean.lips?.toLowerCase().includes('narrow')) {
      setLipFullness(25);
    }

    if (clean.estimated_age) {
      const match = clean.estimated_age.match(/\d+/);
      if (match) setAgeYears(Math.min(75, Math.max(18, parseInt(match[0], 10))));
    }
  }, [initialFeatures]);

  // Handle slider adjustments and synchronize with semantic feature tags
  const handleJawSlider = (val: number) => {
    setJawWidth(val);
    let desc = 'Balanced oval jaw';
    if (val < 30) desc = 'Sharp pointed narrow V-shaped chin';
    else if (val < 45) desc = 'Slightly tapered narrow jawline';
    else if (val > 70) desc = 'Prominent wide heavy square jaw';
    else if (val > 55) desc = 'Defined angular jawline';
    setFeatures((prev) => ({ ...prev, jawline: desc }));
  };

  const handleNoseWidthSlider = (val: number) => {
    setNoseWidth(val);
    let desc = 'Proportionate straight nasal bridge';
    if (val < 30) desc = 'Slender narrow pinched nasal bridge';
    else if (val < 45) desc = 'Relatively narrow straight nose';
    else if (val > 70) desc = 'Broad flared wide nasal bridge';
    else if (val > 55) desc = 'Slightly wide nasal base';
    setFeatures((prev) => ({ ...prev, nose_shape: desc }));
  };

  const handleNoseProfileSlider = (val: number) => {
    setNoseProfile(val);
    let desc = features.nose_shape || 'Straight';
    if (val > 70) desc += ', prominent aquiline dorsal hump';
    else if (val < 30) desc += ', slightly upturned button tip';
    setFeatures((prev) => ({ ...prev, nose_shape: desc }));
  };

  const handleEyeSizeSlider = (val: number) => {
    setEyeSize(val);
    let desc = 'Proportionate almond eye aperture';
    if (val < 30) desc = 'Deep-set hooded narrow squinting eyes';
    else if (val < 45) desc = 'Hooded monolid / narrow eyes';
    else if (val > 70) desc = 'Large wide-open round prominent eyes';
    else if (val > 55) desc = 'Alert round eyes';
    setFeatures((prev) => ({ ...prev, eye_shape: desc }));
  };

  const handleBrowDensitySlider = (val: number) => {
    setBrowDensity(val);
    let desc = 'Natural medium eyebrows';
    if (val > 65) desc = 'Heavy thick bushy low-set eyebrows';
    else if (val < 35) desc = 'Thin sparse lightly arched eyebrows';
    setFeatures((prev) => ({ ...prev, eyebrows: desc }));
  };

  const handleLipFullnessSlider = (val: number) => {
    setLipFullness(val);
    let desc = 'Medium proportional lips';
    if (val > 70) desc = 'Full prominent fleshy vermilion lips';
    else if (val > 55) desc = 'Plump lower lip, defined cupid bow';
    else if (val < 30) desc = 'Thin compressed slender tight lips';
    else if (val < 45) desc = 'Narrow linear upper and lower lips';
    setFeatures((prev) => ({ ...prev, lips: desc }));
  };

  const handleAgeSlider = (val: number) => {
    setAgeYears(val);
    setFeatures((prev) => ({ ...prev, estimated_age: `${val - 2} to ${val + 3} years old` }));
  };

  // Pre-configured forensic morphology options
  const presets = {
    face_shape: [
      'Square Angular',
      'Oval Symmetrical',
      'Round Full-Cheeked',
      'Oblong Long',
      'Heart-Shaped',
      'Diamond Cheekbones',
      'Triangular Jaw',
    ],
    jawline: [
      'Square Heavy Mandible',
      'Sharp Pointed Chin',
      'Soft Rounded Chin',
      'Defined Chiseled Jaw',
      'Receding Weak Chin',
      'Cleft Chin',
      'Wide Mandibular Angle',
    ],
    eye_shape: [
      'Deep-Set Hooded',
      'Almond Symmetrical',
      'Round Alert',
      'Monolid Epicanthic',
      'Downturned Corners',
      'Wide-Spaced',
      'Narrow Squinting',
    ],
    eyebrows: [
      'Straight Low-Set',
      'High Arched',
      'Thick Bushy Unibrow-Prone',
      'Thin Sparse',
      'Angular Slanted',
    ],
    nose_shape: [
      'Aquiline / Hooked Dorsal',
      'Straight Classical Greek',
      'Button Upturned',
      'Broad Flared Nostrils',
      'Crooked Deviated Septum',
      'Pointed Slender Tip',
    ],
    lips: [
      'Full Pouty Lips',
      'Thin Linear Lips',
      'Prominent Cupid Bow',
      'Full Lower Lip Only',
      'Wide Slender Mouth',
      'Compressed Tight Lips',
    ],
    hair_style: [
      'Short Fade Crop',
      'Crew Cut',
      'Wavy Parted',
      'Curly Tight Fade',
      'Receding Hairline',
      'Bald Shaved Head',
      'Comb Over',
    ],
    facial_hair: [
      'Clean Shaven',
      'Heavy 5-O-Clock Shadow',
      'Trimmed Neat Goatee',
      'Full Thick Beard',
      'Classic Mustache',
      'Rough Stubble',
    ],
  };

  // Calculate modifications relative to original report
  const changedFeatures: Array<{ key: string; orig: string; current: string }> = [];
  Object.keys(features).forEach((k) => {
    const origVal = (initialFeatures[k] || '').trim();
    const currVal = (features[k] || '').trim();
    if (currVal && currVal !== origVal) {
      changedFeatures.push({ key: k, orig: origVal || 'Neutral', current: currVal });
    }
  });

  const handleReset = () => {
    const clean: FacialFeatureDeltas = {};
    Object.entries(initialFeatures).forEach(([k, v]) => {
      if (v && v !== 'unspecified' && v !== 'null') {
        clean[k] = v;
      }
    });
    setFeatures(clean);
    setJawWidth(50);
    setNoseWidth(50);
    setNoseProfile(50);
    setEyeSize(50);
    setBrowDensity(50);
    setLipFullness(50);
    setAgeYears(30);
  };

  const handleApply = async () => {
    const summaryParts: string[] = [];
    if (changedFeatures.length > 0) {
      changedFeatures.forEach((c) => {
        summaryParts.push(`${c.key.replace(/_/g, ' ')}: ${c.current}`);
      });
    } else {
      summaryParts.push('Fine anatomical structure tuning');
    }
    const summaryText = `Interactive structure adjustment: ${summaryParts.join('; ')}`;
    await onApplyAdjustments(features, summaryText);
  };

  return (
    <div className="dossier-card p-6 sm:p-8 space-y-6 shadow-dossier border-2 border-parchment-border">
      {/* Header & Controls summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-parchment-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-crimson-800 text-white flex items-center justify-center shadow-sm">
              <Sliders className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-ink-950 font-serif">Adjustable Facial Structure Workbench</h2>
          </div>
          <p className="text-xs text-ink-800 font-medium">
            Modify suspect facial anatomy interactively using forensic sliders and morphology presets.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {changedFeatures.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-md bg-crimson-100 text-crimson-900 font-mono font-extrabold border border-crimson-300">
              {changedFeatures.length} {changedFeatures.length === 1 ? 'Feature' : 'Features'} Adjusted
            </span>
          )}
          <button
            onClick={handleReset}
            disabled={isGenerating || changedFeatures.length === 0}
            className="px-3 py-1.5 rounded-lg btn-parchment text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Interactive Morphology Controls & Category Tabs (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Navigation Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-parchment-cardAlt rounded-xl border border-parchment-border overflow-x-auto">
            <button
              onClick={() => setActiveTab('jaw')}
              className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'jaw'
                  ? 'bg-crimson-800 text-white shadow-sm'
                  : 'text-ink-900 hover:text-black hover:bg-parchment-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Jaw & Head
            </button>
            <button
              onClick={() => setActiveTab('eyes')}
              className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'eyes'
                  ? 'bg-crimson-800 text-white shadow-sm'
                  : 'text-ink-900 hover:text-black hover:bg-parchment-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Eyes & Brows
            </button>
            <button
              onClick={() => setActiveTab('nose')}
              className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'nose'
                  ? 'bg-crimson-800 text-white shadow-sm'
                  : 'text-ink-900 hover:text-black hover:bg-parchment-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Nose & Midface
            </button>
            <button
              onClick={() => setActiveTab('lips')}
              className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'lips'
                  ? 'bg-crimson-800 text-white shadow-sm'
                  : 'text-ink-900 hover:text-black hover:bg-parchment-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Mouth & Lips
            </button>
            <button
              onClick={() => setActiveTab('hair')}
              className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'hair'
                  ? 'bg-crimson-800 text-white shadow-sm'
                  : 'text-ink-900 hover:text-black hover:bg-parchment-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Hair & Beard
            </button>
          </div>

          {/* TAB 1: JAW & HEAD */}
          {activeTab === 'jaw' && (
            <div className="space-y-6 bg-parchment-50 p-5 rounded-2xl border border-parchment-border">
              {/* Jaw Width & Prominence Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-950">Jaw Width & Angularity</span>
                  <span className="text-crimson-900 font-mono text-[11px] font-bold">
                    {jawWidth > 60 ? 'Wide / Angular' : jawWidth < 40 ? 'Narrow / Pointed' : 'Balanced'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={jawWidth}
                  onChange={(e) => handleJawSlider(Number(e.target.value))}
                  className="w-full accent-crimson-800 cursor-pointer h-2 bg-parchment-200 rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-ink-700 font-mono font-bold">
                  <span>Narrow V-Chin</span>
                  <span>Proportionate</span>
                  <span>Heavy Square Mandible</span>
                </div>
              </div>

              {/* Face Shape Presets */}
              <div className="space-y-2 pt-2 border-t border-parchment-border">
                <label className="text-xs font-bold text-ink-950 block">Face Shape Morphology</label>
                <div className="flex flex-wrap gap-2">
                  {presets.face_shape.map((preset) => {
                    const isSelected = (features.face_shape || '').toLowerCase().includes(preset.toLowerCase().slice(0, 4));
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFeatures((prev) => ({ ...prev, face_shape: preset }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-crimson-800 text-white shadow-sm border-crimson-900'
                            : 'bg-white text-ink-950 hover:bg-parchment-200 border-parchment-border'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Jawline Presets */}
              <div className="space-y-2 pt-2 border-t border-parchment-border">
                <label className="text-xs font-bold text-ink-950 block">Jaw & Chin Contours</label>
                <div className="flex flex-wrap gap-2">
                  {presets.jawline.map((preset) => {
                    const isSelected = (features.jawline || '').toLowerCase().includes(preset.toLowerCase().slice(0, 5));
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFeatures((prev) => ({ ...prev, jawline: preset }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-crimson-800 text-white shadow-sm border-crimson-900'
                            : 'bg-white text-ink-950 hover:bg-parchment-200 border-parchment-border'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EYES & BROWS */}
          {activeTab === 'eyes' && (
            <div className="space-y-6 bg-parchment-50 p-5 rounded-2xl border border-parchment-border">
              {/* Eye Aperture Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-950">Eye Aperture & Lid Prominence</span>
                  <span className="text-crimson-900 font-mono text-[11px] font-bold">
                    {eyeSize > 60 ? 'Wide / Alert' : eyeSize < 40 ? 'Narrow / Hooded' : 'Balanced'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={eyeSize}
                  onChange={(e) => handleEyeSizeSlider(Number(e.target.value))}
                  className="w-full accent-crimson-800 cursor-pointer h-2 bg-parchment-200 rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-ink-700 font-mono font-bold">
                  <span>Deep Hooded / Squint</span>
                  <span>Proportionate</span>
                  <span>Round & Prominent</span>
                </div>
              </div>

              {/* Brow Density Slider */}
              <div className="space-y-2 pt-2 border-t border-parchment-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-950">Eyebrow Density & Thickness</span>
                  <span className="text-crimson-900 font-mono text-[11px] font-bold">
                    {browDensity > 60 ? 'Thick / Bushy' : browDensity < 40 ? 'Fine / Sparse' : 'Natural'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={browDensity}
                  onChange={(e) => handleBrowDensitySlider(Number(e.target.value))}
                  className="w-full accent-crimson-800 cursor-pointer h-2 bg-parchment-200 rounded-lg"
                />
              </div>

              {/* Eye Shape Presets */}
              <div className="space-y-2 pt-2 border-t border-parchment-border">
                <label className="text-xs font-bold text-ink-950 block">Eye Shape Presets</label>
                <div className="flex flex-wrap gap-2">
                  {presets.eye_shape.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFeatures((prev) => ({ ...prev, eye_shape: preset }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        (features.eye_shape || '').includes(preset)
                          ? 'bg-crimson-800 text-white shadow-sm border-crimson-900'
                          : 'bg-white text-ink-950 hover:bg-parchment-200 border-parchment-border'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eyebrow Style Presets */}
              <div className="space-y-2 pt-2 border-t border-parchment-border">
                <label className="text-xs font-bold text-ink-950 block">Eyebrow Arch & Contour</label>
                <div className="flex flex-wrap gap-2">
                  {presets.eyebrows.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFeatures((prev) => ({ ...prev, eyebrows: preset }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        (features.eyebrows || '').includes(preset)
                          ? 'bg-crimson-800 text-white shadow-sm border-crimson-900'
                          : 'bg-white text-ink-950 hover:bg-parchment-200 border-parchment-border'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NOSE & MIDFACE */}
          {activeTab === 'nose' && (
            <div className="space-y-6 bg-parchment-50 p-5 rounded-2xl border border-parchment-border">
              {/* Nose Bridge Width */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-950">Nose Bridge Width</span>
                  <span className="text-crimson-900 font-mono text-[11px] font-bold">
                    {noseWidth > 60 ? 'Broad / Flared' : noseWidth < 40 ? 'Narrow / Slender' : 'Standard'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={noseWidth}
                  onChange={(e) => handleNoseWidthSlider(Number(e.target.value))}
                  className="w-full accent-crimson-800 cursor-pointer h-2 bg-parchment-200 rounded-lg"
                />
              </div>

              {/* Nose Profile (Hook vs Button) */}
              <div className="space-y-2 pt-2 border-t border-parchment-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-950">Nasal Profile (Dorsal Hump / Upturn)</span>
                  <span className="text-crimson-900 font-mono text-[11px] font-bold">
                    {noseProfile > 60 ? 'Aquiline / Hooked' : noseProfile < 40 ? 'Button / Upturned' : 'Straight'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={noseProfile}
                  onChange={(e) => handleNoseProfileSlider(Number(e.target.value))}
                  className="w-full accent-crimson-800 cursor-pointer h-2 bg-parchment-200 rounded-lg"
                />
              </div>

              {/* Nose Presets */}
              <div className="space-y-2 pt-2 border-t border-parchment-border">
                <label className="text-xs font-bold text-ink-950 block">Nose Structure Presets</label>
                <div className="flex flex-wrap gap-2">
                  {presets.nose_shape.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFeatures((prev) => ({ ...prev, nose_shape: preset }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        (features.nose_shape || '').includes(preset)
                          ? 'bg-crimson-800 text-white shadow-sm border-crimson-900'
                          : 'bg-white text-ink-950 hover:bg-parchment-200 border-parchment-border'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MOUTH & LIPS */}
          {activeTab === 'lips' && (
            <div className="space-y-6 bg-parchment-50 p-5 rounded-2xl border border-parchment-border">
              {/* Lip Fullness Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-950">Lip Volume & Vermilion Fullness</span>
                  <span className="text-crimson-900 font-mono text-[11px] font-bold">
                    {lipFullness > 60 ? 'Full / Plump' : lipFullness < 40 ? 'Thin / Straight' : 'Balanced'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={lipFullness}
                  onChange={(e) => handleLipFullnessSlider(Number(e.target.value))}
                  className="w-full accent-crimson-800 cursor-pointer h-2 bg-parchment-200 rounded-lg"
                />
              </div>

              {/* Lip Presets */}
              <div className="space-y-2 pt-2 border-t border-parchment-border">
                <label className="text-xs font-bold text-ink-950 block">Lip Shape & Vermilion Border</label>
                <div className="flex flex-wrap gap-2">
                  {presets.lips.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFeatures((prev) => ({ ...prev, lips: preset }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        (features.lips || '').includes(preset)
                          ? 'bg-crimson-800 text-white shadow-sm border-crimson-900'
                          : 'bg-white text-ink-950 hover:bg-parchment-200 border-parchment-border'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HAIR, BEARD & AGE */}
          {activeTab === 'hair' && (
            <div className="space-y-6 bg-parchment-50 p-5 rounded-2xl border border-parchment-border">
              {/* Age Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-950">Apparent Age Estimate</span>
                  <span className="text-crimson-900 font-mono text-[11px] font-bold">{ageYears} years</span>
                </div>
                <input
                  type="range"
                  min="18"
                  max="75"
                  value={ageYears}
                  onChange={(e) => handleAgeSlider(Number(e.target.value))}
                  className="w-full accent-crimson-800 cursor-pointer h-2 bg-parchment-200 rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-ink-700 font-mono font-bold">
                  <span>Youthful (18-24)</span>
                  <span>Adult (30-45)</span>
                  <span>Senior (60+)</span>
                </div>
              </div>

              {/* Hair Style Presets */}
              <div className="space-y-2 pt-2 border-t border-parchment-border">
                <label className="text-xs font-bold text-ink-950 block">Hair Style & Cut</label>
                <div className="flex flex-wrap gap-2">
                  {presets.hair_style.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFeatures((prev) => ({ ...prev, hair_style: preset }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        (features.hair_style || '').includes(preset)
                          ? 'bg-crimson-800 text-white shadow-sm border-crimson-900'
                          : 'bg-white text-ink-950 hover:bg-parchment-200 border-parchment-border'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Facial Hair Presets */}
              <div className="space-y-2 pt-2 border-t border-parchment-border">
                <label className="text-xs font-bold text-ink-950 block">Facial Hair & Stubble</label>
                <div className="flex flex-wrap gap-2">
                  {presets.facial_hair.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFeatures((prev) => ({ ...prev, facial_hair: preset }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        (features.facial_hair || '').includes(preset)
                          ? 'bg-crimson-800 text-white shadow-sm border-crimson-900'
                          : 'bg-white text-ink-950 hover:bg-parchment-200 border-parchment-border'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Dynamic Morph Visualization & Action Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Header switch for 3D GNM Model vs 2D Schematic */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-ink-950 font-serif">MORPHOLOGY BLUEPRINT</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-900 text-cyan-200">
                Google GNM
              </span>
            </div>
            <div className="flex items-center gap-1 bg-parchment-200 p-0.5 rounded-lg border border-parchment-border">
              <button
                type="button"
                onClick={() => setBlueprintMode('3d-gnm')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all flex items-center gap-1 ${
                  blueprintMode === '3d-gnm'
                    ? 'bg-crimson-800 text-white shadow-sm'
                    : 'text-ink-800 hover:text-ink-950'
                }`}
              >
                <Box className="w-3 h-3" />
                Real 3D Model
              </button>
              <button
                type="button"
                onClick={() => setBlueprintMode('2d-blueprint')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all flex items-center gap-1 ${
                  blueprintMode === '2d-blueprint'
                    ? 'bg-crimson-800 text-white shadow-sm'
                    : 'text-ink-800 hover:text-ink-950'
                }`}
              >
                2D Blueprint
              </button>
            </div>
          </div>

          {/* 3D GNM Parametric Head Viewport (Primary) */}
          {blueprintMode === '3d-gnm' ? (
            <GNMHeadViewer3D
              imageUrl={currentImageUrl}
              jawWidth={jawWidth}
              noseWidth={noseWidth}
              noseProfile={noseProfile}
              eyeSize={eyeSize}
              browDensity={browDensity}
              lipFullness={lipFullness}
              ageYears={ageYears}
              faceShape={features.face_shape}
              chinStyle={features.jawline}
            />
          ) : (
            /* Fallback 2D Anatomical Wireframe Morph Visualizer SVG */
            <div className="bg-noir-950 p-6 rounded-2xl border border-noir-800 flex flex-col items-center justify-center relative overflow-hidden shadow-inner h-[440px]">
              <span className="absolute top-3 left-3 text-[10px] uppercase font-mono font-bold text-parchment-200 tracking-wider">
                2D Schematic Blueprint
              </span>

              <svg
                viewBox="0 0 200 240"
                className="w-48 h-56 text-blue-400 transition-all duration-300"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {/* Dynamic Head & Jawline outline based on jawWidth */}
                <path
                  d={`M 100 20 C 150 20, ${150 + (jawWidth - 50) * 0.4} 70, ${150 + (jawWidth - 50) * 0.5} 130 C ${
                    150 + (jawWidth - 50) * 0.6
                  } 190, ${120 + (jawWidth - 50) * 0.4} ${210 + (jawWidth - 50) * 0.1}, 100 ${
                    215 + (jawWidth - 50) * 0.15
                  } C ${80 - (jawWidth - 50) * 0.4} ${210 + (jawWidth - 50) * 0.1}, ${
                    50 - (jawWidth - 50) * 0.6
                  } 190, ${50 - (jawWidth - 50) * 0.5} 130 C ${50 - (jawWidth - 50) * 0.4} 70, 50 20, 100 20 Z`}
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="transition-all duration-200"
                />

                {/* Eyebrows based on browDensity */}
                <path
                  d="M 65 75 Q 78 70, 90 73"
                  stroke="#60a5fa"
                  strokeWidth={1.5 + (browDensity / 100) * 2.5}
                  strokeLinecap="round"
                />
                <path
                  d="M 110 73 Q 122 70, 135 75"
                  stroke="#60a5fa"
                  strokeWidth={1.5 + (browDensity / 100) * 2.5}
                  strokeLinecap="round"
                />

                {/* Eyes based on eyeSize */}
                <ellipse
                  cx="78"
                  cy="88"
                  rx={9 + (eyeSize - 50) * 0.08}
                  ry={5 + (eyeSize - 50) * 0.08}
                  stroke="#93c5fd"
                  strokeWidth="2"
                />
                <circle cx="78" cy="88" r="2.5" fill="#3b82f6" />

                <ellipse
                  cx="122"
                  cy="88"
                  rx={9 + (eyeSize - 50) * 0.08}
                  ry={5 + (eyeSize - 50) * 0.08}
                  stroke="#93c5fd"
                  strokeWidth="2"
                />
                <circle cx="122" cy="88" r="2.5" fill="#3b82f6" />

                {/* Nose based on noseWidth and noseProfile */}
                <path
                  d={`M 100 88 L 100 ${125 + (noseProfile - 50) * 0.15} L ${92 - (noseWidth - 50) * 0.1} ${
                    135 + (noseProfile - 50) * 0.1
                  } Q 100 138, ${108 + (noseWidth - 50) * 0.1} ${135 + (noseProfile - 50) * 0.1}`}
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Lips based on lipFullness */}
                <path
                  d="M 80 162 Q 90 158, 100 160 Q 110 158, 120 162"
                  stroke="#f472b6"
                  strokeWidth={1.5 + (lipFullness / 100) * 2}
                  strokeLinecap="round"
                />
                <path
                  d={`M 82 163 Q 100 ${170 + (lipFullness - 50) * 0.12}, 118 163`}
                  stroke="#f472b6"
                  strokeWidth={1.5 + (lipFullness / 100) * 2.5}
                  strokeLinecap="round"
                />

                {/* Subtle forensic grid lines */}
                <line x1="100" y1="20" x2="100" y2="215" stroke="#334155" strokeDasharray="3 3" />
                <line x1="50" y1="88" x2="150" y2="88" stroke="#334155" strokeDasharray="3 3" />
                <line x1="60" y1="162" x2="140" y2="162" stroke="#334155" strokeDasharray="3 3" />
              </svg>

              <div className="w-full mt-2 pt-3 border-t border-noir-800 flex items-center justify-between text-[11px] text-parchment-200 font-mono font-bold">
                <span>Jaw Width: {jawWidth}%</span>
                <span>Nose: {noseWidth}%</span>
                <span>Lips: {lipFullness}%</span>
              </div>
            </div>
          )}

          {/* Active Deltas Change List */}
          <div className="bg-noir-950 p-4 rounded-2xl border border-noir-800 space-y-2.5 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span>Pending Adjustments ({changedFeatures.length}):</span>
              {changedFeatures.length === 0 && <span className="text-parchment-300 font-normal">None</span>}
            </div>

            {changedFeatures.map((c) => (
              <div
                key={c.key}
                className="p-2.5 rounded-lg bg-noir-900 border border-noir-700 text-xs space-y-0.5"
              >
                <div className="flex items-center justify-between font-mono font-bold text-crimson-400 uppercase text-[10px]">
                  <span>{c.key.replace(/_/g, ' ')}</span>
                  <span className="text-emerald-400 font-bold">Modified</span>
                </div>
                <div className="text-white font-medium line-clamp-1">{c.current}</div>
              </div>
            ))}
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handleApply}
            disabled={isGenerating}
            className="w-full py-3.5 px-6 rounded-xl btn-crimson text-white font-bold text-sm shadow-crimson flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Synthesizing Facial Adjustments (Forensic AI)...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Adjusted Sketch (Live AI)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
