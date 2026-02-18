import { GoogleGenAI } from "@google/genai";
import { Project, Supplier, Task } from "../types";

const getAIClient = () => {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const analyzeSchedule = async (
  tasks: Task[],
  suppliers: Supplier[],
  projects: Project[],
  query: string
): Promise<string> => {
  const ai = getAIClient();
  if (!ai) return "Clé API manquante. Veuillez configurer votre clé API.";

  // Prepare context
  const context = {
    projects: projects.map(p => ({ id: p.id, name: p.name })),
    suppliers: suppliers.map(s => ({ id: s.id, name: s.name, trade: s.trade })),
    tasks: tasks.map(t => ({
      id: t.id,
      project: projects.find(p => p.id === t.projectId)?.name || 'Inconnu',
      supplier: suppliers.find(s => s.id === t.supplierId)?.name || 'Inconnu',
      start: t.start,
      end: t.end,
      title: t.title
    }))
  };

  const prompt = `
    Tu es un expert en gestion de chantier. Analyse les données JSON suivantes concernant mes projets, fournisseurs et tâches.
    
    Données:
    ${JSON.stringify(context, null, 2)}

    Question de l'utilisateur:
    "${query}"

    Réponds en français de manière professionnelle, concise et utile pour un chef de chantier. 
    Si tu détectes des problèmes potentiels (surcharge, conflits non marqués, délais irréalistes), mentionne-les.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Je n'ai pas pu générer de réponse.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Une erreur est survenue lors de l'analyse avec l'IA.";
  }
};
