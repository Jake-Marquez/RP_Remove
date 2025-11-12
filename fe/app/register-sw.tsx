'use client';

import { useEffect } from 'react';
import '../lib/clear-db'; // Import to make utilities available in console

export function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    }

    // Log available dev utilities
    if (process.env.NODE_ENV === 'development') {
      console.log('Dev utilities available:');
      console.log('  clearDevices() - Clear all devices from IndexedDB');
      console.log('  deleteDB() - Delete the entire database');
    }
  }, []);

  return null;
}
