import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, MessageSquare, Users } from 'lucide-react'

/**
 * Parse a plain-text transcript string into structured messages.
 * Used as a fallback when diarized turns are not available (legacy sessions).
 */
function parseTranscript(transcriptString) {
  if (!transcriptString) return []

  const lines = transcriptString.split('\n')
  const messages = []
  let currentSpeaker = null
  let currentText = []

  // Match lines like "Speaker 1: hello" or "Patient: hello" or "מטפל: שלום"
  const speakerRegex = /^([a-zA-Zא-ת\s\d_-]+):\s*(.*)$/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const match = line.match(speakerRegex)
    
    // Safety check on speaker name length to avoid false positives
    if (match && match[1].length < 30) { 
      // Save previous speaker block
      if (currentSpeaker) {
        messages.push({
          speaker: currentSpeaker,
          text: currentText.join('\n')
        })
      }
      currentSpeaker = match[1].trim()
      currentText = [match[2].trim()]
    } else {
      // Continuation of current text
      if (currentSpeaker) {
        currentText.push(line)
      } else {
        // Edge case: no speaker detected yet
        currentSpeaker = 'Unknown'
        currentText.push(line)
      }
    }
  }

  // push last block
  if (currentSpeaker) {
    messages.push({
      speaker: currentSpeaker,
      text: currentText.join('\n')
    })
  }

  return messages
}

/**
 * Assigns a consistent color to each speaker based on their label.
 */
const SPEAKER_COLORS = [
  { bg: 'rgba(107, 142, 35, 0.12)', border: 'rgba(107, 142, 35, 0.25)', label: '#8FBC5A' },  // sage-green
  { bg: 'rgba(100, 149, 237, 0.12)', border: 'rgba(100, 149, 237, 0.25)', label: '#6495ED' },  // cornflower-blue
  { bg: 'rgba(218, 165, 32, 0.12)', border: 'rgba(218, 165, 32, 0.25)', label: '#DAA520' },   // goldenrod
  { bg: 'rgba(205, 92, 92, 0.12)', border: 'rgba(205, 92, 92, 0.25)', label: '#CD5C5C' },     // indian-red
  { bg: 'rgba(147, 112, 219, 0.12)', border: 'rgba(147, 112, 219, 0.25)', label: '#9370DB' },  // medium-purple
]

function getSpeakerColor(speaker, speakerMap) {
  if (!speakerMap.has(speaker)) {
    speakerMap.set(speaker, speakerMap.size % SPEAKER_COLORS.length)
  }
  return SPEAKER_COLORS[speakerMap.get(speaker)]
}


export default function TranscriptView({ transcript, diarizedTurns, speakerCount, initiallyExpanded = true }) {
  const [expanded, setExpanded] = useState(initiallyExpanded)

  // Use diarized turns if available, else fall back to parsing the string
  const messages = useMemo(() => {
    if (diarizedTurns && diarizedTurns.length > 0) {
      return diarizedTurns
    }
    return parseTranscript(transcript)
  }, [diarizedTurns, transcript])

  // Build a stable speaker → color index map
  const speakerMap = useMemo(() => new Map(), [messages])

  if (!transcript && (!diarizedTurns || diarizedTurns.length === 0)) return null

  const isStructured = messages.length > 1 || (messages.length === 1 && messages[0].speaker !== 'Unknown')

  return (
    <div className="bg-[#121A2F] border border-brand-sage/20 rounded-lg overflow-hidden flex flex-col">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-6 py-4 bg-black/20 hover:bg-black/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <MessageSquare className="text-brand-accent" size={20} />
          <h3 className="text-lg font-serif">Session Transcript</h3>
          {speakerCount && (
            <span className="flex items-center gap-1 text-xs text-brand-sage/60 bg-black/20 px-2.5 py-1 rounded-full border border-brand-sage/10">
              <Users size={12} />
              {speakerCount} speaker{speakerCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={20} className="text-brand-sage" /> : <ChevronDown size={20} className="text-brand-sage" />}
      </button>

      {expanded && (
        <div className="p-6 overflow-y-auto max-h-[600px] bg-black/10">
          {isStructured ? (
            <div className="flex flex-col gap-3">
              {messages.map((msg, index) => {
                const color = getSpeakerColor(msg.speaker, speakerMap)
                const isEven = (speakerMap.get(msg.speaker) % 2) === 0

                return (
                  <div key={index} className={`flex w-full ${isEven ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className="max-w-[85%] rounded-2xl p-4 shadow-sm"
                      style={{
                        backgroundColor: color.bg,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: color.border,
                        borderTopLeftRadius: isEven ? '4px' : undefined,
                        borderTopRightRadius: !isEven ? '4px' : undefined,
                      }}
                    >
                      <div
                        className={`text-xs font-semibold mb-1.5 uppercase tracking-wide ${isEven ? 'text-left' : 'text-right'}`}
                        style={{ color: color.label }}
                      >
                        {msg.speaker}
                      </div>
                      <div
                        className={`whitespace-pre-wrap text-sm leading-relaxed text-brand-cream/90 ${isEven ? 'text-left' : 'text-right'}`}
                        dir="auto"
                      >
                        {msg.text}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            // Fallback for unstructured text
            <div className="text-brand-cream/80 leading-relaxed font-sans text-sm whitespace-pre-wrap" dir="auto">
              {transcript}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
