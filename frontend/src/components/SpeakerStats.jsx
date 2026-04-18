import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, MoreVertical, Trash2, GitMerge } from 'lucide-react'

function countWords(text) {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

function SpeakerRowMenu({ speaker, allSpeakers, onMerge, onRemove, disabled }) {
  const [open, setOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setMergeOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (disabled) return null

  const others = allSpeakers.filter((s) => s !== speaker)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setMergeOpen(false) }}
        className="p-1 text-[#4a4a4a] hover:text-black hover:bg-[#f5f5f5] border border-transparent hover:border-black transition-colors"
        title="Speaker options"
        aria-label="Speaker options"
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-black shadow-lg min-w-[180px]">
          {others.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMergeOpen(!mergeOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-black hover:bg-[#f5f5f5] text-left"
              >
                <span className="flex items-center gap-2">
                  <GitMerge size={14} />
                  Merge into…
                </span>
                <span className="text-xs text-[#4a4a4a]">▸</span>
              </button>
              {mergeOpen && (
                <div className="absolute left-full top-0 ml-[-1px] bg-white border border-black shadow-lg min-w-[160px] max-h-64 overflow-y-auto">
                  {others.map((target) => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        setMergeOpen(false)
                        onMerge(speaker, target)
                      }}
                      className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-[#f5f5f5]"
                    >
                      {target}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              if (window.confirm(`Remove "${speaker}" and delete all of their turns?`)) {
                onRemove(speaker)
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-black hover:bg-[#f5f5f5] text-left border-t border-black"
          >
            <Trash2 size={14} />
            Remove speaker
          </button>
        </div>
      )}
    </div>
  )
}

export default function SpeakerStats({ diarizedTurns, onMergeSpeaker, onRemoveSpeaker }) {
  const stats = useMemo(() => {
    if (!diarizedTurns || diarizedTurns.length === 0) return null

    const totals = new Map()
    for (const turn of diarizedTurns) {
      const speaker = turn.speaker || 'Unknown'
      totals.set(speaker, (totals.get(speaker) || 0) + countWords(turn.text))
    }

    const grand = Array.from(totals.values()).reduce((a, b) => a + b, 0)
    if (grand === 0) return null

    return Array.from(totals.entries())
      .map(([speaker, words]) => ({
        speaker,
        words,
        pct: (words / grand) * 100,
      }))
      .sort((a, b) => b.words - a.words)
  }, [diarizedTurns])

  if (!stats) return null

  const allSpeakers = stats.map((s) => s.speaker)
  const menuDisabled = !onMergeSpeaker && !onRemoveSpeaker

  return (
    <div className="bg-white border border-black rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black">
        <BarChart3 size={16} className="text-black" />
        <h3 className="text-sm font-semibold text-black uppercase tracking-wide">
          Talk Distribution
        </h3>
      </div>
      <div className="p-4 flex flex-col gap-4">
        {stats.map(({ speaker, words, pct }) => (
          <div key={speaker} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-black truncate">{speaker}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-black tabular-nums">
                  {pct.toFixed(1)}%
                </span>
                <SpeakerRowMenu
                  speaker={speaker}
                  allSpeakers={allSpeakers}
                  onMerge={onMergeSpeaker}
                  onRemove={onRemoveSpeaker}
                  disabled={menuDisabled}
                />
              </div>
            </div>
            <div className="h-2 w-full bg-[#f5f5f5] border border-black">
              <div
                className="h-full bg-black"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-[#4a4a4a] tabular-nums">
              {words.toLocaleString()} words
            </span>
          </div>
        ))}
        <div className="pt-2 mt-1 border-t border-black text-xs text-[#4a4a4a]">
          Based on word count per speaker in the transcript.
        </div>
      </div>
    </div>
  )
}
