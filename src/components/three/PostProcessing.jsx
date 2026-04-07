// PostProcessing disabled — causes circular JSON serialization crash
// when Remotion Player is on the same page. The EffectComposer's Bloom/Vignette
// refs create circular references that crash JSON.stringify.
// Can be re-enabled once Remotion is removed or isolated in an iframe.

export default function PostProcessing() {
  return null;
}
