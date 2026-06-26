import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Input, Label } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Account created. You can sign in now.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <span className="mb-3 inline-grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-2xl text-[var(--color-brand)]">🏷️</span>
        <h1 className="text-2xl font-medium">ResellTracker</h1>
        <p className="mt-1 text-sm text-stone-500">Track what you sell and consign.</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <Button type="submit" variant="primary" disabled={busy} className="w-full">
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      {msg && <p className="mt-3 text-center text-sm text-stone-600">{msg}</p>}

      <button
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        className="mt-4 text-center text-sm text-stone-500 hover:text-stone-800"
      >
        {mode === 'signin' ? "Need an account? Create one" : 'Have an account? Sign in'}
      </button>
    </div>
  )
}
