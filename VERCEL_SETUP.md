# 🔴 CONFIGURACIÓN DE VARIABLES DE ENTORNO EN VERCEL

## 📋 Variable Requerida

Agrega esta variable de entorno en Vercel:

| Variable | Valor | Entornos |
|----------|-------|----------|
| `STREAMS_BACKEND_URL` | `https://tu-backend.onrender.com` | 🔴 **Production, Preview, Development** |

**Nota:** Reemplaza `https://tu-backend.onrender.com` con la URL real que te dio Render después del deploy.

## 📍 Dónde Configurar en Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Click en **"Add New"**
5. Agrega:
   - **Key:** `STREAMS_BACKEND_URL`
   - **Value:** `https://tu-backend.onrender.com` (tu URL de Render)
   - **Environments:** Selecciona todas (Production, Preview, Development)
6. Click en **"Save"**

## 🔄 Después de Agregar la Variable

**IMPORTANTE:** Debes hacer un redeploy para que la variable tome efecto:

1. Ve a **Deployments** en Vercel
2. Click en los **3 puntos** (⋯) del último deployment
3. Selecciona **"Redeploy"**
4. Espera a que termine el deploy

## ✅ Verificar que Funciona

1. Abre tu app en el navegador
2. Abre la consola del navegador (F12)
3. Escribe: `window.__ENV__`
4. Deberías ver: `{ STREAMS_BACKEND_URL: "https://tu-backend.onrender.com" }`

Si no aparece, verifica:
- Que la variable esté configurada en Vercel
- Que hayas hecho redeploy después de agregarla
- Que el script `setup-env.js` se ejecute durante el build
