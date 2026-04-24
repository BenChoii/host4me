import { useEffect } from "react";

/**
 * Serves the static marketing landing (public/Host4Me.html) at the site root.
 *
 * In production, vercel.json rewrites "/" -> "/Host4Me.html" before React ever
 * mounts. This component is the dev-mode fallback: when `npm run dev` serves
 * index.html for all routes, we redirect the browser to the static file.
 */
export default function LandingRedirect() {
  useEffect(() => {
    window.location.replace("/Host4Me.html");
  }, []);
  return null;
}
