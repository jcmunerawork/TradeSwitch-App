# Backend Socket.IO Proxy para TradeLocker Streams

Este backend actúa como proxy entre el frontend Angular y la API de TradeLocker Streams, agregando los headers necesarios que el navegador no puede enviar por CORS.

## 🚀 Desarrollo Local

1. **Instalar dependencias:**
```bash
cd backend
npm install
```

2. **Crear archivo `.env`:**
```bash
cp .env.example .env
# Edita .env y configura FRONTEND_URL=http://localhost:4200
```

3. **Ejecutar:**
```bash
npm start
# o para desarrollo con auto-reload:
npm run dev
```

## 📦 Deploy en Render

### Paso 1: Crear Web Service en Render

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en **"New +"** → **"Web Service"**
3. Conecta tu repositorio de GitHub
4. **IMPORTANTE:** En "Root Directory", escribe: `backend`

### Paso 2: Configuración del Servicio

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

**Environment:**
- Selecciona: `Node`

### Paso 3: Variables de Entorno en Render

🔴 **AGREGA ESTAS VARIABLES DE ENTORNO en Render:**

| Variable | Valor |
|----------|-------|
| `TRADELOCKER_STREAMS_URL` | `https://api-dev.tradelocker.com/streams-api` |
| `DEVELOPER_API_KEY` | `tl-7xUz3A0a2aAReLuGnaU%kmaF` |
| `FRONTEND_URL` | `https://tu-app.vercel.app` (tu URL de Vercel) |

**Nota:** `PORT` se asigna automáticamente por Render, no necesitas configurarlo.

### Paso 4: Obtener URL del Backend

Después del deploy, Render te dará una URL tipo:
```
https://tradeswitch-ws.onrender.com
```

🔴 **COPIA ESTA URL** - la necesitarás para configurar Vercel.

## ⚙️ Configurar Vercel (Frontend)

En tu proyecto de Vercel, agrega la variable de entorno:

| Variable | Valor |
|----------|-------|
| `STREAMS_BACKEND_URL` | `https://tradeswitch-ws.onrender.com` (la URL que te dio Render) |

## 🔍 Verificar que Funciona

1. El backend debe estar corriendo en Render
2. El frontend debe tener la variable `STREAMS_BACKEND_URL` configurada
3. Al abrir la app, deberías ver en la consola del navegador:
   - `🚀 [STREAMS] Conectando a backend proxy`
   - `✅ [STREAMS] Socket conectado exitosamente`

## 🐛 Troubleshooting

- **Error de CORS:** Verifica que `FRONTEND_URL` en Render coincida con tu URL de Vercel
- **No se conecta:** Verifica que el backend esté corriendo en Render y que la URL sea correcta
- **Cold start:** Render puede tardar unos segundos en "despertar" el servicio en el plan gratuito
