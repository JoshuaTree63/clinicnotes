import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { FileUp, List, LayoutDashboard, Library } from 'lucide-react'

export default function Layout() {
  return (
    <div className="flex h-screen w-full font-sans text-brand-cream bg-brand-navy">
      {/* Sidebar Navigation */}
      <nav className="w-64 bg-opacity-20 bg-black p-6 border-r border-[#2C3E50] flex flex-col">
        <div className="mb-10">
          <h1 className="text-2xl font-serif text-brand-accent mb-1 border-b pb-2 border-brand-accent/20">
            ClinicNotes
          </h1>
          <p className="text-xs text-brand-sage">Therapeutic Analysis Engine</p>
        </div>

        <div className="space-y-4 flex-grow">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                isActive ? 'bg-brand-sage/20 text-brand-accent' : 'hover:bg-brand-sage/10 text-brand-cream/70 hover:text-brand-cream'
              }`
            }
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          
          <NavLink
            to="/upload"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                isActive ? 'bg-brand-sage/20 text-brand-accent' : 'hover:bg-brand-sage/10 text-brand-cream/70 hover:text-brand-cream'
              }`
            }
          >
            <FileUp size={20} />
            <span>Upload Session</span>
          </NavLink>

          <NavLink
            to="/sessions"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                isActive ? 'bg-brand-sage/20 text-brand-accent' : 'hover:bg-brand-sage/10 text-brand-cream/70 hover:text-brand-cream'
              }`
            }
          >
            <List size={20} />
            <span>Session History</span>
          </NavLink>

          <NavLink
            to="/library"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                isActive ? 'bg-brand-sage/20 text-brand-accent' : 'hover:bg-brand-sage/10 text-brand-cream/70 hover:text-brand-cream'
              }`
            }
          >
            <Library size={20} />
            <span>Knowledge Base</span>
          </NavLink>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-[#1A2436] p-8">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
