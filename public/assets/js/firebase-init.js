// Firebase initializer and small Firestore wrapper.
// Usage: include a `firebase-config.js` that sets `window.__FIREBASE_CONFIG__` (copy from firebase-config.example.js)
// then include this file with `type="module"` before your app scripts.

const FB_VERSION = '9.22.1';

// Flag to signal when FB is ready
window.__FB_READY__ = false;

async function setupFirebase() {
  const cfg = window.__FIREBASE_CONFIG__ || null;
  if (!cfg) {
    console.warn('Firebase config not found. Falling back to localStorage-only behavior.');
    window.FB = { available: false };
    window.__FB_READY__ = true; // Mark ready even without FB
    return;
  }

  // dynamic imports from CDN (modular SDK)
  const [{ initializeApp }, { getFirestore, collection, getDocs, addDoc, doc, setDoc, updateDoc, deleteDoc, getDoc, query, where }] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`)
  ]);

  const app = initializeApp(cfg);
  const db = getFirestore(app);

  // If developer sets emulator config, connect to emulator
  if (window.__FIRESTORE_EMULATOR__) {
    try {
      const { connectFirestoreEmulator } = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`);
      connectFirestoreEmulator(db, window.__FIRESTORE_EMULATOR__.host, window.__FIRESTORE_EMULATOR__.port);
      console.info('Connected to Firestore emulator at', window.__FIRESTORE_EMULATOR__);
    } catch (e) {
      console.warn('Could not connect to emulator', e);
    }
  }

  // Minimal wrapper that exposes async CRUD methods compatible with this app's local usage.
  window.FB = {
    available: true,
    async getAll(collectionName) {
      try {
        const colRef = collection(db, collectionName);
        const snap = await getDocs(colRef);
        return snap.docs.map(d => Object.assign({ _id: d.id }, d.data()));
      } catch (e) { console.error('FB.getAll error', e); return []; }
    },
    async getDoc(collectionName, id) {
      try {
        const dref = doc(db, collectionName, String(id));
        const snap = await getDoc(dref);
        if (!snap.exists()) return null;
        return Object.assign({ _id: snap.id }, snap.data());
      } catch (e) { console.error('FB.getDoc error', e); return null; }
    },
    async add(collectionName, data) {
      try {
        // Use addDoc to generate an id, but also return object with _id
        const docRef = await addDoc(collection(db, collectionName), data);
        return { _id: docRef.id, ...data };
      } catch (e) { console.error('FB.add error', e); return null; }
    },
    async set(collectionName, id, data) {
      try {
        await setDoc(doc(db, collectionName, String(id)), data, { merge: true });
        return { _id: String(id), ...data };
      } catch (e) { console.error('FB.set error', e); return null; }
    },
    async update(collectionName, id, patch) {
      try {
        await updateDoc(doc(db, collectionName, String(id)), patch);
        const snap = await getDoc(doc(db, collectionName, String(id)));
        return Object.assign({ _id: snap.id }, snap.data());
      } catch (e) { console.error('FB.update error', e); return null; }
    },
    async delete(collectionName, id) {
      try {
        await deleteDoc(doc(db, collectionName, String(id)));
        return true;
      } catch (e) { console.error('FB.delete error', e); return false; }
    },
    // Helper - query by field equality
    async queryEqual(collectionName, field, value) {
      try {
        const q = query(collection(db, collectionName), where(field, '==', value));
        const snap = await getDocs(q);
        return snap.docs.map(d => Object.assign({ _id: d.id }, d.data()));
      } catch (e) { console.error('FB.queryEqual error', e); return []; }
    }
  };

  window.__FB_READY__ = true; // Mark ready
  console.info('Firebase initialized. Firestore wrapper available as `window.FB`');
}

setupFirebase().catch(err => {
  console.error('Firebase setup failed:', err);
  window.FB = { available: false };
  window.__FB_READY__ = true;
});
