import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, MessageSquare, Users, Download, Pencil } from 'lucide-react'

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


function formatTimestamp(seconds) {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return null
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

function EditableSpeaker({ speaker, color, align, onRename, disabled }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(speaker)
  const inputRef = useRef(null)

  useEffect(() => { setValue(speaker) }, [speaker])
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = () => {
    const next = value.trim()
    setEditing(false)
    if (!next || next === speaker) {
      setValue(speaker)
      return
    }
    onRename(speaker, next)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { e.preventDefault(); setValue(speaker); setEditing(false) }
        }}
        className={`text-xs font-semibold uppercase tracking-wide bg-white border border-black px-1 py-0.5 outline-none ${align === 'right' ? 'text-right' : 'text-left'}`}
        style={{ color: color.label, minWidth: '8ch' }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => !disabled && setEditing(true)}
      title={disabled ? undefined : 'Click to rename speaker'}
      disabled={disabled}
      className={`group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${align === 'right' ? 'flex-row-reverse' : ''} ${disabled ? 'cursor-default' : 'cursor-text hover:underline'}`}
      style={{ color: color.label }}
    >
      <span>{speaker}</span>
      {!disabled && <Pencil size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />}
    </button>
  )
}

function EditableText({ text, align, onSave, disabled }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(text)
  const ref = useRef(null)

  useEffect(() => { setValue(text) }, [text])
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      const len = ref.current.value.length
      ref.current.setSelectionRange(len, len)
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [editing])

  const commit = () => {
    const next = value.trim()
    setEditing(false)
    if (!next || next === text) {
      setValue(text)
      return
    }
    onSave(next)
  }

  const baseCls = `whitespace-pre-wrap text-sm leading-relaxed text-brand-cream/90 ${align === 'right' ? 'text-right' : 'text-left'}`

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = e.target.scrollHeight + 'px'
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
          if (e.key === 'Escape') { e.preventDefault(); setValue(text); setEditing(false) }
        }}
        dir="auto"
        className={`${baseCls} w-full bg-white text-black border border-black rounded p-2 outline-none resize-none`}
      />
    )
  }

  return (
    <div
      onClick={() => !disabled && setEditing(true)}
      title={disabled ? undefined : 'Click to edit. Cmd/Ctrl+Enter to save, Esc to cancel.'}
      dir="auto"
      className={`${baseCls} ${disabled ? '' : 'cursor-text hover:bg-black/5 rounded px-1 -mx-1 transition-colors'}`}
    >
      {text}
    </div>
  )
}

export default function TranscriptView({ transcript, diarizedTurns, speakerCount, sessionId, onRenameSpeaker, onEditTurn, initiallyExpanded = true }) {
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

  // Derive the count from the turns we're actually rendering so it tracks
  // rename/merge/remove instantly — don't trust the `speakerCount` prop alone.
  const displayedSpeakerCount = useMemo(() => {
    if (messages.length > 0) return new Set(messages.map((m) => m.speaker)).size
    return speakerCount || 0
  }, [messages, speakerCount])

  if (!transcript && (!diarizedTurns || diarizedTurns.length === 0)) return null

  const isStructured = messages.length > 1 || (messages.length === 1 && messages[0].speaker !== 'Unknown')

  return (
    <div className="bg-[#121A2F] border border-brand-sage/20 rounded-lg overflow-hidden flex flex-col">
      <div className="flex items-center justify-between w-full px-6 py-4 bg-black/20">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 flex-1 text-left hover:opacity-70 transition-opacity"
        >
          <MessageSquare className="text-brand-accent" size={20} />
          <h3 className="text-lg font-serif">Session Transcript</h3>
          {displayedSpeakerCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-brand-sage/60 bg-black/20 px-2.5 py-1 rounded-full border border-brand-sage/10">
              <Users size={12} />
              {displayedSpeakerCount} speaker{displayedSpeakerCount !== 1 ? 's' : ''}
            </span>
          )}
        </button>
        <div className="flex items-center gap-3">
          {sessionId && (
            <a
              href={`http://localhost:8000/api/sessions/${sessionId}/transcript.docx`}
              download
              title="Download as Word document"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-black hover:bg-black hover:text-white transition-colors"
            >
              <Download size={14} />
              <span>Word</span>
            </a>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-brand-sage hover:opacity-70 transition-opacity"
            aria-label={expanded ? 'Collapse transcript' : 'Expand transcript'}
          >
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

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
                      <div className={`mb-1.5 flex items-baseline gap-2 ${isEven ? 'justify-start' : 'justify-end flex-row-reverse'}`}>
                        <EditableSpeaker
                          speaker={msg.speaker}
                          color={color}
                          align={isEven ? 'left' : 'right'}
                          onRename={onRenameSpeaker}
                          disabled={!onRenameSpeaker}
                        />
                        {formatTimestamp(msg.start) && (
                          <span
                            className="text-[10px] font-mono tabular-nums text-brand-sage/70"
                            title={`Starts at ${formatTimestamp(msg.start)}${formatTimestamp(msg.end) ? ` · Ends at ${formatTimestamp(msg.end)}` : ''}`}
                          >
                            {formatTimestamp(msg.start)}
                          </span>
                        )}
                      </div>
                      <EditableText
                        text={msg.text}
                        align={isEven ? 'left' : 'right'}
                        onSave={(next) => onEditTurn(index, next)}
                        disabled={!onEditTurn}
                      />
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
