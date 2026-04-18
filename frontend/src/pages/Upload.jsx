import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { transcribeAudio, uploadTranscript, analyzeSession, checkTranscribeStatus, renameSpeaker, mergeSpeaker, removeSpeaker, editTurn } from '../api/client'
import AudioDropzone from '../components/AudioDropzone'
import TranscriptView from '../components/TranscriptView'
import SpeakerStats from '../components/SpeakerStats'
import AudioPlayer from '../components/AudioPlayer'
import { Loader2, ArrowRight, Mic, FileText, Upload as UploadIcon } from 'lucide-react'

export default function Upload() {
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = useState('audio')  // 'audio' | 'document'
  const [file, setFile] = useState(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  
  const [sessionData, setSessionData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let interval;
    if (jobId && isTranscribing) {
      interval = setInterval(async () => {
        try {
          const res = await checkTranscribeStatus(jobId)
          if (res.data.status === 'completed') {
            setSessionData(res.data.result)
            setIsTranscribing(false)
            setJobId(null)
            clearInterval(interval)
          } else if (res.data.status === 'error') {
            setError(res.data.error || 'Transcription failed internally.')
            setIsTranscribing(false)
            setJobId(null)
            clearInterval(interval)
          } else if (res.data.status === 'processing') {
            setProgress(res.data.progress)
          }
        } catch (err) {
          console.error(err)
          setError('Lost connection to the backend or the transcription job was interrupted. Please refresh and try again.')
          setIsTranscribing(false)
          setJobId(null)
          clearInterval(interval)
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [jobId, isTranscribing])

  const handleAudioUpload = async (selectedFile) => {
    setFile(selectedFile)
    setError('')
    setIsTranscribing(true)
    setSessionData(null)
    setProgress({ completed: 0, total: 0 })

    try {
      const response = await transcribeAudio(selectedFile)
      
      // If the backend returned a job_id, we start polling
      if (response.data.job_id) {
        setJobId(response.data.job_id)
      } 
      // If the backend returned the final result synchronously
      else if (response.data.session_id || response.data.id) {
        setSessionData(response.data)
        setIsTranscribing(false)
      } else {
        throw new Error("Invalid response from server: Missing job_id or session_id")
      }
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || err.message || 'Failed to start transcription')
      setIsTranscribing(false)
      setFile(null)
    }
  }

  const handleDocumentUpload = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const fname = selectedFile.name.toLowerCase()
    if (!fname.endsWith('.docx') && !fname.endsWith('.pdf')) {
      setError('Only .docx and .pdf files are supported')
      return
    }

    setFile(selectedFile)
    setError('')
    setIsTranscribing(true)
    setSessionData(null)

    try {
      const response = await uploadTranscript(selectedFile)
      setSessionData(response.data)
      setIsTranscribing(false)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || err.message || 'Failed to process transcript')
      setIsTranscribing(false)
      setFile(null)
    }
  }

  const applySpeakerUpdate = (data) =>
    setSessionData((prev) =>
      prev
        ? {
            ...prev,
            transcript_diarized: data.transcript_diarized,
            ...(data.speaker_count !== undefined ? { speaker_count: data.speaker_count } : {}),
          }
        : prev
    )

  const handleRenameSpeaker = async (oldName, newName) => {
    const sessionId = sessionData?.session_id || sessionData?.id
    if (!sessionId) return
    try {
      const { data } = await renameSpeaker(sessionId, oldName, newName)
      applySpeakerUpdate(data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Rename failed')
    }
  }

  const handleMergeSpeaker = async (fromName, intoName) => {
    const sessionId = sessionData?.session_id || sessionData?.id
    if (!sessionId) return
    try {
      const { data } = await mergeSpeaker(sessionId, fromName, intoName)
      applySpeakerUpdate(data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Merge failed')
    }
  }

  const handleRemoveSpeaker = async (name) => {
    const sessionId = sessionData?.session_id || sessionData?.id
    if (!sessionId) return
    try {
      const { data } = await removeSpeaker(sessionId, name)
      applySpeakerUpdate(data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Remove failed')
    }
  }

  const handleEditTurn = async (turnIndex, text) => {
    const sessionId = sessionData?.session_id || sessionData?.id
    if (!sessionId) return
    try {
      const { data } = await editTurn(sessionId, turnIndex, text)
      applySpeakerUpdate(data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Edit failed')
    }
  }

  const handleAnalyze = async () => {
    const sessionId = sessionData?.session_id || sessionData?.id
    if (!sessionId) return

    setIsAnalyzing(true)
    setError('')
    try {
      await analyzeSession(sessionId)
      navigate(`/sessions/${sessionId}`)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || err.message || 'Analysis failed')
      setIsAnalyzing(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setSessionData(null)
    setError('')
    setIsTranscribing(false)
    setIsAnalyzing(false)
    setJobId(null)
  }

  return (
    <div className="max-w-4xl mx-auto py-8 animate-fade-in space-y-8">
      <header className="mb-4">
        <h1 className="text-4xl font-serif text-brand-cream mb-2">Upload Session</h1>
        <p className="text-brand-sage/80">Process audio or a transcript document to generate a clinical session record.</p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-6 py-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Tab Switcher — only show when not processing */}
      {!sessionData && !isTranscribing && (
        <>
          <div className="flex border-b border-brand-sage/20">
            <button
              onClick={() => { setActiveTab('audio'); setError('') }}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'audio'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-brand-sage/60 hover:text-brand-sage'
              }`}
            >
              <Mic size={16} />
              Audio File
            </button>
            <button
              onClick={() => { setActiveTab('document'); setError('') }}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'document'
                  ? 'border-brand-accent text-brand-accent'
                  : 'border-transparent text-brand-sage/60 hover:text-brand-sage'
              }`}
            >
              <FileText size={16} />
              Document Upload
            </button>
          </div>

          {/* Audio Upload Tab */}
          {activeTab === 'audio' && (
            <AudioDropzone 
              onFileSelected={handleAudioUpload} 
              onFileError={(msg) => setError(msg)}
              isLoading={false} 
            />
          )}

          {/* Document Upload Tab */}
          {activeTab === 'document' && (
            <div className="flex flex-col items-center justify-center py-16 bg-black/20 rounded-xl border-2 border-dashed border-[#2C3E50] hover:border-brand-sage/40 transition-colors px-8">
              <div className="bg-brand-sage/10 rounded-full p-4 mb-6">
                <FileText className="text-brand-sage" size={32} />
              </div>
              <h3 className="text-xl font-serif text-brand-cream mb-2">Upload Transcript Document</h3>
              <p className="text-brand-sage/60 text-sm mb-6 text-center max-w-md">
                Upload a <strong>.docx</strong> or <strong>.pdf</strong> file containing your session transcript.
                Speakers will be automatically identified.
              </p>
              <label className="cursor-pointer inline-flex items-center gap-2 bg-brand-accent text-brand-navy px-6 py-3 rounded font-medium hover:bg-brand-accent/90 transition-colors">
                <UploadIcon size={18} />
                Choose File
                <input
                  type="file"
                  accept=".docx,.pdf"
                  className="hidden"
                  onChange={handleDocumentUpload}
                />
              </label>
            </div>
          )}
        </>
      )}

      {/* Processing State */}
      {isTranscribing && (
        <div className="flex flex-col items-center justify-center py-16 bg-black/20 rounded-xl border border-[#2C3E50] px-8 text-center">
          <Loader2 className="animate-spin text-brand-accent mb-6" size={40} />
          <h3 className="text-2xl font-serif text-brand-cream mb-2">
            {activeTab === 'audio' ? 'Transcribing audio...' : 'Processing document...'}
          </h3>
          <p className="text-brand-sage/70 text-sm mb-8">
            {activeTab === 'audio'
              ? "Transcribing with Whisper, then identifying speakers."
              : "Extracting text and identifying speakers."
            }
          </p>
          
          {/* Progress Bar */}
          <div className="w-full max-w-md bg-black/40 rounded-full h-3 mb-3 overflow-hidden border border-brand-sage/20">
            <div 
              className="bg-brand-accent h-3 rounded-full transition-all duration-500 ease-out animate-pulse"
              style={{ width: `100%` }}
            ></div>
          </div>
          <p className="text-brand-sage/60 font-mono text-sm">
            Analyzing...
          </p>
        </div>
      )}

      {/* Results */}
      {sessionData && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-brand-sage/10 text-brand-sage px-4 py-3 rounded border border-brand-sage/30 flex items-center justify-between">
            <span>
              Successfully processed <strong>{file?.name}</strong>
              {sessionData.speaker_count && (
                <span className="ml-2 text-xs opacity-70">
                  · {sessionData.speaker_count} speaker{sessionData.speaker_count !== 1 ? 's' : ''} detected
                </span>
              )}
            </span>
            <button
              onClick={handleReset}
              className="text-xs text-brand-sage/60 hover:text-brand-sage underline"
            >
              Upload another
            </button>
          </div>
          
          {sessionData.audio_filename && (sessionData.session_id || sessionData.id) && (
            <AudioPlayer
              src={`http://localhost:8000/api/sessions/${sessionData.session_id || sessionData.id}/audio`}
            />
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <TranscriptView
                transcript={sessionData?.transcript_raw || sessionData?.transcript || ''}
                diarizedTurns={sessionData?.transcript_diarized}
                speakerCount={sessionData?.speaker_count}
                sessionId={sessionData?.session_id || sessionData?.id}
                onRenameSpeaker={handleRenameSpeaker}
                onEditTurn={handleEditTurn}
              />
            </div>
            <div className="lg:w-72 shrink-0">
              <SpeakerStats
                diarizedTurns={sessionData?.transcript_diarized}
                onMergeSpeaker={handleMergeSpeaker}
                onRemoveSpeaker={handleRemoveSpeaker}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex items-center gap-2 bg-brand-accent text-brand-navy px-6 py-3 rounded font-medium hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Analyzing with RAG...
                </>
              ) : (
                <>
                  Analyze this Session <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
