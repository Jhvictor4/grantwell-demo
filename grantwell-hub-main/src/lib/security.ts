// Security utilities for input validation and sanitization

// Sanitize text input to prevent XSS attacks
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Remove script tags and other dangerous HTML
  const scriptRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  const htmlTagRegex = /<[^>]*>/g;
  const sqlInjectionRegex = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi;
  
  return input
    .replace(scriptRegex, '')
    .replace(htmlTagRegex, '')
    .replace(sqlInjectionRegex, '')
    .slice(0, 1000) // Limit length
    .trim();
};

// Validate email format
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Validate numeric input
export const validateNumericInput = (value: string): boolean => {
  if (!value) return true; // Allow empty values
  const numericRegex = /^[0-9]+(\.[0-9]+)?$/;
  return numericRegex.test(value) && parseFloat(value) >= 0;
};

// Validate text length and content
export const validateTextInput = (text: string, minLength = 0, maxLength = 1000): { isValid: boolean; error?: string } => {
  if (!text && minLength === 0) return { isValid: true };
  
  if (!text || text.trim().length < minLength) {
    return { isValid: false, error: `Minimum ${minLength} characters required` };
  }
  
  if (text.length > maxLength) {
    return { isValid: false, error: `Maximum ${maxLength} characters allowed` };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(text))) {
    return { isValid: false, error: 'Invalid characters detected' };
  }
  
  return { isValid: true };
};

// Rate limiting utility (client-side tracking)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (key: string, maxAttempts = 5, windowMinutes = 15): boolean => {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (entry.count >= maxAttempts) {
    return false;
  }
  
  entry.count++;
  return true;
};

// Security headers utility for API calls
export const getSecurityHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  };
};

// Log security events (for audit trail)
export const logSecurityEvent = async (event: {
  action: string;
  details: string;
  userId?: string;
  severity: 'low' | 'medium' | 'high';
}) => {
  // In a real implementation, this would send to a secure logging service
  console.warn(`Security Event: ${event.action}`, {
    ...event,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  });
};