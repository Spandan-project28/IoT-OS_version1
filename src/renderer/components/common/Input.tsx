import React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({
  label,
  error,
  className = '',
  id,
  ...props
}: InputProps): React.JSX.Element {
  const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {label && (
        <label htmlFor={generatedId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <input
        id={generatedId}
        className={`bg-surface border px-12 py-8 rounded-md text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary ${
          error ? 'border-error focus:ring-error' : 'border-border'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        {...props}
      />
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  )
}
