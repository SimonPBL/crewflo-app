
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
  start: string;      // ISO Date String
  end: string;        // ISO Date String
  createdAt?: string; // ISO Date String — set at creation, never modified
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
  // Teintes claires
  'bg-red-200 text-red-800 border-red-300',
  'bg-orange-200 text-orange-800 border-orange-300',
  'bg-amber-200 text-amber-800 border-amber-300',
  'bg-yellow-200 text-yellow-800 border-yellow-300',
  'bg-lime-200 text-lime-800 border-lime-300',
  'bg-green-200 text-green-800 border-green-300',
  'bg-emerald-200 text-emerald-800 border-emerald-300',
  'bg-teal-200 text-teal-800 border-teal-300',
  'bg-cyan-200 text-cyan-800 border-cyan-300',
  'bg-sky-200 text-sky-800 border-sky-300',
  'bg-blue-200 text-blue-800 border-blue-300',
  'bg-indigo-200 text-indigo-800 border-indigo-300',
  'bg-violet-200 text-violet-800 border-violet-300',
  'bg-purple-200 text-purple-800 border-purple-300',
  'bg-fuchsia-200 text-fuchsia-800 border-fuchsia-300',
  'bg-pink-200 text-pink-800 border-pink-300',
  'bg-rose-200 text-rose-800 border-rose-300',
  // Teintes saturées (bien distinctes)
  'bg-red-400 text-white border-red-500',
  'bg-orange-400 text-white border-orange-500',
  'bg-amber-400 text-white border-amber-500',
  'bg-lime-400 text-white border-lime-500',
  'bg-green-500 text-white border-green-600',
  'bg-teal-500 text-white border-teal-600',
  'bg-cyan-500 text-white border-cyan-600',
  'bg-blue-500 text-white border-blue-600',
  'bg-indigo-500 text-white border-indigo-600',
  'bg-purple-500 text-white border-purple-600',
  'bg-pink-500 text-white border-pink-600',
];