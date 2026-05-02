# Cell Evolution

Run this prototype through Vite, not a static file server or VS Code Live Server.

```sh
npm install
npm run dev
```

Then open the local URL printed by Vite, for example:

```txt
http://localhost:4177/
```

The page imports `/src/main.ts`, which Vite compiles and serves as JavaScript. A static server such as `localhost:5501` will usually return HTML for that TypeScript module path, causing the browser error:

```txt
Loading module from /src/main.ts was blocked because of a disallowed MIME type ("text/html").
```
