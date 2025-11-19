
import { AudioPlaylistItem } from "../types";

const DB_NAME = 'VillainLabzDB';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      reject("Failed to open database");
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
  });
};

export const saveTrackToDB = async (track: AudioPlaylistItem): Promise<void> => {
  try {
    // 1. Fetch the blob from the current blob URL
    const response = await fetch(track.src);
    const blob = await response.blob();

    // 2. Create a storable object
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      createdAt: track.createdAt || Date.now(),
      size: blob.size,
      type: blob.type,
      blob: blob 
    };

    store.put(record);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Error saving track to DB:", error);
    throw error;
  }
};

export const getAllTracksFromDB = async (): Promise<AudioPlaylistItem[]> => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const records = request.result;
      // Convert stored blobs back to URLs for the app to use
      const tracks: AudioPlaylistItem[] = records.map((record: any) => ({
        id: record.id,
        title: record.title,
        artist: record.artist,
        createdAt: record.createdAt,
        size: record.size,
        src: URL.createObjectURL(record.blob) // Rehydrate Blob URL
      }));
      // Sort by newest first
      resolve(tracks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteTrackFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const clearAllTracksFromDB = async (): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.clear();
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const updateTrackInDB = async (track: AudioPlaylistItem): Promise<void> => {
    // For title/artist updates only, we don't want to refetch the blob if we don't have to,
    // but IDB put replaces the object. We need to get the existing one first to keep the blob.
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
        const getReq = store.get(track.id);
        getReq.onsuccess = () => {
            const existing = getReq.result;
            if (existing) {
                existing.title = track.title;
                existing.artist = track.artist;
                store.put(existing);
                resolve();
            } else {
                reject("Track not found");
            }
        };
        getReq.onerror = () => reject(getReq.error);
    });
};
