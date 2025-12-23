# 🔴 CONFIGURACIÓN COMPLETA - Backend y Frontend

Este documento resume TODAS las configuraciones que debes hacer para que el sistema funcione.

---

## 📍 LÍNEAS MARCADAS EN EL CÓDIGO

### 1. Backend (`backend/server.js`)

**Líneas 8-13:** 🔴 **CONFIGURAR EN RENDER**

```javascript
// ============================================
// ⚙️ CONFIGURACIÓN - VARIABLES DE ENTORNO
// ============================================
// 🔴 IMPORTANTE: Configura estas variables en Render:
// - TRADELOCKER_STREAMS_URL: https://api-dev.tradelocker.com/streams-api
// - DEVELOPER_API_KEY: tl-7xUz3A0a2aAReLuGnaU%kmaF
// - FRONTEND_URL: https://tu-app.vercel.app (tu URL de Vercel)
// ============================================
```

**Acción:** Agrega estas 3 variables en Render Dashboard → Environment Variables

---

### 2. Frontend (`src/app/shared/services/streams.service.ts`)

**Líneas 76-95:** 🔴 **CONFIGURAR EN VERCEL**

```typescript
  // ============================================
  // ⚙️ CONFIGURACIÓN - VARIABLES DE ENTORNO
  // ============================================
  // 🔴 IMPORTANTE: Configura esta variable en Vercel:
  // 
  // Variable: STREAMS_BACKEND_URL
  // Valor: URL de tu backend en Render (ej: https://tradeswitch-ws.onrender.com)
  // 
  // En desarrollo local: http://localhost:3000
  // En producción: URL que te da Render después del deploy
  // 
  // Cómo configurar en Vercel:
  // 1. Ve a tu proyecto en Vercel Dashboard
  // 2. Settings → Environment Variables
  // 3. Agrega: STREAMS_BACKEND_URL = https://tu-backend.onrender.com
  // 4. Redeploy la aplicación
  // ============================================
```

**Acción:** Agrega `STREAMS_BACKEND_URL` en Vercel Dashboard → Settings → Environment Variables

---

## 📋 CHECKLIST DE CONFIGURACIÓN

### ✅ Paso 1: Deploy Backend en Render

- [ ] Crear Web Service en Render
- [ ] Root Directory: `backend`
- [ ] Build Command: `npm install`
- [ ] Start Command: `npm start`
- [ ] Agregar variable: `TRADELOCKER_STREAMS_URL` = `https://api-dev.tradelocker.com/streams-api`
- [ ] Agregar variable: `DEVELOPER_API_KEY` = `tl-7xUz3A0a2aAReLuGnaU%kmaF`
- [ ] Agregar variable: `FRONTEND_URL` = `https://tu-app.vercel.app` 🔴 **TU URL DE VERCEL**
- [ ] Copiar URL del backend (ej: `https://tradeswitch-ws.onrender.com`)

### ✅ Paso 2: Configurar Frontend en Vercel

- [ ] Ir a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
- [ ] Agregar variable: `STREAMS_BACKEND_URL` = `https://tu-backend.onrender.com` 🔴 **URL DE RENDER**
- [ ] Seleccionar todos los entornos (Production, Preview, Development)
- [ ] Guardar
- [ ] Hacer **Redeploy** del proyecto

### ✅ Paso 3: Desarrollo Local

- [ ] En `/backend`, crear archivo `.env`:
  ```env
  TRADELOCKER_STREAMS_URL=https://api-dev.tradelocker.com/streams-api
  DEVELOPER_API_KEY=tl-7xUz3A0a2aAReLuGnaU%kmaF
  FRONTEND_URL=http://localhost:4200
  PORT=3000
  ```
- [ ] Ejecutar backend: `cd backend && npm install && npm start`
- [ ] El frontend usará `http://localhost:3000` automáticamente

---

## 🔍 Verificar que Funciona

### Backend (Render)
1. Ve a los logs de Render
2. Deberías ver: `✅ [BACKEND] Servidor escuchando en puerto XXXX`

### Frontend (Vercel)
1. Abre tu app en el navegador
2. Abre consola (F12)
3. Deberías ver:
   - `🚀 [STREAMS] Conectando a backend proxy`
   - `✅ [STREAMS] Socket conectado exitosamente`

### Desarrollo Local
1. Backend corriendo en `http://localhost:3000`
2. Frontend corriendo en `http://localhost:4200`
3. En consola del navegador deberías ver la conexión exitosa

---

## 📚 Documentación Adicional

- **Backend Setup:** Ver `backend/README.md`
- **Render Config:** Ver `backend/ENV_SETUP.md`
- **Vercel Config:** Ver `VERCEL_SETUP.md`
- **Deploy Completo:** Ver `DEPLOY_INSTRUCTIONS.md`

---

## 🆘 Problemas Comunes

### "Cannot connect to backend"
- ✅ Verifica que el backend esté corriendo en Render
- ✅ Verifica que `STREAMS_BACKEND_URL` en Vercel sea correcta
- ✅ Verifica que hayas hecho redeploy después de agregar la variable

### Error de CORS
- ✅ Verifica que `FRONTEND_URL` en Render sea exactamente tu URL de Vercel
- ✅ No incluyas barra final `/` en la URL

### Variable no se lee
- ✅ Verifica que hayas hecho redeploy en Vercel
- ✅ Verifica en consola: `window.__ENV__` debe mostrar la variable
