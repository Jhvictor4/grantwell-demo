import * as React from "react"

const MOBILE_BREAKPOINT = 768

export const useMobileDetection = () => {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const tabletMql = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: 1024px)`)
    
    const onChange = () => {
      const width = window.innerWidth
      setIsMobile(width < MOBILE_BREAKPOINT)
      setIsTablet(width >= MOBILE_BREAKPOINT && width <= 1024)
    }
    
    mql.addEventListener("change", onChange)
    tabletMql.addEventListener("change", onChange)
    onChange() // Set initial values
    
    return () => {
      mql.removeEventListener("change", onChange)
      tabletMql.removeEventListener("change", onChange)
    }
  }, [])

  return {
    isMobile: !!isMobile,
    isTablet: !!isTablet,
    isDesktop: !isMobile && !isTablet,
    deviceType: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'
  }
}