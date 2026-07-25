import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Better Auth oturumundan uygulama içi (integer) kullanıcı id'sini çözer.
 * İlk girişte users tablosunda satır yoksa oluşturur.
 * Oturum yoksa null döner.
 */
export async function getAppUserId(headers: Headers): Promise<number | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;

  const db = getDb();
  
  // Turso / LibSQL asenkron client yapısına uyarlanmıştır
  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE auth_id = ?",
    args: [session.user.id],
  });

  if (existing.rows.length > 0) {
    return Number(existing.rows[0].id);
  }

  await db.execute({
    sql: `INSERT INTO users (name, email, auth_id) VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET auth_id = excluded.auth_id, name = excluded.name`,
    args: [session.user.name || "Kullanıcı", session.user.email, session.user.id],
  });

  const row = await db.execute({
    sql: "SELECT id FROM users WHERE auth_id = ?",
    args: [session.user.id],
  });

  return Number(row.rows[0].id);
}

/** Oturum + admin bilgisi (ADMIN_EMAILS env'indeki e-postalar moderatördür). */
export async function getSessionInfo(
  headers: Headers
): Promise<{ userId: number; isAdmin: boolean } | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  const userId = await getAppUserId(headers);
  if (!userId) return null;

  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLocaleLowerCase("tr"))
    .filter(Boolean);
  const isAdmin = admins.includes(session.user.email.toLocaleLowerCase("tr"));
  return { userId, isAdmin };
}