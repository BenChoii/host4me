// Convex accepts identity tokens from Clerk. The domain is the Clerk
// "Frontend API" URL shown in the Clerk dashboard (JWT Templates → Convex).
// Set CLERK_ISSUER_URL in the Convex deployment's environment variables.
export default {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL,
      applicationID: "convex",
    },
  ],
};
