# 🚀 Instrucciones de Deploy - Backend y Frontend

Esta guía te explica cómo desplegar el backend en Render y el frontend en Vercel, y cómo conectarlos.

## 📋 Resumen

- **Frontend (Angular)**: Vercel
- **Backend (Socket.IO Proxy)**: Render
- **Mismo repositorio**: ✅ Sí, todo en el mismo proyecto

---

## 🔴 PASO 1: Deploy del Backend en Render

### 1.1 Crear Web Service en Render

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en **"New +"** → **"Web Service"**
3. Conecta tu repositorio de GitHub
4. **🔴 IMPORTANTE:** En "Root Directory", escribe: `backend`

### 1.2 Configuración del Servicio

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

### 1.3 Variables de Entorno en Render

🔴 **AGREGA ESTAS VARIABLES DE ENTORNO en Render (Settings → Environment):**

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `TRADELOCKER_STREAMS_URL` | `https://api-dev.tradelocker.com/streams-api` | URL de TradeLocker Streams API |
| `DEVELOPER_API_KEY` | `tl-7xUz3A0a2aAReLuGnaU%kmaF` | API Key de TradeLocker |
| `FRONTEND_URL` | `https://tu-app.vercel.app` | 🔴 **TU URL DE VERCEL** (para CORS) |

**Nota:** `PORT` se asigna automáticamente por Render, no necesitas configurarlo.

### 1.4 Obtener URL del Backend

Después del deploy, Render te dará una URL tipo:
```
https://tradeswitch-ws.onrender.com
```

🔴 **COPIA ESTA URL** - la necesitarás en el siguiente paso.

---

## 🔴 PASO 2: Configurar Frontend en Vercel

### 2.1 Agregar Variable de Entorno en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Click en **"Add New"**

🔴 **AGREGA ESTA VARIABLE:**

| Variable | Valor | Entornos |
|----------|-------|----------|
| `STREAMS_BACKEND_URL` | `https://tu-backend.onrender.com` | 🔴 **Production, Preview, Development** |

**Nota:** Reemplaza `https://tu-backend.onrender.com` con la URL real que te dio Render.

### 2.2 Configurar Vercel para Inyectar Variables

Para que Angular pueda leer la variable, necesitas configurar Vercel para inyectarla.

**Opción A: Usando `vercel.json` (Recomendado)**

Crea o actualiza `vercel.json` en la raíz del proyecto:

```json
{
  "buildCommand": "npm run setup-env && npm run build",
  "env": {
    "STREAMS_BACKEND_URL": "@streams_backend_url"
  }
}
```

**Opción B: Script de Build Personalizado**

Actualiza `package.json` para inyectar la variable:

```json
{
  "scripts": {
    "build": "npm run setup-env && ng build",
    "build:vercel": "STREAMS_BACKEND_URL=$STREAMS_BACKEND_URL npm run build"
  }
}
```

### 2.3 Actualizar Script de Setup de Env

Si usas `scripts/setup-env.js`, actualízalo para incluir `STREAMS_BACKEND_URL`:

```javascript
// En scripts/setup-env.js, agrega:
const streamsBackendUrl = process.env.STREAMS_BACKEND_URL || 'http://localhost:3000';

// Y agrégalo al objeto de configuración que se inyecta en window.__ENV__
```

### 2.4 Redeploy

Después de agregar la variable de entorno:
1. Ve a **Deployments** en Vercel
2. Click en los **3 puntos** del último deployment
3. Selecciona **"Redeploy"**

---

## ✅ Verificar que Funciona

### Backend (Render)

1. Ve a los logs de Render
2. Deberías ver:
   ```
   ✅ [BACKEND] Servidor escuchando en puerto XXXX
   ✅ [BACKEND] Socket.IO disponible en http://...
   ```

### Frontend (Vercel)

1. Abre tu app en el navegador
2. Abre la consola del navegador (F12)
3. Deberías ver:
   ```
   🚀 [STREAMS] Conectando a backend proxy
   ✅ [STREAMS] Socket conectado exitosamente
   ```

---

## 🐛 Troubleshooting

### Error: "Cannot connect to backend"

**Solución:**
- Verifica que el backend esté corriendo en Render
- Verifica que `STREAMS_BACKEND_URL` en Vercel sea correcta
- Verifica que `FRONTEND_URL` en Render coincida con tu URL de Vercel

### Error de CORS

**Solución:**
- Verifica que `FRONTEND_URL` en Render sea exactamente tu URL de Vercel (con https://)
- No incluyas la barra final `/` en la URL

### Backend no responde (Cold Start)

**Solución:**
- En el plan gratuito de Render, el servicio puede tardar 30-60 segundos en "despertar"
- Esto es normal, solo espera un momento

### Variable de entorno no se lee en Angular

**Solución:**
- Verifica que la variable esté configurada en Vercel para todos los entornos
- Verifica que el script `setup-env.js` esté inyectando la variable correctamente
- Revisa la consola del navegador para ver qué valor tiene `window.__ENV__`

---

## 📝 Checklist de Deploy

- [ ] Backend desplegado en Render
- [ ] Variables de entorno configuradas en Render:
  - [ ] `TRADELOCKER_STREAMS_URL`
  - [ ] `DEVELOPER_API_KEY`
  - [ ] `FRONTEND_URL` (URL de Vercel)
- [ ] URL del backend copiada
- [ ] Variable `STREAMS_BACKEND_URL` configurada en Vercel
- [ ] Frontend redeployado en Vercel
- [ ] Verificado que la conexión funciona en producción

---

## 🔗 URLs de Referencia

- **Render Dashboard**: https://dashboard.render.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Documentación Render**: https://render.com/docs
- **Documentación Vercel**: https://vercel.com/docs
