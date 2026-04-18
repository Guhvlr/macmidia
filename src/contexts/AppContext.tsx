import React, { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { UIProvider } from './UIContext';
import { KanbanProvider } from './KanbanContext';
import { AutomationProvider } from './AutomationContext';

import { IntelligenceProvider } from '@/features/intelligence/context/IntelligenceContext';

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UIProvider>
        <IntelligenceProvider>
          <KanbanProvider>
            <AutomationProvider>
              {children}
            </AutomationProvider>
          </KanbanProvider>
        </IntelligenceProvider>
      </UIProvider>
    </AuthProvider>
  );
}

// Re-export hook for convenience
export { useApp } from './useApp';
