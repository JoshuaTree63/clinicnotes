import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { FileUp, List, LayoutDashboard, Library } from 'lucide-react'

export default function Layout() {
  return (
    <div className="flex flex-col h-screen w-full font-sans text-brand-cream bg-brand-navy">
      {/* Top Navigation Bar */}
      <nav className="w-full bg-white border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-black tracking-tight">
              clinicnotes
            </h1>
            <span className="text-xs text-brand-sage border-l border-black pl-3">
              Therapeutic Analysis Engine
            </span>
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-sm font-medium border border-transparent transition-colors ${
                  isActive
                    ? 'bg-black text-white border-black'
                    : 'text-black hover:bg-black hover:text-white'
                }`
              }
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/upload"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-sm font-medium border border-transparent transition-colors ${
                  isActive
                    ? 'bg-black text-white border-black'
                    : 'text-black hover:bg-black hover:text-white'
                }`
              }
            >
              <FileUp size={16} />
              <span>Upload Session</span>
            </NavLink>

            <NavLink
              to="/sessions"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-sm font-medium border border-transparent transition-colors ${
                  isActive
                    ? 'bg-black text-white border-black'
                    : 'text-black hover:bg-black hover:text-white'
                }`
              }
            >
              <List size={16} />
              <span>Session History</span>
            </NavLink>

            <NavLink
              to="/library"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-sm font-medium border border-transparent transition-colors ${
                  isActive
                    ? 'bg-black text-white border-black'
                    : 'text-black hover:bg-black hover:text-white'
                }`
              }
            >
              <Library size={16} />
              <span>Knowledge Base</span>
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-white p-8">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
