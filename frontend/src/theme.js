import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  colors: {
    stacks: { orange: '#ff7f0f', black: '#07070a', white: '#f5f5f5' },
    neon: { blue: '#00ddff', pink: '#ff00cc' },
    gray: {
      900: '#0b0b0f',
      800: '#121217',
      700: '#1b1b22',
      600: '#242433',
    },
  },
  fonts: {
    heading: `'Share Tech Mono', monospace`,
    body: `'Fira Sans', sans-serif`,
  },
  radii: {
    sm: '6px',
    md: '10px',
    lg: '14px',
  },
  shadows: {
    glow: '0 0 8px rgba(255,127,15,0.75), 0 0 16px rgba(0,221,255,0.5)',
    'glow-xl': '0 0 16px rgba(255,127,15,0.9), 0 0 32px rgba(255,0,204,0.7)',
  },
  styles: {
    global: {
      'html, body, #root': {
        bg: 'stacks.black',
        color: 'stacks.white',
        minHeight: '100%',
      },
      '::-webkit-scrollbar': { width: '8px' },
      '::-webkit-scrollbar-track': { background: '#07070a' },
      '::-webkit-scrollbar-thumb': { background: '#ff7f0f', borderRadius: '4px' },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 600,
        _focusVisible: {
          boxShadow: '0 0 0 3px rgba(255,127,15,0.5)',
        },
      },
      variants: {
        neon: {
          bg: 'stacks.orange',
          color: 'stacks.black',
          boxShadow: 'glow',
          _hover: { bg: 'stacks.white', color: 'stacks.orange' },
          _active: { transform: 'translateY(0px)' },
          px: 6,
          py: 4,
          fontFamily: 'heading',
        },
        outlineNeon: {
          bg: 'transparent',
          color: 'stacks.orange',
          border: '2px solid',
          borderColor: 'stacks.orange',
          _hover: { bg: 'stacks.orange', color: 'stacks.black' },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'rgba(7,7,10,0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,127,15,0.3)',
          boxShadow: 'glow',
          borderRadius: 'lg',
          p: 6,
        },
      },
    },
  },
})

export default theme
