import React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean
}

export function Card({
  children,
  elevated = false,
  className = '',
  ...props
}: CardProps): React.JSX.Element {
  const bg = elevated
    ? 'bg-surface-elevated shadow-lg border border-border-strong/50 backdrop-blur-sm'
    : 'bg-surface border border-border shadow-sm'

  return (
    <div className={`rounded-2xl transition-all duration-200 ${bg} ${className}`} {...props}>
      {children}
    </div>
  )
}
