import React from 'react';
import { Search, Settings, User, Bell, Diamond, Home, ShoppingBag, BarChart3, Mic, Gavel, LogOut, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthProvider.tsx';
import { signInWithGoogle, logout, logAnalyticsEvent } from '../../lib/firebase.ts';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const AdminNav = ({ activeTab, onTabChange }: { activeTab?: string, onTabChange?: (tab: string) => void }) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;

  return (
    <>
      <p className="text-[10px] uppercase tracking-widest text-blue-strong font-black px-5 mt-6 mb-2">Administration</p>
      <NavItem 
        icon={Gavel} 
        label="Julgamento" 
        active={activeTab === 'judging'} 
        onClick={() => onTabChange?.('judging')} 
      />
    </>
  );
};
const NavItem = ({ icon: Icon, label, active, onClick }: NavItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 text-left relative overflow-hidden group",
      active ? "text-white" : "text-slate-400 hover:text-white"
    )}
  >
    {active && (
      <motion.div 
        layoutId="activeNav"
        className="absolute inset-0 bg-white/5 border border-white/10 shadow-lg"
        style={{ borderRadius: '1rem' }}
      />
    )}
    <Icon size={20} className={cn("relative z-10 transition-colors", active ? "text-blue-strong" : "group-hover:text-blue-600")} />
    <span className="text-sm font-medium relative z-10">{label}</span>
  </button>
);

export const Navbar = ({ onVoiceClick, isListening }: { onVoiceClick: () => void, isListening: boolean }) => {
  const { config } = useAuth();
  return (
    <nav className="h-20 px-8 flex items-center justify-between glass-dark fixed top-0 right-0 left-0 z-50">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-blue-strong rounded-xl flex items-center justify-center shadow-blue-strong">
          <Diamond className="text-black" size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white leading-none">LUXEVAULT</h1>
          <p className="text-[10px] text-blue-strong font-bold tracking-[0.2em] uppercase opacity-80">{config.tagline}</p>
        </div>
      </div>
      
      <div className="flex-1 max-w-xl mx-12 hidden md:block">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-strong transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search luxury brands, items or markets..." 
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 outline-none text-sm transition-all focus:border-blue-strong/30 focus:bg-white/10"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={onVoiceClick}
          className={cn(
            "p-3 rounded-2xl transition-all border",
            isListening 
              ? "bg-blue-strong border-blue-strong text-white animate-pulse" 
              : "bg-white/5 border-white/5 text-slate-400 hover:border-blue-strong opacity-80 hover:text-blue-strong"
          )}
        >
          <Mic size={20} />
        </button>
        <button className="p-3 rounded-2xl bg-white/5 border border-white/5 text-slate-400 hover:border-blue-strong/30 hover:text-blue-strong transition-all relative">
          <Bell size={20} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-strong rounded-full border-2 border-black" />
        </button>
        <UserMenu />
      </div>
    </nav>
  );
};

const UserMenu = () => {
  const { user, profile } = useAuth();
  const [open, setOpen] = React.useState(false);

  if (!user) {
    const handleLogin = async () => {
      await signInWithGoogle();
      logAnalyticsEvent('login', { method: 'google' });
    };

    return (
      <button 
        onClick={handleLogin}
        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-strong text-white font-bold text-xs hover:shadow-blue-strong transition-all"
      >
        <LogIn size={16} /> Entrar com Google
      </button>
    );
  }

  const handleLogout = async () => {
    await logout();
    logAnalyticsEvent('logout');
    setOpen(false);
  };

  return (
    <div className="relative">
      <div 
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600/20 to-blue-900/10 border border-blue-600/20 p-0.5 ml-2 cursor-pointer hover:border-blue-600/40 transition-all overflow-hidden"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full rounded-[14px] object-cover" referrerpolicy="no-referrer" />
        ) : (
          <div className="w-full h-full rounded-[14px] bg-slate-900 flex items-center justify-center">
            <User size={20} className="text-blue-strong" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-64 glass-dark p-2 rounded-3xl border border-white/10 shadow-2xl z-[60]"
          >
            <div className="p-4 border-b border-white/5 mb-2">
              <p className="font-bold text-sm text-white truncate">{profile?.displayName || user.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              <div className="mt-2 inline-block px-2 py-0.5 bg-blue-600/10 border border-blue-600/20 rounded-md">
                <p className="text-[9px] font-bold text-blue-strong uppercase">{profile?.role || 'User'}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:text-red-400 hover:bg-white/5 transition-all text-xs font-bold"
            >
              <LogOut size={16} /> Sair do Sistema
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const MainLayout = ({ 
  children, 
  activeTab,
  onTabChange,
  onVoiceClick,
  isListening
}: { 
  children: React.ReactNode, 
  activeTab?: string,
  onTabChange?: (tab: string) => void,
  onVoiceClick: () => void,
  isListening: boolean
}) => {
  const { config } = useAuth();
  
  return (
    <div className="min-h-screen bg-black text-slate-100 font-sans selection:bg-blue-600/20" style={{'--primary': config.primaryColor, '--nm-blue': config.primaryColor} as React.CSSProperties}>
      <Navbar onVoiceClick={onVoiceClick} isListening={isListening} />
      
      {/* Sidebar */}
      <aside className="w-72 fixed left-0 top-20 bottom-0 p-8 flex flex-col gap-10 border-r border-white/5 hidden lg:flex">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black px-5 mb-2">Management</p>
          <NavItem 
            icon={Home} 
            label="Overview" 
            active={activeTab === 'overview'} 
            onClick={() => onTabChange?.('overview')} 
          />
          <NavItem 
            icon={ShoppingBag} 
            label="Inventory" 
            active={activeTab === 'inventory'} 
            onClick={() => onTabChange?.('inventory')} 
          />
          <NavItem 
            icon={BarChart3} 
            label="Market AI" 
            active={activeTab === 'analytics'} 
            onClick={() => onTabChange?.('analytics')} 
          />
          <AdminNav activeTab={activeTab} onTabChange={onTabChange} />
          <NavItem 
            icon={Settings} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => onTabChange?.('settings')} 
          />
        </div>

        <div className="mt-auto px-5 py-6 rounded-3xl bg-gradient-to-br from-blue-600/20 to-transparent border border-blue-600/10">
          <p className="text-xs font-bold text-blue-strong mb-1">Vault Status: Secure</p>
          <p className="text-[10px] text-slate-400 leading-relaxed">System monitoring luxury fluctuations across global outlets in real-time.</p>
          <div className="mt-4 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '85%' }}
              className="h-full bg-blue-strong shadow-blue-strong"
            />
          </div>
        </div>
      </aside>

      <main className="lg:pl-72 pt-20">
        <div className="p-10 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

