/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { 
  Diamond, 
  TrendingUp, 
  Package, 
  AlertCircle, 
  ChevronRight, 
  Plus, 
  BrainCircuit,
  ShieldCheck,
  Zap,
  Globe,
  Settings,
  Gavel,
  Save,
  Trash2,
  History,
  UserCircle,
  ToggleLeft as Toggle,
  Layout,
  Upload,
  FileText,
  Loader2,
  Trash
} from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { cn } from '@/lib/utils';
import { useAuth } from './components/AuthProvider.tsx';
import { db, logUserAction, updateUserSettings, getUserSettings, uploadFile, listUserFiles, deleteFile, logAnalyticsEvent } from './lib/firebase.ts';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, orderBy, limit, query } from 'firebase/firestore';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MOCK_BRANDS = [
  { id: 1, name: 'LVMH Group', category: 'Luxury Conglomerate', status: 'Rising', performance: '+12.4%', color: 'border-blue-strong/30' },
  { id: 2, name: 'Gucci Outlet', category: 'Retail / Off-price', status: 'Stable', performance: '+2.1%', color: 'border-blue-500/20' },
  { id: 3, name: 'Hermès', category: 'High-end Leather', status: 'Peak', performance: '+5.7%', color: 'border-orange-500/20' },
  { id: 4, name: 'Prada', category: 'Apparel', status: 'Volatile', performance: '-1.2%', color: 'border-slate-500/20' },
];

export default function App() {
  const { user, profile, isAdmin, config } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isListening, setIsListening] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // History and Settings state
  const [history, setHistory] = useState<any[]>([]);
  const [userSettings, setSettings] = useState({ notifications: true, favoriteCategory: 'All', compactView: false });
  const [userFiles, setUserFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Administration state
  const [judgments, setJudgments] = useState<any[]>([]);
  const [judgingForm, setJudgingForm] = useState({ name: '', status: 'draft', description: '' });

  useEffect(() => {
    if (activeTab === 'judging' && isAdmin) {
      loadJudgments();
    }
    if (user) {
      loadUserSettings();
      logUserAction(user.uid, 'Navigation', `Opened tab: ${activeTab}`);
      logAnalyticsEvent('screen_view', { firebase_screen: activeTab });
    }
  }, [activeTab, isAdmin, user]);

  useEffect(() => {
    if (user && (activeTab === 'inventory' || activeTab === 'settings')) {
      loadHistory();
      loadUserFiles();
    }
  }, [activeTab, user]);

  const loadUserFiles = async () => {
    if (!user) return;
    const files = await listUserFiles(user.uid);
    setUserFiles(files);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const path = `users/${user.uid}/files/${Date.now()}_${file.name}`;
      await uploadFile(path, file);
      logUserAction(user.uid, 'File Upload', `Uploaded asset: ${file.name}`);
      logAnalyticsEvent('file_upload', { file_name: file.name, file_size: file.size });
      await loadUserFiles();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (path: string) => {
    if (!user) return;
    try {
      await deleteFile(path);
      logUserAction(user.uid, 'File Deletion', `Removed asset from vault`);
      await loadUserFiles();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const loadUserSettings = async () => {
    if (!user) return;
    const settings = await getUserSettings(user.uid);
    if (settings) {
      // Removing uid from display state if needed, but and spread it
      const { uid, updatedAt, ...rest } = settings;
      setSettings(prev => ({ ...prev, ...rest }));
    }
  };

  const loadHistory = async () => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'logs'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleUpdateSettings = async (newSettings: any) => {
    if (!user) return;
    const updated = { ...userSettings, ...newSettings };
    setSettings(updated);
    await updateUserSettings(user.uid, updated);
    logUserAction(user.uid, 'Settings Update', 'User updated personal preferences');
    logAnalyticsEvent('update_settings', { ...newSettings });
  };

  const loadJudgments = async () => {
    const snap = await getDocs(collection(db, 'judgments_config'));
    setJudgments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const saveJudgment = async () => {
    if (!judgingForm.name) return;
    await addDoc(collection(db, 'judgments_config'), {
      ...judgingForm,
      updatedAt: new Date().toISOString()
    });
    logAnalyticsEvent('admin_save_judgment', { name: judgingForm.name });
    setJudgingForm({ name: '', status: 'draft', description: '' });
    loadJudgments();
  };

  const deleteJudgment = async (id: string) => {
    await deleteDoc(doc(db, 'judgments_config', id));
    logAnalyticsEvent('admin_delete_judgment', { judgment_id: id });
    loadJudgments();
  };

  // --- Voice Control Logic ---
  const handleVoiceCommand = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'pt-BR'; // Or 'en-US'
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const command = event.results[0][0].transcript.toLowerCase();
      console.log('Voice Command:', command);
      
      if (command.includes('visão geral') || command.includes('home') || command.includes('overview')) {
        setActiveTab('overview');
      } else if (command.includes('inventário') || command.includes('inventory')) {
        setActiveTab('inventory');
      } else if (command.includes('inteligência') || command.includes('analytics') || command.includes('ai')) {
        setActiveTab('analytics');
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, []);

  // --- Gemini AI Market Analysis ---
  const generateMarketReport = async () => {
    setIsAnalyzing(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Você é um especialista em branding de luxo e outlets. Forneça uma análise curta (3 parágrafos) sobre a tendência atual de 'Quiet Luxury' no mercado de Outlets Europeus em 2026. Use um tom profissional e sofisticado.",
      });
      setAiReport(response.text || "Report generation failed.");
    } catch (error) {
      console.error(error);
      setAiReport("Unable to contact AI Vault. Check connectivity.");
    } finally {
      setIsAnalyzing(false);
      if (user) {
        logUserAction(user.uid, 'AI Intel', 'Generated market analysis report');
        logAnalyticsEvent('generate_ai_report', { user_id: user.uid });
      }
    }
  };

  const renderOverview = () => (
    <div className="space-y-10">
      {/* Hero Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <motion.p 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-blue-strong font-bold tracking-[0.3em] uppercase text-[10px] mb-2"
          >
            Dashboard Principal
          </motion.p>
          <h2 className="text-4xl font-bold text-white tracking-tight">{config.heroTitle}</h2>
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-3 rounded-2xl glass-dark border border-white/10 text-xs font-bold hover:border-blue-strong/30 transition-all flex items-center gap-2">
            <Globe size={14} /> Global Feed
          </button>
          <button className="px-6 py-3 rounded-2xl bg-blue-strong text-white text-xs font-bold shadow-blue-strong hover:scale-[1.02] transition-all flex items-center gap-2">
            <Plus size={14} /> Import Data
          </button>
        </div>
      </header>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Valuation', val: '$4.2M', trend: '+8.4%', icon: Diamond, color: 'text-blue-strong' },
          { label: 'Market Velocity', val: 'Fast', trend: 'High', icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Pending Units', val: '142', trend: '-12', icon: Package, color: 'text-blue-400' },
          { label: 'Risk Index', val: 'Stable', trend: 'Low', icon: ShieldCheck, color: 'text-slate-400' },
        ].map((kpi, idx) => (
          <motion.div 
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-6 rounded-[32px] glass-dark border border-white/5 space-y-4 hover:border-white/10 transition-colors cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div className={cn("p-3 rounded-2xl bg-white/5", kpi.color)}>
                <kpi.icon size={20} />
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{kpi.trend}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-white tracking-tight">{kpi.val}</p>
              <p className="text-[11px] text-slate-400 uppercase tracking-widest mt-1">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-bold text-white">Active Brand Monitoring</h3>
            <button className="text-xs text-blue-strong font-bold hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {MOCK_BRANDS.map(brand => (
              <div key={brand.id} className={cn("p-6 rounded-[28px] glass-dark border transition-all hover:bg-white/5 flex items-center justify-between group", brand.color)}>
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center font-bold text-blue-strong">
                    {brand.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{brand.name}</h4>
                    <p className="text-xs text-slate-500 uppercase tracking-widest mt-0.5">{brand.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-emerald-400">{brand.performance}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">{brand.status}</p>
                  </div>
                  <button className="p-3 rounded-xl bg-white/5 text-slate-400 group-hover:text-blue-strong transition-colors">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="p-8 rounded-[40px] bg-gradient-to-br from-blue-700/20 to-blue-900/40 border border-white/10 relative overflow-hidden group">
            <div className="relative z-10 space-y-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                <BrainCircuit className="text-blue-600" size={24} />
              </div>
              <h4 className="text-xl font-bold text-white leading-tight">Elite Market Intelligence</h4>
              <p className="text-xs text-slate-300 leading-relaxed">Let our AI analyze global price arbitrage opportunities for your next collection.</p>
              <button 
                onClick={() => {
                  setActiveTab('analytics');
                  logAnalyticsEvent('click_ai_feature_cta');
                }}
                className="w-full py-3 bg-white text-black font-bold rounded-xl text-xs hover:bg-blue-strong hover:text-white transition-all shadow-lg"
              >
                Launch Analyzer
              </button>
            </div>
            <div className="absolute top-[-20%] right-[-20%] w-48 h-48 bg-blue-600/10 blur-[60px] rounded-full group-hover:bg-blue-600/20 transition-all" />
          </div>

          <div className="p-8 rounded-[40px] glass-dark border border-dashed border-white/10 flex flex-col items-center text-center space-y-4">
             <AlertCircle className="text-slate-500" size={32} />
             <p className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">System Maintenance</p>
             <p className="text-xs text-slate-500">Node US-WEST syncing luxury item metadata. 99.8% uptime.</p>
          </div>
        </aside>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-12">
      <section className="space-y-8">
        <h2 className="text-3xl font-bold text-white tracking-tight">Physical Inventory</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-[32px] glass-dark border border-white/5 overflow-hidden group">
              <div className="h-48 bg-slate-900 border-b border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-black/60 to-transparent z-10" />
                <img 
                  src={`https://picsum.photos/seed/luxury${i}/800/600`} 
                  alt="Luxury Item" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-blue-strong text-white rounded-lg text-[10px] font-black uppercase">
                  In Vault
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white">Item Reference {i}Z</h4>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Heritage Collection</p>
                  </div>
                  <p className="text-blue-strong font-bold">$1,{i}50</p>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase transition-all hover:bg-white/10 text-white">Details</button>
                  <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-blue-strong hover:bg-blue-strong/10 transition-all"><Zap size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Digital Vault Assets</h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-slate-500 text-sm">Secure storage for brand certifications and legal documents.</p>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-strong animate-pulse" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">5GB Cloud Limit</span>
              </div>
            </div>
          </div>
          <div className="relative">
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <label 
              htmlFor="file-upload" 
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-strong text-white text-xs font-bold shadow-blue-strong transition-all cursor-pointer",
                isUploading ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"
              )}
            >
              {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
              {isUploading ? 'Securing Asset...' : 'Upload New Asset'}
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {userFiles.map((file, idx) => (
            <motion.div 
              key={file.path}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="group p-6 rounded-[32px] glass-dark border border-white/5 hover:border-blue-strong/30 transition-all flex flex-col space-y-4 relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-strong/10 flex items-center justify-center text-blue-strong">
                <FileText size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate pr-6">{file.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Cloud Secure</p>
              </div>
              <div className="flex gap-2">
                <a 
                  href={file.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 py-2 text-center bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase text-slate-300 hover:bg-white/10 transition-all"
                >
                  View File
                </a>
                <button 
                  onClick={() => handleDeleteFile(file.path)}
                  className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
                >
                  <Trash size={14} />
                </button>
              </div>
            </motion.div>
          ))}
          {userFiles.length === 0 && !isUploading && (
            <div className="col-span-full py-20 border border-dashed border-white/10 rounded-[40px] flex flex-col items-center justify-center text-center space-y-4">
               <Package className="text-slate-700" size={48} />
               <div>
                 <p className="text-slate-400 font-bold">Digital Vault is Empty</p>
                 <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-1">Upload brand assets to begin.</p>
               </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const renderAnalytics = () => (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-blue-600/20 rounded-3xl border border-blue-500/30 text-blue-400 mb-2">
          <BrainCircuit size={40} />
        </div>
        <h2 className="text-3xl font-bold text-white">AI Market Intelligence</h2>
        <p className="text-slate-400">Consult the vault's neural network for high-fidelity retail strategies.</p>
      </div>

      <div className="p-10 rounded-[48px] glass-dark border border-white/10 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8">
           <Diamond className="text-blue-strong/20 animate-pulse" size={120} />
        </div>
        
        {aiReport ? (
          <div className="space-y-6 relative z-10">
            <div className="prose prose-invert prose-slate max-w-none">
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{aiReport}</p>
            </div>
            <button 
              onClick={() => setAiReport(null)}
              className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-bold uppercase hover:bg-white/10 transition-all"
            >
              System Reset
            </button>
          </div>
        ) : (
          <div className="text-center space-y-6 relative z-10 py-12">
            <h3 className="text-xl font-bold text-blue-strong">Ready for Synthesis?</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">Click below to generate a real-time report on the luxury brand landscape using LLM-3 Intelligence.</p>
            <button 
              onClick={generateMarketReport}
              disabled={isAnalyzing}
              className="px-12 py-4 bg-blue-strong text-white font-bold rounded-2xl shadow-blue-strong hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-3 mx-auto"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Analyzing Data...
                </>
              ) : (
                'Generate Report'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderJudging = () => (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <motion.p 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-blue-strong font-bold tracking-[0.3em] uppercase text-[10px] mb-2"
          >
            Sistema de Julgamento
          </motion.p>
          <h2 className="text-4xl font-bold text-white tracking-tight">Configurações de Decisão</h2>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-8 rounded-[40px] glass-dark border border-white/10 space-y-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
             <Plus className="text-blue-strong" /> Nova Configuração
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Título do Sistema</label>
              <input 
                value={judgingForm.name}
                onChange={e => setJudgingForm({...judgingForm, name: e.target.value})}
                placeholder="Ex: Julgamento de Design 2026"
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 outline-none focus:border-blue-strong/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Status</label>
              <select 
                value={judgingForm.status}
                onChange={e => setJudgingForm({...judgingForm, status: e.target.value})}
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 outline-none focus:border-gold/30 appearance-none text-slate-300"
              >
                <option value="draft">Borrão (Draft)</option>
                <option value="active">Ativo (Active)</option>
                <option value="retired">Arquivado (Retired)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Descrição</label>
              <textarea 
                value={judgingForm.description}
                onChange={e => setJudgingForm({...judgingForm, description: e.target.value})}
                placeholder="Detalhes sobre os critérios..."
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 outline-none focus:border-gold/30 h-32"
              />
            </div>
            <button 
              onClick={saveJudgment}
              className="w-full py-4 bg-blue-strong text-white font-bold rounded-2xl shadow-blue-strong hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
            >
              <Save size={18} /> Salvar Configuração
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold text-white px-2">Sistemas Existentes ({judgments.length})</h3>
          <div className="space-y-4">
            {judgments.map((item: any) => (
              <div key={item.id} className="p-6 rounded-[32px] glass-dark border border-white/5 flex items-center justify-between group">
                <div>
                  <h4 className="font-bold text-white">{item.name}</h4>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{item.status} • {item.description.slice(0, 40)}...</p>
                </div>
                <button 
                  onClick={() => deleteJudgment(item.id)}
                  className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {judgments.length === 0 && (
              <div className="p-10 text-center glass-dark border border-white/5 rounded-[40px] text-slate-500">
                Nenhum sistema configurado ainda.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-12">
      <header>
        <h2 className="text-3xl font-bold text-white tracking-tight">Personalized Settings</h2>
        <p className="text-slate-500 text-sm mt-1">Configure your individual LuxeVault experience.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="p-8 rounded-[40px] glass-dark border border-white/5 space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <UserCircle className="text-blue-strong" size={20} /> Interface Preferences
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <p className="font-bold text-sm text-white">Compact View</p>
                  <p className="text-xs text-slate-500">Reduce padding and font sizes across the dashboard.</p>
                </div>
                <button 
                  onClick={() => handleUpdateSettings({ compactView: !userSettings.compactView })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    userSettings.compactView ? "bg-blue-strong" : "bg-slate-800"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    userSettings.compactView ? "right-1" : "left-1"
                  )} />
                </button>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <p className="font-bold text-sm text-white">Push Notifications</p>
                  <p className="text-xs text-slate-500">Receive alerts on luxury market drops and AI synthesis.</p>
                </div>
                <button 
                  onClick={() => handleUpdateSettings({ notifications: !userSettings.notifications })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    userSettings.notifications ? "bg-blue-strong" : "bg-slate-800"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    userSettings.notifications ? "right-1" : "left-1"
                  )} />
                </button>
              </div>

              <div className="space-y-3">
                <p className="font-bold text-sm text-white">Favorite Category</p>
                <div className="flex flex-wrap gap-2">
                  {['All', 'Conglomerates', 'Outlets', 'High-end'].map(cat => (
                    <button 
                      key={cat}
                      onClick={() => handleUpdateSettings({ favoriteCategory: cat })}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                        userSettings.favoriteCategory === cat 
                          ? "bg-blue-strong border-blue-strong text-white" 
                          : "bg-white/5 border-white/5 text-slate-400 hover:border-white/10"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="p-8 rounded-[40px] glass-dark border border-white/5 space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <History className="text-blue-strong" size={20} /> Action History
            </h3>
            <div className="space-y-4">
              {history.map((log, i) => (
                <div key={log.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-blue-strong group-hover:bg-blue-strong group-hover:text-white transition-all">
                    {log.action === 'Navigation' ? <Layout size={18} /> : log.action === 'AI Intel' ? <BrainCircuit size={18} /> : <Settings size={18} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{log.action}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">{log.details}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-600 font-mono italic">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-center py-10 text-slate-600 text-sm">No recent activity detected.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
           <div className="p-8 rounded-[40px] bg-blue-strong/10 border border-blue-strong/20 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-strong flex items-center justify-center">
                <ShieldCheck className="text-white" size={24} />
              </div>
              <h4 className="text-lg font-bold text-white">Vault Security</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Your settings are synced with the Cloud Vault and protected by your Google Identity.</p>
           </div>

           <div className="p-8 rounded-[40px] glass-dark border border-white/5 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Globe size={24} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Cloud Deployment</h4>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live: SSL Active</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">System published via secure global CDN. Traffic quota: 10GB/month.</p>
           </div>
           <div className="p-6 text-center text-[10px] text-slate-700 uppercase tracking-[0.3em] font-black">
             LuxeVault Protocol v1.4
           </div>
        </aside>
      </div>
    </div>
  );

  return (
    <MainLayout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      onVoiceClick={handleVoiceCommand}
      isListening={isListening}
    >
      {!user && (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
           <ShieldCheck className="text-blue-strong" size={80} />
           <div className="space-y-2">
             <h2 className="text-3xl font-bold text-white">Acesso Restrito ao Cofre</h2>
             <p className="text-slate-500 max-w-sm mx-auto">Conecte sua conta Google para acessar o ecossistema LuxeVault.</p>
           </div>
        </div>
      )}

      {user && activeTab === 'overview' && renderOverview()}
      {user && activeTab === 'inventory' && renderInventory()}
      {user && activeTab === 'analytics' && renderAnalytics()}
      {user && activeTab === 'judging' && isAdmin && renderJudging()}
      {user && activeTab === 'settings' && renderSettings()}
    </MainLayout>
  );
}


