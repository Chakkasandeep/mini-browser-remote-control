FROM mcr.microsoft.com/playwright:v1.54.2-noble

LABEL mini-browser.image-version="2026-06-08.3"

RUN apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*

ENV VIEWPORT_WIDTH=1280
ENV VIEWPORT_HEIGHT=720
ENV DISPLAY=:99

EXPOSE 9222

CMD ["bash", "-lc", "set -e; CHROME_BIN=$(find /ms-playwright -path '*/chrome-linux/chrome' -type f | head -n 1); if [ -z \"$CHROME_BIN\" ]; then echo 'Chromium binary not found in /ms-playwright'; exit 1; fi; mkdir -p /tmp/chromium-profile; socat TCP-LISTEN:9222,fork,reuseaddr TCP:127.0.0.1:9223 & exec \"$CHROME_BIN\" --headless=new --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --no-first-run --no-default-browser-check --disable-crash-reporter --disable-background-networking --disable-background-timer-throttling --disable-renderer-backgrounding --disable-features=Translate,BackForwardCache --remote-allow-origins=* --remote-debugging-port=9223 --user-data-dir=/tmp/chromium-profile --window-size=${VIEWPORT_WIDTH},${VIEWPORT_HEIGHT} about:blank"]
