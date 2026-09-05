import React, { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { UIProvider } from './UIContext';
import { KanbanProvider } from './KanbanContext';
import { AutomationProvider } from './AutomationContext';

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UIProvider>
        <KanbanProvider>
          <AutomationProvider>
            {children}
          </AutomationProvider>
        </KanbanProvider>
      </UIProvider>
    </AuthProvider>
  );
}

// Re-export hook for convenience
export { useApp } from './useApp';
