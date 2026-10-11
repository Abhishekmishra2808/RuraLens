/**
 * DEV MODE BYPASS - Authentication Skip for Testing
 * 
 * This file automatically logs you in without backend authentication.
 * Use this to test the GNN visualization demo when backend is unavailable.
 * 
 * To use: Import this file in main.tsx or App.tsx
 */

import { useAppStore } from '../store/appStore';

export function enableDevMode() {
  console.log('🔓 DEV MODE: Auto-login enabled');
  
  // Auto-login as administrator
  const store = useAppStore.getState();
  store.login('admin', 'dev-admin');
  
  console.log('✅ Logged in as: dev-admin (Administrator)');
  console.log('🎯 You can now access all features without backend!');
}

// Auto-enable if in development
if (import.meta.env.DEV) {
  // Small delay to ensure store is initialized
  setTimeout(() => {
    enableDevMode();
  }, 100);
}

export default enableDevMode;
