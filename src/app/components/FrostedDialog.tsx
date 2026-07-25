'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FrostedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function FrostedDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: FrostedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="border rounded-lg"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'white' }}>{title}</DialogTitle>
          {description && (
            <DialogDescription style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div style={{ color: 'white', overflowY: 'auto', flex: 1, paddingRight: '1rem' }}>
          {children}
        </div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}