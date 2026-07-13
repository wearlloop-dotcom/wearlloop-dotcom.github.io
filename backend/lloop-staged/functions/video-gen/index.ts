// =============================================================================
// video-gen — Supabase Edge Function (Deno) · LLOOP Video Studio
//
// ⚠️ ไฟล์นี้เป็น "ฉบับ staged" ที่เขียนในรีโปหน้าเว็บเพื่อรีวิว
//    ต้นทางจริง (canonical) ต้องอยู่ที่ repo backend:
//        wearlloop-dotcom/lloop → supabase/functions/video-gen/index.ts
//    เพราะ deploy-site.yml จะ copy ops/* + liff/* มาทับรีโปหน้าเว็บ แต่ "ไม่ deploy
//    edge function ให้" — edge function ต้อง `supabase functions deploy video-gen`
//    จาก repo lloop เอง (secret ตั้งใน Supabase dashboard แล้ว)
//
// สัญญา (contract) เดียวกับ storyboard-gen: รับ POST { id_token, task, ...args }
//   task: 'config' | 'preview_prompt' | 'generate' | 'feedback' | 'history'
//   verify LINE idToken → เช็คพนักงาน active + role (marketing/manager/owner)
//   → เช็ค feature flag video_studio_enabled (owner ข้ามได้ = dark launch)
//   → image-to-video ผ่าน provider (Veo ดีฟอลต์) → log ลง video_gen_log
//
// ENV ที่ต้องตั้งใน Supabase → Edge Functions → Secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (มีให้อัตโนมัติ)
//   GOOGLE_AI_API_KEY                          (ใช้ซ้ำจาก storyboard-gen ได้เลย)
//   LINE_OPS_CHANNEL_ID                        (client_id สำหรับ verify idToken ของ ops LIFF)
//   VIDEO_PROVIDER = 'veo' | 'higgsfield'      (ดีฟอลต์ 'veo')
//   VEO_MODEL      = เช่น 'veo-3.1-fast'       (ตรวจ id ล่าสุดกับ Gemini API ก่อน)
//   VEO_THB_PER_SECOND = '5'                   (ราคาโดยประมาณ บาท/วินาที ไว้โชว์ + ลง audit)
//   HIGGSFIELD_API_KEY, HIGGSFIELD_THB_PER_SECOND (เฉพาะถ้าใช้ provider higgsfield)
//   USD_THB = '36'                             (เรตแปลงถ้าอยากคิดจาก usd)
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const SB_URL = env("SUPABASE_URL");
const SB_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_KEY = env("GOOGLE_AI_API_KEY");
const LINE_CHANNEL = env("LINE_OPS_CHANNEL_ID");
const PROVIDER = env("VIDEO_PROVIDER", "veo").toLowerCase();
const VEO_MODEL = env("VEO_MODEL", "veo-3.1-fast");
const VEO_THB_PER_SECOND = Number(env("VEO_THB_PER_SECOND", "5"));
const HF_KEY = env("HIGGSFIELD_API_KEY");
const HF_THB_PER_SECOND = Number(env("HIGGSFIELD_THB_PER_SECOND", "4"));

const admin = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const ROLES_ALLOWED = ["marketing", "manager", "owner"];
const BUCKET = "video-gen";

// ── โมชันสำเร็จรูป → ประโยคภาษาถ่ายวิดีโอ (คุมให้เพี้ยนน้อย: กล้องนิ่ง คนขยับพอดี) ──
const MOTION: Record<string, string> = {
  spin: "the model slowly rotates a full 360 degrees on the spot to reveal the whole outfit, smooth continuous turn, garment fabric flowing naturally with the motion",
  catwalk: "the model walks confidently toward the camera like a runway catwalk, natural stride, the dress and fabric swaying with each step",
  fabric: "the model stands still in an elegant pose while a gentle breeze makes the hem and fabric of the dress flow and ripple softly",
  pushin: "the model holds a still elegant pose while the camera slowly pushes in toward the outfit, revealing fabric texture and detail",
  subtle: "the model holds an elegant pose with only very subtle natural movement — soft breathing, slight fabric settle — minimal motion to keep every garment detail crisp and stable",
};
const ASPECTS = new Set(["9:16", "16:9"]);
const DURATIONS = new Set([4, 6, 8]);

// ── สร้าง prompt วิดีโอ (image-to-video: บรรยายการเคลื่อนไหว ไม่บรรยายชุดซ้ำ) ──
function buildPrompt(motion: string, note?: string, custom?: string): string {
  if (custom && custom.trim()) return custom.trim();
  const m = MOTION[motion] || MOTION.spin;
  const parts = [
    "Cinematic fashion video generated from the provided still image of a model wearing a dress.",
    "Keep the person's face, body, and the garment's color, print, fabric texture and fit EXACTLY as in the source image — do not restyle, do not warp the garment, do not add or remove clothing.",
    m,
    "Photorealistic, natural skin texture, soft realistic lighting consistent with the source image, elegant premium mood, smooth stable motion, no morphing artifacts, no flicker.",
  ];
  if (note && note.trim()) parts.push("Additional direction: " + note.trim());
  return parts.join(" ");
}

function costOf(durationSeconds: number): { model: string; thb_per_second: number; thb: number } {
  const per = PROVIDER === "higgsfield" ? HF_THB_PER_SECOND : VEO_THB_PER_SECOND;
  const model = PROVIDER === "higgsfield" ? "higgsfield" : VEO_MODEL;
  return { model, thb_per_second: per, thb: Math.round(per * durationSeconds) };
}

// ── verify LINE idToken → คืน sub (line_user_id) ──
async function verifyLine(idToken: string): Promise<string | null> {
  if (!idToken || !LINE_CHANNEL) return null;
  const r = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: LINE_CHANNEL }),
  });
  if (!r.ok) return null;
  const d = await r.json().catch(() => ({}));
  return d.sub || null;
}

// ── หาพนักงานจาก line_user_id (ปรับชื่อตาราง/คอลัมน์ให้ตรง schema จริงของ lloop) ──
async function resolveStaff(lineUserId: string) {
  const { data } = await admin
    .from("employees")
    .select("id, name, nickname, role, is_owner, active")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  return data;
}

async function getFlag(key: string): Promise<boolean> {
  const { data } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value === "true";
}

// ── ดึงรูปตั้งต้นเป็น base64 (จากชุดในคลัง หรือจาก client) ──
async function sourceImage(args: any): Promise<{ b64: string; mime: string } | null> {
  if (args.image) {
    const m = String(args.image).match(/^data:([^;]+);base64,(.+)$/);
    if (m) return { mime: m[1], b64: m[2] };
    return { mime: args.media_type || "image/png", b64: String(args.image) };
  }
  if (args.sku) {
    // ดึง url รูปหลักของชุดจากคลัง แล้ว fetch มาแปลง base64
    const { data } = await admin.from("garments").select("photos").eq("code", args.sku).maybeSingle();
    const url = data?.photos?.[0];
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (const b of buf) bin += String.fromCharCode(b);
    return { mime: r.headers.get("content-type") || "image/jpeg", b64: btoa(bin) };
  }
  return null;
}

// ── PROVIDER: Veo ผ่าน Gemini API (image-to-video, long-running poll) ──
// หมายเหตุ: endpoint/ชื่อ field ของ Veo อาจเปลี่ยนตามเวอร์ชัน API — ตรวจกับเอกสาร
// https://ai.google.dev/gemini-api/docs/video ก่อน deploy จริง แล้วปรับตรงนี้จุดเดียว
async function genVeo(prompt: string, img: { b64: string; mime: string }, aspect: string, duration: number): Promise<Uint8Array> {
  if (!GOOGLE_KEY) throw { code: "no_api_key" };
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const start = await fetch(`${base}/models/${VEO_MODEL}:predictLongRunning?key=${GOOGLE_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt, image: { bytesBase64Encoded: img.b64, mimeType: img.mime } }],
      parameters: { aspectRatio: aspect, durationSeconds: duration, sampleCount: 1 },
    }),
  });
  const startBody = await start.json().catch(() => ({}));
  if (!start.ok) throw { code: "gen_failed", message: startBody?.error?.message || `veo start ${start.status}` };
  const opName = startBody.name;
  if (!opName) throw { code: "gen_failed", message: "no operation name from Veo" };

  // poll operation จนเสร็จ (สูงสุด ~4 นาที)
  for (let i = 0; i < 48; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const op = await fetch(`${base}/${opName}?key=${GOOGLE_KEY}`).then((r) => r.json()).catch(() => ({}));
    if (op.error) throw { code: "gen_failed", message: op.error.message || "veo op error" };
    if (op.done) {
      const resp = op.response || {};
      const vids = resp.generateVideoResponse?.generatedSamples || resp.generatedVideos || resp.videos || [];
      const first = vids[0] || {};
      const b64 = first.video?.bytesBase64Encoded || first.bytesBase64Encoded;
      const uri = first.video?.uri || first.uri;
      if (b64) {
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) out[j] = bin.charCodeAt(j);
        return out;
      }
      if (uri) {
        const vr = await fetch(uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${GOOGLE_KEY}`);
        if (!vr.ok) throw { code: "gen_failed", message: `fetch video uri ${vr.status}` };
        return new Uint8Array(await vr.arrayBuffer());
      }
      throw { code: "gen_failed", message: "veo done but no video payload" };
    }
  }
  throw { code: "timeout", message: "veo generation timed out" };
}

async function generateVideo(prompt: string, img: { b64: string; mime: string }, aspect: string, duration: number): Promise<Uint8Array> {
  if (PROVIDER === "higgsfield") {
    // สเก็ตช์: Higgsfield API ($0.1/วิ) — เติมเมื่อสลับ provider
    // ดู https://higgsfield.ai/mcp / API docs แล้ว implement start+poll คล้าย Veo
    throw { code: "gen_failed", message: "higgsfield provider not implemented yet — set VIDEO_PROVIDER=veo" };
  }
  return await genVeo(prompt, img, aspect, duration);
}

// ── upload ผลลัพธ์ขึ้น storage → คืน public url ──
async function uploadResult(bytes: Uint8Array, staffId: string): Promise<string> {
  const path = `${staffId}/${crypto.randomUUID()}.mp4`;
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "video/mp4", upsert: false });
  if (error) throw { code: "gen_failed", message: "upload failed: " + error.message };
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const { id_token, task } = body;

  const sub = await verifyLine(id_token);
  if (!sub) return json({ error: "unauthorized" }, 401);
  const staff = await resolveStaff(sub);
  if (!staff || !staff.active) return json({ error: "no_access" }, 403);
  const isOwner = !!staff.is_owner;
  if (!isOwner && !ROLES_ALLOWED.includes(staff.role)) return json({ error: "role_denied" }, 403);

  const enabled = await getFlag("video_studio_enabled");
  // dark launch: เจ้าของทดสอบได้เสมอ; ทีมใช้ได้เมื่อเปิดสวิตช์
  const usable = enabled || isOwner;

  try {
    if (task === "config") {
      return json({ data: { enabled, is_owner: isOwner, cost: costOf(1), provider: PROVIDER } });
    }

    if (task === "preview_prompt") {
      const prompt = buildPrompt(body.motion || "spin", body.note, body.custom_prompt);
      return json({ data: { prompt } });
    }

    if (task === "feedback") {
      const { gen_id, rating, note } = body;
      if (!gen_id || !["pass", "fail"].includes(rating)) return json({ error: "bad_request" }, 400);
      await admin.from("video_gen_log").update({
        feedback_rating: rating, feedback_note: note || null,
        feedback_by: staff.name || staff.nickname || null, feedback_at: new Date().toISOString(),
      }).eq("id", gen_id);
      return json({ data: { ok: true } });
    }

    if (task === "history") {
      const limit = Math.min(50, Number(body.limit) || 30);
      let q = admin.from("video_gen_log").select("*").order("created_at", { ascending: false }).limit(limit);
      if (!isOwner) q = q.eq("employee_id", staff.id);
      const { data: rows } = await q;
      let summary = null;
      if (isOwner) {
        const { data: all } = await admin.from("video_gen_log").select("status, feedback_rating, cost_thb");
        if (all) {
          summary = {
            total: all.length,
            cost_thb: all.reduce((s, r) => s + (Number(r.cost_thb) || 0), 0),
            passes: all.filter((r) => r.feedback_rating === "pass").length,
            fails: all.filter((r) => r.feedback_rating === "fail").length,
            errors: all.filter((r) => r.status !== "ok").length,
          };
        }
      }
      return json({ data: { rows: rows || [], all_visible: isOwner, summary } });
    }

    if (task === "generate") {
      if (!usable) return json({ error: "feature_disabled" }, 403);

      // กติกาบังคับตัดสินคลิปค้าง: ถ้ามีคลิป ok ที่ยังไม่ได้ให้ feedback ของตัวเอง → ต้องตัดสินก่อน
      const { data: pend } = await admin.from("video_gen_log")
        .select("id, url, sku")
        .eq("employee_id", staff.id).eq("status", "ok").is("feedback_rating", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (pend) return json({ error: "feedback_required", pending: { gen_id: pend.id, url: pend.url, sku: pend.sku } }, 409);

      const aspect = ASPECTS.has(body.aspect) ? body.aspect : "9:16";
      const duration = DURATIONS.has(Number(body.duration)) ? Number(body.duration) : 4;
      const prompt = buildPrompt(body.motion || "spin", body.note, body.custom_prompt);
      const c = costOf(duration);

      const img = await sourceImage(body);
      if (!img) return json({ error: "no_source" }, 400);

      // แถวออดิทตั้งต้น (สถานะ pending) → อัปเดตผลทีหลัง เพื่อให้ค่าเสีย/พังถูกบันทึกด้วย
      const { data: logRow } = await admin.from("video_gen_log").insert({
        employee_id: staff.id, employee_name: staff.name || staff.nickname || null,
        sku: body.sku || null, provider: PROVIDER, model: c.model,
        aspect, duration, preset: body.preset || null, note: body.note || null,
        prompt, cost_thb: c.thb, status: "pending",
      }).select("id").single();
      const genId = logRow?.id;

      try {
        const bytes = await generateVideo(prompt, img, aspect, duration);
        const url = await uploadResult(bytes, staff.id);
        await admin.from("video_gen_log").update({ status: "ok", url }).eq("id", genId);
        return json({ data: { gen_id: genId, url, prompt, aspect, duration, cost_thb: c.thb } });
      } catch (e: any) {
        await admin.from("video_gen_log").update({ status: "error", error: String(e?.message || e?.code || e) }).eq("id", genId);
        return json({ error: e?.code || "gen_failed", message: e?.message || "generation failed" }, 502);
      }
    }

    return json({ error: "unknown_task" }, 400);
  } catch (e: any) {
    return json({ error: e?.code || "server_error", message: e?.message || String(e) }, 500);
  }
});
