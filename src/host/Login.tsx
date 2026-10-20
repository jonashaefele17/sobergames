import { useState, type FormEvent } from 'react'
import './host.css'
import { signInHost } from '../lib/hostAuth'

/** Host-Login für Regiepult und Sammlung */
export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(await signInHost(username, password))
    setSubmitting(false)
  }

  return (
    <form className="host login" onSubmit={handleSubmit}>
      <h1>Host-Login</h1>
      <label>
        Benutzername
        <input type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>
        Passwort
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? 'Anmelden…' : 'Anmelden'}
      </button>
    </form>
  )
}
