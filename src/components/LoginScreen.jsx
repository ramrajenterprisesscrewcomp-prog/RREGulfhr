import { useState } from 'react'

const CRED_EMAIL = 'ramrajenterprises.screwcomp@gmail.com'
const CRED_PASS  = 'RRE@1234'
const SESSION_KEY = 'rre_session'

export function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY)
}

export default function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    // Small delay for feel
    await new Promise((r) => setTimeout(r, 400))
    if (email.trim().toLowerCase() === CRED_EMAIL && password === CRED_PASS) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onLogin()
    } else {
      setError('Invalid email or password')
    }
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0d1117',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 400, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(79,143,247,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: 380, background: '#111620', borderRadius: 16,
        border: '1px solid #1e2533', padding: '36px 32px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #1a3a6e 0%, #0f2040 100%)',
            border: '1px solid rgba(79,143,247,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            fontSize: 22, fontWeight: 800, color: '#4f8ff7',
            letterSpacing: -1,
          }}>R</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#e8eaf0', letterSpacing: -0.3 }}>
            RRE HR Consultancy
          </div>
          <div style={{ fontSize: 12, color: '#4a5568', marginTop: 4 }}>
            Sign in to continue
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 6, letterSpacing: 0.3 }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              placeholder="Enter your email"
              autoComplete="email"
              required
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#4f8ff7'}
              onBlur={(e)  => e.target.style.borderColor = '#1e2533'}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 6, letterSpacing: 0.3 }}>
              PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                style={{ ...inputStyle, paddingRight: 38 }}
                onFocus={(e) => e.target.style.borderColor = '#4f8ff7'}
                onBlur={(e)  => e.target.style.borderColor = '#1e2533'}
              />
              <button type="button" onClick={() => setShowPass((v) => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#4a5568', fontSize: 11, fontFamily: 'DM Sans, sans-serif',
                  padding: '2px 4px',
                }}>
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 14, padding: '8px 12px', borderRadius: 7,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              fontSize: 12, color: '#ef4444', textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width: '100%', padding: '11px', borderRadius: 9,
              border: 'none',
              background: loading || !email || !password
                ? 'rgba(79,143,247,0.25)'
                : 'linear-gradient(135deg, #3b6fd4 0%, #1a4db8 100%)',
              color: loading || !email || !password ? '#4a6a9a' : '#fff',
              fontSize: 13, fontWeight: 700, cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'all 0.15s',
              letterSpacing: 0.2,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: '#1e2533' }}>
          RRE HR Consultancy · Internal Dashboard
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
  background: '#0d1117', border: '1px solid #1e2533', borderRadius: 8,
  color: '#e8eaf0', fontSize: 13, fontFamily: 'DM Sans, sans-serif',
  outline: 'none', transition: 'border-color 0.15s',
}
