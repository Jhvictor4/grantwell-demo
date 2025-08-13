import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingStateProps {
  title?: string;
  description?: string;
  rows?: number;
}

const LoadingState = ({ 
  title = "Loading...", 
  description = "Please wait while we load your data.", 
  rows = 3 
}: LoadingStateProps) => {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <h3 className="text-lg font-medium text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoadingState;