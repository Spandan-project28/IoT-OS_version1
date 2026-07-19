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
      className={`flex flex-col items-center justify-center h-full w-full p-40 text-center bg-surface border border-border rounded-[24px] shadow-sm ${className}`}
      {...props}
    >
      {icon && (
        <div className="mb-32 relative">
          <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-[2] -z-10" />
          <div className="w-24 h-24 bg-surface rounded-[20px] flex items-center justify-center border border-border shadow-md">
            <div className="text-text-secondary scale-150">{icon}</div>
          </div>
        </div>
      )}
      <h2 className="text-[24px] font-bold tracking-tight text-text-primary mb-12">{title}</h2>
      <p className="text-[15px] text-text-secondary max-w-[460px] mb-40 leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  )
}
