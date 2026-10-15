// Divino's live Google rating for the review badges on the site.
//
// GET /functions/v1/google-rating  ->  { "rating": 4.7, "count": 134 }
//
// The answer comes from a one-row cache (public.google_rating) and is
// refreshed from the Google Places API at most every 12 hours, so the site
// can call this on every page view without running up the Google bill.
// Until the GOOGLE_PLACES_KEY secret is set (or if Google ever fails before
// the first fill) it answers { "rating": null } and the pages keep the
// number typed into them.
import { createClient } from "npm:@supabase/supabase-js@2";

const PLACE_ID = "ChIJbfUTBsQ7FxMRd-LJ0zExPYU"; // Divino Urban Cellar, Via Gibilmanna 16
const FRESH_MS = 12 * 60 * 60 * 1000;
const RETRY_MS = 60 * 60 * 1000; // after a failed refresh, try again in an hour

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=3600",
};

type Row = { rating: number | null; review_count: number | null; fetched_at: string };

async function fromGoogle(key: string) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${PLACE_ID}`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount" },
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
  const j = await res.json();
  if (typeof j.rating !== "number" || typeof j.userRatingCount !== "number") {
    throw new Error("Places API answer had no rating");
  }
  return { rating: j.rating as number, count: j.userRatingCount as number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });

  const { data } = await db.from("google_rating").select("rating,review_count,fetched_at").eq("id", 1).single();
  let row = data as Row | null;

  const key = Deno.env.get("GOOGLE_PLACES_KEY");
  const age = row ? Date.now() - new Date(row.fetched_at).getTime() : Infinity;
  if (key && age > FRESH_MS) {
    try {
      const g = await fromGoogle(key);
      row = { rating: Math.round(g.rating * 10) / 10, review_count: g.count, fetched_at: new Date().toISOString() };
      await db.from("google_rating").upsert({ id: 1, ...row });
    } catch (e) {
      console.error(String(e));
      // Keep the last good numbers; wait an hour before asking Google again.
      await db.from("google_rating").update({ fetched_at: new Date(Date.now() - FRESH_MS + RETRY_MS).toISOString() }).eq("id", 1);
    }
  }

  return new Response(JSON.stringify({ rating: row?.rating ?? null, count: row?.review_count ?? null }), { headers });
});
