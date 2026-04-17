import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, FileAudio, CheckCircle, Clock, Trash2 } from 'lucide-react'

export default function SessionRow({ session, onDelete, isSelected, onToggleSelect }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const navigate = useNavigate()

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

  const handleDeleteClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowConfirm(true)
  }

  const handleConfirmDelete = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDeleting(true)
    try {
      await onDelete(session.id)
    } catch {
      setIsDeleting(false)
    }
  }

  const handleCancelDelete = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowConfirm(false)
  }

  const handleCheckbox = (e) => {
    e.stopPropagation()
    onToggleSelect(session.id)
  }

  return (
    <div className="relative group">
      <div
        onClick={() => navigate(`/sessions/${session.id}`)}
        id={`session-row-${session.id}`}
        className={`block bg-black/20 hover:bg-black/40 border rounded-xl p-5 transition-all duration-200 hover:border-brand-sage/50 cursor-pointer ${
          isSelected ? 'border-brand-accent/60 bg-brand-accent/5' : 'border-[#2C3E50]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Checkbox */}
            <div onClick={handleCheckbox} className="flex-shrink-0">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleCheckbox}
                className="w-4 h-4 rounded accent-brand-accent cursor-pointer"
              />
            </div>

            <div className="bg-brand-sage/10 p-3 rounded-lg text-brand-sage">
              <FileAudio size={24} />
            </div>

            <div>
              <h3 className="text-xl font-serif text-brand-cream group-hover:text-brand-accent transition-colors">
                Session — {dateStr}
              </h3>
              <div className="flex items-center gap-4 mt-2 text-sm text-brand-sage/70">
                <span className="flex items-center gap-1">
                  <Clock size={14} /> {timeStr}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session.has_analysis ? (
              <span className="flex items-center gap-2 px-3 py-1 bg-brand-sage/20 text-brand-sage rounded-full text-sm font-medium border border-brand-sage/20">
                <CheckCircle size={14} /> Analyzed
              </span>
            ) : (
              <span className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 text-yellow-500/80 rounded-full text-sm font-medium border border-yellow-500/20">
                <Clock size={14} /> Pending Analysis
              </span>
            )}

            {/* Delete button */}
            <button
              onClick={handleDeleteClick}
              id={`delete-session-${session.id}`}
              className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-brand-sage/40 hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/20 transition-all duration-200 cursor-pointer"
              title="Delete session"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation overlay */}
      {showConfirm && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl border border-red-500/30 animate-fade-in"
          onClick={handleCancelDelete}
        >
          <div
            className="flex items-center gap-4 px-6 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-brand-cream text-sm font-medium">
              Delete this session permanently?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium text-brand-sage/80 bg-black/40 border border-[#2C3E50] hover:bg-black/60 hover:text-brand-cream transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500/80 border border-red-500/40 hover:bg-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
