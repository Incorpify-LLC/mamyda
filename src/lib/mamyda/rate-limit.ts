import { getSql } from "@/lib/db";

/** Returns true when this bucket is still inside its allowance. */
export async function allowHit(bucket: string, max: number, windowMs: number): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ hits: number }>`
    insert into rate_limits (bucket, hits, window_start)
    values (${bucket}, 1, now())
    on conflict (bucket) do update set
      hits = case
        when rate_limits.window_start <= now() - ((${windowMs}::text || ' milliseconds')::interval)
          then 1
        else rate_limits.hits + 1
      end,
      window_start = case
        when rate_limits.window_start <= now() - ((${windowMs}::text || ' milliseconds')::interval)
          then now()
        else rate_limits.window_start
      end
    returning hits
  `;
  return Number(rows[0]?.hits ?? max + 1) <= max;
}
