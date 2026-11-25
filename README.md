# Soundstick

PWA para preparar stickers con sonido para WhatsApp: video con sonido -> recorte de hasta 10 s -> MP4 cuadrado 512x512.
Todo se procesa en el navegador (ffmpeg.wasm); no hay servidor.

    npm install
    npm run dev       # desarrollo
    npm run build     # genera dist/ (sitio estatico, listo para hosting gratis)

Notas:
- Compartir a WhatsApp (Web Share) y la instalacion como app exigen HTTPS (o localhost).
- Limites en src/lib/limits.ts (50 MB, 10 s, 512 px).
- Textos ES/EN en src/lib/i18n.tsx.
