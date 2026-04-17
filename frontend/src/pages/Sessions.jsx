import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSessions, deleteSession } from '../api/client'
import SessionRow from '../components/SessionRow'
import { Inbox, Trash2 } from 'lucide-react'

export default function Sessions() {
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await getSessions()
      return data
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (sessionId) => deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    }
  })

  const handleDelete = async (sessionId) => {
    await deleteMutation.mutateAsync(sessionId)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(sessionId)
      return next
    })
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = sessions.length > 0 && selectedIds.size === sessions.length

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(sessions.map(s => s.id)))
  }

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true)
    try {
      await Promise.all([...selectedIds].map(id => deleteSession(id)))
      setSelectedIds(new Set())
      setShowBulkConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    } finally {
      setIsBulkDeleting(false)
    }
  }

  return (
    <div className="py-8 animate-fade-in">
      <header className="border-b border-brand-sage/20 pb-6 mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif text-brand-cream mb-2">Session History</h1>
          <p className="text-brand-sage/80">Review previous session transcripts and analyses.</p>
        </div>
        <div className="text-sm px-4 py-2 bg-black/30 rounded-full text-brand-cream/60 border border-brand-sage/10">
          {sessions.length} {sessions.length === 1 ? 'Record' : 'Records'}
        </div>
      </header>

      {/* Bulk action bar */}
      {sessions.length > 0 && !isLoading && (
        <div className="flex items-center justify-between mb-4 px-1">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-brand-sage/70 hover:text-brand-sage select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded accent-brand-accent cursor-pointer"
            />
            {allSelected ? 'Deselect all' : 'Select all'}
          </label>

          {selectedIds.size > 0 && (
            showBulkConfirm ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-brand-cream/70">
                  Delete {selectedIds.size} session{selectedIds.size !== 1 ? 's' : ''}?
                </span>
                <button
                  onClick={() => setShowBulkConfirm(false)}
                  className="px-3 py-1.5 rounded-lg text-brand-sage/80 bg-black/40 border border-[#2C3E50] hover:bg-black/60 hover:text-brand-cream transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white bg-red-500/80 border border-red-500/40 hover:bg-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isBulkDeleting ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} /> Confirm
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowBulkConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 transition-all cursor-pointer"
              >
                <Trash2 size={14} />
                Delete selected ({selectedIds.size})
              </button>
            )
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-black/10 animate-pulse rounded-xl border border-[#2C3E50]" />
          ))}
        </div>
      ) : error ? (
        <div className="text-red-400 bg-red-900/10 p-4 rounded border border-red-900/30">
          Failed to load sessions. Ensure the backend is running.
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20 bg-black/10 rounded-xl border border-dashed border-[#2C3E50]">
          <Inbox className="mx-auto h-12 w-12 text-brand-sage/40 mb-3" />
          <h3 className="text-xl text-brand-cream/80 font-medium">No sessions yet</h3>
          <p className="text-brand-sage/60 mt-2">Upload your first audio file to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map(s => (
            <SessionRow
              key={s.id}
              session={s}
              onDelete={handleDelete}
              isSelected={selectedIds.has(s.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
