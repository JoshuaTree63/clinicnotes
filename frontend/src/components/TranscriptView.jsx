import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'

// Helper to parse transcript string into structured messages
function parseTranscript(transcriptString) {
  if (!transcriptString) return []

  const lines = transcriptString.split('\n')
  const messages = []
  let currentSpeaker = null
  let currentText = []

  // Match lines like "Patient: hello" or "מטפל: שלום"
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

export default function TranscriptView({ transcript, initiallyExpanded = true }) {
  const [expanded, setExpanded] = useState(initiallyExpanded)

  const messages = useMemo(() => parseTranscript(transcript), [transcript])

  if (!transcript) return null

  // If we couldn't parse it well (maybe just one huge block), fallback to raw
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
        </div>
        {expanded ? <ChevronUp size={20} className="text-brand-sage" /> : <ChevronDown size={20} className="text-brand-sage" />}
      </button>

      {expanded && (
        <div className="p-6 overflow-y-auto max-h-[600px] bg-black/10">
          {isStructured ? (
            <div className="flex flex-col gap-4">
              {messages.map((msg, index) => {
                const isTherapist = msg.speaker.toLowerCase().includes('therapist') || msg.speaker.includes('מטפל') || msg.speaker.includes('מראיין')
                const isPatient = msg.speaker.toLowerCase().includes('patient') || msg.speaker.includes('מטופל') || msg.speaker.includes('מרואיין')
                
                // Determine styling based on speaker role
                let bubbleClass = "max-w-[85%] rounded-2xl p-4 shadow-sm"
                let containerClass = "flex w-full"
                
                if (isTherapist) {
                  // Therapist on the left styling
                  containerClass += " justify-start"
                  bubbleClass += " bg-brand-sage/10 border border-brand-sage/20 text-brand-cream/90 rounded-tl-sm"
                } else if (isPatient) {
                  // Patient on the right styling
                  containerClass += " justify-end"
                  bubbleClass += " bg-brand-accent/10 border border-brand-accent/20 text-brand-cream/90 rounded-tr-sm"
                } else {
                  // Default unknown or other speaker
                  containerClass += " justify-start"
                  bubbleClass += " bg-white/5 border border-white/10 text-brand-cream/80"
                }

                return (
                  <div key={index} className={containerClass}>
                    <div className={bubbleClass}>
                      <div className={`text-xs font-semibold mb-1 uppercase tracking-wide opacity-70 ${isPatient ? 'text-right' : 'text-left'}`}>
                        {msg.speaker}
                      </div>
                      <div className={`whitespace-pre-wrap text-sm leading-relaxed ${isPatient ? 'text-right' : 'text-left'}`} dir="auto">
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
