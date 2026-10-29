import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Turns a saved voice note into text.
// The browser only sends the capture id. The audio is fetched here on the server,
// so the OpenAI key never leaves the server.

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fail("Transcription isn't set up yet.", 503);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Please log in again.", 401);

  const body = await request.json().catch(() => null);
  const captureId = typeof body?.captureId === "string" ? body.captureId : null;
  if (!captureId) return fail("Missing capture.", 400);

  // Row-level security means this only finds captures in the person's own business.
  const { data: capture } = await supabase
    .from("captures")
    .select("id, audio_url, transcript")
    .eq("id", captureId)
    .maybeSingle();
  if (!capture?.audio_url) return fail("Couldn't find that recording.", 404);

  // Already done (for example a double tap): just hand back what we have.
  if (capture.transcript) return NextResponse.json({ transcript: capture.transcript });

  async function markFailed() {
    await supabase.from("captures").update({ status: "failed" }).eq("id", captureId);
  }

  const { data: audio, error: downloadError } = await supabase.storage
    .from("audio")
    .download(capture.audio_url);
  if (downloadError || !audio) {
    await markFailed();
    return fail("Couldn't open the recording.", 500);
  }

  // Client names help the transcriber spell them the way you do.
  const { data: clients } = await supabase.from("clients").select("name, aliases").limit(100);
  const names = (clients ?? []).flatMap((c) => [c.name, ...(c.aliases ?? [])]);
  const prompt =
    "An Australian tradie talking about jobs, clients, bookings, quotes and invoices." +
    (names.length ? ` Names that may come up: ${names.join(", ")}.` : "");

  const extension = capture.audio_url.split(".").pop() || "webm";
  const form = new FormData();
  form.append("file", audio, `note.${extension}`);
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe");
  form.append("language", "en");
  form.append("prompt", prompt);

  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  let res: Response;
  try {
    res = await fetch(`${base}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (err) {
    console.error("transcribe: couldn't reach OpenAI", err);
    await markFailed();
    return fail("Couldn't reach OpenAI. Try again in a moment.", 502);
  }

  if (!res.ok) {
    // Read what OpenAI said so the real reason shows up, in our logs and on screen.
    const detail = await res.json().catch(() => null);
    const code: string | undefined = detail?.error?.code;
    const message: string | undefined = detail?.error?.message;
    console.error("transcribe: OpenAI error", res.status, code, message);
    await markFailed();

    if (res.status === 401) {
      return fail("OpenAI rejected the key. Check OPENAI_API_KEY in Netlify.", 502);
    }
    if (res.status === 429 && code === "insufficient_quota") {
      return fail("The OpenAI account has no credit. Add some under Billing at platform.openai.com.", 502);
    }
    if (res.status === 429) {
      return fail("OpenAI is busy right now. Try again in a moment.", 502);
    }
    return fail(`OpenAI said no (${res.status}): ${message ?? "no reason given"}`, 502);
  }

  const text = String((await res.json().catch(() => ({}))).text ?? "").trim();

  const { error: saveError } = await supabase
    .from("captures")
    .update({ transcript: text, status: "transcribed" })
    .eq("id", captureId);
  if (saveError) return fail("Got the words but couldn't save them. Try again.", 500);

  return NextResponse.json({ transcript: text });
}
