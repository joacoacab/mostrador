import { createClient, type RedisClientType } from "redis";

let clientPromise: Promise<RedisClientType> | undefined;

export function getRedisClient(): Promise<RedisClientType> {
  if (!clientPromise) {
    const client: RedisClientType = createClient({
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
    });
    client.on("error", (err) => console.error("Redis error", err));
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

export async function closeRedisClient(): Promise<void> {
  if (!clientPromise) return;
  const client = await clientPromise;
  if (client.isOpen) {
    await client.quit();
  }
  clientPromise = undefined;
}
