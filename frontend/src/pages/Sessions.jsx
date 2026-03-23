import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSessions } from '../api/client'
import SessionRow from '../components/SessionRow'
import { Inbox } from 'lucide-react'

export default function Sessions() {
  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await getSessions()
      return data
    }
  })

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
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  )
}
