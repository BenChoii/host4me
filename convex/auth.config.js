// Convex accepts identity tokens from Clerk. CLERK_JWT_ISSUER_DOMAIN is already
// set in the Convex deployment env (Settings → Environment Variables) to the
// Clerk Frontend API URL from the "bc rentals" Clerk app:
// https://next-aphid-4.clerk.accounts.dev
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
