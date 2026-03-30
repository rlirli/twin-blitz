import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

/**
 * Common keys for IndexedDB storage
 */
export const DB_KEYS = {
  SOURCE_IMAGE: (id: string | number) => `source-image:${id}`,
};

export const getDb = async <T>(key: string): Promise<T | undefined> => {
  if (typeof window === "undefined") return undefined;
  return idbGet(key);
};

export const setDb = async (key: string, value: any): Promise<void> => {
  if (typeof window === "undefined") return;
  return idbSet(key, value);
};

export const delDb = async (key: string): Promise<void> => {
  if (typeof window === "undefined") return;
  return idbDel(key);
};
