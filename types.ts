
export interface Supplier {
  id: string;
  name: string;
  trade: string; // e.g., Electricien, Plombier
  color: string;
  email?: string;
}

export interface Project {
  id: string;
  name: string;
  address: string;
  status: 'planning' | 'active' | 'completed';
}

export interface Task {
  id: string;
  projectId: string;
  supplierId: string;
  title: string;
  description?: string;
  notes?: string;
  start: string; // ISO Date String
  end: string;   // ISO Date String
}

export interface Conflict {
  taskA: Task;
  taskB: Task;
  supplierName: string;
  message: string;
}

export type ViewMode = 'calendar' | 'suppliers' | 'projects' | 'ai';

export const TRADES = [
  'Électricien',
  'Plombier',
  'Ventilation',
  'Charpentier',
  'Peintre',
  'Maçon',
  'Couvreur',
  'Paysagiste',
  'Cuisiniste',
  'Général'
];

export const COLORS = [
  'bg-red-200 text-red-800 border-red-300',
  'bg-orange-200 text-orange-800 border-orange-300',
  'bg-amber-200 text-amber-800 border-amber-300',
  'bg-green-200 text-green-800 border-green-300',
  'bg-emerald-200 text-emerald-800 border-emerald-300',
  'bg-teal-200 text-teal-800 border-teal-300',
  'bg-cyan-200 text-cyan-800 border-cyan-300',
  'bg-blue-200 text-blue-800 border-blue-300',
  'bg-indigo-200 text-indigo-800 border-indigo-300',
  'bg-violet-200 text-violet-800 border-violet-300',
  'bg-purple-200 text-purple-800 border-purple-300',
  'bg-fuchsia-200 text-fuchsia-800 border-fuchsia-300',
  'bg-pink-200 text-pink-800 border-pink-300',
  'bg-rose-200 text-rose-800 border-rose-300',
];