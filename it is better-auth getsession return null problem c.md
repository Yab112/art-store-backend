<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# it is better-auth getsession return null problem can u just check peoples with the prob like me man that is all i need bruhhh ..don't make me cry

You are definitely not alone; a lot of people using Better‑Auth are hitting `getSession()` / `auth.api.getSession()` returning `null` even though login “works”.[^1][^2][^3]

Below is what people with your exact problem have done to fix it, step‑by‑step.

## 1. Are you calling it the “Better‑Auth way”?

Most working examples use this pattern (Server / RSC / route handler):[^4][^5]

```ts
const session = await auth.api.getSession({
  headers: request.headers, // or: headers: await headers() in Next RSC
});
```

Key points people missed:

- On the **server**, always pass the incoming `request.headers` (or `await headers()` in Next.js App Router). Calling `auth.api.getSession()` with no headers will usually give `null`.[^2][^6]
- On the **client**, use the client instance (`authClient.getSession()` / `useSession()`) only if cookies are correctly set in the browser; otherwise it will also be `null`.[^7][^8]

If your call does not look like the snippet above, fix that first.

## 2. “Login works but `getSession` is null” – most common real causes

From other devs with the same bug:[^9][^10][^1][^7][^2]

- **Cookies not stored in the browser**
    - They used `authClient.signIn.*` inside a **server action**, so the cookie was written to the server response, not to the actual browser request.
    - Fix: call server‑side methods (`auth.api.signIn*`) in server actions, or do the sign‑in from a true client component so the browser gets the Set‑Cookie header.[^7][^4]
- **Different frontend / backend origins**
    - When frontend and backend have different domains/ports, the cookie default settings are wrong, so the browser never sends the session cookie → `getSession` null.
    - Fix (from people who fixed it): set `crossSubDomainCookies` and `defaultCookieAttributes` (`sameSite: 'none'`, `secure: true` in prod) and align cookie domain/origin.[^10][^6][^9]
- **Missing headers in Next.js RSC**
    - In `layout.tsx` or other server components, they forgot `headers: await headers()`. Without that, Better‑Auth cannot see the cookie.[^11][^2]
- **Version / internal bug**
    - Several GitHub issues show `auth.api.getSession` returning `null` even with valid DB sessions and correct cookies, especially on some beta versions and certain DBs (Prisma + MySQL).[^12][^1]
    - Fix: upgrade `better-auth` and any related packages (`@better-auth/nextjs`, `@better-auth/expo`, etc.) to the latest stable; some people only fixed it this way.[^3][^1][^12]


## 3. Quick “am I crazy?” checklist

Run through these in order; you only need one to be wrong to get `null`:[^5][^6][^1][^4]

- After signing in, can you:
    - See a `better-auth` session cookie in devtools (Application → Cookies) with a non‑expired date?
    - Call `/api/auth/get-session` (or whatever your Better‑Auth get‑session route is) directly in the browser and get JSON with `user`+`session`, not `null`?
- If `/api/auth/get-session` returns data but your **server component** or **route handler** sees `null`, then:
    - Make sure you do `auth.api.getSession({ headers: await headers() })` (Next.js) or `auth.api.getSession({ headers: request.headers })` (Hono/Fastify/Express).[^13][^6][^2]
- If the **client** (`authClient.getSession()` / `useSession()`) is `null` but the server has a session:
    - Check that sign‑in happens in a **client** context (or redirects through the Better‑Auth pages), not inside a server action that drops cookies.[^4][^7]
    - If backend is on another origin, make sure CORS and cookies are configured for cross‑origin (credentials allowed, `SameSite=None`, `Secure`, correct domain).[^9][^10]


## 4. If it still returns null

Many people ended up opening issues where everything looked “right” and it was actually a Better‑Auth bug on a specific version or storage combo.[^1][^2][^12]

- Confirm your exact versions of `better-auth` and any integration package.
- If you are on a beta or older 1.2.x / 1.3.x, bump to the latest release first. Several reports say upgrading alone made `getSession` start working.[^3][^12][^1]

***

If you paste:

- your Better‑Auth config,
- how you call sign‑in, and
- the code where you call `getSession`,

it is possible to point to the exact line that is making it return `null` and give you copy‑paste‑able fixed code.
<span style="display:none">[^14][^15][^16][^17][^18][^19][^20]</span>

<div align="center">⁂</div>

[^1]: https://github.com/better-auth/better-auth/issues/3892

[^2]: https://github.com/better-auth/better-auth/issues/2055

[^3]: https://www.answeroverflow.com/m/1397507577020944414

[^4]: https://www.better-auth.com/docs/basic-usage

[^5]: https://www.better-auth.com/docs/concepts/session-management

[^6]: https://www.better-auth.com/docs/integrations/hono

[^7]: https://www.reddit.com/r/nextjs/comments/1jfnj59/help_betterauth_clientside_session_return_null/

[^8]: https://www.reddit.com/r/nextjs/comments/1m4la1e/help_with_betterauth_usesession_clientside_stays/

[^9]: https://github.com/better-auth/better-auth/issues/3470

[^10]: https://www.reddit.com/r/nextjs/comments/1mvf361/betterauth_client_session/

[^11]: https://github.com/better-auth/better-auth/issues/4188

[^12]: https://github.com/better-auth/better-auth/issues/4942

[^13]: https://www.better-auth.com/docs/integrations/astro

[^14]: https://nikuscs.com/blog/06-tanstack-start-deep-dive/

[^15]: https://www.better-auth.com/llms.txt

[^16]: https://www.reddit.com/r/nextjs/comments/1h4zoha/help_accessing_betterauth_session/

[^17]: https://ripeseed.io/blogs/practical-user-impersonation

[^18]: https://www.reddit.com/r/nextjs/comments/1kmd7gw/how_are_you_protecting_your_client_routes_when/

[^19]: https://orpc.unnoq.com/llms-full.txt

[^20]: https://www.reddit.com/r/nextjs/comments/12jw09z/nextauth_session_returning_null_data_in/

