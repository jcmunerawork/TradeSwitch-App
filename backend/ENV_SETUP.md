# 🔴 CONFIGURACIÓN DE VARIABLES DE ENTORNO

## 📋 Para Desarrollo Local

Crea un archivo `.env` en la carpeta `/backend` con:

```env
TRADELOCKER_STREAMS_URL=https://api-dev.tradelocker.com/streams-api
DEVELOPER_API_KEY=tl-7xUz3A0a2aAReLuGnaU%kmaF
FRONTEND_URL=http://localhost:4200
PORT=3000
```

## 🔴 Para Render (Producción)

En el dashboard de Render, agrega estas variables de entorno:

| Variable | Valor |
|----------|-------|
| `TRADELOCKER_STREAMS_URL` | `https://api-dev.tradelocker.com/streams-api` |
| `DEVELOPER_API_KEY` | `tl-7xUz3A0a2aAReLuGnaU%kmaF` |
| `FRONTEND_URL` | `https://app.tradeswitch.io` 🔴 **URL BASE DE TU APP ANGULAR** (sin /login, solo el dominio) |

**Nota:** `PORT` se asigna automáticamente, no necesitas configurarlo.

## 📍 Dónde Configurar en Render

1. Ve a tu Web Service en Render
2. Click en **"Environment"** en el menú lateral
3. Click en **"Add Environment Variable"**
4. Agrega cada variable una por una
