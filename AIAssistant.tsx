import React, { useState } from 'react';
import { Project, Supplier, Task } from '../types';
import { analyzeSchedule } from '../services/geminiService';
import { Bot, Send, Loader2, ExternalLink, AlertCircle } from 'lucide-react';

interface AIAssistantProps {
  tasks: Task[];
  suppliers: Supplier[];
  projects: Project[];
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ tasks, suppliers, projects }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResponse(null);
    const result = await analyzeSchedule(tasks, suppliers, projects, query);
    setResponse(result);
    setLoading(false);
  };

  const isKeyError = response === "Clé API manquante. Veuillez configurer votre clé API.";

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 w-96 shadow-xl relative z-20">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
        <Bot className="w-6 h-6 text-purple-600" />
        <h2 className="font-bold text-slate-800">Assistant IA</h2>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        <div className="bg-purple-50 p-3 rounded-lg rounded-tl-none text-sm text-slate-700 border border-purple-100">
          Bonjour! Je peux vous aider à optimiser vos cédules, détecter des conflits complexes ou suggérer des assignations. Posez-moi une question!
        </div>

        {query && response === null && !loading && (
           <div className="bg-slate-100 p-3 rounded-lg rounded-tr-none text-sm text-slate-700 ml-auto max-w-[90%]">
             {query}
           </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        )}

        {response && (
          <div className="space-y-4">
             <div className="bg-slate-100 p-3 rounded-lg rounded-tr-none text-sm text-slate-700 ml-auto max-w-[90%]">
               {query}
             </div>
             
             {isKeyError ? (
                <div className="bg-red-50 p-4 rounded-lg rounded-tl-none text-sm text-slate-800 border border-red-100">
                    <div className="flex items-center gap-2 font-bold text-red-700 mb-2">
                        <AlertCircle className="w-4 h-4" />
                        Clé API introuvable
                    </div>
                    <p className="mb-3 text-slate-600">Pour utiliser l'IA, vous devez configurer une clé Google Gemini (gratuite).</p>
                    <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium hover:underline bg-white px-3 py-2 rounded border border-blue-100 shadow-sm transition-colors"
                    >
                        <span>Obtenir ma clé Gemini</span>
                        <ExternalLink className="w-3 h-3" />
                    </a>
                    <p className="mt-3 text-xs text-slate-400">Si vous hébergez sur Vercel, ajoutez cette clé dans les "Environment Variables" sous le nom <code>API_KEY</code>.</p>
                </div>
             ) : (
                <div className="bg-purple-50 p-4 rounded-lg rounded-tl-none text-sm text-slate-800 border border-purple-100 prose prose-sm">
                    <p className="whitespace-pre-line">{response}</p>
                </div>
             )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder="Ex: Y a-t-il des conflits la semaine prochaine ?"
            className="w-full p-3 pr-10 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm bg-white"
            rows={3}
          />
          <button
            onClick={handleAsk}
            disabled={loading || !query.trim()}
            className="absolute bottom-3 right-3 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};