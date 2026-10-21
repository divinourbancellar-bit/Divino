// Poster upload for the Add event form in admin.html.
//
// POST /functions/v1/event-poster   body: the image (webp/jpeg/png, max 3 MB)
//   header x-admin-pw: the dashboard password
//   ->  { "url": "https://…/storage/v1/object/public/posters/…" }
//
// The password is checked with the same admin_login RPC the dashboard uses,
// then the file goes into the public "posters" bucket (supabase/events-v2.sql).
// Deploy with JWT verification off: the dashboard only has the publishable key.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-admin-pw, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const MAX = 3 * 1024 * 1024;

const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return answer(405, { error: "POST an image" });

  const { error: pwError } = await db.rpc("admin_login", { pw: req.headers.get("x-admin-pw") ?? "" });
  if (pwError) return answer(401, { error: "wrong password" });

  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = TYPES[type];
  if (!ext) return answer(415, { error: "Poster must be a WebP, JPEG or PNG image" });
  const file = new Uint8Array(await req.arrayBuffer());
  if (!file.length || file.length > MAX) return answer(413, { error: "Poster must be under 3 MB" });

  const path = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await db.storage.from("posters").upload(path, file, { contentType: type, cacheControl: "31536000" });
  if (error) {
    console.error(error.message);
    return answer(500, { error: "Upload failed, please try again" });
  }
  return answer(200, { url: db.storage.from("posters").getPublicUrl(path).data.publicUrl });
});
