import React from 'react'
import { Link } from 'react-router-dom'
import { Calendar, FileAudio, CheckCircle, Clock } from 'lucide-react'

export default function SessionRow({ session }) {
  const d = new Date(session.date)
  const dateStr = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Link
      to={`/sessions/${session.id}`}
      className="block bg-black/20 hover:bg-black/40 border border-[#2C3E50] rounded-xl p-5 transition-all duration-200 hover:border-brand-sage/50 group target-row"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-4">
          <div className="bg-brand-sage/10 p-3 rounded-lg text-brand-sage">
            <FileAudio size={24} />
          </div>
          <div>
            <h3 className="text-xl font-serif text-brand-cream group-hover:text-brand-accent transition-colors">
              Session — {dateStr}
            </h3>
            <div className="flex items-center gap-4 mt-2 text-sm text-brand-sage/70">
              <span className="flex items-center gap-1">
                <Calendar size={14} /> {dateStr}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} /> {timeStr}
              </span>
            </div>
          </div>
        </div>

        <div>
          {session.has_analysis ? (
            <span className="flex items-center gap-2 px-3 py-1 bg-brand-sage/20 text-brand-sage rounded-full text-sm font-medium border border-brand-sage/20">
              <CheckCircle size={14} /> Analyzed
            </span>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 text-yellow-500/80 rounded-full text-sm font-medium border border-yellow-500/20">
              <Clock size={14} /> Pending Analysis
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
