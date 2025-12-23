# 🚀 Quick Start - Configuración Rápida

## 📋 Valores que Necesitas

### Para Render (Backend)
```
TRADELOCKER_STREAMS_URL = https://api-dev.tradelocker.com/streams-api
DEVELOPER_API_KEY = tl-7xUz3A0a2aAReLuGnaU%kmaF
FRONTEND_URL = https://tu-app.vercel.app  🔴 CAMBIAR POR TU URL
```

### Para Vercel (Frontend)
```
STREAMS_BACKEND_URL = https://tu-backend.onrender.com  🔴 CAMBIAR POR URL DE RENDER
```

---

## ⚡ Pasos Rápidos

### 1️⃣ Deploy Backend (Render)

1. [Render Dashboard](https://dashboard.render.com) → New Web Service
2. Conecta repo → Root Directory: `backend`
3. Build: `npm install` | Start: `npm start`
4. Agrega las 3 variables de arriba
5. **Copia la URL** que te da Render

### 2️⃣ Configurar Frontend (Vercel)

1. [Vercel Dashboard](https://vercel.com/dashboard) → Tu Proyecto
2. Settings → Environment Variables
3. Agrega: `STREAMS_BACKEND_URL` = URL de Render
4. **Redeploy**

### 3️⃣ Listo ✅

---

## 🔍 Verificar

**Backend:** Logs de Render deben mostrar `✅ Servidor escuchando`

**Frontend:** Consola del navegador debe mostrar `✅ Socket conectado`

---

## 📚 Documentación Completa

- `CONFIGURACION_COMPLETA.md` - Checklist detallado
- `DEPLOY_INSTRUCTIONS.md` - Guía paso a paso
- `backend/README.md` - Detalles del backend
