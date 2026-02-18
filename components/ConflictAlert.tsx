import React from 'react';
import { Conflict } from '../types';
import { AlertTriangle } from 'lucide-react';

interface ConflictAlertProps {
  conflicts: Conflict[];
}

export const ConflictAlert: React.FC<ConflictAlertProps> = ({ conflicts }) => {
  if (conflicts.length === 0) return null;

  return (
    <div className="mb-6 animate-in slide-in-from-top duration-300">
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Conflits d'horaire détectés ({conflicts.length})</h3>
            <div className="mt-2 text-sm text-red-700">
              <ul className="list-disc pl-5 space-y-1">
                {conflicts.map((conflict, idx) => (
                  <li key={idx}>
                    <span className="font-bold">{conflict.supplierName}</span>: {conflict.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
