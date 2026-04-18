import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, syncUserProfile, db, fetchConfig, getConfigValue } from '../lib/firebase.ts';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  config: {
    primaryColor: string;
    tagline: string;
    heroTitle: string;
  };
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true, 
  isAdmin: false,
  config: { primaryColor: '#2563eb', tagline: 'Outlet Intelligence', heroTitle: 'Luxury Ecosystem' }
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
    primaryColor: '#2563eb',
    tagline: 'Outlet Intelligence',
    heroTitle: 'Luxury Ecosystem'
  });

  useEffect(() => {
    const initApp = async () => {
      await fetchConfig();
      setConfig({
        primaryColor: getConfigValue('primary_color'),
        tagline: getConfigValue('app_tagline'),
        heroTitle: getConfigValue('hero_title')
      });
    };
    initApp();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await syncUserProfile(firebaseUser);
        const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        setProfile(profileDoc.data());
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    config
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
