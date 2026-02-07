import React from 'react'
import { cn } from '../../lib/utils'
import { cva } from 'class-variance-authority'

const headingVariants = cva(
  "font-bold tracking-tight",
  {
    variants: {
      level: {
        1: "text-4xl",
        2: "text-3xl", 
        3: "text-2xl",
        4: "text-xl",
        5: "text-lg",
        6: "text-base"
      },
      variant: {
        display: "neon-text text-primary",
        subheading: "text-primary",
        default: "text-foreground"
      }
    },
    defaultVariants: {
      level: 2,
      variant: "default"
    }
  }
)

const Heading = React.forwardRef(({ className, level = 2, variant, children, ...props }, ref) => {
  const Comp = `h${level}`
  
  return (
    <Comp
      ref={ref}
      className={cn(headingVariants({ level, variant, className }))}
      {...props}
    >
      {children}
    </Comp>
  )
})
Heading.displayName = "Heading"

export { Heading }
