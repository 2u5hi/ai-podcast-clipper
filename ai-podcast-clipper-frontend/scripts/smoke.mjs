// Post-deploy smoke test: public pages load, a real sign-in works, and the signed-in pages render.
// usage: SMOKE_BASE_URL=https://… SMOKE_EMAIL=… SMOKE_PASSWORD=… npm run smoke
// The account should be a dedicated, verified test account; this never spends credits.

const base = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

// a minimal cookie jar: Auth.js needs its csrf cookie on the sign-in POST and sets the session cookie
const jar = new Map();
const remember = (response) => {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
};
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const get = async (path) => {
  const response = await fetch(base + path, {
    headers: { cookie: cookieHeader() },
    redirect: "manual",
  });
  remember(response);
  return response;
};

for (const path of ["/", "/pricing", "/terms", "/privacy", "/refunds", "/login", "/signup"]) {
  const response = await get(path);
  const html = response.status === 200 ? await response.text() : "";
  check(
    response.status === 200 && html.includes('href="/terms"'),
    `GET ${path}`,
    `HTTP ${response.status}`,
  );
}

const inngest = await get("/api/inngest");
check(inngest.status === 200, "GET /api/inngest", `HTTP ${inngest.status}`);

if (!email || !password) {
  console.log("skip sign-in checks: set SMOKE_EMAIL and SMOKE_PASSWORD");
} else {
  const csrf = await get("/api/auth/csrf");
  const { csrfToken } = await csrf.json();
  const signIn = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
    },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${base}/dashboard` }),
    redirect: "manual",
  });
  remember(signIn);
  const signedIn = [...jar.keys()].some((k) => k.endsWith("authjs.session-token"));
  check(signedIn, "sign in", signedIn ? "" : `HTTP ${signIn.status}, no session cookie`);

  for (const [path, marker] of [
    ["/dashboard", "Upload"],
    ["/dashboard/billing", "Buy Credits"],
    ["/dashboard/settings", "Watermark"],
  ]) {
    const response = await get(path);
    const html = response.status === 200 ? await response.text() : "";
    check(response.status === 200 && html.includes(marker), `GET ${path} (signed in)`, `HTTP ${response.status}`);
  }
}

console.log(failures === 0 ? `\nall checks passed against ${base}` : `\n${failures} check(s) failed against ${base}`);
process.exit(failures === 0 ? 0 : 1);
