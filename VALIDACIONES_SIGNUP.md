# 🔒 Validaciones en el Signup

## 📋 Resumen de Validaciones

El signup tiene **6 campos** con validaciones específicas que se ejecutan en **tiempo real** y al hacer **submit**.

---

## 🎯 Validaciones por Campo

### **1. First Name (Nombre)**

**Validadores**:
- ✅ **Required**: Campo obligatorio
- ✅ **MinLength(2)**: Mínimo 2 caracteres

**Mensajes de Error**:
```
❌ "First name is required"
❌ "First name must be at least 2 characters"
```

**Código**:
```typescript
firstName: ['', [Validators.required, Validators.minLength(2)]]
```

---

### **2. Last Name (Apellido)**

**Validadores**:
- ✅ **Required**: Campo obligatorio
- ✅ **MinLength(2)**: Mínimo 2 caracteres

**Mensajes de Error**:
```
❌ "Last name is required"
❌ "Last name must be at least 2 characters"
```

**Código**:
```typescript
lastName: ['', [Validators.required, Validators.minLength(2)]]
```

---

### **3. Email**

**Validadores**:
- ✅ **Required**: Campo obligatorio
- ✅ **Email**: Validación estándar de Angular
- ✅ **emailValidator**: Validador personalizado con regex

**Regex**:
```typescript
/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
```

**Mensajes de Error**:
```
❌ "Email is required"
❌ "Invalid email format"
❌ "Invalid email format. Must contain @ and a valid domain"
```

**Validación Adicional (En submit)**:
```typescript
// Verifica si el email ya existe en Firebase
const existingUser = await this.authService.getUserByEmail(email);
if (existingUser) {
  alert('This email is already registered. Please use a different email or try logging in.');
}
```

**Código**:
```typescript
email: ['', [Validators.required, Validators.email, this.emailValidator]]

private emailValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(control.value)) {
    return { invalidEmailFormat: true };
  }
  
  return null;
}
```

---

### **4. Password (Contraseña)**

**Validadores**:
- ✅ **Required**: Campo obligatorio
- ✅ **MinLength(6)**: Mínimo 6 caracteres

**Mensajes de Error**:
```
❌ "Password is required"
❌ "Password must be at least 6 characters"
```

**Nota**: El componente `password-input` tiene validaciones adicionales visuales:
- Muestra fortaleza de contraseña
- Verifica que no contenga email del usuario
- Verifica que no contenga nombre del usuario

**Código**:
```typescript
password: ['', [Validators.required, Validators.minLength(6)]]
```

---

### **5. Phone Number (Número de Teléfono)**

**Validadores**:
- ✅ **Required**: Campo obligatorio
- ✅ **phoneValidator**: Validador personalizado

**Reglas del Validador**:
1. Debe empezar con + o dígito 1-9
2. Solo permite dígitos (espacios, guiones y paréntesis se eliminan)
3. Longitud entre 10 y 15 dígitos

**Regex**:
```typescript
/^[\+]?[1-9][\d]{0,15}$/
```

**Ejemplos Válidos**:
```
✅ +1234567890
✅ 1234567890
✅ +52 123 456 7890
✅ (123) 456-7890
```

**Ejemplos Inválidos**:
```
❌ 123456789        (menos de 10 dígitos)
❌ 12345678901234567 (más de 15 dígitos)
❌ 0123456789       (empieza con 0)
❌ abc123456789     (contiene letras)
```

**Mensajes de Error**:
```
❌ "Phone number is required"
❌ "Invalid phone number format"
❌ "Phone number must be between 10 and 15 digits"
```

**Código**:
```typescript
phoneNumber: ['', [Validators.required, this.phoneValidator]]

private phoneValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  const cleanPhone = control.value.replace(/[\s\-\(\)]/g, ''); // Elimina formato
  
  if (!phoneRegex.test(cleanPhone)) {
    return { invalidPhone: true };
  }
  
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return { invalidPhoneLength: true };
  }
  
  return null;
}
```

---

### **6. Birthday (Fecha de Nacimiento)**

**Validadores**:
- ✅ **Required**: Campo obligatorio
- ✅ **ageValidator**: Validador personalizado de edad mínima

**Reglas del Validador**:
- Usuario debe tener **mínimo 18 años**
- Calcula edad considerando mes y día exactos

**Mensajes de Error**:
```
❌ "Birthday is required"
❌ "You must be 18 years or older to register"
```

**Ejemplos**:
```
Hoy: 20 de Octubre 2025

✅ 19/10/2007 → 18 años (válido)
✅ 20/10/2007 → 18 años exactos (válido)
❌ 21/10/2007 → 17 años (inválido - menor de edad)
❌ 01/01/2008 → 17 años (inválido)
```

**Código**:
```typescript
birthday: ['', [Validators.required, this.ageValidator]]

private ageValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  
  const today = new Date();
  const birthDate = new Date(control.value);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Ajustar edad si no ha cumplido años este año
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  if (age < 18) {
    return { underage: true };
  }
  
  return null;
}
```

---

## 🔍 Cómo se Manifiestan las Validaciones

### **1. Validación en Tiempo Real**

Cada campo tiene su componente personalizado que muestra errores visualmente:

```html
<app-text-input
  formControlName="firstName"
  class="form-input"
></app-text-input>
```

Los componentes (`text-input`, `password-input`, `phone-input`, `birthday-input`) manejan:
- ✅ Mostrar/ocultar mensajes de error
- ✅ Cambiar estilos del input (borde rojo)
- ✅ Validar mientras el usuario escribe

---

### **2. Validación al Enviar (Submit)**

Cuando el usuario hace clic en "Register":

```typescript
async onSubmit(): Promise<void> {
  if (this.signupForm.valid) {
    // ✅ Formulario válido → Continuar con registro
  } else {
    // ❌ Formulario inválido → Mostrar errores
    this.showValidationErrors();
  }
}
```

---

### **3. Método `showValidationErrors()`**

Si el formulario es inválido, se ejecuta este método que:

1. **Recopila todos los errores**:
```typescript
const errors: string[] = [];

if (firstNameControl?.errors?.['required']) {
  errors.push('First name is required');
}
// ... más validaciones
```

2. **Marca todos los campos como "touched"**:
```typescript
this.markFormGroupTouched();
// Esto activa las validaciones visuales en todos los campos
```

3. **Muestra un alert con todos los errores**:
```typescript
alert('Validation errors:\n\n' + errors.join('\n'));
```

**Ejemplo de Alert**:
```
Validation errors:

First name is required
Email is required
Phone number must be between 10 and 15 digits
You must be 18 years or older to register
```

---

## 🎨 Manifestación Visual

### **Estados de un Input**:

**1. Normal (sin interacción)**:
- Borde gris/transparente
- Placeholder visible

**2. Focused (en foco)**:
- Borde cambia de color
- Placeholder desaparece o sube

**3. Invalid + Touched (error)**:
- Borde rojo
- Mensaje de error debajo
- Icono de advertencia (depende del componente)

**4. Valid**:
- Borde verde (opcional)
- Sin mensajes de error

---

## 🔄 Flujo de Validación Completo

```
Usuario escribe en campo
        ↓
Validación en tiempo real (componente)
        ↓
Usuario termina de llenar formulario
        ↓
Click en "Register"
        ↓
    ¿Formulario válido?
        ├─ NO → showValidationErrors()
        │         ├─ Marca campos como touched
        │         ├─ Muestra alert con errores
        │         └─ Usuario corrige errores
        │
        └─ SÍ → Validación de email duplicado
                  ├─ Email existe → Alert "Email already registered"
                  └─ Email nuevo → Continuar con registro
                                     ├─ Crear usuario en Firebase Auth
                                     ├─ Crear usuario en Firestore
                                     ├─ Crear suscripción FREE
                                     ├─ Login automático
                                     └─ Mostrar plan-selection
```

---

## 🚨 Validaciones Adicionales (En Submit)

### **1. Email Duplicado**:
```typescript
const existingUser = await this.authService.getUserByEmail(email);
if (existingUser) {
  alert('This email is already registered. Please use a different email or try logging in.');
  return;
}
```

### **2. Errores de Firebase**:
```typescript
try {
  const userResponse = await this.authService.register(credentials);
} catch (error) {
  // Errores comunes:
  // - "auth/email-already-in-use"
  // - "auth/invalid-email"
  // - "auth/weak-password"
  alert(error.message);
}
```

---

## 💡 Mejoras Sugeridas

### **Actualmente**: Alert con todos los errores

```javascript
alert('Validation errors:\n\nFirst name is required\nEmail is required');
```

### **Sugerencia**: Toast notifications o inline errors

```html
<div class="error-summary">
  <h4>Please fix the following errors:</h4>
  <ul>
    <li>First name is required</li>
    <li>Email is required</li>
  </ul>
</div>
```

### **Sugerencia**: Scroll automático al primer error

```typescript
private scrollToFirstError(): void {
  const firstError = document.querySelector('.input-error');
  firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
```

---

## 📝 Resumen de Todas las Validaciones

| Campo | Obligatorio | Min Length | Max Length | Edad Mínima | Regex | Async Check |
|-------|-------------|------------|------------|-------------|-------|-------------|
| First Name | ✅ | 2 chars | - | - | - | - |
| Last Name | ✅ | 2 chars | - | - | - | - |
| Email | ✅ | - | - | - | ✅ | ✅ Duplicado |
| Password | ✅ | 6 chars | - | - | - | - |
| Phone | ✅ | 10 digits | 15 digits | - | ✅ | - |
| Birthday | ✅ | - | - | 18 años | - | - |

---

## 🧪 Casos de Prueba

### **Test 1: Todos los campos vacíos**
```
Resultado: 6 errores mostrados en alert
- First name is required
- Last name is required
- Email is required
- Phone number is required
- Birthday is required
- Password is required
```

### **Test 2: Email inválido**
```
Input: "test@"
Resultado: "Invalid email format. Must contain @ and a valid domain"

Input: "test.com"
Resultado: "Invalid email format"
```

### **Test 3: Menor de edad**
```
Input: "01/01/2010"
Resultado: "You must be 18 years or older to register"
```

### **Test 4: Teléfono corto**
```
Input: "123456"
Resultado: "Phone number must be between 10 and 15 digits"
```

### **Test 5: Email duplicado**
```
Input: "existinguser@example.com"
Resultado: Alert "This email is already registered. Please use a different email or try logging in."
```

---

## ✅ Conclusión

El signup tiene **validaciones robustas**:
- ✅ 6 campos con validaciones específicas
- ✅ 3 validadores personalizados (phone, age, email)
- ✅ Validación en tiempo real
- ✅ Validación al submit
- ✅ Validación async de email duplicado
- ✅ Mensajes de error claros
- ✅ Alert consolidado con todos los errores

**Fortalezas**:
- Validaciones completas y seguras
- Mensajes de error específicos
- Prevención de datos inválidos

**Áreas de mejora**:
- Reemplazar alerts por notificaciones más elegantes
- Agregar tooltips explicativos
- Validación de fortaleza de contraseña más robusta
- Scroll automático a errores

