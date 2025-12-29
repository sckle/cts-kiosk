#!/bin/bash -x

# Gå till kioskens arbetsmapp
cd /home/pi/cts/kiosk || exit 1

# Sätt rätt display (för X11 / Chromium)
export DISPLAY=:0
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus

# Vänta tills webservern svarar på port 8080
until curl --silent --head --fail http://localhost:8080; do
    echo "[kiosk] Waiting for HTTP server on port 8080..."
    sleep 1
done

pkill -f "/usr/lib/chromium/chromium"
pkill unclutter

# Starta unclutter för att dölja muspekaren
unclutter -display :0 -idle 1 -root &

# Starta Chromium i kiosk-läge
CHROMIUM="/usr/bin/chromium-browser"
URL="http://localhost:8080/kiosk.html"
CHROMIUM_FLAGS="\
  --noerrdialogs \
  --kiosk \
  --disable-restore-session-state \
  --disable-session-crashed-bubble \
  --no-first-run \
  --allow-file-access-from-files \
  --hide-scrollbars \
  --auto-open-devtools-for-tabs"

CHROMIUM_FLAGS="\
  --kiosk \
  --enable-features=VaapiVideoDecoder \
  --use-gl=egl \
  --enable-accelerated-video-decode \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  --no-first-run "

echo "[kiosk] Starting Chromium with URL: $URL"
exec $CHROMIUM $CHROMIUM_FLAGS "$URL"

