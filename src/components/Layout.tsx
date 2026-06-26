import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

const tabs = [
  { to: '/', label: 'Inventory', icon: '📦', end: true },
  { to: '/channels', label: 'Channels', icon: '🏬', end: false },
]

export default function Layout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // The add-item FAB only belongs on the list screens, where it won't overlap
  // a form's submit button.
  const showFab = pathname === '/' || pathname === '/channels'

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-[var(--color-paper)]/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand)]">🏷️</span>
          <span className="text-lg font-medium">ResellTracker</span>
        </div>
        <button onClick={signOut} className="text-sm text-stone-500 hover:text-stone-800">
          Sign out
        </button>
      </header>

      <main className="flex-1 px-4 py-4 pb-28">
        <Outlet />
      </main>

      {/* New item floating button — list screens only */}
      {showFab && (
        <button
          onClick={() => navigate('/item/new')}
          className="fixed bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3 text-[15px] font-medium text-white shadow-lg hover:opacity-90"
        >
          <span className="text-lg leading-none">＋</span> Add item
        </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-2xl border-t border-stone-200 bg-white">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${
                isActive ? 'text-[var(--color-brand)]' : 'text-stone-400'
              }`
            }
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
