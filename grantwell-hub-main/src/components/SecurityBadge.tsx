import React from 'react';
import { Shield, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SecurityBadgeProps {
  variant?: 'default' | 'compliance' | 'encrypted';
  className?: string;
}

export function SecurityBadge({ variant = 'default', className = '' }: SecurityBadgeProps) {
  const getBadgeConfig = () => {
    switch (variant) {
      case 'compliance':
        return {
          icon: <Shield className="h-3 w-3" />,
          text: 'Data is Secure',
          tooltip: 'This data is protected with enterprise-grade security including encryption at rest, role-based access control, and comprehensive audit logging.',
          className: 'bg-green-100 text-green-800 border-green-200'
        };
      case 'encrypted':
        return {
          icon: <Lock className="h-3 w-3" />,
          text: 'Encrypted',
          tooltip: 'All uploads are encrypted in transit and at rest with AES-256 encryption. Access is strictly controlled based on your role and permissions.',
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      default:
        return {
          icon: <Shield className="h-3 w-3" />,
          text: 'Secure',
          tooltip: 'This feature includes security protections such as access control, data validation, and audit logging.',
          className: 'bg-slate-100 text-slate-800 border-slate-200'
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`inline-flex items-center gap-1 font-medium ${config.className} ${className}`}
          >
            {config.icon}
            {config.text}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}