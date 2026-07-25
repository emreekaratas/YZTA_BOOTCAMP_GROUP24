import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db"; // db.ts dosyamızdan çağırıyoruz

let isInitialized = false;

export async function GET() {
  try {
    // Tablolar veritabanında yoksa bir kereye mahsus otomatik oluşturur
    if (!isInitialized) {
      await initDb();
      isInitialized = true;
    }

    const result = await db.execute(`
      SELECT p.id, p.content, p.image_path, p.created_at,
             u.name AS user_name, u.image AS avatar_path,
             s.title AS suggestion_title, s.layer AS suggestion_layer
      FROM posts p
      LEFT JOIN user u ON p.user_id = u.id
      LEFT JOIN suggestions s ON p.suggestion_id = s.id
      ORDER BY p.created_at DESC
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Feed API Hatası:", error);
    return NextResponse.json({ error: "Veriler alınamadı." }, { status: 500 });
  }
}