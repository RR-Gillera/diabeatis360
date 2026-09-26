// Small shared building blocks so every admin page looks like one system (brand green #629C2C, rounded cards).

export function Card({ className = '', children }) {
  return <div className={`rounded-3xl border border-gray-100 bg-white p-6 shadow-sm ${className}`}>{children}</div>
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    outline: 'border-2 border-brand text-brand hover:bg-brand-tint',
    danger: 'bg-red-600 text-white hover:bg-red-700',
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

export function TextField({ label, ...props }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <input
        {...props}
        className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand disabled:bg-gray-50 disabled:text-muted"
      />
    </label>
  )
}

export function Notice({ tone = 'error', children }) {
  const styles = {
    error: 'bg-red-50 text-red-700',
    success: 'bg-brand-tint text-brand-dark',
    info: 'bg-gray-100 text-muted',
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
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  )
}
