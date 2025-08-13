import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState = ({ 
  icon = <AlertTriangle className="h-12 w-12 text-slate-400" />, 
  title, 
  description, 
  action 
}: EmptyStateProps) => {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            {icon}
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          {action && (
            <Button onClick={action.onClick} variant="outline">
              <RefreshCcw className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmptyState;