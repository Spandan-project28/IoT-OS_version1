import React from 'react'

interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
}

export function Divider({
  orientation = 'horizontal',
  className = '',
  ...props
}: DividerProps): React.JSX.Element {
  const baseStyles = 'bg-border shrink-0'
  const styles = orientation === 'horizontal' ? 'w-full h-[1px]' : 'h-full w-[1px]'

  return <div className={`${baseStyles} ${styles} ${className}`} role="separator" {...props} />
}
