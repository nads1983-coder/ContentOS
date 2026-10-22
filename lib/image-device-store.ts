// Bounded, account-scoped device designs. Cloud text/history storage is unchanged.
const DATABASE = "contentos-image-designs-v1";
export type DeviceImage = { image: string; createdAt: string };
export function boundDeviceImages<T extends DeviceImage>(images: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  let bytes = 0;
  for (const [id, value] of Object.entries(images).sort((a, b) => b[1].createdAt.localeCompare(a[1].createdAt))) {
    const size = new TextEncoder().encode(JSON.stringify(value)).length;
    if (Object.keys(result).length >= 8 || bytes + size > 10_000_000) continue;
    if (!value.image.startsWith("data:image/svg+xml;charset=utf-8,")) continue;
    result[id] = value; bytes += size;
  }
  return result;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("accounts");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
export async function readDeviceImages<T extends DeviceImage>(account: string): Promise<Record<string, T>> {
  if (!account) return {};
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("accounts", "readonly").objectStore("accounts").get(account);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(boundDeviceImages(request.result ?? {}));
    });
  } finally { db.close(); }
}
let writes: Promise<void> = Promise.resolve();
export function saveDeviceImages<T extends DeviceImage>(account: string, images: Record<string, T>): Promise<void> {
  // Preserve edit order even if opening IndexedDB completes out of order.
  const next = writes.catch(() => {}).then(() => writeDeviceImages(account, images));
  writes = next;
  return next;
}
async function writeDeviceImages<T extends DeviceImage>(account: string, images: Record<string, T>): Promise<void> {
  if (!account) throw new Error("Sign in to save designs.");
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("accounts", "readwrite");
      tx.objectStore("accounts").put(boundDeviceImages(images), account);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
