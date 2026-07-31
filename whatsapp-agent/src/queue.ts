import { getRedisClient } from "./redis.js";

export async function enqueue(queue: string, payload: unknown): Promise<void> {
  const client = await getRedisClient();
  await client.lPush(queue, JSON.stringify(payload));
}

/** BLPOP bloqueante: espera hasta `timeoutSeconds` a que aparezca un mensaje. */
export async function dequeue<T>(queue: string, timeoutSeconds: number): Promise<T | null> {
  const client = await getRedisClient();
  const result = await client.blPop(queue, timeoutSeconds);
  return result ? (JSON.parse(result.element) as T) : null;
}
