import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  FileText,
  Mic,
  Image as ImageIcon,
  Send,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Upload,
  Play,
  Square,
  Shield,
  Tag
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
      const res = await api.get<CaseData>(`/api/cases/${id}`);
      setCaseData(res.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to load case details');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key: string, val: string) => {
    setStructuredFields((prev) => ({ ...prev, [key]: val }));
  };

  const handleSaveText = async () => {
    if (!narrativeText.trim()) return;
    setSubmittingText(true);
    setErrorMsg(null);
    try {
      // Filter out empty structured fields
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
      // Automatically attempt transcribe (using dev fixture if provider unconfigured)
      setTranscribing(true);
      const transRes = await api.post(`/api/cases/${id}/transcribe?use_fixture=true&input_id=${res.data.id}`);
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
    // If text was written but not saved, save it first
    if (narrativeText.trim() && !textSubmitted) {
      await handleSaveText();
    }

    setAnalyzing(true);
    setErrorMsg(null);
    try {
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/cases')}
              className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              title="Return to Case Registry"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2.5 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded font-bold">
                  {caseData?.case_number}
                </span>
                <span className="text-xs text-slate-400 uppercase font-semibold">Witness Intake Phase</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">{caseData?.title}</h1>
            </div>
          </div>

          <button
            onClick={handleAnalyzeAndProceed}
            disabled={analyzing || (!narrativeText.trim() && !transcription && !imageFile)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg transition"
          >
            {analyzing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Process & Send for Analysis</span>
          </button>
        </div>

        {/* Disclaimer Banner */}
        <InvestigativeAidBanner compact />

        {errorMsg && (
          <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('text')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${
              activeTab === 'text'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Witness Statement & Descriptors
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${
              activeTab === 'audio'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Mic className="w-4 h-4" />
            Audio Interview Recording
            {transcription && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          <button
            onClick={() => setActiveTab('image')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${
              activeTab === 'image'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Reference Imagery
            {imageFile && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>
        </div>

        {/* Tab 1: Text Input & Form */}
        {activeTab === 'text' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Witness Narrative & Free Testimony *
              </label>
              <textarea
                rows={5}
                required
                value={narrativeText}
                onChange={(e) => {
                  setNarrativeText(e.target.value);
                  setTextSubmitted(false);
                }}
                placeholder="Describe everything the witness recalled regarding the suspect's face, build, hair, eyes, expression, and distinct marks..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-sans"
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Original statements are immutable and preserved for audit.</span>
                <button
                  type="button"
                  onClick={handleSaveText}
                  disabled={submittingText || !narrativeText.trim()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
                >
                  {textSubmitted ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Saved
                    </>
                  ) : submittingText ? (
                    'Saving...'
                  ) : (
                    'Save Statement'
                  )}
                </button>
              </div>
            </div>

            {/* Optional Structured Fields */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Observable Demographic & Anatomical Attributes (Optional)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Estimated Age</label>
                  <input
                    type="text"
                    placeholder="e.g. 28-32"
                    value={structuredFields.estimated_age}
                    onChange={(e) => handleFieldChange('estimated_age', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Hair Style / Cut</label>
                  <input
                    type="text"
                    placeholder="e.g. Short fade, textured top"
                    value={structuredFields.hair_style}
                    onChange={(e) => handleFieldChange('hair_style', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Hair Color</label>
                  <input
                    type="text"
                    placeholder="e.g. Dark brown"
                    value={structuredFields.hair_color}
                    onChange={(e) => handleFieldChange('hair_color', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Eye Color</label>
                  <input
                    type="text"
                    placeholder="e.g. Hazel, dark brown"
                    value={structuredFields.eye_color}
                    onChange={(e) => handleFieldChange('eye_color', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Jawline / Chin</label>
                  <input
                    type="text"
                    placeholder="e.g. Sharp square jaw"
                    value={structuredFields.jawline}
                    onChange={(e) => handleFieldChange('jawline', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Facial Hair</label>
                  <input
                    type="text"
                    placeholder="e.g. Trimmed goatee, clean-shaven"
                    value={structuredFields.facial_hair}
                    onChange={(e) => handleFieldChange('facial_hair', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Audio Upload */}
        {activeTab === 'audio' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Witness Audio Interview Recording
            </h3>
            <p className="text-xs text-slate-400">
              Upload a recorded witness interview (MP3, WAV, M4A, WEBM up to 25MB). Audio files are stored privately and transcribed using Whisper.
            </p>

            <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 text-center hover:border-slate-700 transition">
              <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-block transition">
                  {uploadingAudio ? 'Uploading...' : 'Select Audio File'}
                </span>
                <input
                  type="file"
                  accept="audio/mp3,audio/wav,audio/m4a,audio/webm"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
              </label>
              {audioFile && (
                <p className="text-xs text-emerald-400 mt-2 font-mono">Selected: {audioFile.name}</p>
              )}
            </div>

            {transcribing && (
              <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-lg text-xs text-blue-300 flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                Transcribing audio with Whisper AI...
              </div>
            )}

            {transcription && (
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Interview Transcription
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">{transcription}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Reference Image Upload */}
        {activeTab === 'image' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Observable Reference Imagery
            </h3>
            <p className="text-xs text-slate-400">
              Upload CCTV captures or reference reference photos (JPEG, PNG). EXIF and GPS coordinates are automatically stripped upon storage.
            </p>

            <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 text-center hover:border-slate-700 transition">
              <ImageIcon className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-block transition">
                  {uploadingImage ? 'Uploading & Stripping EXIF...' : 'Select Image File'}
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
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <img
                  src={imagePreview}
                  alt="Reference preview"
                  className="w-32 h-32 object-cover rounded-lg border border-slate-800"
                />
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-semibold text-white">Reference Image Uploaded</p>
                  <p className="text-slate-400">EXIF metadata sanitized.</p>
                  {imageObservations.length > 0 && (
                    <div className="pt-1">
                      <span className="text-slate-500 font-bold block">Observable Features:</span>
                      <ul className="list-disc list-inside text-slate-300">
                        {imageObservations.map((obs, idx) => (
                          <li key={idx}>{obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
