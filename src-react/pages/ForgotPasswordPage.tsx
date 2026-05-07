import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err: any) {
      setError(err.message ?? 'Could not send reset email. Check the address and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-bg-primary">
      <div className="w-full max-w-sm px-6 animate-slide-up">
        <div className="text-center mb-8">
          <img src="/transparentlogo.png" alt="" className="w-24 h-24 object-contain mx-auto" />
          <h1 className="text-2xl font-bold text-text-primary">Reset password</h1>
          <p className="text-text-secondary text-sm mt-1">We'll send you a reset link</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Reset email sent! Check your inbox.
            </p>
            <Link to="/login" className="block text-sm text-violet-400 hover:text-violet-300 font-medium">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input bg-blue-50 border-blue-200 focus:ring-blue-300"
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>

            <p className="text-center text-sm text-text-muted">
              <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
