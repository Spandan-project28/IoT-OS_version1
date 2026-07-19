import React from 'react'

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  action?: React.ReactNode
}

export function Panel({
  title,
  action,
  children,
  className = '',
  ...props
}: PanelProps): React.JSX.Element {
  return (
    <div
      className={`flex flex-col bg-surface border border-border rounded-[20px] shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-20 py-16 border-b border-border bg-surface">
          {title && (
            <h3 className="font-semibold text-[15px] text-text-primary tracking-tight">{title}</h3>
          )}
          {action && <div className="flex items-center">{action}</div>}
        </div>
      )}
      <div className="flex-1 overflow-auto bg-surface">{children}</div>
    </div>
  )
}
