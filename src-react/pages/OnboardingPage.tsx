import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check, Users, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSpace } from '../context/SpaceContext'

export default function OnboardingPage() {
  const { userProfile } = useAuth()
  const { createSpace, joinSpace } = useSpace()
  const navigate = useNavigate()

  const [step, setStep] = useState<'choose' | 'create' | 'join'>('choose')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCreateSpace = async () => {
    setLoading(true)
    await createSpace()
    setStep('create')
    setLoading(false)
  }

  const handleCopy = () => {
    if (userProfile?.inviteCode) {
      navigator.clipboard.writeText(userProfile.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await joinSpace(inviteCode)
    if (result.success) {
      navigate('/calendar')
    } else {
      setError(result.error ?? 'Failed to join')
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center h-screen bg-bg-primary">
      <div className="w-full max-w-sm px-6 animate-slide-up">
        {step === 'choose' && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-text-primary">Set up your space</h1>
              <p className="text-text-secondary text-sm mt-2">
                You need a shared space to start. Create one or join your partner's.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleCreateSpace}
                disabled={loading}
                className="w-full card flex items-center gap-4 p-4 hover:bg-surface-hover transition-all text-left group border-violet-600/20 hover:border-violet-600/40"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center group-hover:bg-violet-600/30 transition-colors">
                  <Plus size={18} className="text-violet-400" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary text-sm">Create a space</p>
                  <p className="text-text-muted text-xs mt-0.5">Get an invite code to share with your partner</p>
                </div>
              </button>
              <button
                onClick={() => setStep('join')}
                className="w-full card flex items-center gap-4 p-4 hover:bg-surface-hover transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center group-hover:bg-pink-500/30 transition-colors">
                  <Users size={18} className="text-pink-400" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary text-sm">Join a space</p>
                  <p className="text-text-muted text-xs mt-0.5">Enter your partner's invite code</p>
                </div>
              </button>
            </div>
          </>
        )}

        {step === 'create' && userProfile?.inviteCode && (
          <>
            <div className="text-center mb-8">
              <div className="text-3xl mb-3">🎉</div>
              <h1 className="text-2xl font-bold text-text-primary">Your space is ready!</h1>
              <p className="text-text-secondary text-sm mt-2">
                Share this code with your partner so they can join.
              </p>
            </div>
            <div className="card p-4 mb-4">
              <p className="text-xs text-text-muted text-center mb-3 uppercase tracking-wider font-semibold">Your invite code</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center text-3xl font-bold tracking-widest text-violet-300 font-mono bg-violet-600/10 rounded-lg py-3">
                  {userProfile.inviteCode}
                </div>
                <button onClick={handleCopy} className="btn-secondary p-3 shrink-0">
                  {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <button onClick={() => navigate('/calendar')} className="btn-primary w-full">
              Continue to calendar →
            </button>
            <p className="text-center text-xs text-text-muted mt-3">
              Your partner can also find and enter this code from their setup screen
            </p>
          </>
        )}

        {step === 'join' && (
          <>
            <button onClick={() => setStep('choose')} className="btn-ghost mb-6 text-sm">← Back</button>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-text-primary">Join a space</h1>
              <p className="text-text-secondary text-sm mt-2">Enter the 6-character code from your partner</p>
            </div>
            <form onSubmit={handleJoin} className="space-y-4">
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                className="input text-center text-2xl tracking-widest font-mono uppercase"
                placeholder="ABC123"
                maxLength={6}
                required
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                  {error}
                </p>
              )}
              <button type="submit" className="btn-primary w-full" disabled={loading || inviteCode.length < 6}>
                {loading ? 'Joining...' : 'Join space'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
