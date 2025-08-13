import { createRoot } from 'react-dom/client';
import React, { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
};

export function notifySuccess(message: string, description?: string) {
  toast({ title: message, description });
}

export function notifyError(message: string, description?: string) {
  toast({ title: message, description, variant: 'destructive' });
}

export function confirmAction(options: ConfirmOptions = {}): Promise<boolean> {
  const { title = 'Are you sure?', description = '', confirmText = 'Confirm', cancelText = 'Cancel' } = options;

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  return new Promise<boolean>((resolve) => {
    const Confirmer: React.FC = () => {
      const [open, setOpen] = useState(true);

      useEffect(() => {
        return () => {
          // Cleanup the container when unmounted
          setTimeout(() => {
            root.unmount();
            if (container.parentNode) container.parentNode.removeChild(container);
          }, 0);
        };
      }, []);

      const handleClose = (result: boolean) => {
        setOpen(false);
        resolve(result);
      };

      return (
        <AlertDialog open={open} onOpenChange={(v) => !v && handleClose(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description ? (
                <AlertDialogDescription>{description}</AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => handleClose(false)}>{cancelText}</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleClose(true)}>{confirmText}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    };

    root.render(React.createElement(Confirmer));
  });
}
