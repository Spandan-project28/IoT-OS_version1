import { Loader2 } from 'lucide-react'

interface LoadingOverlayProps {
  message?: string
  fullScreen?: boolean
}

export function LoadingOverlay({
  message = 'Loading...',
  fullScreen = false
}: LoadingOverlayProps): React.JSX.Element {
  const containerClass = fullScreen ? 'fixed inset-0 z-50' : 'absolute inset-0 z-10 rounded-lg'

  return (
    <div
      className={`${containerClass} flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm`}
    >
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-16" />
      <p className="text-text-primary font-medium">{message}</p>
    </div>
  )
}
