import React from 'react'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function IconButton({
  icon,
  size = 'md',
  className = '',
  ...props
}: IconButtonProps): React.JSX.Element {
  const sizes = {
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-12'
  }

  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl bg-dark-bg hover:bg-dark-surface text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${sizes[size]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  )
}
