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
    ? 'bg-surface shadow-md border border-border'
    : 'bg-surface shadow-sm border border-border'

  return (
    <div className={`rounded-[20px] transition-all duration-200 ${bg} ${className}`} {...props}>
      {children}
    </div>
  )
}
