# JFR web viewer

[![CI](https://github.com/clementherve/jfr-web-viewer/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/clementherve/jfr-web-viewer/actions/workflows/ci.yml)

<img src="./resources/home.png">
<img src="./resources/parsed.png">

## Self-hosting

```bash
docker run -p 8080:80 ghcr.io/clementherve/jfr-web-viewer
```

Then open http://localhost:8080. Recordings are parsed in the browser and never sent to the server.
