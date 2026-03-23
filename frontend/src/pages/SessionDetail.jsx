import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSession, analyzeSession } from '../api/client'
import TranscriptView from '../components/TranscriptView'
import AnalysisCard from '../components/AnalysisCard'
import { Loader2, ArrowRight, Calendar, ArrowLeft } from 'lucide-react'

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [analyzeError, setAnalyzeError] = useState('')

  const { data: session, isLoading, error } = useQuery({
    queryKey: ['session', id],
    queryFn: async () => {
      const { data } = await getSession(id)
      return data
    }
  })

  // Mutation to trigger analysis
  const analyzeMutation = useMutation({
    mutationFn: () => analyzeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['session', id])
      queryClient.invalidateQueries(['sessions'])
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

  return (
    <div className="py-6 animate-fade-in space-y-8">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-brand-sage/80 hover:text-brand-cream transition-colors text-sm font-medium"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <header className="border-b border-brand-sage/20 pb-6">
        <h1 className="text-3xl font-serif text-brand-cream mb-3">
          Session Record
        </h1>
        <div className="flex items-center gap-4 text-brand-sage/80">
          <span className="flex items-center gap-1.5"><Calendar size={16} /> {dateStr}</span>
          <span className="bg-black/20 px-3 py-1 rounded text-xs border border-[#2C3E50]">
            {session.filename}
          </span>
        </div>
      </header>

      {analyzeError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-6 py-4 rounded-lg">
          {analyzeError}
        </div>
      )}

      {/* Transcript Collapsible */}
      <TranscriptView transcript={session.transcript} initiallyExpanded={!session.analysis} />

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
