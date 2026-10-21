Production CSS is checked in as `tailwind.min.css`. No Tailwind runtime CDN is used.

After adding or changing utility classes in HTML or JavaScript:

```sh
npm ci
npm run build:css
```

Commit the regenerated CSS with the source change. Dynamic color classes must be listed in `tailwind.config.cjs` safelist. Dependencies are build-time only; never publish node_modules or credentials.
