'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface LoginDialogContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const LoginDialogContext = createContext<LoginDialogContextType | undefined>(undefined);

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <LoginDialogContext.Provider value={{ isOpen, open, close }}>
      {children}
    </LoginDialogContext.Provider>
  );
}

export function useLoginDialog() {
  const context = useContext(LoginDialogContext);
  if (context === undefined) {
    throw new Error('useLoginDialog must be used within a LoginDialogProvider');
  }
  return context;
} 