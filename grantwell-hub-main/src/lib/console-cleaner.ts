import { logger } from './logger';

/**
 * Utility to clean up console statements across the application
 * This will systematically replace console.* calls with proper logger usage
 */

// List of files and their console replacements
export const consoleReplacements = [
  // AITemplateVault.tsx
  { file: 'src/components/AITemplateVault.tsx', line: 104, from: "console.error('Error fetching templates:', error);", to: "logger.error('Error fetching templates', error);" },
  { file: 'src/components/AITemplateVault.tsx', line: 173, from: "console.error('Error creating template:', error);", to: "logger.error('Error creating template', error);" },
  { file: 'src/components/AITemplateVault.tsx', line: 209, from: "console.error('Error updating template:', error);", to: "logger.error('Error updating template', error);" },
  { file: 'src/components/AITemplateVault.tsx', line: 234, from: "console.error('Error deleting template:', error);", to: "logger.error('Error deleting template', error);" },
  { file: 'src/components/AITemplateVault.tsx', line: 264, from: "console.error('Error using template:', error);", to: "logger.error('Error using template', error);" },

  // ActivityLog.tsx
  { file: 'src/components/ActivityLog.tsx', line: 161, from: "console.error('Error fetching activities:', error);", to: "logger.error('Error fetching activities', error);" },
  { file: 'src/components/ActivityLog.tsx', line: 176, from: "console.error('Error fetching users:', error);", to: "logger.error('Error fetching users', error);" },

  // ActivityLogViewer.tsx
  { file: 'src/components/ActivityLogViewer.tsx', line: 126, from: "console.error('Error loading activities:', error);", to: "logger.error('Error loading activities', error);" },

  // AdminPanel.tsx
  { file: 'src/components/AdminPanel.tsx', line: 70, from: "console.error('Error fetching users:', error);", to: "logger.error('Error fetching users', error);" },
  { file: 'src/components/AdminPanel.tsx', line: 87, from: "console.error('Error fetching activity logs:', error);", to: "logger.error('Error fetching activity logs', error);" },
  { file: 'src/components/AdminPanel.tsx', line: 125, from: "console.error('Error inviting user:', error);", to: "logger.error('Error inviting user', error);" },
  { file: 'src/components/AdminPanel.tsx', line: 152, from: "console.error('Error updating user role:', error);", to: "logger.error('Error updating user role', error);" },
  { file: 'src/components/AdminPanel.tsx', line: 176, from: "console.error('Error exporting logs:', error);", to: "logger.error('Error exporting logs', error);" },

  // AdvancedReporting.tsx
  { file: 'src/components/AdvancedReporting.tsx', line: 71, from: "console.error('Error fetching templates:', error);", to: "logger.error('Error fetching templates', error);" },
  { file: 'src/components/AdvancedReporting.tsx', line: 99, from: "console.error('Error fetching reports:', error);", to: "logger.error('Error fetching reports', error);" },
  { file: 'src/components/AdvancedReporting.tsx', line: 134, from: "console.error('Error fetching financial summary:', error);", to: "logger.error('Error fetching financial summary', error);" },
  { file: 'src/components/AdvancedReporting.tsx', line: 139, from: "console.error('Error calling financial summary function:', err);", to: "logger.error('Error calling financial summary function', err);" },
  { file: 'src/components/AdvancedReporting.tsx', line: 170, from: "console.error('Error generating report:', error);", to: "logger.error('Error generating report', error);" },
  { file: 'src/components/AdvancedReporting.tsx', line: 184, from: "console.error('Error:', err);", to: "logger.error('Error in advanced reporting', err);" },

  // Continue with other high-priority components...
];

/**
 * Pattern to identify console statements that need replacement
 */
export const consolePattern = /console\.(log|warn|error|debug)\(/g;

/**
 * Convert console statement to logger equivalent
 */
export const convertConsoleToLogger = (match: string, level: string): string => {
  const loggerLevel = level === 'log' ? 'info' : level;
  return match.replace(`console.${level}(`, `logger.${loggerLevel}(`);
};

/**
 * Development helper to suggest logger imports for files
 */
export const suggestLoggerImport = (fileContent: string): boolean => {
  return consolePattern.test(fileContent) && !fileContent.includes("import { logger } from");
};