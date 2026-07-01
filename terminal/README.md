# Agent IDE terminal control panel

Run the local terminal control panel from the repository root:

```bash
npm run control
```

The control panel is a lightweight wrapper around the existing local developer commands. It can start or restart the API server with `npm run server`, start or restart Vite with `npm run dev`, stop both background processes, run `npm test`, run `npm run build`, show `git status`, open Agent IDE at `http://localhost:5173`, and display local server logs.

Use it when you want one supported terminal entrypoint for day-to-day Agent IDE operations without changing browser UI behavior or repository intelligence generation.

Background process logs and pid files are written to `.dev-logs/`:

- `.dev-logs/server.log`
- `.dev-logs/vite.log`
- `.dev-logs/server.pid`
- `.dev-logs/vite.pid`

To stop local dev servers, choose **2) Stop dev servers** in the menu or run:

```bash
npm run control -- stop
```

You can also check status without opening the menu:

```bash
npm run control -- status
```
