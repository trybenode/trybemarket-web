/**
 * A tiny in-memory stand-in for the Admin Firestore, with just what
 * lib/whatsapp/* uses: collection().doc(), doc.get/set/create/update/delete,
 * collection().where(field, "==", value).get() (select/limit are accepted and
 * ignored), and runTransaction with tx.get/set/create/update/delete. Transactions run one at a time, in order.
 */
export function createFakeFirestore() {
  const store = new Map(); // "collection/id" → data
  let autoId = 0;

  const snapshot = (ref) => {
    const data = store.get(ref.path);
    return { exists: data !== undefined, id: ref.id, ref, data: () => (data === undefined ? undefined : structuredClone(data)) };
  };
  const write = (ref, data, options) => {
    const current = store.get(ref.path);
    store.set(ref.path, options?.merge && current ? { ...current, ...structuredClone(data) } : structuredClone(data));
  };
  const runQuery = (query) => {
    const docs = [...store.keys()]
      .filter((path) => path.startsWith(`${query.collection}/`))
      .map((path) => snapshot(docRef(query.collection, path.slice(query.collection.length + 1))))
      .filter((snap) => query.filters.every(([field, value]) => snap.data()[field] === value));
    return { docs, empty: docs.length === 0, size: docs.length };
  };

  function docRef(collection, id) {
    const ref = {
      id,
      path: `${collection}/${id}`,
      get: async () => snapshot(ref),
      set: async (data, options) => write(ref, data, options),
      update: async (data) => {
        if (!store.has(ref.path)) throw new Error(`No document to update: ${ref.path}`);
        write(ref, data, { merge: true });
      },
      create: async (data) => {
        if (store.has(ref.path)) throw Object.assign(new Error("ALREADY_EXISTS"), { code: 6 });
        write(ref, data);
      },
      delete: async () => void store.delete(ref.path),
    };
    return ref;
  }

  const collection = (name) => {
    const query = (filters) => ({
      collection: name,
      filters,
      where: (field, op, value) => {
        if (op !== "==") throw new Error("fake Firestore only supports ==");
        return query([...filters, [field, value]]);
      },
      select: () => query(filters), // field masks don't matter here
      limit: () => query(filters),
      get: async () => runQuery({ collection: name, filters }),
    });
    return { doc: (id) => docRef(name, id ?? `auto${++autoId}`), ...query([]) };
  };

  let queue = Promise.resolve();
  const runTransaction = (fn) => {
    const run = queue.then(async () => {
      const writes = [];
      const tx = {
        get: async (target) => (target.path ? snapshot(target) : runQuery(target)),
        set: (ref, data, options) => writes.push(() => write(ref, data, options)),
        create: (ref, data) =>
          writes.push(() => {
            if (store.has(ref.path)) throw Object.assign(new Error("ALREADY_EXISTS"), { code: 6 });
            write(ref, data);
          }),
        update: (ref, data) => writes.push(() => write(ref, data, { merge: true })),
        delete: (ref) => writes.push(() => store.delete(ref.path)),
      };
      const result = await fn(tx);
      writes.forEach((apply) => apply()); // all-or-nothing: only if fn didn't throw
      return result;
    });
    queue = run.catch(() => {});
    return run;
  };

  return { collection, runTransaction, _store: store, _get: (path) => store.get(path) };
}
