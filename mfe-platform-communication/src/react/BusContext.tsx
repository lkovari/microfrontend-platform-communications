import { createContext } from 'react';
import type { Bus } from '../core/bus.js';

export const BusContext = createContext<Bus | null>(null);
