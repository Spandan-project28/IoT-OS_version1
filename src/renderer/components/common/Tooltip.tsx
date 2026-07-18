import React, { useState } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false)

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-8',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-8',
    left: 'right-full top-1/2 -translate-y-1/2 mr-8',
    right: 'left-full top-1/2 -translate-y-1/2 ml-8'
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute z-50 whitespace-nowrap px-8 py-4 bg-surface-elevated text-text-primary text-xs rounded border border-border shadow-lg ${positions[position]}`}
        >
          {content}
        </div>
      )}
    </div>
  )
}
