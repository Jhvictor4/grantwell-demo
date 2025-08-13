import { useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  origin?: { x: number; y: number };
  colors?: string[];
  startVelocity?: number;
  gravity?: number;
  drift?: number;
  ticks?: number;
}

export const useConfetti = () => {
  const lastConfetti = useRef<number>(0);
  const throttleMs = 1000; // Prevent spam

  const triggerConfetti = useCallback((element?: HTMLElement, options?: ConfettiOptions) => {
    const now = Date.now();
    if (now - lastConfetti.current < throttleMs) return;
    
    lastConfetti.current = now;

    // Get element position if provided, otherwise use center
    let origin = { x: 0.5, y: 0.5 };
    if (element) {
      const rect = element.getBoundingClientRect();
      origin = {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight
      };
    }

    // Professional, muted confetti with subtle colors
    const defaultOptions: ConfettiOptions = {
      particleCount: 30, // Fewer particles for subtlety
      spread: 45, // Tighter spread
      origin,
      colors: [
        'hsl(var(--primary))',
        'hsl(var(--secondary))', 
        'hsl(var(--accent))',
        'hsl(var(--muted))'
      ], // Use design system colors
      startVelocity: 15, // Gentler velocity
      gravity: 0.8,
      drift: 0,
      ticks: 100 // Shorter duration
    };

    confetti({
      ...defaultOptions,
      ...options
    });
  }, []);

  const celebrateTaskCompletion = useCallback((element?: HTMLElement) => {
    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    triggerConfetti(element, {
      particleCount: 25,
      spread: 35,
      colors: [
        'hsl(142 71% 45%)', // Success green but muted
        'hsl(210 40% 60%)', // Professional blue
        'hsl(220 14% 70%)' // Neutral gray
      ],
      startVelocity: 12,
      ticks: 80
    });
  }, [triggerConfetti]);

  return {
    triggerConfetti,
    celebrateTaskCompletion
  };
};