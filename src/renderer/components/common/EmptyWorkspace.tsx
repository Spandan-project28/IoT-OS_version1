import React from 'react'

export interface EmptyWorkspaceProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export function EmptyWorkspace({
  title,
  description,
  action,
  icon,
  className = '',
  ...props
}: EmptyWorkspaceProps): React.JSX.Element {
  return (
    <div
      className={`flex flex-col items-center justify-center h-full w-full p-32 text-center bg-surface border border-border rounded-2xl shadow-sm ${className}`}
      {...props}
    >
      {icon && (
        <div className="mb-24 relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 -z-10" />
          <div className="w-64 h-64 bg-surface-elevated rounded-2xl flex items-center justify-center border border-border-strong shadow-lg">
            <div className="text-text-secondary scale-150">{icon}</div>
          </div>
        </div>
      )}
      <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-8">{title}</h2>
      <p className="text-base text-text-secondary max-w-[400px] mb-32 leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  )
}
