import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { transcribeAudio, analyzeSession, checkTranscribeStatus } from '../api/client'
import AudioDropzone from '../components/AudioDropzone'
import TranscriptView from '../components/TranscriptView'
import { Loader2, ArrowRight } from 'lucide-react'

export default function Upload() {
  const navigate = useNavigate()
  
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
          // If the backend restarted, we might get a 404 for a missing job ID.
          // Handle this explicitly by abandoning the polling so we don't spin forever.
          setError('Lost connection to the backend or the transcription job was interrupted. Please refresh and try again.')
          setIsTranscribing(false)
          setJobId(null)
          clearInterval(interval)
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [jobId, isTranscribing])

  const handleUpload = async (selectedFile) => {
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

  const handleAnalyze = async () => {
    // Look for session_id in multiple possible keys returned by the backend
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

  return (
    <div className="max-w-4xl mx-auto py-8 animate-fade-in space-y-8">
      <header className="mb-4">
        <h1 className="text-4xl font-serif text-brand-cream mb-2">Upload Session</h1>
        <p className="text-brand-sage/80">Process a raw audio file to generate a clinical transcript.</p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-6 py-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Upload area */}
      {!sessionData && !isTranscribing && (
        <AudioDropzone 
          onFileSelected={handleUpload} 
          onFileError={(msg) => setError(msg)}
          isLoading={false} 
        />
      )}

      {isTranscribing && (
        <div className="flex flex-col items-center justify-center py-16 bg-black/20 rounded-xl border border-[#2C3E50] px-8 text-center">
          <Loader2 className="animate-spin text-brand-accent mb-6" size={40} />
          <h3 className="text-2xl font-serif text-brand-cream mb-2">Transcribing audio...</h3>
          <p className="text-brand-sage/70 text-sm mb-8">
            Processing your audio file with Groq's Whisper API.
          </p>
          
          {/* Progress Bar Container */}
          <div className="w-full max-w-md bg-black/40 rounded-full h-3 mb-3 overflow-hidden border border-brand-sage/20">
            <div 
              className="bg-brand-accent h-3 rounded-full transition-all duration-500 ease-out animate-pulse"
              style={{ width: `100%` }}
            ></div>
          </div>
          <p className="text-brand-sage/60 font-mono text-sm">
            Analyzing audio...
          </p>
        </div>
      )}

      {sessionData && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-brand-sage/10 text-brand-sage px-4 py-3 rounded border border-brand-sage/30 flex items-center justify-between">
            <span>Successfully transcribed <strong>{file?.name}</strong></span>
          </div>
          
          {/* Conversation Window */}
          <div className="bg-[#0A0F1D] border border-[#2C3E50] rounded-xl overflow-hidden shadow-2xl">
            <div className="px-5 py-3 border-b border-[#2C3E50] bg-white/5 flex items-center justify-between">
              <h3 className="text-xs font-bold text-brand-sage uppercase tracking-widest">Session Transcript</h3>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto p-6 bg-black/20">
              <TranscriptView 
                transcript={
                  sessionData?.transcript || 
                  sessionData?.text || 
                  (typeof sessionData === 'string' ? sessionData : '')
                } 
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
