# OrçaNext — Google OAuth (Emergent-managed) Testing Playbook

The frontend and backend implement the **Emergent-managed Google Sign-in** flow.
The email/password login continues to coexist with this flow.

## Env & endpoints
- Frontend redirect: `https://auth.emergentagent.com/?redirect=${window.location.origin}/dashboard`
- Backend exchange: `POST /api/auth/session`
  Body: `{ "session_id": "<from URL fragment>" }`
  Sets **httpOnly** cookie `session_token` (path=`/`, secure, samesite=`none`, 7 days).
- Session verification: `GET /api/auth/me` accepts either:
  - JWT `access_token` cookie (legacy email/password flow), or
  - `session_token` cookie / `Authorization: Bearer <session_token>` (Google flow).
- Logout: `POST /api/auth/logout` clears both cookies and deletes the session row.

## Data model
- `users` collection uses existing `id` (UUID) field. Google users get `role="user"`
  (or `role="super_admin"` for the owner email `orcanextbr@gmail.com`) and `plan="FREE"`,
  and `password_hash` is left **empty** (Google-only account).
- `user_sessions` collection: `{ id, user_id, session_token, expires_at, created_at }`
  with a unique index on `session_token`.

## Manual test (backend) via mongosh
```sh
# 1) Create a fake user + session directly in Mongo
mongosh "$MONGO_URL" --eval "
use('$DB_NAME');
var uid = 'test-goog-'+Date.now();
var tok = 'sess_'+Date.now();
db.users.insertOne({
  id: uid,
  email: 'test.google.'+Date.now()+'@example.com',
  name: 'Google Test User',
  role: 'user', plan: 'FREE',
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  id: 'sid_'+Date.now(),
  user_id: uid,
  session_token: tok,
  expires_at: new Date(Date.now()+7*24*3600*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('user_id='+uid);
print('session_token='+tok);
"

# 2) Hit /api/auth/me with the session_token as bearer
curl -s -H "Authorization: Bearer <session_token>" \
  https://invoice-pro-435.preview.emergentagent.com/api/auth/me | jq .

# 3) Hit /api/auth/me with the cookie
curl -s -b "session_token=<session_token>" \
  https://invoice-pro-435.preview.emergentagent.com/api/auth/me | jq .

# 4) Clean up
mongosh "$MONGO_URL" --eval "
use('$DB_NAME');
db.users.deleteMany({email: /test\.google\./});
db.user_sessions.deleteMany({session_token: /^sess_/});
"
```

## Manual test (frontend)
1. Open `/login` — click **Continuar com Google**.
2. Land back at `/dashboard#session_id=…`. `<AuthCallback />` renders synchronously
   (detected via `useLocation().hash`), POSTs to `/api/auth/session`, sets cookie,
   then `navigate('/dashboard', { replace: true })`.
3. Refresh — user stays authenticated via cookie.
4. Logout — cookie cleared, session row removed.

## Owner / admin gating
When the Google-authenticated email equals `orcanextbr@gmail.com`, the user is
promoted to `role="super_admin"` automatically on first sign-in. The `/admin`
route becomes accessible.

## Files touched
- Backend: `/app/backend/server.py` (new `POST /api/auth/session`, cookie fallback in `get_current_user`, expanded logout).
- Frontend:
  - `/app/frontend/src/pages/AuthCallback.jsx` (new)
  - `/app/frontend/src/App.js` (synchronous `session_id` detection)
  - `/app/frontend/src/context/AuthContext.jsx` (skip `/me` while hash contains `session_id`)
  - `/app/frontend/src/pages/Login.jsx` + `Register.jsx` (Google button)
