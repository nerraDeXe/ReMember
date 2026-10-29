# Organisation membership badges

All membership tiers in an organisation share its `badgeColor` setting. It defaults to `#FFD700` and accepts a six-digit hex colour such as `#3467AB`. Owners can change it in Membership Tiers. Individual tier colours and tier access levels have been removed.

The backend runs an idempotent migration before accepting requests. It sets the default only on organisations without `badgeColor`, then removes `accessLevel` and `badgeColor` from every stored tier, including inactive and legacy tiers. Existing organisation colours and all other tier data are preserved. It does not pick a legacy tier colour as the shared colour.

To inspect or apply the same migration manually using the database configured in `backend/.env`, run from `backend`:

```powershell
npm run migrate:membership-badges
npm run migrate:membership-badges -- --apply
```

The first command previews counts without writing. Repeating the apply command is safe. Deploy the updated backend so existing installations also receive the migration on startup. No new environment variables are required.
