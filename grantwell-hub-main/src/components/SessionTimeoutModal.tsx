import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, AlertTriangle } from 'lucide-react';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  onExtendSession: () => void;
  onSignOut: () => void;
  minutesLeft: number;
}

export function SessionTimeoutModal({
  isOpen,
  onExtendSession,
  onSignOut,
  minutesLeft
}: SessionTimeoutModalProps) {
  const [countdown, setCountdown] = useState(minutesLeft * 60);

  useEffect(() => {
    if (isOpen) {
      setCountdown(minutesLeft * 60);
      
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            onSignOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen, minutesLeft, onSignOut]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressValue = (countdown / (minutesLeft * 60)) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Session Timeout Warning
          </DialogTitle>
          <DialogDescription>
            Your session will expire soon due to inactivity. This is a security measure to protect your data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 p-4 bg-orange-50 rounded-lg">
            <Clock className="h-5 w-5 text-orange-600" />
            <span className="text-lg font-mono font-bold text-orange-800">
              {formatTime(countdown)}
            </span>
          </div>
          
          <Progress value={progressValue} className="h-2" />
          
          <div className="text-sm text-muted-foreground text-center">
            Session expires automatically to protect sensitive law enforcement data
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={onSignOut}
              className="flex-1"
            >
              Sign Out Now
            </Button>
            <Button 
              onClick={onExtendSession}
              className="flex-1"
            >
              Stay Signed In
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}