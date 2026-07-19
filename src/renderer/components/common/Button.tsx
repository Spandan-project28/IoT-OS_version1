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
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-primary text-dark-bg hover:bg-primary-hover focus:ring-primary shadow-sm',
    secondary:
      'bg-surface text-text-primary border border-border hover:bg-border/50 focus:ring-border shadow-sm',
    ghost:
      'bg-transparent text-text-secondary hover:text-text-primary hover:bg-border/30 focus:ring-border',
    destructive: 'bg-error text-white hover:bg-error/90 focus:ring-error shadow-sm'
  }

  const sizes = {
    sm: 'px-12 py-6 text-[13px] gap-6',
    md: 'px-16 py-8 text-[14px] gap-8',
    lg: 'px-24 py-12 text-[15px] gap-12'
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
