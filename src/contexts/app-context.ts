import { createContext } from 'react';
import type { AppState } from './app-types';

export const AppContext = createContext<AppState | null>(null);
