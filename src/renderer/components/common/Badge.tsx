import React from 'react'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({
  children,
  variant = 'default',
  className = '',
  ...props
}: BadgeProps): React.JSX.Element {
  const baseStyles = 'inline-flex items-center px-8 py-4 rounded-full text-xs font-medium'
  const variants = {
    default: 'bg-surface-elevated text-text-secondary border border-border',
    success: 'bg-success/10 text-success border border-success/20',
    warning: 'bg-warning/10 text-warning border border-warning/20',
    error: 'bg-error/10 text-error border border-error/20',
    info: 'bg-info/10 text-info border border-info/20'
  }
  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  )
}
