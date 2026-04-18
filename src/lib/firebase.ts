import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, getDocs, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { getRemoteConfig, fetchAndActivate, getValue, getString } from 'firebase/remote-config';
import { getAnalytics, logEvent as firebaseLogEvent, isSupported } from 'firebase/analytics';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const remoteConfig = getRemoteConfig(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const googleProvider = new GoogleAuthProvider();

export const logAnalyticsEvent = async (eventName: string, params?: any) => {
  if (typeof window !== 'undefined' && await isSupported() && analytics) {
    firebaseLogEvent(analytics, eventName, params);
  }
};

// Remote Config Setup
remoteConfig.settings.minimumFetchIntervalMillis = 60000; // 1 minute
remoteConfig.defaultConfig = {
  'primary_color': '#2563eb',
  'app_tagline': 'Outlet Intelligence',
  'hero_title': 'Luxury Ecosystem'
};

export const fetchConfig = async () => {
  try {
    await fetchAndActivate(remoteConfig);
  } catch (err) {
    console.error('Remote Config fetch failed:', err);
  }
};

export const getConfigValue = (key: string) => {
  return getString(remoteConfig, key);
};

// Auth Helpers
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Storage Helpers
export const uploadFile = async (path: string, file: File) => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const listUserFiles = async (uid: string) => {
  const listRef = ref(storage, `users/${uid}/files`);
  const res = await listAll(listRef);
  const urls = await Promise.all(res.items.map(item => getDownloadURL(item)));
  return res.items.map((item, index) => ({
    name: item.name,
    url: urls[index],
    path: item.fullPath
  }));
};

export const deleteFile = async (path: string) => {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
};

// User Profile Helpers
export const syncUserProfile = async (user: any) => {
  if (!user) return;
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: brandizeName(user.displayName || 'Anônimo'),
      photoURL: user.photoURL,
      role: 'user', // Default role
      createdAt: new Date().toISOString()
    });
  }
};

// Log and Settings Helpers
export const logUserAction = async (uid: string, action: string, details?: string) => {
  try {
    const logsRef = collection(db, 'users', uid, 'logs');
    await addDoc(logsRef, {
      uid,
      action,
      details: details || '',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log action:', error);
  }
};

export const updateUserSettings = async (uid: string, settings: any) => {
  try {
    const settingsRef = doc(db, 'users', uid, 'settings', 'current');
    await setDoc(settingsRef, {
      uid,
      ...settings,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error('Failed to update settings:', error);
  }
};

export const getUserSettings = async (uid: string) => {
  const settingsRef = doc(db, 'users', uid, 'settings', 'current');
  const snap = await getDoc(settingsRef);
  return snap.exists() ? snap.data() : null;
};

const brandizeName = (name: string) => {
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
