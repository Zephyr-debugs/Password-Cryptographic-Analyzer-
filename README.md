Keyspace - password strength and collision analyzer

Run it:
  Option 1: double-click index.html (works in any modern browser).
  Option 2: from this folder run  python3 -m http.server 8000
            then open http://localhost:8000

Files:
  index.html  page structure and text
  style.css   all styling (light and dark themes)
  app.js      counting engine, charts, collision lab

Notes:
  - No build step or dependencies. Everything runs in the browser.
  - Fonts (Archivo, JetBrains Mono) load from Google Fonts when online;
    offline it falls back to system fonts.
