/**
 * Login Page
 * 
 * User authentication (email/password)
 */

import { useState } from 'react'
import { Button, Input, Card, Alert } from '../components'
import { signIn } from '../services/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const response = await fetch(
          `${import.meta.env.REACT_APP_SUPABASE_URL}/auth/v1/signup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.REACT_APP_SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ email, password })
          }
        )
        if (!response.ok) throw new Error('Sign up failed')
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex-center bg-gradient-to-br from-primary to-primary-dark p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">👥</div>
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

        <form onSubmit={handleSubmit} className="space-y-4">
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
          >
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="text-center mt-6 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-primary hover:underline"
            disabled={loading}
          >
            {isSignUp 
              ? 'Already have an account? Sign in' 
              : 'Don\'t have an account? Sign up'}
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <p className="text-xs text-tertiary mb-2 font-semibold">Demo Credentials:</p>
          <p className="text-xs text-tertiary mb-1">
            <span className="font-medium">Email:</span> demo@example.com
          </p>
          <p className="text-xs text-tertiary">
            <span className="font-medium">Password:</span> demo123456
          </p>
        </div>
      </Card>

      <div className="fixed bottom-6 left-6 right-6 text-center text-white text-xs opacity-75">
        <p>Youth Health Management System v1.0</p>
      </div>
    </div>
  )
}
