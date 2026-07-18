import React from 'react'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps): React.JSX.Element {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed shadow-sm'

  const variants = {
    primary:
      'bg-text-primary text-background hover:bg-white focus:ring-text-primary border border-transparent shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]',
    secondary:
      'bg-surface-elevated text-text-primary hover:bg-border focus:ring-border border border-border-strong',
    ghost:
      'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus:ring-border shadow-none',
    destructive: 'bg-error text-white hover:bg-error/90 focus:ring-error border border-error/50'
  }

  const sizes = {
    sm: 'px-12 py-6 text-xs gap-6',
    md: 'px-16 py-8 text-sm gap-8',
    lg: 'px-24 py-12 text-base gap-12'
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  )
}
