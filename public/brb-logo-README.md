# App logo asset

Save the official BRB Capital logo lockup here as:

    public/brb-logo.png

The header/nav and login screen will pick it up automatically (see
`src/components/brand/BrbLogo.tsx`). Until the file exists, the app falls back to
the built-in vector lockup — nothing breaks either way.

Notes:
- Use it on **dark** surfaces only (the nav + login). The light print/PDF header
  keeps the background-free vector, since the raster has a dark background.
- A transparent-background PNG is ideal if you have one; the current raster
  (dark forest background) is fine on the nav because the nav is the same forest.
