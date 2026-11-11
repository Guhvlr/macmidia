import { Employee } from '@/contexts/app-types';

const STORAGE_KEY = '@macmidia:employee_order';

export function getStoredEmployeeOrder(): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredEmployeeOrder(order: string[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    window.dispatchEvent(new CustomEvent('employee-order-changed', { detail: order }));
  } catch (e) {
    console.error('Failed to save employee order:', e);
  }
}

export function sortEmployeesByCustomOrder(employees: Employee[], customOrder?: string[]): Employee[] {
  const order = customOrder ?? getStoredEmployeeOrder();
  if (!order || order.length === 0) return employees;

  return [...employees].sort((a, b) => {
    const idxA = order.indexOf(a.id);
    const idxB = order.indexOf(b.id);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}
