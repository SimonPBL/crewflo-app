import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Project, Supplier, Task, ViewMode, COLORS } from '../types';
import { CalendarView } from '../components/CalendarView';
import { SupplierList } from '../components/SupplierList';
import { ProjectList } from '../components/ProjectList';
import { AIAssistant } from '../components/AIAssistant';
import { useSyncStore } from '../hooks/useSyncStore';
import { CloudSetup } from '../components/CloudSetup';
import { AuthScreen } from '../components/AuthScreen';
import { Users, Calendar as CalendarIcon, Sparkles, Building2, Menu, X, Hammer, CloudOff, RefreshCw, Upload, Save, Cloud, Wifi, Loader2, CheckCircle2, AlertTriangle, Download, Share, PlusSquare, Info, Undo2, Building } from 'lucide-react';
import { getSupabase } from "../services/supabase";

// VERSION DE L'APPLICATION
const APP_VERSION = "2.1.0";

const STORE_KEY_ROLE = "crewflo_role";

const App = () => {
  const supabase = getSupabase();

  // --- INSTALL APP LOGIC ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);
  
  const configCompanyId = (localStorage.getItem("crewflo_company_id") || "").trim();

  const [sessionChecked, setSessionChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<string>(localStorage.getItem(STORE_KEY_ROLE) || '');

  const fetchUserRole = async () => {
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setRole(data.role || '');
        localStorage.setItem(STORE_KEY_ROLE, data.role || '');
        if (data.company_id) localStorage.setItem('crewflo_company_id', data.company_id);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (!supabase) {
      setSessionChecked(true);
      return;
    }

    let unsub: { subscription: { unsubscribe: () => void } } | null = null;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(!!data.session);

      if (data.session) {
        await fetchUserRole();
      } else {
        setRole('');
        localStorage.removeItem(STORE_KEY_ROLE);
      }

      setSessionChecked(true);
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setIsLoggedIn(!!sess);

      if (sess) {
        await fetchUserRole();
      } else {
        setRole('');
        localStorage.removeItem(STORE_KEY_ROLE);
      }
    });

    unsub = sub;

    return () => {
      if (unsub) unsub.subscription.unsubscribe();
    };
  }, []);

  const canEdit = role === 'admin';

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const checkIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(checkIos);

    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsStandalone(checkStandalone);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };
  
  const handleUpdateApp = () => {
    if(confirm("Recharger l'application pour obtenir la dernière version ?")) {
        window.location.reload();
    }
  };

  // Données par défaut
  const defaultProjects: Project[] = [
    { id: 'p1', name: 'Résidence Lacroix', address: '12 Chemin du Lac', status: 'active' },
    { id: 'p2', name: 'Condos Centre-Ville', address: '450 Blvd Urbain', status: 'planning' }
  ];

  const defaultSuppliers: Supplier[] = [
    { id: 's1', name: 'ÉlecTout Inc.', trade: 'Électricien', color: COLORS[0], email: 'contact@electout.demo' },
    { id: 's2', name: 'Plomberie Pro', trade: 'Plombier', color: COLORS[7], email: 'info@plomberie.demo' },
    { id: 's3', name: 'Charpentes du Nord', trade: 'Charpentier', color: COLORS[2] }
  ];

  const defaultTasks: Task[] = [
    { 
      id: 't1', 
      projectId: 'p1', 
      supplierId: 's1', 
      title: 'Câblage initial', 
      start: new Date(new Date().setHours(8,0,0,0)).toISOString(), 
      end: new Date(new Date().setHours(16,0,0,0)).toISOString() 
    },
  ];

  const [projects, setProjects, isCloudP, statusP, undoP, canUndoP, lastModP] = useSyncStore<Project[]>('crewflo_projects', defaultProjects);
  const [suppliers, setSuppliers, isCloudS, statusS, undoS, canUndoS, lastModS] = useSyncStore<Supplier[]>('crewflo_suppliers', defaultSuppliers);
  const [tasks, setTasks, isCloudT, statusT, undoT, canUndoT, lastModT] = useSyncStore<Task[]>('crewflo_tasks', defaultTasks);

  const isCloudConnected = isCloudP || isCloudS || isCloudT;

  const globalStatus = useMemo(() => {
    if (statusP === 'error' || statusS === 'error' || statusT === 'error') return 'error';
    if (statusP === 'saving' || statusS === 'saving' || statusT === 'saving') return 'saving';
    if (statusP === 'saved' || statusS === 'saved' || statusT === 'saved') return 'saved';
    return 'idle';
  }, [statusP, statusS, statusT]);

  const handleGlobalUndo = () => {
    const maxMod = Math.max(
        canUndoP ? lastModP : 0, 
        canUndoS ? lastModS : 0, 
        canUndoT ? lastModT : 0
    );
    if (maxMod === 0) return;
    if (canUndoT && lastModT === maxMod) undoT();
    else if (canUndoP && lastModP === maxMod) undoP();
    else if (canUndoS && lastModS === maxMod) undoS();
  };

  const canGlobalUndo = canUndoP || canUndoS || canUndoT;

  const [currentView, setCurrentView] = useState<ViewMode>('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const resetData = () => {
    if(confirm("Attention : Cela va effacer toutes vos données LOCALES et remettre les données de démonstration. Continuer ?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const exportData = () => {
    const data = {
      version: APP_VERSION,
      companyId: configCompanyId,
      timestamp: new Date().toISOString(),
      projects,
      suppliers,
      tasks
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `CrewFlo_Backup_${configCompanyId || 'Global'}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        if (data.projects && data.suppliers && data.tasks) {
          if (confirm(`Remplacer vos données par cette sauvegarde ?`)) {
            setProjects(data.projects);
            setSuppliers(data.suppliers);
            setTasks(data.tasks);
            alert("Données restaurées !");
          }
        } else {
          alert("Format de fichier invalide.");
        }
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la lecture du fichier.");
      }
    };
    reader.readAsText(file);
    event.target.value = ''; 
  };

  // Afficher AuthScreen si pas connecté
  if (sessionChecked && !isLoggedIn) {
    return <AuthScreen />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'calendar':
        return (
          <CalendarView 
            canEdit={canEdit}
            projects={projects}
            suppliers={suppliers}
            tasks={tasks}
            setTasks={setTasks}
            currentProjectId={selectedProjectId}
          />
        );
      case 'suppliers':
        return <SupplierList suppliers={suppliers} setSuppliers={setSuppliers} canEdit={canEdit} />;
      case 'projects':
        return <ProjectList projects={projects} setProjects={setProjects} canEdit={canEdit} />;
      case 'ai':
        return <AIAssistant tasks={tasks} suppliers={suppliers} projects={projects} />;
      default:
        return <div>Vue inconnue</div>;
    }
  };

  const StatusIndicator = () => {
    if (!isCloudConnected) return null;
    if (globalStatus === 'saving') return <div className="flex items-center gap-2 text-yellow-500 text-[10px] font-bold animate-pulse"><Loader2 className="w-3 h-3 animate-spin" /> Envoi...</div>;
    if (globalStatus === 'saved') return <div className="flex items-center gap-2 text-green-500 text-[10px] font-bold"><CheckCircle2 className="w-3 h-3" /> Synchronisé</div>;
    if (globalStatus === 'error') return <div className="flex items-center gap-2 text-orange-500 text-[10px] font-bold" title="Pas de connexion internet."><AlertTriangle className="w-3 h-3" /> Hors ligne (Local)</div>;
    return <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold"><Wifi className="w-3 h-3" /> Connecté</div>;
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <CloudSetup 
        isOpen={isCloudModalOpen} 
        onClose={() => setIsCloudModalOpen(false)} 
        isCloudConnected={isCloudConnected} 
      />

      {showIosInstallModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl relative animate-in slide-in-from-bottom">
            <button onClick={() => setShowIosInstallModal(false)} className="absolute top-2 right-2 text-slate-400 p-2"><X className="w-5 h-5" /></button>
            <h3 className="font-bold text-lg mb-4 text-slate-900">Installer sur iPhone/iPad</h3>
            <ol className="space-y-4 text-sm text-slate-600">
              <li className="flex gap-3">
                <div className="flex-none bg-slate-100 p-2 rounded-lg h-fit"><Share className="w-5 h-5 text-blue-600" /></div>
                <div>1. Appuyez sur le bouton <strong>Partager</strong> dans la barre du navigateur.</div>
              </li>
              <li className="flex gap-3">
                <div className="flex-none bg-slate-100 p-2 rounded-lg h-fit"><PlusSquare className="w-5 h-5 text-slate-600" /></div>
                <div>2. Appuyez sur <strong>Sur l'écran d'accueil</strong>.</div>
              </li>
              <li className="flex gap-3">
                <div className="flex-none bg-slate-100 p-2 rounded-lg h-fit"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
                <div>3. Appuyez sur <strong>Ajouter</strong> en haut à droite.</div>
              </li>
            </ol>
          </div>
        </div>
      )}

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-none">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="bg-blue-600 p-1.5 rounded-lg"><Hammer className="w-5 h-5 text-white" /></div>
            <span>CrewFlo</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        {configCompanyId && (
          <div className="px-4 py-2 bg-slate-800 border-b border-slate-700">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wide">
              <Building className="w-3 h-3" />
              <span>{configCompanyId}</span>
            </div>
          </div>
        )}

        {canGlobalUndo && (
          <div className="px-4 pt-4 animate-in slide-in-from-left">
            <button onClick={handleGlobalUndo} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold bg-orange-600 text-white hover:bg-orange-700 transition-colors shadow-lg shadow-orange-900/20">
              <Undo2 className="w-4 h-4" /> Annuler dernière action
            </button>
          </div>
        )}

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          <button onClick={() => { setCurrentView('calendar'); setSelectedProjectId(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'calendar' && !selectedProjectId ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <CalendarIcon className="w-5 h-5" /> Calendrier Global
          </button>

          <div className="pt-4 pb-2 text-xs font-bold text-slate-500 uppercase px-3">Projets</div>
          {projects.map(p => (
            <button key={p.id} onClick={() => { setCurrentView('calendar'); setSelectedProjectId(p.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'calendar' && selectedProjectId === p.id ? 'bg-blue-900/50 text-blue-200 border border-blue-800' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
          
          <div className="pt-4 pb-2 text-xs font-bold text-slate-500 uppercase px-3">Gestion</div>
          
          <button onClick={() => { setCurrentView('projects'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'projects' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <Building2 className="w-5 h-5" /> Chantiers
          </button>

          <button onClick={() => { setCurrentView('suppliers'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'suppliers' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <Users className="w-5 h-5" /> Fournisseurs
          </button>

          <button onClick={() => { setCurrentView('ai'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'ai' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <Sparkles className="w-5 h-5" /> Assistant IA
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-800 space-y-3 flex-none bg-slate-900/50">
          <div className="flex justify-between items-center px-1 mb-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Cloud</span>
            <StatusIndicator />
          </div>

          {!isStandalone && deferredPrompt && (
            <button onClick={handleInstallClick} className="w-full flex items-center gap-2 px-3 py-2.5 mb-2 rounded text-xs font-bold transition-colors bg-blue-600 text-white hover:bg-blue-500 animate-in slide-in-from-left">
              <Download className="w-4 h-4" /> Installer l'app
            </button>
          )}

          {!isStandalone && isIos && (
            <button onClick={() => setShowIosInstallModal(true)} className="w-full flex items-center gap-2 px-3 py-2.5 mb-2 rounded text-xs font-bold transition-colors bg-blue-600 text-white hover:bg-blue-500 animate-in slide-in-from-left">
              <Download className="w-4 h-4" /> Installer sur iPhone
            </button>
          )}

          <button onClick={() => setIsCloudModalOpen(true)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded text-xs font-bold transition-colors border ${isCloudConnected ? 'bg-green-900/20 text-green-400 border-green-900 hover:bg-green-900/40' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>
            {isCloudConnected ? <Wifi className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
            {isCloudConnected ? 'Configuration' : 'Mode Collaboration'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={exportData} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors" title="Exporter">
              <Save className="w-4 h-4 mb-1" /> <span className="text-[10px]">Backup</span>
            </button>
            <button onClick={handleImportClick} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors" title="Importer">
              <Upload className="w-4 h-4 mb-1" /> <span className="text-[10px]">Restaurer</span>
            </button>
          </div>
          
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
          
          {!isCloudConnected && (
            <div className="flex items-center gap-2 text-[10px] text-yellow-500 opacity-80 justify-center">
              <CloudOff className="w-3 h-3 flex-shrink-0" /> <span>Mode Local</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-slate-800 mt-1">
            <button onClick={resetData} className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-red-400 transition-colors">
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
            <button onClick={handleUpdateApp} className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-white transition-colors" title="Mettre à jour">
              <Info className="w-3 h-3" /> v{APP_VERSION}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="text-slate-600 hover:text-slate-900"><Menu className="w-6 h-6" /></button>
            <h1 className="font-bold text-slate-800">CrewFlo</h1>
          </div>
          {canGlobalUndo && (
            <button onClick={handleGlobalUndo} className="p-2 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition-colors" title="Annuler">
              <Undo2 className="w-5 h-5" />
            </button>
          )}
        </header>

        <div className="flex-1 overflow-hidden relative">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
