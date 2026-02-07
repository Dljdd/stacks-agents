import React from 'react'
import { Box } from '@chakra-ui/react'

export default function GlassPanel({ children, p = 6, ...props }) {
  return (
    <Box
      bg='rgba(7,7,10,0.6)'
      backdropFilter='blur(10px)'
      border='1px solid rgba(255,127,15,0.3)'
      boxShadow='glow'
      borderRadius='lg'
      p={p}
      {...props}
    >
      {children}
    </Box>
  )
}
