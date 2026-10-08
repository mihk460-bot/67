<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project decisions

- Custom username/password auth (merchants, employees, admin, price manager) with HMAC-signed tokens and scrypt password hashes lives in `src/lib/auth.server.ts` + `src/lib/app.functions.ts`; deliberately not Lovable Auth (email-based) because the source app is username-based with owner/employee/admin/price-manager roles and subscription expiry.
- All DB access goes through `supabaseAdmin` inside server functions only; RLS denies anon/authenticated on all public tables. Components never talk to the DB directly.
- Client auth state (token + role) is stored in localStorage key `jewelry_auth_state` via `src/lib/auth-client.tsx`; protected routes call `useRequireRole()` client-side, and every privileged server function re-verifies the token server-side.
- Design tokens (dark graphite + gold `#D4AF37` family, enforced dark, RTL) are defined in `src/styles.css` only; components use semantic Tailwind utilities, never hardcoded colors. Font: IBM Plex Sans Arabic, loaded in `__root.tsx` head.
- Merchant store names are private settings keyed by verified owner ID; employees inherit their owner's name and only owners can update it, avoiding client-trusted ownership.
- Invoices render once to an Arabic-font canvas using CSS print-palette tokens, reused for preview, PNG, PDF and iframe printing so exports match without server filesystem/native dependencies.
- Support and renewal destinations use the shared ContactLink anchor/copy control to keep navigation and clipboard behavior consistent.
- Content routes define unique metadata through pageHead; shared layouts rely on their content children's metadata.
- Sales and audit logs live in DB tables sales_logs/activity_logs written only by server functions (src/lib/logs.functions.ts, logs.server.ts); uploaded localStorage logger was not used because client-side logs can be faked or lost.
