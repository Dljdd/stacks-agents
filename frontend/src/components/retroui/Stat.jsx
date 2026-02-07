import React from 'react'
import { cn } from '../../lib/utils'

const Stat = React.forwardRef(({ className, label, value, icon, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-md border bg-card p-4",
      className
    )}
    {...props}
  >
    <div className="flex items-center gap-3">
      {icon && <div className="text-primary">{icon}</div>}
      <div>
        <div className="text-xl font-semibold text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  </div>
))
Stat.displayName = "Stat"

export { Stat }
