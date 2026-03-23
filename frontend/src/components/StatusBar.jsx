import React from 'react'

export default function StatusBar({ sessionsCount, indexedCount }) {
  return (
    <div className="flex gap-4">
      <div className="bg-black/30 border border-[#2C3E50] rounded-lg px-6 py-4 flex-1">
        <div className="text-sm text-brand-sage/70 mb-1">Stored Sessions</div>
        <div className="text-3xl font-serif text-brand-cream">{sessionsCount}</div>
      </div>
      
      <div className="bg-black/30 border border-[#2C3E50] rounded-lg px-6 py-4 flex-1">
        <div className="text-sm text-brand-sage/70 mb-1">Knowledge Base</div>
        <div className="text-3xl font-serif text-brand-cream">
          {indexedCount}{" "}
          <span className="text-base text-brand-cream/40 font-sans">chunks indexed</span>
        </div>
      </div>
    </div>
  )
}
