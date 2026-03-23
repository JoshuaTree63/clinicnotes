import React, { useState } from 'react'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'

export default function TranscriptView({ transcript, initiallyExpanded = true }) {
  const [expanded, setExpanded] = useState(initiallyExpanded)

  if (!transcript) return null

  return (
    <div className="bg-[#121A2F] border border-brand-sage/20 rounded-lg overflow-hidden flex flex-col">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-6 py-4 bg-black/20 hover:bg-black/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText className="text-brand-accent" size={20} />
          <h3 className="text-lg font-serif">Session Transcript</h3>
        </div>
        {expanded ? <ChevronUp size={20} className="text-brand-sage" /> : <ChevronDown size={20} className="text-brand-sage" />}
      </button>

      {expanded && (
        <div className="p-6 overflow-y-auto max-h-[500px] text-brand-cream/80 leading-relaxed font-sans text-sm whitespace-pre-wrap">
          {transcript}
        </div>
      )}
    </div>
  )
}
