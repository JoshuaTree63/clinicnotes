import React, { useEffect, useRef, useState } from 'react'

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]

export default function AudioPlayer({ src }) {
  const audioRef = useRef(null)
  const [rate, setRate] = useState(1)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
    }
  }, [rate])

  return (
    <div className="sticky top-0 z-10 bg-white border border-black rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <span className="text-xs font-semibold text-black uppercase tracking-wide shrink-0">
        Audio
      </span>
      <audio
        ref={audioRef}
        src={src}
        controls
        preload="metadata"
        className="flex-1 min-w-0"
      />
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-[#4a4a4a] mr-1">Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRate(s)}
            className={`text-xs font-medium px-2 py-1 border border-black transition-colors ${
              rate === s
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-black hover:text-white'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}
