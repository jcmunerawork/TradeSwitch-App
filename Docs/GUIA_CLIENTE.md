# Guía de Usuario - TradeSwitch App

## 📋 Resumen de Cambios Realizados

### Mejoras Principales

1. **Arquitectura con Backend Externo** ⭐ *Cambio Principal*
   - Migración completa de la lógica de negocio a un backend externo dedicado
   - Todas las comunicaciones con TradeLocker ahora pasan a través del backend propio
   - Mayor seguridad y protección de credenciales
   - Mejor rendimiento y escalabilidad
   - Centralización de la lógica de negocio para facilitar mantenimiento y actualizaciones

2. **Gestión de Cuentas de Trading**
   - Sistema mejorado para agregar, editar y eliminar cuentas de trading
   - Validación automática de cuentas con TradeLocker
   - Visualización de balances en tiempo real

2. **Sistema de Estrategias**
   - Creación y gestión de múltiples estrategias de trading
   - Configuración de reglas personalizadas (riesgo/recompensa, límites diarios, horarios, etc.)
   - Activación/desactivación de estrategias
   - Guía integrada para nuevos usuarios

3. **Reportes y Análisis**
   - Dashboard completo con estadísticas de trading
   - Gráficos de PnL (ganancias/pérdidas)
   - Calendario de operaciones
   - Análisis de operaciones ganadoras/perdedoras
   - Seguimiento de cumplimiento de estrategias

4. **Gestión de Planes y Suscripciones**
   - Sistema de planes con diferentes niveles
   - Actualización y cancelación de suscripciones
   - Historial de suscripciones

5. **Integración con TradeLocker**
   - Todas las conexiones con TradeLocker ahora se realizan a través del backend externo
   - Mayor seguridad en el manejo de credenciales y tokens
   - Sincronización automática de datos de trading
   - Validación de credenciales mejorada

---

## 🚀 Funcionamiento del Programa - Ejemplo Rápido

### Flujo Básico de Uso

1. **Inicio de Sesión**
   - Ingresa con tu email y contraseña
   - El sistema te redirige automáticamente según tu rol (usuario o administrador)

2. **Agregar una Cuenta de Trading**
   - Ve a "Trading Accounts" en el menú
   - Haz clic en "Agregar Cuenta"
   - Completa el formulario con:
     - Nombre de la cuenta
     - Broker (nombre corto, ej: "ICMarkets")
     - Server (debe ser el mismo que el broker, nombre corto)
     - Email de la cuenta de trading
     - Contraseña del broker
     - Account ID
     - Número de cuenta
     - Balance inicial
   - El sistema validará automáticamente la cuenta con TradeLocker

3. **Crear una Estrategia**
   - Ve a la sección "Strategy"
   - Haz clic en "Crear Estrategia"
   - Configura las reglas:
     - Ratio riesgo/recompensa
     - Riesgo por operación
     - Máximo de operaciones diarias
     - Días permitidos para trading
     - Horarios de trading
     - Activos permitidos
   - Activa la estrategia cuando esté lista

4. **Ver Reportes**
   - Accede a la sección "Report"
   - Selecciona la cuenta que deseas analizar
   - Visualiza:
     - Estadísticas generales (Net PnL, Win Rate, Profit Factor)
     - Gráficos de rendimiento
     - Calendario de operaciones
     - Análisis de operaciones ganadoras/perdedoras

5. **Gestionar tu Cuenta**
   - Ve a "Account" en el menú
   - Edita tu perfil, cambia tu contraseña
   - Gestiona tu plan de suscripción
   - Revisa tu historial de suscripciones

---

## ⚠️ Tips y Recomendaciones Importantes

### 🔄 Problemas de Carga

**Si la aplicación se queda cargando:**
- Recarga la ventana del navegador (F5 o Ctrl+R)
- Si el problema persiste, cierra y vuelve a abrir el navegador
- Verifica tu conexión a internet

### 📝 Al Agregar Cuentas de TradeLocker

**IMPORTANTE - Campos Server y Broker:**
- El campo **Server** y el campo **Broker** deben tener **el mismo valor**
- Usa el **nombre corto** del broker (ejemplo: "ICMarkets", "FXCM", "OANDA")
- No uses nombres largos o descripciones completas
- Ejemplo correcto:
  - Broker: `ICMarkets`
  - Server: `ICMarkets`
- Ejemplo incorrecto:
  - Broker: `IC Markets Global Limited`
  - Server: `IC Markets - Demo Server`

### ✅ Mejores Prácticas

1. **Nombres de Cuentas**
   - Usa nombres descriptivos pero cortos para tus cuentas
   - Ejemplo: "Cuenta Principal", "Demo Testing", "Cuenta EUR"

2. **Estrategias**
   - Empieza con estrategias simples y ajusta según tus resultados
   - Revisa regularmente el cumplimiento de tus estrategias en los reportes
   - Puedes tener múltiples estrategias activas simultáneamente

3. **Reportes**
   - Los datos se actualizan automáticamente cada 5 minutos
   - Los reportes se guardan en tu navegador para acceso rápido
   - Puedes filtrar por fechas para análisis específicos

4. **Seguridad**
   - No compartas tus credenciales de trading
   - Cambia tu contraseña regularmente
   - Cierra sesión si usas una computadora compartida

5. **Límites de Plan**
   - Tu plan tiene límites en:
     - Número de cuentas de trading
     - Número de estrategias
   - Verás notificaciones cuando te acerques a los límites
   - Puedes actualizar tu plan en cualquier momento desde "Account"

### 🔍 Solución de Problemas Comunes

**Error al validar cuenta:**
- Verifica que el email, contraseña y server sean correctos
- Asegúrate de que el server y broker tengan el mismo valor (nombre corto)
- Confirma que la cuenta existe en TradeLocker

**No se muestran datos en reportes:**
- Verifica que la cuenta esté correctamente configurada
- Espera unos minutos para que se sincronicen los datos
- Recarga la página si es necesario

**Estrategia no se activa:**
- Verifica que hayas completado todos los campos requeridos
- Revisa que no hayas alcanzado el límite de estrategias de tu plan
- Asegúrate de que al menos una cuenta esté asociada

---

## 🎯 Resumen Rápido

- ⭐ **Backend externo**: Toda la lógica ahora funciona a través de un backend dedicado para mayor seguridad
- ✅ **Si se queda cargando**: Recarga la ventana (F5)
- ✅ **Server y Broker**: Deben ser iguales y usar nombre corto
- ✅ **Validación automática**: Las cuentas se validan con TradeLocker al crearlas
- ✅ **Múltiples estrategias**: Puedes crear y gestionar varias estrategias
- ✅ **Reportes en tiempo real**: Los datos se actualizan cada 5 minutos
- ✅ **Límites de plan**: Revisa tu plan para conocer tus límites

---