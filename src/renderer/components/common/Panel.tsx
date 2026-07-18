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
      className={`flex flex-col bg-surface border border-border rounded-xl shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-16 py-12 border-b border-border bg-surface-elevated/30">
          {title && (
            <h3 className="font-medium text-sm text-text-primary tracking-tight">{title}</h3>
          )}
          {action && <div className="flex items-center">{action}</div>}
        </div>
      )}
      <div className="flex-1 overflow-auto bg-background/30">{children}</div>
    </div>
  )
}
