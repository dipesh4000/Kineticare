import { deleteObject, getBlob, ref, uploadBytes } from 'firebase/storage';
import { firebaseEnabled, storage } from './firebase';

const DATABASE = 'kineticare-media-v1';
const STORE = 'references';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function localWrite(key, blob) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(blob, key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function localRead(key) {
  const database = await openDatabase();
  const blob = await new Promise((resolve, reject) => {
    const request = database.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return blob;
}

async function localDelete(key) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function saveReferenceMedia({ ownerUid, referenceId, versionId, blob }) {
  const path = `references/${ownerUid}/${referenceId}/${versionId}/reference.webm`;
  if (firebaseEnabled) {
    await uploadBytes(ref(storage, path), blob, { contentType: blob.type || 'video/webm' });
  } else {
    await localWrite(path, blob);
  }
  return path;
}

export async function loadReferenceMedia(path) {
  // Bundled demonstration clips are static files, not stored blobs.
  if (path.startsWith('demo:')) return `${import.meta.env.BASE_URL}demo/${path.slice(5)}.mp4`;
  const blob = firebaseEnabled ? await getBlob(ref(storage, path)) : await localRead(path);
  if (!blob) throw new Error('Reference media is unavailable.');
  return URL.createObjectURL(blob);
}

export async function removeReferenceMedia(path) {
  if (path.startsWith('demo:')) return;
  if (firebaseEnabled) await deleteObject(ref(storage, path));
  else await localDelete(path);
}
