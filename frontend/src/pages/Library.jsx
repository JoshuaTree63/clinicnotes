import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIndexStatus, indexPdfs } from '../api/client'
import { BookOpen, RefreshCw, CheckCircle, Database } from 'lucide-react'

export default function Library() {
  const queryClient = useQueryClient()
  const [indexMessage, setIndexMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const { data: status, isLoading } = useQuery({
    queryKey: ['indexStatus'],
    queryFn: async () => {
      const { data } = await getIndexStatus()
      return data
    }
  })

  const indexMutation = useMutation({
    mutationFn: indexPdfs,
    onMutate: () => {
      setIndexMessage('')
      setErrorMsg('')
    },
    onSuccess: (res) => {
      setIndexMessage(`Success: ${res.data.message}. Processed ${res.data.pdfs_processed} PDFs into ${res.data.chunks_stored} chunks.`)
      queryClient.invalidateQueries(['indexStatus'])
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.detail || err.message || 'Indexing failed')
    }
  })

  return (
    <div className="max-w-4xl mx-auto py-8 animate-fade-in space-y-8">
      <header className="border-b border-brand-sage/20 pb-6">
        <h1 className="text-4xl font-serif text-brand-cream mb-2 flex items-center gap-3">
          <BookOpen className="text-brand-accent" /> Knowledge Base
        </h1>
        <p className="text-brand-sage/80 text-lg">
          Manage your clinical literature index that powers the AI analysis engine.
        </p>
      </header>

      {/* Status Card */}
      <div className="bg-black/20 border border-[#2C3E50] rounded-xl p-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="bg-brand-sage/10 p-4 rounded-full text-brand-sage">
            <Database size={32} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-brand-sage/70 uppercase tracking-wider mb-1">
              Current Index Status
            </h3>
            {isLoading ? (
              <div className="h-8 w-32 bg-brand-sage/10 animate-pulse rounded" />
            ) : (
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-serif text-brand-cream">
                  {status?.indexed_chunks || 0}
                </span>
                <span className="text-brand-sage">chunks stored</span>
              </div>
            )}
          </div>
        </div>

        <div>
          {status?.ready ? (
            <span className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-full text-sm font-medium border border-green-500/20">
              <CheckCircle size={16} /> Online & Ready
            </span>
          ) : (
            <span className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-500 rounded-full text-sm font-medium border border-yellow-500/20">
              Queue Empty
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-[#121A2F] border border-brand-sage/20 rounded-xl p-8">
        <h3 className="text-2xl font-serif text-brand-cream mb-4">Update Indexed Literature</h3>
        <p className="text-brand-cream/70 mb-6 leading-relaxed">
          When you add new clinical PDFs to the <code className="bg-black/30 px-2 py-0.5 rounded text-brand-sage">backend/data/pdfs/</code> folder on your server, 
          run the indexer to add their contents to the ChromaDB vector database.
        </p>

        {errorMsg && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded">
            {errorMsg}
          </div>
        )}

        {indexMessage && (
          <div className="mb-6 bg-brand-sage/10 border border-brand-sage/30 text-brand-sage px-4 py-3 rounded">
            {indexMessage}
          </div>
        )}

        <button
          onClick={() => indexMutation.mutate()}
          disabled={indexMutation.isPending}
          className="flex items-center gap-3 bg-brand-accent/10 border border-brand-accent/30 text-brand-accent hover:bg-brand-accent/20 px-6 py-3 rounded transition-colors disabled:opacity-50 font-medium"
        >
          <RefreshCw size={20} className={indexMutation.isPending ? 'animate-spin' : ''} />
          {indexMutation.isPending ? 'Processing PDFs...' : 'Re-index Documents'}
        </button>
      </div>
    </div>
  )
}
