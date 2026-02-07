import React from 'react'
import { cn } from '../../lib/utils'

const Icon = React.forwardRef(({ className, as: Component, ...props }, ref) => {
  if (!Component) return null
  
  return (
    <Component
      ref={ref}
      className={cn("w-4 h-4", className)}
      {...props}
    />
  )
})
Icon.displayName = "Icon"

export { Icon }
