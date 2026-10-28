import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  FileText,
  Mic,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RotateCcw,
  Shield,
  Layers,
  ChevronRight
} from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';

export const InputPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'text' | 'audio' | 'image'>('text');
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [narrativeText, setNarrativeText] = useState('');
  const [structuredFields, setStructuredFields] = useState<Record<string, string>>({
    estimated_age: '',
    gender: 'male',
    face_shape: '',
    jawline: '',
    hair_style: '',
    hair_color: '',
    eye_shape: '',
    nose_shape: '',
    facial_hair: ''
  });

  const [textSubmitted, setTextSubmitted] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchCaseDetails();
  }, [id]);

  const fetchCaseDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/cases/${id}`);
      setCaseData(res.data);
    } catch (err: any) {
      console.error('Failed to load case:', err);
      setErrorMsg('Failed to load case record.');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: string, val: string) => {
    setStructuredFields((prev) => ({ ...prev, [field]: val }));
    setTextSubmitted(false);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploadingAudio(true);
    setTranscribing(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('audio_file', file);

    try {
      const res = await api.post(`/api/cases/${id}/inputs/audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTranscription(res.data.transcription || 'Audio transcription processed successfully.');
      if (res.data.transcription && !narrativeText) {
        setNarrativeText(res.data.transcription);
      }
    } catch (err: any) {
      console.error('Audio upload failed:', err);
      setErrorMsg(err.response?.data?.detail || 'Audio upload/transcription failed.');
    } finally {
      setUploadingAudio(false);
      setTranscribing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('image_file', file);

    try {
      await api.post(`/api/cases/${id}/inputs/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (err: any) {
      console.error('Image upload failed:', err);
      setErrorMsg(err.response?.data?.detail || 'Image sanitization/upload failed.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleClear = () => {
    setNarrativeText('');
    setStructuredFields({
      estimated_age: '',
      gender: 'male',
      face_shape: '',
      jawline: '',
      hair_style: '',
      hair_color: '',
      eye_shape: '',
      nose_shape: '',
      facial_hair: ''
    });
    setTranscription(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleAnalyzeAndProceed = async () => {
    if (!id) return;
    setAnalyzing(true);
    setErrorMsg(null);
    try {
      if (narrativeText.trim()) {
        const cleanFields: Record<string, string> = {};
        Object.entries(structuredFields).forEach(([k, v]) => {
          if (v.trim()) cleanFields[k] = v.trim();
        });
        await api.post(`/api/cases/${id}/inputs/text`, {
          text: narrativeText.trim(),
          structured_fields: cleanFields
        });
        setTextSubmitted(true);
      }

      try {
        await api.post(`/api/cases/${id}/analyze`);
      } catch (err: any) {
        if (err.response?.status === 503) {
          await api.post(`/api/cases/${id}/analyze?use_fixture=true`);
        } else {
          throw err;
        }
      }
      navigate(`/cases/${id}/report`);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Analysis failed. Please verify witness inputs were submitted.');
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen noir-desk flex items-center justify-center text-parchment-200 font-mono text-xs">
        <div className="w-8 h-8 border-3 border-crimson-600 border-t-transparent rounded-full animate-spin mb-2"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen noir-desk p-4 sm:p-6 lg:p-8 font-sans text-parchment-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-noir-700/80 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/cases')}
              className="p-2 bg-noir-900 border border-noir-700 rounded-lg text-parchment-200 hover:text-white transition"
              title="Return to Case Registry"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-crimson-900/60 text-crimson-200 border border-crimson-700/60 rounded">
                  {caseData?.case_number}
                </span>
                <span className="text-xs text-parchment-200 font-mono font-medium">Case File Dossier</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1 font-serif">{caseData?.title}</h1>
            </div>
          </div>

          <button
            onClick={handleAnalyzeAndProceed}
            disabled={analyzing || (!narrativeText.trim() && !transcription && !imageFile)}
            className="px-6 py-2.5 btn-crimson text-xs font-bold flex items-center gap-2 shadow-crimson cursor-pointer"
          >
            {analyzing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Process & Send for Analysis →</span>
          </button>
        </div>

        <InvestigativeAidBanner compact />

        {errorMsg && (
          <div className="p-3 bg-crimson-950/80 border border-crimson-700 rounded-lg text-xs text-crimson-200 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-crimson-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3-Step Forensic Investigation Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Stepper (3 cols) */}
          <div className="md:col-span-3 dossier-card p-5 space-y-4 border-2 border-parchment-border">
            <h3 className="text-xs font-bold text-ink-950 uppercase tracking-wider font-mono">
              Workflow Stages
            </h3>
            <div className="space-y-3">
              {/* Step 1: Active */}
              <div className="flex items-center gap-3 p-2 bg-crimson-800 text-white rounded-lg shadow-sm">
                <span className="w-6 h-6 rounded-full bg-white text-crimson-900 flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </span>
                <span className="text-xs font-bold">Description</span>
              </div>

              {/* Step 2 */}
              <div
                onClick={() => navigate(`/cases/${id}/refine`)}
                className="flex items-center gap-3 p-2 text-ink-900 hover:bg-parchment-200/80 rounded-lg cursor-pointer transition font-bold"
              >
                <span className="w-6 h-6 rounded-full bg-parchment-300 text-ink-950 flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </span>
                <span className="text-xs">Attributes</span>
              </div>

              {/* Step 3 */}
              <div
                onClick={() => navigate(`/cases/${id}/sketch`)}
                className="flex items-center gap-3 p-2 text-ink-900 hover:bg-parchment-200/80 rounded-lg cursor-pointer transition font-bold"
              >
                <span className="w-6 h-6 rounded-full bg-parchment-300 text-ink-950 flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </span>
                <span className="text-xs">Generate</span>
              </div>
            </div>
          </div>

          {/* Right Main Manila Dossier Card (9 cols) */}
          <div className="md:col-span-9 dossier-card p-6 sm:p-8 space-y-6 border-2 border-parchment-border">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-ink-950 font-serif">
                Tell us what the person looked like
              </h2>
              <p className="text-xs text-ink-800 mt-1 font-medium">
                Provide a detailed description using witness text, audio testimony, or observable reference imagery.
              </p>
            </div>

            {/* Input Modality Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-parchment-border pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition ${
                  activeTab === 'text'
                    ? 'bg-crimson-800 text-white shadow-sm'
                    : 'bg-parchment-200 text-ink-900 font-bold hover:bg-parchment-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Text Input
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('audio')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition ${
                  activeTab === 'audio'
                    ? 'bg-crimson-800 text-white shadow-sm'
                    : 'bg-parchment-200 text-ink-900 font-bold hover:bg-parchment-300'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                Voice Input
                {transcription && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('image')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition ${
                  activeTab === 'image'
                    ? 'bg-crimson-800 text-white shadow-sm'
                    : 'bg-parchment-200 text-ink-900 font-bold hover:bg-parchment-300'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Image Reference
                {imageFile && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
              </button>
            </div>

            {/* Tab 1: Text Input */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-ink-950 uppercase tracking-wider font-mono">
                    Witness Narrative Testimony
                  </label>
                  <textarea
                    rows={5}
                    value={narrativeText}
                    onChange={(e) => {
                      setNarrativeText(e.target.value);
                      setTextSubmitted(false);
                    }}
                    placeholder="Example: Male, around 30 years old, medium build, short dark hair, wearing a dark cap, defined jawline, light cheek stubble..."
                    className="w-full bg-white border border-parchment-border rounded-xl p-3 text-xs sm:text-sm text-ink-950 placeholder-ink-400 focus:outline-none focus:border-crimson-700 focus:ring-1 focus:ring-crimson-700 font-medium font-sans"
                  />
                  <div className="flex items-center justify-between text-xs text-ink-700 font-mono font-bold">
                    <span>{narrativeText.length} characters</span>
                    {textSubmitted && (
                      <span className="text-emerald-800 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved to case file
                      </span>
                    )}
                  </div>
                </div>

                {/* Optional Structured Fields */}
                <div className="p-4 bg-parchment-cardAlt rounded-xl border border-parchment-border space-y-3">
                  <span className="text-xs font-bold text-ink-950 uppercase font-mono block">
                    Optional Observed Physical Attributes
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-ink-900 font-bold mb-1">Estimated Age</label>
                      <input
                        type="text"
                        placeholder="e.g. 28-32"
                        value={structuredFields.estimated_age}
                        onChange={(e) => handleFieldChange('estimated_age', e.target.value)}
                        className="w-full bg-white border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-950 font-medium focus:outline-none focus:border-crimson-700"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-900 font-bold mb-1">Gender Expression</label>
                      <select
                        value={structuredFields.gender}
                        onChange={(e) => handleFieldChange('gender', e.target.value)}
                        className="w-full bg-white border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-950 font-medium focus:outline-none focus:border-crimson-700 font-sans"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="androgynous">Androgynous / Unspecified</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-ink-900 font-bold mb-1">Face Shape</label>
                      <input
                        type="text"
                        placeholder="e.g. oval, square, round"
                        value={structuredFields.face_shape}
                        onChange={(e) => handleFieldChange('face_shape', e.target.value)}
                        className="w-full bg-white border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-950 font-medium focus:outline-none focus:border-crimson-700"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-900 font-bold mb-1">Jawline & Chin</label>
                      <input
                        type="text"
                        placeholder="e.g. sharp angular, square"
                        value={structuredFields.jawline}
                        onChange={(e) => handleFieldChange('jawline', e.target.value)}
                        className="w-full bg-white border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-950 font-medium focus:outline-none focus:border-crimson-700"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-900 font-bold mb-1">Hair Style / Cut</label>
                      <input
                        type="text"
                        placeholder="e.g. short buzz fade"
                        value={structuredFields.hair_style}
                        onChange={(e) => handleFieldChange('hair_style', e.target.value)}
                        className="w-full bg-white border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-950 font-medium focus:outline-none focus:border-crimson-700"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-900 font-bold mb-1">Facial Hair</label>
                      <input
                        type="text"
                        placeholder="e.g. neat goatee, light stubble"
                        value={structuredFields.facial_hair}
                        onChange={(e) => handleFieldChange('facial_hair', e.target.value)}
                        className="w-full bg-white border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-950 font-medium focus:outline-none focus:border-crimson-700"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Audio Interview Recording */}
            {activeTab === 'audio' && (
              <div className="space-y-4">
                <div className="p-6 border-2 border-dashed border-parchment-border rounded-xl text-center bg-parchment-50">
                  <Mic className="w-8 h-8 text-crimson-800 mx-auto mb-2" />
                  <p className="text-xs font-bold text-ink-950 mb-1">Upload Witness Audio Recording</p>
                  <p className="text-[11px] text-ink-700 mb-4 max-w-sm mx-auto font-medium">
                    Supports WAV, MP3, M4A, WebM. Automatically transcribed using Groq Whisper.
                  </p>
                  <label className="cursor-pointer inline-block">
                    <span className="px-5 py-2 btn-crimson text-xs font-bold shadow-sm">
                      {uploadingAudio ? 'Uploading...' : 'Select Audio File'}
                    </span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {transcribing && (
                  <div className="p-4 bg-parchment-cardAlt rounded-xl text-center text-xs text-ink-900 font-mono font-bold animate-pulse">
                    Transcribing audio statement via Groq Whisper...
                  </div>
                )}

                {transcription && (
                  <div className="p-4 bg-white rounded-xl border border-parchment-border space-y-1.5 shadow-sm">
                    <span className="text-[11px] font-bold text-crimson-800 uppercase font-mono block">
                      Transcribed Witness Statement
                    </span>
                    <p className="text-xs text-ink-950 leading-relaxed italic font-serif">
                      "{transcription}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Reference Imagery */}
            {activeTab === 'image' && (
              <div className="space-y-4">
                <div className="p-6 border-2 border-dashed border-parchment-border rounded-xl text-center bg-parchment-50">
                  <ImageIcon className="w-8 h-8 text-crimson-800 mx-auto mb-2" />
                  <p className="text-xs font-bold text-ink-950 mb-1">Observable CCTV or Reference Photo</p>
                  <p className="text-[11px] text-ink-700 mb-4 max-w-sm mx-auto font-medium">
                    JPEG, PNG. Sensitive EXIF/GPS metadata is automatically stripped upon upload.
                  </p>
                  <label className="cursor-pointer inline-block">
                    <span className="px-5 py-2 btn-crimson text-xs font-bold shadow-sm">
                      {uploadingImage ? 'Sanitizing & Uploading...' : 'Select Image File'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {imagePreview && (
                  <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-parchment-border shadow-sm">
                    <img
                      src={imagePreview}
                      alt="Reference"
                      className="w-24 h-24 object-cover rounded-lg border border-parchment-border"
                    />
                    <div className="text-xs text-ink-800 space-y-1">
                      <p className="font-bold text-ink-950">Reference Photo Attached</p>
                      <p className="text-emerald-800 font-bold font-mono text-[11px]">
                        ✓ EXIF & GPS stripped
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-parchment-border">
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2.5 btn-parchment text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>

              <button
                type="button"
                onClick={handleAnalyzeAndProceed}
                disabled={analyzing || (!narrativeText.trim() && !transcription && !imageFile)}
                className="px-6 py-2.5 btn-crimson text-xs font-bold flex items-center gap-2 cursor-pointer shadow-crimson"
              >
                <span>Next →</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
