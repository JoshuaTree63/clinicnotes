import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSessions, getIndexStatus } from '../api/client'
import StatusBar from '../components/StatusBar'
import { FileUp, List } from 'lucide-react'

export default function Home() {
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await getSessions()
      return data
    }
  })

  const { data: indexStatus, isLoading: indexLoading } = useQuery({
    queryKey: ['indexStatus'],
    queryFn: async () => {
      const { data } = await getIndexStatus()
      return data
    }
  })

  return (
    <div className="space-y-10 animate-fade-in py-6">
      <header className="border-b border-brand-sage/20 pb-6">
        <h1 className="text-4xl font-serif text-brand-cream tracking-tight mb-2">
          Clinical Dashboard
        </h1>
        <p className="text-brand-sage/80 text-lg">
          Overview of your stored sessions and literature index.
        </p>
      </header>

      {/* Status Indicators */}
      {(sessionsLoading || indexLoading) ? (
        <div className="h-32 bg-black/10 animate-pulse rounded-xl border border-[#2C3E50]" />
      ) : (
        <StatusBar 
          sessionsCount={sessions.length} 
          indexedCount={indexStatus?.indexed_chunks || 0} 
        />
      )}

      {/* Quick Actions */}
      <section>
        <h2 className="text-2xl font-serif text-brand-cream/90 mb-6">Quick Actions</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Link to="/upload" className="group p-8 rounded-xl bg-gradient-to-br from-brand-sage/20 to-black/20 border border-brand-sage/20 hover:border-brand-accent transition-all duration-300">
            <FileUp className="text-brand-accent mb-4 group-hover:scale-110 transition-transform" size={32} />
            <h3 className="text-xl font-medium text-brand-cream mb-2">Upload Audio Session</h3>
            <p className="text-sm text-brand-cream/60 leading-relaxed">
              Process a new audio recording to generate a transcript and extract clinical themes.
            </p>
          </Link>

          <Link to="/sessions" className="group p-8 rounded-xl bg-gradient-to-br from-black/20 to-brand-sage/10 border border-[#2C3E50] hover:border-brand-cream/30 transition-all duration-300">
            <List className="text-brand-sage mb-4 group-hover:scale-110 transition-transform" size={32} />
            <h3 className="text-xl font-medium text-brand-cream mb-2">Review Past Sessions</h3>
            <p className="text-sm text-brand-cream/60 leading-relaxed">
              Examine historical transcripts, view generated analyses, and review literature connections.
            </p>
          </Link>
        </div>
      </section>
    </div>
  )
}
