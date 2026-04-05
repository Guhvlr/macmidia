import { useAuth } from './AuthContext';
import { useKanban } from './KanbanContext';
import { useUI } from './UIContext';
import { useAutomation } from './AutomationContext';

export function useApp() {
  const auth = useAuth();
  const kanban = useKanban();
  const ui = useUI();
  const automation = useAutomation();

  return {
    ...auth,
    ...kanban,
    ...ui,
    ...automation
  };
}
