import React from 'react'

const themeColors = {
  Psychoanalytic: 'bg-blue-900/40 text-blue-200 border-blue-500/30',
  CBT: 'bg-green-900/40 text-green-200 border-green-500/30',
  Jungian: 'bg-purple-900/40 text-purple-200 border-purple-500/30',
  DBT: 'bg-orange-900/40 text-orange-200 border-orange-500/30',
  ACT: 'bg-teal-900/40 text-teal-200 border-teal-500/30',
  Humanistic: 'bg-pink-900/40 text-pink-200 border-pink-500/30',
  default: 'bg-brand-sage/20 text-brand-cream border-brand-sage/30',
}

export default function ThemeTag({ text, type = 'theme' }) {
  let colorClass = themeColors.default

  if (type === 'school') {
    // Try to match the school name to a color
    const key = Object.keys(themeColors).find(k => k !== 'default' && text.toLowerCase().includes(k.toLowerCase()))
    if (key) colorClass = themeColors[key]
  }

  return (
    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${colorClass} inline-flex items-center`}>
      {text}
    </span>
  )
}
