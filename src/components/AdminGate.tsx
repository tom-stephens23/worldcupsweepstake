import { useState, type FormEvent } from 'react'
import { useSweepstake } from '../hooks/useSweepstake'

/** Passcode modal that unlocks admin editing for the session. */
export function AdminGate({ onClose }: { onClose: () => void }) {
  const { unlockAdmin } = useSweepstake()
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (unlockAdmin(code)) {
      onClose()
    } else {
      setError(true)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="card w-full max-w-sm animate-pop-in p-6"
      >
        <h2 className="text-lg font-bold">Admin access</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Enter the passcode to set up the sweepstake and enter results.
        </p>
        <input
          autoFocus
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError(false)
          }}
          placeholder="Passcode"
          className="input mt-4"
        />
        {error && <p className="mt-2 text-sm font-medium text-red-600">Incorrect passcode.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Unlock
          </button>
        </div>
      </form>
    </div>
  )
}
