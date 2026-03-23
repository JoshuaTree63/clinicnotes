import React from 'react'
import ThemeTag from './ThemeTag'
import { BookOpen, AlertCircle, Quote, BrainCircuit } from 'lucide-react'

export default function AnalysisCard({ analysis }) {
  if (!analysis) return null

  return (
    <div className="space-y-6">
      {/* Top row: Schools & Summary */}
      <div className="bg-[#121A2F] border border-brand-sage/30 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4 text-brand-accent">
          <BrainCircuit size={24} />
          <h2 className="text-2xl font-serif">Clinical Analysis</h2>
        </div>
        
        <p className="text-brand-cream/90 leading-relaxed text-lg mb-6">
          {analysis.summary}
        </p>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-brand-sage/70 mb-2 uppercase tracking-wider">
              Schools Detected
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.schools_detected?.map((school, i) => (
                <ThemeTag key={i} text={school} type="school" />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-brand-sage/70 mb-2 uppercase tracking-wider">
              Key Themes
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.themes?.map((theme, i) => (
                <ThemeTag key={i} text={theme} type="theme" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notable Moments */}
      <div className="bg-black/20 border border-[#2C3E50] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6 text-brand-sage">
          <AlertCircle size={20} />
          <h3 className="text-xl font-serif">Notable Moments</h3>
        </div>
        
        <div className="space-y-4">
          {analysis.notable_moments?.map((moment, i) => (
            <div key={i} className="bg-black/20 rounded-lg p-4 border border-brand-sage/10">
              <div className="flex gap-3 mb-3">
                <Quote size={16} className="text-brand-accent/50 shrink-0 mt-1" />
                <p className="italic text-brand-cream/80 text-sm">
                  "{moment.quote}"
                </p>
              </div>
              <div className="pl-7 text-sm text-brand-sage leading-relaxed border-l-2 border-brand-sage/20 ml-2">
                {moment.interpretation}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Literature Core */}
      <div className="bg-black/20 border border-[#2C3E50] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6 text-brand-sage">
          <BookOpen size={20} />
          <h3 className="text-xl font-serif">Literature Connections</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-brand-sage/70 mb-3 uppercase tracking-wider">
              Suggested Concepts
            </h4>
            <ul className="list-disc list-inside text-brand-cream/80 space-y-2 text-sm">
              {analysis.suggested_concepts?.map((concept, i) => (
                <li key={i}>{concept}</li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-brand-sage/70 mb-3 uppercase tracking-wider">
              References
            </h4>
            <ul className="space-y-3">
              {analysis.literature_references?.map((ref, i) => (
                <li key={i} className="text-sm text-brand-cream/80 bg-brand-navy/50 p-3 rounded border border-brand-sage/10 flex items-start gap-2">
                  <BookOpen size={14} className="shrink-0 mt-0.5 text-brand-accent" />
                  <span>{ref}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
