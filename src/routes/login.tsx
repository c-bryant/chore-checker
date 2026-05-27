import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { login, signup } from '@netlify/identity'
import { useIdentity } from '../lib/identity-context'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'parent' | 'kid'>('parent')
  const [status, setStatus] = useState<'idle' | 'loading' | 'confirm-email' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (ready && user) navigate({ to: '/dashboard' })
  }, [ready, user])

  const handleLogin = async () => {
    setStatus('loading')
    try {
      await login(email, password)
      navigate({ to: '/dashboard' })
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Check your email and password.')
      setStatus('error')
    }
  }

  const handleSignup = async () => {
    setStatus('loading')
    try {
      await signup(email, password, { full_name: name, role })
      setStatus('confirm-email')
    } catch (err: any) {
      setErrorMsg(err.message || 'Signup failed. Try a different email.')
      setStatus('error')
    }
  }

  if (!ready) return <div className="min-h-screen bg-amber-50 flex items-center justify-center"><div className="text-2xl">🌟</div></div>

  if (status === 'confirm-email') {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">📬</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Check your email!</h2>
          <p className="text-gray-600 mb-6">A confirmation link was sent to <strong>{email}</strong>. Click it to finish signing up.</p>
          <button onClick={() => setStatus('idle')} className="text-amber-600 underline text-sm">Back to login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🏠</div>
          <h1 className="text-2xl font-bold text-gray-800">Chore Chart</h1>
          <p className="text-gray-500 text-sm mt-1">Family task tracker</p>
        </div>

        <div className="flex gap-2 mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'login' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
          >
            Log in
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
          >
            Sign up
          </button>
        </div>

        <div className="space-y-3">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {mode === 'signup' && (
            <div className="flex gap-2">
              <button
                onClick={() => setRole('parent')}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${role === 'parent' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500'}`}
              >
                👨‍👩‍👧 Parent
              </button>
              <button
                onClick={() => setRole('kid')}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${role === 'kid' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}
              >
                🧒 Kid
              </button>
            </div>
          )}
        </div>

        {status === 'error' && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
        )}

        <button
          onClick={mode === 'login' ? handleLogin : handleSignup}
          disabled={status === 'loading'}
          className="mt-5 w-full bg-amber-400 hover:bg-amber-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? '...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>

        {mode === 'signup' && (
          <p className="mt-4 text-xs text-gray-400 text-center">
            Parents can manage chores &amp; schedules. Kids can mark chores done.
          </p>
        )}
      </div>
    </div>
  )
}
