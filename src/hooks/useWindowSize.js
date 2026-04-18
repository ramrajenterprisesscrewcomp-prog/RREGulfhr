import { useState, useEffect } from 'react'

export function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const fn = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return size
}

export function useIsMobile() { return useWindowSize().width < 768 }
export function useIsTablet() { const w = useWindowSize().width; return w >= 768 && w < 1024 }
