import { useEffect, useState } from 'react'

import { CloseIcon, SearchIcon } from './icons'

// Small shared building blocks so every admin page looks like one system (brand green #629C2C, rounded cards).
// Matches FIGMA/ADMIN: white cards on a #F5F5F5 page, rounded-2xl/3xl corners, bold headings.

export function Card({ className = '', children }) {
  return <div className={`rounded-3xl border border-gray-100 bg-white p-6 shadow-sm ${className}`}>{children}</div>
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    outline: 'border-2 border-brand text-brand hover:bg-brand-tint',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    dangerOutline: 'border-2 border-red-500 text-red-600 hover:bg-red-50',
    ghost: 'text-muted hover:bg-gray-100',
  }
  return (
    <button
      type="button"
      {...props}
      className={`whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  )
}

export function TextField({ label, className = '', ...props }) {
  return (
    <label className={`block text-sm font-medium text-ink ${className}`}>
      {label}
      <input
        {...props}
        className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand disabled:bg-gray-50 disabled:text-muted"
      />
    </label>
  )
}

export function TextArea({ label, className = '', ...props }) {
  return (
    <label className={`block text-sm font-medium text-ink ${className}`}>
      {label}
      <textarea
        {...props}
        className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand disabled:bg-gray-50"
      />
    </label>
  )
}

export function SelectField({ label, className = '', children, ...props }) {
  return (
    <label className={`block text-sm font-medium text-ink ${className}`}>
      {label}
      <select {...props} className="mt-1 block w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand">
        {children}
      </select>
    </label>
  )
}

export function Notice({ tone = 'error', children }) {
  const styles = {
    error: 'bg-red-50 text-red-700',
    success: 'bg-brand-tint text-brand-dark',
    info: 'bg-gray-100 text-muted',
    warning: 'bg-amber-50 text-amber-800',
  }
  return <p className={`rounded-2xl px-4 py-3 text-sm ${styles[tone]}`}>{children}</p>
}

export function StatusBadge({ tone = 'neutral', children }) {
  const styles = {
    success: 'bg-brand-tint text-brand-dark',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-700',
    neutral: 'bg-gray-100 text-muted',
  }
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${styles[tone]}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${tone === 'success' ? 'bg-brand' : tone === 'warning' ? 'bg-amber-500' : tone === 'danger' ? 'bg-red-500' : 'bg-gray-400'}`} />
    {children}
  </span>
}

/** A small round count badge, e.g. next to a sidebar item or a tab label — FIGMA/ADMIN Providers "Pending Approval 12". */
export function CountBadge({ children, tone = 'warning' }) {
  if (!children) return null
  const styles = { warning: 'bg-amber-400 text-white', danger: 'bg-red-500 text-white', neutral: 'bg-gray-300 text-ink' }
  return <span className={`inline-flex min-w-[1.4rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-extrabold ${styles[tone]}`}>{children}</span>
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  )
}

/** A stat card for Overview / Analytics / Revenue: label, big value, optional trend/hint and an icon. */
export function StatCard({ label, value, hint, hintTone = 'neutral', icon, accent = false }) {
  const hintColor = hintTone === 'success' ? 'text-brand' : hintTone === 'danger' ? 'text-red-600' : hintTone === 'warning' ? 'text-amber-600' : 'text-muted'
  return (
    <Card className="!p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
        {icon ? <span className="text-muted">{icon}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <p className={`text-3xl font-extrabold ${accent ? 'text-brand' : ''}`}>{value}</p>
        {hint ? <span className={`text-xs font-bold ${hintColor}`}>{hint}</span> : null}
      </div>
    </Card>
  )
}

export function SearchInput({ className = '', ...props }) {
  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        {...props}
        className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-brand"
      />
    </div>
  )
}

/** Underline tab strip for a page's top-level sections (FIGMA/ADMIN Providers, Settings). */
export function PageTabs({ options, value, onChange }) {
  return (
    <div className="mb-6 flex gap-8 border-b border-gray-200">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-bold transition ${
            value === option.value ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {option.label}
          {option.count ? <CountBadge tone={option.badgeTone ?? 'warning'}>{option.count}</CountBadge> : null}
        </button>
      ))}
    </div>
  )
}

/** Two-choice status toggle, e.g. "SET ACCOUNT STATUS: Active / Inactive" in the Figma detail modals. */
export function StatusToggle({ value, onChange, activeLabel = 'Active', inactiveLabel = 'Inactive', disabled }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`rounded-2xl border-2 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          value ? 'border-brand bg-brand-tint text-brand-dark' : 'border-gray-200 text-muted hover:bg-gray-50'
        }`}
      >
        <span className={`mr-2 inline-block h-2 w-2 rounded-full ${value ? 'bg-brand' : 'bg-gray-300'}`} />
        {activeLabel}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`rounded-2xl border-2 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          !value ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-muted hover:bg-gray-50'
        }`}
      >
        <span className={`mr-2 inline-block h-2 w-2 rounded-full ${!value ? 'bg-red-500' : 'bg-gray-300'}`} />
        {inactiveLabel}
      </button>
    </div>
  )
}

/** Centered modal dialog (FIGMA/ADMIN "Doctor Credential Verification", "Payment Details"). Escape and backdrop close it. */
export function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-3xl bg-white shadow-xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-muted hover:bg-gray-100" aria-label="Close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer ? <div className="border-t border-gray-100 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}

/** Right-side sliding panel (FIGMA/ADMIN "User Details" drawer on the Users page). */
export function Drawer({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-muted hover:bg-gray-100" aria-label="Close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 px-6 py-5">{children}</div>
        {footer ? <div className="border-t border-gray-100 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}

/**
 * One shared confirmation dialog for every destructive/people-affecting action (deactivate, reject, delete,
 * send). `requireReason` makes the confirm button stay disabled until something is typed (doctor/guardian
 * rejections). Root CLAUDE.md: "Actions that affect people need a confirmation dialog, rejections need a reason."
 */
export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', danger = false, requireReason = false,
  reasonLabel = 'Reason', busy = false, onCancel, onConfirm,
}) {
  if (!open) return null
  return (
    <ConfirmDialogBody
      title={title} message={message} confirmLabel={confirmLabel} danger={danger}
      requireReason={requireReason} reasonLabel={reasonLabel} busy={busy}
      onCancel={onCancel} onConfirm={onConfirm}
    />
  )
}

function ConfirmDialogBody({ title, message, confirmLabel, danger, requireReason, reasonLabel, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const disabled = busy || (requireReason && !reason.trim())
  return (
    <Modal open onClose={onCancel} title={title} maxWidth="max-w-md">
      <p className="text-sm text-muted">{message}</p>
      {requireReason ? (
        <TextArea
          className="mt-4"
          label={reasonLabel}
          rows={3}
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain why, so the person can fix it and resubmit…"
        />
      ) : null}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => onConfirm(reason.trim())} disabled={disabled}>
          {busy ? 'Please wait…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
