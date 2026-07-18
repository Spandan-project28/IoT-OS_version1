import React from 'react'

interface SkeletonLoaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SkeletonLoader({
  className = '',
  ...props
}: SkeletonLoaderProps): React.JSX.Element {
  return <div className={`animate-pulse bg-surface-elevated rounded ${className}`} {...props} />
}
