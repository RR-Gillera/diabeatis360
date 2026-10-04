import { useState } from 'react'

import { useAuth } from '../../auth/AuthContext'
import { Button, Card, Notice, TextField } from '../../components/ui'
import { sendAdminPasswordReset } from '../../services/adminAccount'

// Update Account + Reset Password for the admin (Table 24, module 1).
export default function AccountTab() {
  const { admin, renameAdmin } = useAuth()
  const [name, setName] = useState(admin?.full_name ?? '')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  const save = async (event) => {
    event.preventDefault()
    if (!name.trim()) {
      setMessage({ tone: 'error', text: 'Please fill in all required fields.' })
      return
    }
    setBusy(true)
    try {
      await renameAdmin(name)
      setMessage({ tone: 'success', text: 'Your account was updated.' })
    } catch {
      setMessage({ tone: 'error', text: 'We could not update your account. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const sendReset = async () => {
    try {
      await sendAdminPasswordReset(admin.email)
      setMessage({ tone: 'success', text: `A password reset link was sent to ${admin.email}.` })
    } catch {
      setMessage({ tone: 'error', text: 'We could not send the reset email. Please try again.' })
    }
  }

  return (
    <Card className="max-w-xl space-y-4">
      <h2 className="text-lg font-extrabold">My Account</h2>
      <form onSubmit={save} className="space-y-4" noValidate>
        <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Email address" value={admin?.email ?? ''} disabled readOnly />
        <TextField label="Role" value={admin?.role ?? 'admin'} disabled readOnly />
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
      </form>
      <div className="border-t border-gray-100 pt-4">
        <p className="mb-2 text-sm text-muted">Forgot or want to change your password? We will email you a reset link.</p>
        <Button variant="outline" onClick={sendReset}>Send password reset email</Button>
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </Card>
  )
}
