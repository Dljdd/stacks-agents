import React from 'react'
import { Button } from '@chakra-ui/react'

export default function NeonButton({ children, variant = 'neon', ...props }) {
  return (
    <Button variant={variant} {...props}>
      {children}
    </Button>
  )
}
