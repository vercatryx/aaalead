# Turbopack and pdfjs-dist Issue

## Problem
Turbopack cannot resolve pdfjs-dist's internal dynamic worker import:
```javascript
const worker = await import(this.workerSrc);
```

Turbopack tries to resolve this at build time, but `this.workerSrc` is a runtime value, causing a "Module not found" error.

## Current Solution
Using webpack (default `npm run dev`) which handles pdfjs-dist properly.

## Future Options
1. **Wait for Turbopack improvements** - Turbopack is still experimental and may add better support for dynamic imports
2. **Use CDN version** - Load pdfjs-dist from CDN instead of bundling it
3. **Use different PDF library** - Consider alternatives that don't have this issue

## To Try Turbopack
Run `npm run dev:turbo` - but it will likely fail with the same error until Turbopack adds better support for this use case.
