/**
 * Login Page
 * 
 * User authentication (email/password)
 */

import { useEffect, useState } from 'react'
import { Button, Input, Card, Alert } from '../components'
import { fetchOrganizations, signIn, signUp } from '../services/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')
  const [accountType, setAccountType] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [organizations, setOrganizations] = useState([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [isSignUp, setIsSignUp] = useState(false)

  useEffect(() => {
    if (!isSignUp || accountType !== 'personal') return

    let isMounted = true
    setLoadingOrganizations(true)
    fetchOrganizations()
      .then((data) => {
        if (isMounted) setOrganizations(data || [])
      })
      .catch((err) => {
        if (isMounted) setError(`Could not load friendly spaces: ${err.message}`)
      })
      .finally(() => {
        if (isMounted) setLoadingOrganizations(false)
      })

    return () => {
      isMounted = false
    }
  }, [isSignUp, accountType])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { session } = await signUp(email, password, {
          accountType,
          organizationName: accountType === 'friendly_space' ? organizationName.trim() : '',
          organizationId: accountType === 'personal' ? organizationId : '',
          fullName: fullName.trim(),
          phone: phone.trim(),
          age: age ? Number(age) : null
        })
        setSuccess(session
          ? 'Your account was created. You can now continue.'
          : accountType === 'personal'
            ? 'Your request was submitted. Verify your email, then wait for the centre coordinator to approve your membership.'
            : 'Your account was created. Check your email and click the verification link before signing in.')
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      const message = err?.message || 'Authentication failed'
      const normalized = message.toLowerCase()

      if (normalized.includes('invalid login credentials') || normalized.includes('bad request')) {
        setError('Invalid email or password.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page min-h-screen flex-center p-4">
      <Card className="login-card w-full max-w-md">
        <div className="text-center mb-8">
          <div className="login-brand-mark" aria-hidden="true">YH</div>
          <h1 className="text-2xl font-bold text-primary mb-2">
            Youth Health System
          </h1>
          <p className="text-secondary text-sm">
            Manage your organization with confidence
          </p>
        </div>

        {error && (
          <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-6" onDismiss={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div className="space-y-4 mb-4">
            <label className="block">
              <span className="block mb-2 font-medium text-sm">Account type</span>
              <select
                value={accountType}
                onChange={(e) => {
                  setAccountType(e.target.value)
                  setOrganizationId('')
                  setOrganizationName('')
                  setError(null)
                }}
                required
                disabled={loading}
                className="w-full p-3 border rounded"
              >
                <option value="" disabled>Choose an account type</option>
                <option value="personal">Member (youth) — request to join</option>
                <option value="friendly_space">Friendly space — register a centre</option>
              </select>
            </label>

            {accountType === 'friendly_space' && (
              <Input
                label="Friendly space / centre name"
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g. Makululu Urban"
                required
                disabled={loading}
              />
            )}

            {accountType === 'personal' && (
              <>
                <Input
                  label="Full name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                />
                <Input
                  label="Phone number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={loading}
                />
                <Input
                  label="Age"
                  type="number"
                  min="10"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                  disabled={loading}
                />
                <label className="block">
                  <span className="block mb-2 font-medium text-sm">Request to join friendly space</span>
                  <select
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                    required
                    disabled={loading || loadingOrganizations}
                    className="w-full p-3 border rounded"
                  >
                    <option value="" disabled>
                      {loadingOrganizations ? 'Loading friendly spaces...' : 'Choose your centre'}
                    </option>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                  {!loadingOrganizations && organizations.length === 0 && (
                    <span className="block mt-2 text-sm text-secondary">
                      No centres are registered yet. Ask a centre admin to register first.
                    </span>
                  )}
                  <span className="block mt-2 text-sm text-secondary">
                    Your selected centre coordinator must approve your request before you can access centre information.
                  </span>
                </label>
              </>
            )}
          </div>
        )}

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@organization.com"
            required
            disabled={loading}
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
          />

          <Button
            type="submit"
            block
            loading={loading}
            className="mt-6"
            disabled={loading || loadingOrganizations || (isSignUp && !accountType)}
          >
            {isSignUp
              ? accountType === 'friendly_space' ? 'Register Centre & Create Account' : 'Request Membership'
              : 'Sign In'}
          </Button>
        </form>

        <div className="text-center mt-6 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setAccountType('')
              setOrganizationId('')
              setOrganizationName('')
              setError(null)
              setSuccess(null)
            }}
            className="text-sm text-primary hover:underline"
            disabled={loading}
          >
            {isSignUp 
              ? 'Already have an account? Sign in' 
              : 'Don\'t have an account? Sign up'}
          </button>
        </div>

      </Card>

      <div className="login-footer fixed bottom-6 left-6 right-6 text-center text-white text-xs opacity-75">
        <p>Youth Health Management System v1.0</p>
      </div>
    </div>
  )
}
