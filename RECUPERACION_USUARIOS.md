# 🚑 Guía de Recuperación de Usuarios Afectados

## 📋 Resumen

Esta guía explica cómo identificar y recuperar usuarios que fueron afectados por el problema del flujo de registro incompleto.

---

## 🔍 Identificar Usuarios Afectados

### **Escenario 1: Usuario Pagó pero No Puede Acceder**

#### **Síntomas**:
- El usuario completó el pago en Stripe ✅
- El usuario aparece en Firebase Auth ✅
- El usuario aparece en Firestore collection `users` ✅
- La suscripción aparece en `users/{userId}/subscription` ✅
- **PERO** el estado de la suscripción es `CREATED` en lugar de `PURCHASED` ❌

#### **Cómo Verificar**:

1. **En Stripe Dashboard**:
   ```
   - Ir a Customers
   - Buscar por email del usuario
   - Verificar si hay una suscripción activa
   - Copiar el session_id del checkout
   ```

2. **En Firebase Console**:
   ```
   - Ir a Firestore Database
   - Navegar a: users/{userId}/subscription
   - Verificar el status: si es "CREATED" → Usuario afectado
   ```

3. **Estado Esperado vs Real**:
   ```javascript
   // ❌ Estado Actual (Incorrecto)
   {
     status: "CREATED",
     transactionId: null,
     periodStart: null,
     periodEnd: null
   }
   
   // ✅ Estado Esperado (Correcto)
   {
     status: "PURCHASED",
     transactionId: "cs_test_xxx...",
     periodStart: Timestamp(2025-10-20),
     periodEnd: Timestamp(2025-11-20)
   }
   ```

---

## 🛠️ Solución Manual (Urgente)

Para recuperar un usuario específico inmediatamente:

### **Opción 1: Usando Firebase Console (Recomendado para pocos usuarios)**

1. **Obtener Información de Stripe**:
   - Session ID del checkout exitoso
   - Subscription ID de Stripe
   - Fecha del pago

2. **Actualizar en Firebase**:
   ```
   1. Ir a Firestore
   2. Navegar a: users/{userId}/subscription/{subscriptionId}
   3. Editar el documento:
      
      status: "PURCHASED"
      transactionId: "cs_test_xxx..." (del paso 1)
      periodStart: [Timestamp de la fecha del pago]
      periodEnd: [Timestamp de 30 días después]
   
   4. Guardar cambios
   ```

3. **Actualizar Usuario**:
   ```
   1. Navegar a: users/{userId}
   2. Editar:
      
      status: "ACTIVE"
      subscription_date: [Timestamp del pago]
      lastUpdated: [Timestamp ahora]
   
   3. Guardar cambios
   ```

4. **Notificar al Usuario**:
   - Enviar email confirmando que su cuenta está activa
   - Pedirle que intente iniciar sesión
   - Disculparse por el inconveniente

---

### **Opción 2: Usando Script de Firebase Admin SDK (Recomendado para muchos usuarios)**

Crear un archivo: `scripts/fix-affected-users.js`

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Mapa de usuarios afectados con sus session IDs de Stripe
const affectedUsers = [
  {
    userId: 'ABC123...',
    email: 'usuario1@example.com',
    stripeSessionId: 'cs_test_xxx...',
    paymentDate: '2025-10-20'
  },
  // Agregar más usuarios aquí
];

async function fixUser(userInfo) {
  try {
    console.log(`\n🔧 Fixing user: ${userInfo.email}`);
    
    // 1. Obtener la suscripción actual
    const subscriptionsRef = db.collection('users')
      .doc(userInfo.userId)
      .collection('subscription');
    
    const subscriptionsSnapshot = await subscriptionsRef
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    
    if (subscriptionsSnapshot.empty) {
      console.log(`❌ No subscription found for ${userInfo.email}`);
      return;
    }
    
    const subscriptionDoc = subscriptionsSnapshot.docs[0];
    const subscriptionId = subscriptionDoc.id;
    
    // 2. Calcular fechas
    const periodStart = admin.firestore.Timestamp.fromDate(
      new Date(userInfo.paymentDate)
    );
    const periodEndDate = new Date(userInfo.paymentDate);
    periodEndDate.setDate(periodEndDate.getDate() + 30);
    const periodEnd = admin.firestore.Timestamp.fromDate(periodEndDate);
    
    // 3. Actualizar suscripción
    await subscriptionDoc.ref.update({
      status: 'PURCHASED',
      transactionId: userInfo.stripeSessionId,
      periodStart: periodStart,
      periodEnd: periodEnd,
      updated_at: admin.firestore.Timestamp.now()
    });
    
    console.log(`✅ Subscription updated for ${userInfo.email}`);
    
    // 4. Actualizar usuario
    await db.collection('users').doc(userInfo.userId).update({
      status: 'ACTIVE',
      subscription_date: periodStart.toMillis(),
      lastUpdated: Date.now()
    });
    
    console.log(`✅ User status updated for ${userInfo.email}`);
    console.log(`✅ User ${userInfo.email} fixed successfully!`);
    
  } catch (error) {
    console.error(`❌ Error fixing user ${userInfo.email}:`, error);
  }
}

async function fixAllUsers() {
  console.log('🚀 Starting user recovery process...\n');
  console.log(`📊 Total users to fix: ${affectedUsers.length}\n`);
  
  for (const userInfo of affectedUsers) {
    await fixUser(userInfo);
  }
  
  console.log('\n✅ Recovery process completed!');
}

// Ejecutar
fixAllUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
```

#### **Cómo Usar el Script**:

1. **Instalar Firebase Admin SDK**:
   ```bash
   npm install firebase-admin
   ```

2. **Obtener Service Account Key**:
   ```
   1. Ir a Firebase Console
   2. Project Settings → Service Accounts
   3. Generate New Private Key
   4. Guardar como: scripts/serviceAccountKey.json
   ```

3. **Crear Lista de Usuarios Afectados**:
   - Revisar Stripe Dashboard
   - Revisar Firebase para usuarios con status CREATED
   - Agregar al array `affectedUsers`

4. **Ejecutar el Script**:
   ```bash
   node scripts/fix-affected-users.js
   ```

---

## 📊 Cómo Obtener la Lista de Usuarios Afectados

### **Script para Listar Usuarios con Problemas**

Crear: `scripts/list-affected-users.js`

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function findAffectedUsers() {
  try {
    console.log('🔍 Searching for affected users...\n');
    
    const usersSnapshot = await db.collection('users').get();
    const affectedUsers = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      // Obtener última suscripción
      const subscriptionsSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('subscription')
        .orderBy('created_at', 'desc')
        .limit(1)
        .get();
      
      if (!subscriptionsSnapshot.empty) {
        const subscription = subscriptionsSnapshot.docs[0].data();
        
        // Verificar si está afectado
        if (subscription.status === 'CREATED' || subscription.status === 'created') {
          affectedUsers.push({
            userId: userId,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            subscriptionCreated: subscription.created_at.toDate(),
            subscriptionId: subscriptionsSnapshot.docs[0].id
          });
        }
      }
    }
    
    // Mostrar resultados
    console.log(`\n📊 Found ${affectedUsers.length} affected users:\n`);
    console.log('----------------------------------------');
    
    affectedUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. User: ${user.firstName} ${user.lastName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   User ID: ${user.userId}`);
      console.log(`   Subscription Created: ${user.subscriptionCreated.toISOString()}`);
      console.log(`   Subscription ID: ${user.subscriptionId}`);
    });
    
    console.log('\n----------------------------------------');
    
    // Exportar a JSON
    const fs = require('fs');
    fs.writeFileSync(
      'affected-users.json',
      JSON.stringify(affectedUsers, null, 2)
    );
    console.log('\n✅ List exported to: affected-users.json');
    
    return affectedUsers;
    
  } catch (error) {
    console.error('Error finding affected users:', error);
  }
}

findAffectedUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
```

**Ejecutar**:
```bash
node scripts/list-affected-users.js
```

**Resultado**:
- Imprime lista de usuarios afectados
- Crea archivo `affected-users.json` con los detalles

---

## 💳 Verificar Pagos en Stripe

### **Script para Cruzar Datos Stripe ↔ Firebase**

Crear: `scripts/verify-stripe-payments.js`

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verifyPaymentsForUser(userId, userEmail) {
  try {
    console.log(`\n🔍 Checking Stripe for: ${userEmail}`);
    
    // Buscar customer en Stripe
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1
    });
    
    if (customers.data.length === 0) {
      console.log(`❌ No Stripe customer found for ${userEmail}`);
      return null;
    }
    
    const customer = customers.data[0];
    console.log(`✅ Found Stripe customer: ${customer.id}`);
    
    // Buscar sesiones de checkout
    const sessions = await stripe.checkout.sessions.list({
      customer: customer.id,
      limit: 10
    });
    
    console.log(`📋 Found ${sessions.data.length} checkout sessions`);
    
    const completedSessions = sessions.data.filter(
      s => s.payment_status === 'paid'
    );
    
    if (completedSessions.length === 0) {
      console.log(`❌ No completed payments found`);
      return null;
    }
    
    // Obtener la sesión más reciente
    const latestSession = completedSessions[0];
    
    console.log(`\n💰 Latest Completed Payment:`);
    console.log(`   Session ID: ${latestSession.id}`);
    console.log(`   Amount: $${latestSession.amount_total / 100}`);
    console.log(`   Date: ${new Date(latestSession.created * 1000).toISOString()}`);
    console.log(`   Subscription ID: ${latestSession.subscription}`);
    
    return {
      userId: userId,
      email: userEmail,
      sessionId: latestSession.id,
      subscriptionId: latestSession.subscription,
      paymentDate: new Date(latestSession.created * 1000),
      amount: latestSession.amount_total / 100
    };
    
  } catch (error) {
    console.error(`Error verifying payment for ${userEmail}:`, error.message);
    return null;
  }
}

async function verifyAllAffectedUsers() {
  // Leer lista de usuarios afectados
  const fs = require('fs');
  const affectedUsers = JSON.parse(
    fs.readFileSync('affected-users.json', 'utf8')
  );
  
  console.log('🚀 Starting payment verification...\n');
  console.log(`📊 Total users to verify: ${affectedUsers.length}\n`);
  
  const results = [];
  
  for (const user of affectedUsers) {
    const result = await verifyPaymentsForUser(user.userId, user.email);
    if (result) {
      results.push(result);
    }
    // Pausa para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n✅ Verification complete!`);
  console.log(`📊 Confirmed Payments: ${results.length} / ${affectedUsers.length}`);
  
  // Exportar resultados
  fs.writeFileSync(
    'verified-payments.json',
    JSON.stringify(results, null, 2)
  );
  console.log(`\n✅ Results exported to: verified-payments.json`);
  
  return results;
}

verifyAllAffectedUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
```

**Requisitos**:
```bash
npm install stripe
```

**Variables de Entorno**:
```bash
export STRIPE_SECRET_KEY="sk_test_..."
```

**Ejecutar**:
```bash
node scripts/verify-stripe-payments.js
```

---

## 🔄 Flujo Completo de Recuperación

### **Paso a Paso**:

```
1. Identificar Usuarios Afectados
   ↓
   node scripts/list-affected-users.js
   → Genera: affected-users.json

2. Verificar Pagos en Stripe
   ↓
   node scripts/verify-stripe-payments.js
   → Genera: verified-payments.json

3. Corregir Suscripciones
   ↓
   node scripts/fix-affected-users.js
   (Usar datos de verified-payments.json)

4. Notificar Usuarios
   ↓
   Enviar emails a usuarios corregidos

5. Verificar Acceso
   ↓
   Confirmar que pueden iniciar sesión
```

---

## 📧 Template de Email para Usuarios

```
Subject: Tu cuenta de Trade Manager está activa

Hola [Nombre],

Queremos informarte que hemos detectado y resuelto un problema técnico que afectó el proceso de activación de tu cuenta.

✅ Tu pago fue procesado correctamente
✅ Tu suscripción está ahora activa
✅ Puedes acceder a todas las funciones de Trade Manager

Para acceder a tu cuenta:
1. Ve a: https://tuapp.com/login
2. Ingresa con tu email: [email]
3. Usa la contraseña que creaste durante el registro

Si olvidaste tu contraseña, puedes restablecerla aquí: [link]

Lamentamos las molestias causadas y agradecemos tu paciencia.

Si tienes alguna pregunta o problema, no dudes en contactarnos.

Saludos,
El equipo de Trade Manager
```

---

## 🚨 Prevención Futura

Una vez implementada la solución del flujo (ver `SOLUCION_IMPLEMENTACION.md`):

1. **Monitorear Métricas**:
   - Usuarios registrados vs suscripciones activas
   - Tasa de conversión del checkout
   - Usuarios con status CREATED por más de 1 hora

2. **Alertas Automáticas**:
   ```javascript
   // Agregar a Cloud Functions
   exports.alertStuckSubscriptions = functions.pubsub
     .schedule('every 1 hours')
     .onRun(async (context) => {
       const oneHourAgo = Date.now() - 3600000;
       const stuckSubs = await findSubscriptionsWithStatus(
         'CREATED',
         oneHourAgo
       );
       
       if (stuckSubs.length > 0) {
         sendAlertToAdmin(stuckSubs);
       }
     });
   ```

3. **Dashboard de Monitoreo**:
   - Crear página admin para ver usuarios pendientes
   - Botón para forzar verificación de pago
   - Log de acciones de recuperación

---

## 📊 Métricas a Trackear

### **Durante la Recuperación**:
- Total de usuarios afectados
- Usuarios con pago confirmado en Stripe
- Usuarios recuperados exitosamente
- Usuarios que requieren atención manual

### **Post-Recuperación**:
- Usuarios que iniciaron sesión después de la corrección
- Tickets de soporte relacionados
- Feedback de usuarios

---

## ⚠️ Casos Especiales

### **Caso 1: Usuario Pagó Múltiples Veces**

**Síntoma**: El usuario intentó varias veces y completó múltiples pagos.

**Solución**:
1. Verificar todas las sesiones en Stripe
2. Activar la suscripción más reciente
3. Reembolsar pagos duplicados en Stripe
4. Notificar al usuario

### **Caso 2: Usuario No Pagó pero Tiene Cuenta Creada**

**Síntoma**: Usuario en Firebase pero sin pago en Stripe.

**Solución**:
1. Dejar la suscripción en CREATED (correcto)
2. El usuario puede intentar pagar de nuevo
3. O eliminar la cuenta si no va a pagar

### **Caso 3: Usuario Pagó pero No Hay Cuenta en Firebase**

**Síntoma**: Pago en Stripe pero no hay registro en Firebase.

**Solución**:
1. Verificar en Firebase Auth (puede estar allí)
2. Reembolsar en Stripe
3. Pedir al usuario que se registre de nuevo

---

## 🛡️ Checklist de Recuperación

- [ ] Exportar lista de usuarios afectados
- [ ] Verificar pagos en Stripe para cada usuario
- [ ] Crear backup de Firestore antes de modificar
- [ ] Ejecutar script de corrección
- [ ] Verificar manualmente algunos usuarios
- [ ] Enviar emails de notificación
- [ ] Monitorear logs de inicio de sesión
- [ ] Responder tickets de soporte
- [ ] Documentar lecciones aprendidas

---

## 📞 Contacto de Soporte

Si un usuario afectado contacta:

1. **Verificar su estado actual**:
   - ¿Pagó? (Stripe)
   - ¿Tiene cuenta? (Firebase Auth)
   - ¿Estado de suscripción? (Firestore)

2. **Aplicar solución correspondiente**:
   - Si pagó → Activar manualmente
   - Si no pagó → Ofrecer completar pago
   - Si dudas → Escalate to admin

3. **Seguimiento**:
   - Confirmar que puede acceder
   - Agregar nota en su cuenta
   - Actualizar métricas

---

**Última Actualización**: Octubre 20, 2025
**Prioridad**: 🟡 ALTA (Para usuarios existentes)
**Estado**: Listo para usar

