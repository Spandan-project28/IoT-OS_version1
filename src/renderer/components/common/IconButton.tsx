import React from 'react'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}: IconButtonProps): React.JSX.Element {
  const baseStyles =
    'inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-primary text-text-primary hover:bg-primary-hover focus:ring-primary',
    secondary: 'bg-secondary text-text-primary hover:bg-secondary-hover focus:ring-secondary',
    ghost:
      'bg-transparent text-text-secondary hover:bg-surface-elevated hover:text-text-primary focus:ring-border'
  }

  const sizes = {
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-16'
  }

  return (
    <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {icon}
    </button>
  )
}
