import React from 'react'

export function ScrollContainer({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`h-full w-full overflow-y-auto ${className}`} {...props}>
      {children}
    </div>
  )
}
