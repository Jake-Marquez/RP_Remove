import { db } from './db';

/**
 * Utility function to clear all devices from IndexedDB
 * Useful for development/testing
 */
export async function clearAllDevices() {
  try {
    await db.devices.clear();
    console.log('All devices cleared from IndexedDB');
  } catch (error) {
    console.error('Failed to clear devices:', error);
  }
}

/**
 * Utility function to delete the entire database
 * This will recreate it on next page load
 */
export async function deleteDatabase() {
  try {
    await db.delete();
    console.log('Database deleted');
  } catch (error) {
    console.error('Failed to delete database:', error);
  }
}

// For browser console access during development
if (typeof window !== 'undefined') {
  (window as any).clearDevices = clearAllDevices;
  (window as any).deleteDB = deleteDatabase;
}
