import { AsyncLocalStorage } from "node:async_hooks";
import { getDb } from "@/lib/db/client";

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const transactions = new AsyncLocalStorage<Transaction>();

// Hooks must share the adapter's connection, including when the pool is saturated.
export function getAuthDatabase(): Database | Transaction {
  return transactions.getStore() ?? getDb();
}

export function authAdapterDatabase(): Database {
  const db = getDb();
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === "transaction") {
        return (callback: Parameters<Database["transaction"]>[0], config?: Parameters<Database["transaction"]>[1]) =>
          target.transaction(tx => transactions.run(tx, () => callback(tx)), config);
      }
      return Reflect.get(target, property, receiver);
    },
  });
}
