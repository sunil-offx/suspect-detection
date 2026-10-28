import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  FileText,
  Mic,
  Image as ImageIcon,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  Fingerprint
} from 'lucide-react';
import { InvestigativeAidBanner } from '../components/InvestigativeAidBanner';

interface CaseData {
  id: string;
  case_number: string;
  title: string;
  status: string;
}

export const InputPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'text' | 'audio' | 'image'>('text');

  // Text Inputs
  const [narrativeText, setNarrativeText] = useState('');
  const [structuredFields, setStructuredFields] = useState<Record<string, string>>({
    estimated_age: '',
    gender: 'male',
    apparent_race: '',
    face_shape: '',
    hair_color: '',
    hair_style: '',
    eye_color: '',
    nose_shape: '',
    jawline: '',
    facial_hair: ''
  });
  const [submittingText, setSubmittingText] = useState(false);
  const [textSubmitted, setTextSubmitted] = useState(false);

  // Audio state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageObservations, setImageObservations] = useState<string[]>([]);

  // Analyzing state
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadCase();
  }, [id]);

  const loadCase = async () => {
    setLoading(true);
    try {
      const [caseRes, inputsRes] = await Promise.all([
        api.get<CaseData>(`/api/cases/${id}`),
        api.get<any[]>(`/api/cases/${id}/inputs`).catch(() => ({ data: [] }))
      ]);
      setCaseData(caseRes.data);
      if (inputsRes.data && inputsRes.data.length > 0) {
        const textInp = inputsRes.data.find((i: any) => i.input_type === 'text' && i.original_text);
        if (textInp) {
          setNarrativeText(textInp.original_text);
          setTextSubmitted(true);
          if (textInp.structured_data) {
            setStructuredFields((prev) => ({ ...prev, ...textInp.structured_data }));
          }
        }
        const audioInp = inputsRes.data.find((i: any) => i.input_type === 'audio' && i.transcription);
        if (audioInp) {
          setTranscription(audioInp.transcription);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to load case details');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key: string, val: string) => {
    setStructuredFields((prev) => ({ ...prev, [key]: val }));
  };

  const handleClear = () => {
    setNarrativeText('');
    setStructuredFields({
      estimated_age: '',
      gender: 'male',
      apparent_race: '',
      face_shape: '',
      hair_color: '',
      hair_style: '',
      eye_color: '',
      nose_shape: '',
      jawline: '',
      facial_hair: ''
    });
    setTextSubmitted(false);
  };

  const handleSaveText = async () => {
    if (!narrativeText.trim()) return;
    setSubmittingText(true);
    setErrorMsg(null);
    try {
      const cleanFields: Record<string, string> = {};
      Object.entries(structuredFields).forEach(([k, v]) => {
        if (v.trim()) cleanFields[k] = v.trim();
      });

      await api.post(`/api/cases/${id}/inputs/text`, {
        text: narrativeText.trim(),
        structured_fields: cleanFields
      });
      setTextSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit witness statement');
    } finally {
      setSubmittingText(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setUploadingAudio(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/api/cases/${id}/inputs/audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTranscribing(true);
      let transRes;
      try {
        transRes = await api.post(`/api/cases/${id}/transcribe?input_id=${res.data.id}`);
      } catch (trErr: any) {
        if (trErr.response?.status === 503) {
          transRes = await api.post(`/api/cases/${id}/transcribe?use_fixture=true&input_id=${res.data.id}`);
        } else {
          throw trErr;
        }
      }
      setTranscription(transRes.data.transcription);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to process audio recording');
    } finally {
      setUploadingAudio(false);
      setTranscribing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/api/cases/${id}/inputs/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.observations) {
        setImageObservations(res.data.observations);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to process reference image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAnalyzeAndProceed = async () => {
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
      <div className="min-h-screen noir-desk flex items-center justify-center text-parchment-300 font-mono text-xs">
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
              className="p-2 bg-noir-900 border border-noir-700 rounded-lg text-parchment-300 hover:text-white transition"
              title="Return to Case Registry"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-crimson-900/60 text-crimson-300 border border-crimson-700/60 rounded">
                  {caseData?.case_number}
                </span>
                <span className="text-xs text-parchment-400 font-mono">Case File Dossier</span>
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
          <div className="p-3 bg-crimson-950/80 border border-crimson-700 rounded-lg text-xs text-crimson-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-crimson-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3-Step Forensic Investigation Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Stepper (3 cols) */}
          <div className="md:col-span-3 dossier-card p-5 space-y-4">
            <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider font-mono">
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
                className="flex items-center gap-3 p-2 text-ink-700 hover:bg-parchment-200/50 rounded-lg cursor-pointer transition"
              >
                <span className="w-6 h-6 rounded-full bg-parchment-300 text-ink-800 flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </span>
                <span className="text-xs font-medium">Attributes</span>
              </div>

              {/* Step 3 */}
              <div
                onClick={() => navigate(`/cases/${id}/sketch`)}
                className="flex items-center gap-3 p-2 text-ink-700 hover:bg-parchment-200/50 rounded-lg cursor-pointer transition"
              >
                <span className="w-6 h-6 rounded-full bg-parchment-300 text-ink-800 flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </span>
                <span className="text-xs font-medium">Generate</span>
              </div>
            </div>
          </div>

          {/* Right Main Manila Dossier Card (9 cols) */}
          <div className="md:col-span-9 dossier-card p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-ink-900 font-serif">
                Tell us what the person looked like
              </h2>
              <p className="text-xs text-ink-600 mt-1">
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
                    : 'bg-parchment-200/80 text-ink-700 hover:text-ink-900 hover:bg-parchment-300/60'
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
                    : 'bg-parchment-200/80 text-ink-700 hover:text-ink-900 hover:bg-parchment-300/60'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                Voice Input
                {transcription && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('image')}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition ${
                  activeTab === 'image'
                    ? 'bg-crimson-800 text-white shadow-sm'
                    : 'bg-parchment-200/80 text-ink-700 hover:text-ink-900 hover:bg-parchment-300/60'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Image Reference
                {imageFile && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
            </div>

            {/* Tab 1: Text Input */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-ink-800 uppercase tracking-wider font-mono">
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
                    className="w-full bg-parchment-50 border border-parchment-border rounded-xl p-3 text-xs sm:text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:border-crimson-700 focus:ring-1 focus:ring-crimson-700 font-sans"
                  />
                  <div className="flex items-center justify-between text-xs text-ink-500 font-mono">
                    <span>{narrativeText.length} characters</span>
                    {textSubmitted && (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved to case file
                      </span>
                    )}
                  </div>
                </div>

                {/* Optional Structured Fields */}
                <div className="p-4 bg-parchment-cardAlt rounded-xl border border-parchment-border space-y-3">
                  <span className="text-xs font-bold text-ink-900 uppercase font-mono block">
                    Optional Observed Physical Attributes
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-ink-600 mb-1">Estimated Age</label>
                      <input
                        type="text"
                        placeholder="e.g. 28-32"
                        value={structuredFields.estimated_age}
                        onChange={(e) => handleFieldChange('estimated_age', e.target.value)}
                        className="w-full bg-parchment-50 border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-900 focus:outline-none focus:border-crimson-700"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-600 mb-1">Gender Expression</label>
                      <select
                        value={structuredFields.gender}
                        onChange={(e) => handleFieldChange('gender', e.target.value)}
                        className="w-full bg-parchment-50 border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-900 focus:outline-none focus:border-crimson-700 font-sans"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="androgynous">Androgynous / Unspecified</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-ink-600 mb-1">Face Shape</label>
                      <input
                        type="text"
                        placeholder="e.g. oval, square, round"
                        value={structuredFields.face_shape}
                        onChange={(e) => handleFieldChange('face_shape', e.target.value)}
                        className="w-full bg-parchment-50 border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-900 focus:outline-none focus:border-crimson-700"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-600 mb-1">Jawline & Chin</label>
                      <input
                        type="text"
                        placeholder="e.g. sharp angular, square"
                        value={structuredFields.jawline}
                        onChange={(e) => handleFieldChange('jawline', e.target.value)}
                        className="w-full bg-parchment-50 border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-900 focus:outline-none focus:border-crimson-700"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-600 mb-1">Hair Style / Cut</label>
                      <input
                        type="text"
                        placeholder="e.g. short buzz fade"
                        value={structuredFields.hair_style}
                        onChange={(e) => handleFieldChange('hair_style', e.target.value)}
                        className="w-full bg-parchment-50 border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-900 focus:outline-none focus:border-crimson-700"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-600 mb-1">Facial Hair</label>
                      <input
                        type="text"
                        placeholder="e.g. neat goatee, light stubble"
                        value={structuredFields.facial_hair}
                        onChange={(e) => handleFieldChange('facial_hair', e.target.value)}
                        className="w-full bg-parchment-50 border border-parchment-border rounded-lg px-2.5 py-1.5 text-ink-900 focus:outline-none focus:border-crimson-700"
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
                  <p className="text-xs font-bold text-ink-900 mb-1">Upload Witness Audio Recording</p>
                  <p className="text-[11px] text-ink-500 mb-4 max-w-sm mx-auto">
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
                  <div className="p-4 bg-parchment-cardAlt rounded-xl text-center text-xs text-ink-700 font-mono animate-pulse">
                    Transcribing audio statement via Groq Whisper...
                  </div>
                )}

                {transcription && (
                  <div className="p-4 bg-parchment-50 rounded-xl border border-parchment-border space-y-1.5">
                    <span className="text-[11px] font-bold text-crimson-800 uppercase font-mono block">
                      Transcribed Witness Statement
                    </span>
                    <p className="text-xs text-ink-900 leading-relaxed italic font-serif">
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
                  <p className="text-xs font-bold text-ink-900 mb-1">Observable CCTV or Reference Photo</p>
                  <p className="text-[11px] text-ink-500 mb-4 max-w-sm mx-auto">
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
                  <div className="flex items-center gap-4 p-4 bg-parchment-50 rounded-xl border border-parchment-border">
                    <img
                      src={imagePreview}
                      alt="Reference"
                      className="w-24 h-24 object-cover rounded-lg border border-parchment-border"
                    />
                    <div className="text-xs text-ink-700 space-y-1">
                      <p className="font-bold text-ink-900">Reference Photo Attached</p>
                      <p className="text-emerald-700 font-semibold font-mono text-[11px]">
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
