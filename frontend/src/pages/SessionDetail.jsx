import React, { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSession, analyzeSession, overrideTranscript, renameSpeaker, mergeSpeaker, removeSpeaker, editTurn } from '../api/client'
import TranscriptView from '../components/TranscriptView'
import SpeakerStats from '../components/SpeakerStats'
import AudioPlayer from '../components/AudioPlayer'
import AnalysisCard from '../components/AnalysisCard'
import { Loader2, ArrowRight, Calendar, ArrowLeft, Upload, Mic, FileText, Users } from 'lucide-react'

const SOURCE_LABELS = {
  audio: { label: 'Audio', icon: Mic, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  manual_docx: { label: 'Word Doc', icon: FileText, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  manual_pdf: { label: 'PDF', icon: FileText, color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
}

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [analyzeError, setAnalyzeError] = useState('')
  const [isUploadingDoc, setIsUploadingDoc] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingDoc(true)
    setAnalyzeError('')
    
    try {
      await overrideTranscript(id, file)
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    } catch (err) {
      setAnalyzeError(err.response?.data?.detail || err.message || 'Failed to upload document')
    } finally {
      setIsUploadingDoc(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const { data: session, isLoading, error } = useQuery({
    queryKey: ['session', id],
    queryFn: async () => {
      const { data } = await getSession(id)
      return data
    }
  })

  const applySpeakerUpdate = (data) => {
    queryClient.setQueryData(['session', id], (prev) =>
      prev
        ? {
            ...prev,
            transcript_diarized: data.transcript_diarized,
            ...(data.speaker_count !== undefined ? { speaker_count: data.speaker_count } : {}),
          }
        : prev
    )
  }

  const handleRenameSpeaker = async (oldName, newName) => {
    try {
      const { data } = await renameSpeaker(id, oldName, newName)
      applySpeakerUpdate(data)
    } catch (err) {
      setAnalyzeError(err.response?.data?.detail || err.message || 'Rename failed')
    }
  }

  const handleMergeSpeaker = async (fromName, intoName) => {
    try {
      const { data } = await mergeSpeaker(id, fromName, intoName)
      applySpeakerUpdate(data)
    } catch (err) {
      setAnalyzeError(err.response?.data?.detail || err.message || 'Merge failed')
    }
  }

  const handleRemoveSpeaker = async (name) => {
    try {
      const { data } = await removeSpeaker(id, name)
      applySpeakerUpdate(data)
    } catch (err) {
      setAnalyzeError(err.response?.data?.detail || err.message || 'Remove failed')
    }
  }

  const handleEditTurn = async (turnIndex, text) => {
    try {
      const { data } = await editTurn(id, turnIndex, text)
      applySpeakerUpdate(data)
    } catch (err) {
      setAnalyzeError(err.response?.data?.detail || err.message || 'Edit failed')
    }
  }

  // Mutation to trigger analysis
  const analyzeMutation = useMutation({
    mutationFn: () => analyzeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (err) => {
      setAnalyzeError(err.response?.data?.detail || err.message || 'Analysis failed')
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-accent" size={40} />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="text-red-400 bg-red-900/10 p-4 rounded border border-red-900/30">
        Session not found or failed to load.
      </div>
    )
  }

  const dateStr = new Date(session.date).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const sourceInfo = SOURCE_LABELS[session.source] || SOURCE_LABELS.audio
  const SourceIcon = sourceInfo.icon

  return (
    <div className="py-6 animate-fade-in space-y-8">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-brand-sage/80 hover:text-brand-cream transition-colors text-sm font-medium"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <header className="border-b border-brand-sage/20 pb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-brand-cream mb-3">
            Session Record
          </h1>
          <div className="flex items-center gap-3 text-brand-sage/80 flex-wrap">
            <span className="flex items-center gap-1.5"><Calendar size={16} /> {dateStr}</span>
            <span className="bg-black/20 px-3 py-1 rounded text-xs border border-[#2C3E50]">
              {session.filename}
            </span>
            {/* Source badge */}
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs border ${sourceInfo.color}`}>
              <SourceIcon size={12} />
              {sourceInfo.label}
            </span>
            {/* Speaker count */}
            {session.speaker_count && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded text-xs border border-brand-sage/20 bg-black/20 text-brand-sage/80">
                <Users size={12} />
                {session.speaker_count} speaker{session.speaker_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div>
          <input 
            type="file" 
            accept=".docx,.pdf" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingDoc}
            className="flex items-center gap-2 bg-brand-sage/10 text-brand-sage px-4 py-2 rounded text-sm hover:bg-brand-sage/20 transition-colors disabled:opacity-50"
          >
            {isUploadingDoc ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            Override Transcript
          </button>
        </div>
      </header>

      {analyzeError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-6 py-4 rounded-lg">
          {analyzeError}
        </div>
      )}

      {session.audio_filename && (
        <AudioPlayer src={`http://localhost:8000/api/sessions/${session.id}/audio`} />
      )}

      {/* Transcript — pass both legacy and diarized data */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <TranscriptView
            transcript={session.transcript_raw || session.transcript}
            diarizedTurns={session.transcript_diarized}
            speakerCount={session.speaker_count}
            sessionId={session.id}
            onRenameSpeaker={handleRenameSpeaker}
            onEditTurn={handleEditTurn}
            initiallyExpanded={!session.analysis}
          />
        </div>
        <div className="lg:w-72 shrink-0">
          <SpeakerStats
            diarizedTurns={session.transcript_diarized}
            onMergeSpeaker={handleMergeSpeaker}
            onRemoveSpeaker={handleRemoveSpeaker}
          />
        </div>
      </div>

      {/* Analysis Section */}
      {session.analysis ? (
        <AnalysisCard analysis={session.analysis} />
      ) : (
        <div className="bg-black/20 border border-[#2C3E50] rounded-xl p-8 text-center mt-8">
          <h3 className="text-2xl font-serif text-brand-cream mb-4">No Clinical Analysis Yet</h3>
          <p className="text-brand-sage/80 mb-8 max-w-lg mx-auto">
            This session has been transcribed but not yet analyzed against your knowledge base. Run the RAG pipeline to extract clinical insights.
          </p>
          
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="inline-flex items-center gap-2 bg-brand-accent text-brand-navy px-8 py-3 rounded font-medium hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Analyzing with RAG...
              </>
            ) : (
              <>
                Generate Analysis <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
