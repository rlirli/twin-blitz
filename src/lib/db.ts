import { get as getDb, set as setDb, del as delDb } from "idb-keyval";

/**
 * Common keys for IndexedDB storage
 */
export const DB_KEYS = {
  SOURCE_IMAGE: (id: string | number) => `source-image:${id}`,
};

export { getDb, setDb, delDb };
