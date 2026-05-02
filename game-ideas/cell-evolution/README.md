# Cell Evolution

Run this prototype through Vite, not a static file server or VS Code Live Server.

```sh
npm install
npm start
```

Then open the local URL printed by Vite, for example:

```txt
http://localhost:4177/
```

The page imports `/src/main.ts`, which Vite compiles and serves as JavaScript. A static server such as `localhost:5501` will usually return HTML for that TypeScript module path, causing the browser error:

```txt
Loading module from /src/main.ts was blocked because of a disallowed MIME type ("text/html").
```

`npm run dev` is also available and starts the same Vite server.

## GitHub Pages

This prototype builds for the repository Pages URL:

```txt
https://<user>.github.io/game-sandbox/
```

The production Vite base path is configured in `vite.config.ts` as `/game-sandbox/`.
The repository workflow at `.github/workflows/cell-evolution-pages.yml` builds this
idea and uploads `game-ideas/cell-evolution/dist` to GitHub Pages.
