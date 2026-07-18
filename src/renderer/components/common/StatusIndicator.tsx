import React from 'react'
import { CheckCircle2, XCircle, AlertCircle, Loader2, Link } from 'lucide-react'

export type StatusType =
  'connected' | 'disconnected' | 'uploading' | 'success' | 'warning' | 'error'

interface StatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusType
  text?: string
}

export function StatusIndicator({
  status,
  text,
  className = '',
  ...props
}: StatusIndicatorProps): React.JSX.Element {
  const configs = {
    connected: { icon: Link, color: 'text-success', spin: false },
    disconnected: { icon: XCircle, color: 'text-text-secondary', spin: false },
    uploading: { icon: Loader2, color: 'text-info', spin: true },
    success: { icon: CheckCircle2, color: 'text-success', spin: false },
    warning: { icon: AlertCircle, color: 'text-warning', spin: false },
    error: { icon: XCircle, color: 'text-error', spin: false }
  }

  const Config = configs[status]
  const Icon = Config.icon

  return (
    <div className={`inline-flex items-center gap-8 ${className}`} {...props}>
      <Icon className={`w-4 h-4 ${Config.color} ${Config.spin ? 'animate-spin' : ''}`} />
      {text && <span className="text-sm font-medium text-text-primary">{text}</span>}
    </div>
  )
}
