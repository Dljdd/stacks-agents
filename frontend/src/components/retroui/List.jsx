import React from 'react'
import { cn } from '../../lib/utils'

const List = React.forwardRef(({ className, as = "ul", children, ...props }, ref) => {
  const Comp = as
  
  return (
    <Comp
      ref={ref}
      className={cn("space-y-2", className)}
      {...props}
    >
      {children}
    </Comp>
  )
})
List.displayName = "List"

const ListItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("flex items-center", className)}
    {...props}
  >
    {children}
  </li>
))
ListItem.displayName = "ListItem"

List.Item = ListItem

export { List }
