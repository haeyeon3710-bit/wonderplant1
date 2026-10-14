// Username resolution and Auth exchange stay on Supabase's server.
// Never log the password, resolved email, or returned tokens.
Deno.serve(async (request: Request) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
  if (request.method !== "POST") return reply(405, { message: "POST required" });
  try {
    if (Number(request.headers.get("content-length") || 0) > 10000) return reply(413, { message: "Request too large" });
    const body = await request.json();
    if (typeof body.username !== "string" || !/^[a-z0-9_]{3,40}$/.test(body.username) || typeof body.password !== "string" || !body.password || body.password.length > 256) return reply(400, { message: "Invalid credentials" });
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!url || !service || !anon) return reply(503, { message: "Authentication unavailable" });
    const identityResponse = await fetch(url + "/rest/v1/rpc/cms_login_identity", { method: "POST", headers: { apikey: service, Authorization: "Bearer " + service, "Content-Type": "application/json" }, body: JSON.stringify({ p_username: body.username }) });
    if (!identityResponse.ok) return reply(503, { message: "Authentication unavailable" });
    const identities = await identityResponse.json();
    if (!identities?.[0]?.email) return reply(401, { message: "Invalid credentials" });
    const authResponse = await fetch(url + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email: identities[0].email, password: body.password }) });
    const session = await authResponse.json();
    if (!authResponse.ok) return reply(authResponse.status === 429 ? 429 : 401, { message: "Invalid credentials" });
    if (session.user?.id !== identities[0].user_id) return reply(401, { message: "Invalid credentials" });
    return reply(200, session);
  } catch { return reply(503, { message: "Authentication unavailable" }); }
});
