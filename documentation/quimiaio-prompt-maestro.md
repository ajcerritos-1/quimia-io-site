# QUIMIA IO — PROMPT MAESTRO v2.0
> Sistema de Información para Laboratorios Clínicos · SaaS Multi-Tenant · PWA

---

## 0. CONTEXTO DEL PROYECTO

**Quimia IO** es un SaaS PWA multi-tenant para laboratorios clínicos en México.
- Fase 1: Primer cliente (laboratorio del doctor socio) — $32,000 MXN, 17 semanas
- Fase 2: Plataforma SaaS replicable a otros laboratorios como `labname.quimiaio.com`
- Developer: Jesús Cerritos · jesus@ediservice.net
- Dominio: quimiaio.com
- Repositorio: github.com/ajcerritos-1/quimia-io

---

## 1. METODOLOGÍA DE DESARROLLO (SDD)

Cada módulo sigue este flujo estricto:

```
SPEC → SCHEMA → API → UI → CÓDIGO → REVIEW
```

1. **SPEC**: Definir qué hace el módulo, campos, reglas de negocio
2. **SCHEMA**: Tablas Prisma con RLS por tenant_id
3. **API**: Route handlers Next.js (GET/POST/PUT/DELETE)
4. **UI**: Componentes shadcn/ui con Tailwind
5. **CÓDIGO**: Implementación completa con TypeScript strict
6. **REVIEW**: Tests, validaciones, edge cases

**Reglas:**
- TypeScript strict en todo el código
- Nunca omitir manejo de errores
- Validar con Zod en cliente y servidor
- RLS activo en todas las tablas (aislamiento por tenant)
- Mobile-first en todos los componentes

---

## 2. TECH STACK

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14+ App Router |
| Lenguaje | TypeScript strict |
| Estilos | Tailwind CSS + shadcn/ui |
| Fuente | Plus Jakarta Sans (300 light / 800 bold) |
| Base de datos | PostgreSQL con RLS (Supabase o Neon) |
| ORM | Prisma |
| Auth | NextAuth.js v5 |
| PDF | React-PDF / jsPDF |
| WhatsApp | Twilio API |
| Email | Resend |
| QR | qrcode.react |
| Deploy | Vercel (Fase 1) → VPS/Railway (Fase 2) |
| Pagos | Stripe (suscripciones SaaS) |

---

## 3. PALETA Y DISEÑO

```css
:root {
  --primary:    #0D1B36;  /* Azul marino — navbar, botones */
  --accent:     #00C4E0;  /* Cyan eléctrico — IO del logo, activos */
  --accent-lt:  #E0F8FF;  /* Cyan suave — fondos de sidebar activo */
  --bg:         #F0F6FF;  /* Fondo general */
  --text:       #0F172A;  /* Texto principal */
  --gray:       #64748B;  /* Texto secundario */
  --border:     #E2E8F0;  /* Bordes */
  --ok:         #10B981;  /* Entregado / validado */
  --warn:       #F59E0B;  /* Alerta >45 min */
  --error:      #EF4444;  /* Crítico >90 min / adeudo */
}
```

**Logo:** `Quimia` (font-weight: 300) + ` IO` (font-weight: 800, color: #00C4E0)

---

## 4. ARQUITECTURA MULTI-TENANT

```
quimiaio.com          → Landing / marketing
app.quimiaio.com      → Plataforma SaaS (login)
labname.quimiaio.com  → Tenant específico (subdomain routing)
```

- Cada laboratorio = 1 tenant con su `tenant_id`
- Todas las tablas tienen `tenant_id` con RLS en PostgreSQL
- Subdominios gestionados vía middleware Next.js
- Un solo codebase, múltiples laboratorios aislados

---

## 5. PLANES DE SUSCRIPCIÓN

| Plan | Precio | Sucursales | Usuarios | Módulos |
|------|--------|-----------|---------|---------|
| **Reactivo** | $799 MXN/mes | 1 | 3 | Básicos (pacientes, órdenes, captura, entrega) |
| **Clínico** | $1,299 MXN/mes | 1+1 | Ilimitados | Todo + Pipeline Kanban, WhatsApp, QR |
| **Red** | $2,099 MXN/mes | Hasta 5 | Ilimitados | Todo + Multi-sucursal, dashboard consolidado, inventario |
| **Facturación CFDI** | +$399 MXN/mes | Add-on | — | Timbrado SAT, facturas electrónicas |

---

## 6. MÓDULOS DEL SISTEMA

### MÓDULO 1 — DASHBOARD
**Descripción:** Pantalla principal al iniciar sesión. KPIs del día en tiempo real.

**Componentes:**
- Cards con métricas: órdenes del día, ingresos del día, resultados pendientes, estudios entregados
- Pipeline Kanban resumen (mini vista)
- Gráfica de ingresos últimos 7 días
- Estudios más solicitados (top 5)
- Alertas activas (adeudos, muestras pendientes, órdenes con tiempo crítico)
- Acceso rápido a: Nueva Orden, Captura, Entrega

**Roles con acceso:** Admin, Químico (parcial), Recepcionista (parcial)

---

### MÓDULO 2 — PACIENTES
**Descripción:** Gestión completa del expediente del paciente.

**Submódulos:**
- **Nuevo Paciente:** nombre completo, fecha de nacimiento (calcula edad automática), sexo, teléfono, email, CURP (opcional), dirección
- **Modificar Datos:** edición de cualquier campo con bitácora de cambio
- **Historial Clínico:** todos los resultados ordenados por fecha, comparativa visual entre estudios del mismo tipo (gráfica de tendencia), altibajos marcados
- **Muestra Pendiente:** marcar que falta muestra de orina/otro, cobrar al recibirla, enviar a captura automáticamente

**Mejoras vs sistema anterior:**
- Búsqueda por nombre, teléfono o folio en tiempo real
- Foto del paciente opcional
- Alerta si el paciente tiene adeudo al abrir su perfil
- Historial con gráfica comparativa (no solo tabla)

---

### MÓDULO 3 — RECEPCIÓN / ÓRDENES ⭐ (Más importante)
**Descripción:** Crear y gestionar órdenes de trabajo. Módulo de mayor uso diario.

**Flujo principal:**
1. Buscar o crear paciente
2. Seleccionar doctor (opcional), empresa (opcional), vendedor
3. Agregar estudios — buscador con clave o nombre, precio editable para esa orden
4. Aplicar descuento (%) o precio especial por empresa
5. Seleccionar forma(s) de pago: efectivo, tarjeta, transferencia, crédito
6. Guardar → genera folio único → imprime ticket/orden
7. Si tiene cotización previa → cargar cotización → convierte automáticamente

**Campos de la orden:**
- Folio (auto, único por tenant)
- Paciente (buscar existente o crear nuevo inline)
- Doctor (dropdown con búsqueda)
- Empresa (dropdown, aplica lista de precios automática)
- Vendedor (usuario que registra)
- Estudios con: clave, descripción, precio, IVA, descuento
- Observaciones del paciente (ayuno, medicamentos, etc.)
- Condiciones del paciente (estado clínico relevante)
- Total, descuento, IVA, formas de pago
- Pago parcial → genera adeudo

**Cotizaciones:**
- Crear cotización sin cobrar
- Enviar por WhatsApp o email como PDF
- Número de cotización para recuperarla rápido
- Convertir cotización en orden con 1 clic

**Mejoras vs sistema anterior:**
- Búsqueda de estudios instantánea (fuzzy search)
- Precio especial por empresa se aplica automáticamente
- Múltiples formas de pago en una sola orden (ej: parte efectivo + parte tarjeta)
- QR generado automáticamente para cada orden
- Campo "condiciones del paciente" visible en captura

---

### MÓDULO 4 — PIPELINE KANBAN ⭐ (Innovación principal)
**Descripción:** Vista visual del estado de todas las órdenes activas. Diferenciador clave del sistema.

**Columnas:**
1. **Recepción** — orden creada, pendiente de muestra
2. **Muestra recibida** — muestra confirmada, lista para análisis
3. **En análisis** — el químico está capturando resultados
4. **Validado** — resultados validados, listo para entrega
5. **Entregado** — resultado entregado al paciente

**Alertas por tiempo:**
- 🟡 Amarillo: orden lleva más de 45 minutos sin avanzar
- 🔴 Rojo: orden lleva más de 90 minutos (crítico)
- Tiempo configurable por laboratorio en Configuración

**Tarjeta de cada orden muestra:**
- Folio, nombre del paciente
- Estudios (chips resumidos)
- Tiempo transcurrido
- Responsable actual
- Indicador de color

**Interacciones:**
- Arrastrar tarjeta entre columnas (drag & drop)
- Clic en tarjeta → ver detalle completo
- Filtrar por sucursal, químico, fecha
- Contador en cada columna

**Disponible en:** Plan Clínico y Plan Red

---

### MÓDULO 5 — CAPTURA DE RESULTADOS ⭐
**Descripción:** El químico captura los resultados de cada estudio de una orden.

**Flujo:**
1. Buscar orden por folio, nombre o fecha
2. Seleccionar estudio a capturar
3. Ingresar valores de cada analito
4. Sistema calcula analitos automáticos
5. Indicador visual: Normal / Bajo / Alto (con colores)
6. Validar estudio → pasa a "Validado" en el Pipeline
7. Opción de invalidar y recapturar con bitácora

**Tipos de analitos:**
- **Numérico:** valor + unidad + VR-Bajo / VR-Alto (por edad, sexo, nivel del mar)
- **Texto:** resultado tipo positivo/negativo, descripción libre
- **Cálculo automático:** fórmula basada en otros analitos capturados (ej: índice aterogénico)
- **Imagen:** adjuntar foto (microscopio, laminilla) → aparece en PDF
- **Documento:** editor de texto enriquecido → aparece en PDF (ej: antibiograma)
- **Valor referenciado:** rango varía por edad inicial/final, unidad (días/semanas/años), sexo, nivel del mar

**Captura eficiente:**
- Tab entre analitos para captura rápida
- Resaltado automático de valores fuera de rango
- Carga de resultados desde archivo CSV/HL7 (equipos Mindray, Spin, Biobas) — interfacing
- Adjuntar PDF externo del equipo
- Cambiar orden de aparición de estudios en el PDF final
- Código de colores en la lista: pendiente / en proceso / validado

**Mejoras vs sistema anterior:**
- Interfacing: importar resultados directamente del equipo (cero captura manual)
- Validación inline sin salir de la pantalla
- Fórmulas de cálculo automático más potentes
- Vista previa del PDF antes de validar

---

### MÓDULO 6 — ENTREGA DE RESULTADOS
**Descripción:** Gestionar la entrega de resultados validados a los pacientes.

**Lista de resultados:**
- Filtro por fecha (hoy, rango personalizado)
- Filtro por estado: listos, con adeudo, cancelados
- Resultados en rojo: adeudo pendiente o orden cancelada
- Resultados en verde: listos para entregar

**Acciones por resultado:**
- **Imprimir PDF:** genera el PDF oficial con logo del laboratorio
- **Email:** enviar PDF al correo del paciente
- **WhatsApp:** enviar link seguro o PDF por WhatsApp (Twilio)
- **QR:** el paciente escanea y ve sus resultados en portal web
- **Finiquitar adeudo:** cobrar saldo pendiente (múltiples formas de pago) desde esta pantalla
- **Ver historial:** comparativa con resultados anteriores del mismo paciente

**Mejoras vs sistema anterior:**
- Envío por WhatsApp automático al validar (configurable)
- Portal del paciente con URL única y segura (token de 1 uso o con expiración)
- Notificación push cuando el resultado está listo
- Firma de recibido digital (el paciente firma en pantalla táctil)

---

### MÓDULO 7 — DOCTORES
**Descripción:** Gestión de médicos referentes.

**Campos:** nombre, especialidad, cédula profesional, teléfono, email, hospital/consultorio, activo/inactivo

**Funciones:**
- CRUD completo con botón imprimir tabla
- Lista de precios especial por doctor (opcional)
- Comisión configurada (% sobre ventas referidas)
- Ver relación de órdenes por doctor (con filtro de fechas)
- Total de ventas, comisión generada en el período

---

### MÓDULO 8 — EMPRESAS
**Descripción:** Laboratorios, clínicas u empresas que mandan pacientes o tienen convenio.

**Campos:** nombre, tipo (Empresa / Laboratorio), RFC, dirección, teléfono, email, contacto, maneja crédito (Sí/No), límite de crédito, comisión %

**Funciones:**
- CRUD completo
- Lista de precios exclusiva por empresa (descuento o precio fijo por estudio)
- Control de crédito: saldo disponible, alertas al llegar al límite
- Ver relación de órdenes por empresa
- Estado de cuenta: total de ventas, adeudo actual, comisión

---

### MÓDULO 9 — CONFIGURACIÓN

#### 9.1 Estudios
**Campos:** clave, descripción, área (hematología, química, urología...), tipo de muestra, recipiente, método, técnica, equipo, condiciones del paciente, días de proceso, precio, IVA, imprimir método/técnica/equipo/muestra en PDF (checkboxes)

#### 9.2 Analitos
**Campos:** clave, bitácora, descripción, tipo de resultado (numérico/texto/imagen/documento/cálculo/referenciado), unidad, dígitos decimales, VR-Bajo, VR-Alto, resultado por defecto, fórmula (si es cálculo)

**Analito referenciado:** rangos por edad inicial/final, unidad de edad (días/semanas/años), sexo, nivel del mar → VR-Bajo y VR-Alto

**Mejora:** edición inline de VR sin salir de la lista, historial de cambios por analito

#### 9.3 Paquetes / Perfiles
Agrupar estudios para venderlos como uno solo.
**Campos:** clave, descripción, condiciones del paciente, días de proceso, estudios incluidos, precio del paquete

#### 9.4 Métodos
Lista de métodos analíticos disponibles. Ej: Floculación, Aglutinación en placas, Base líquida, Cálculo, Cromatografía

#### 9.5 Técnicas
Ej: Automatizada, Cultivo, Manual, Conteo

#### 9.6 Equipos
Ej: Mindray BS, Spin 120, Biobas 10. Con modelo, serie, fecha de calibración

#### 9.7 Recipientes
Ej: Caja, Frasco, Papel filtro, Tubo amarillo, Laminilla

#### 9.8 Tipos de Muestra
Ej: Catéter central, Cérvico vaginal, Esputo, Excremento, Herida o fisura, Sangre, Orina

#### 9.9 Nivel del Mar
Configurar ciudades/altitudes para ajustar valores de referencia.
Ej: La Paz (0 msnm), CDMX (2,240 msnm), Monterrey (540 msnm)

#### 9.10 Plantillas PDF
Personalizar el encabezado del PDF de resultados: logo del laboratorio, nombre, dirección, teléfono, leyendas legales, firma del responsable.

#### 9.11 Tiempo de alertas Kanban
Configurar los minutos para alerta amarilla (default 45) y alerta roja (default 90).

---

### MÓDULO 10 — CAJA
**Descripción:** Control del dinero en el laboratorio por día y sucursal.

**Apertura de Caja:**
- Obligatoria para operar (sin apertura no se pueden crear órdenes)
- Monto de apertura (fondo inicial)
- Usuario y sucursal

**Durante el día:**
- Cada pago registrado suma al corte
- Nuevo movimiento manual (entrada/salida con concepto)

**Cierre de Caja:**
- Resumen: efectivo, tarjeta, transferencia, crédito
- Total teórico vs total contado
- Diferencia (sobrante/faltante)
- PDF de cierre con detalle
- Detalle por vendedor

**Funciones extra:**
- Caja de días anteriores (consulta histórica)
- Imprimir detalle por sucursal
- Exportar a Excel

---

### MÓDULO 11 — REPORTES Y ANÁLISIS
**Descripción:** Inteligencia de negocio para el laboratorio.

**Reporte de Ventas:**
- Por período (día, semana, mes, año, rango personalizado)
- Por estudio (cuántas veces se realizó cada estudio, ingreso total)
- Por sumatoria general
- Por doctor (ventas referidas)
- Por empresa (ventas por convenio)
- Por sucursal
- Por vendedor/recepcionista
- Por forma de pago
- Exportar a Excel / PDF

**Relaciones:**
- Tabla de doctores: total de ventas, comisión %, total de comisión, folios incluidos
- Tabla de empresas: total de ventas, adeudo, comisión %, folios
- Tabla de folios: folio, paciente, doctor, empresa, pago1, pago2, pago3, total pagado, adeudo

**Gráficas interactivas:**
- Ingresos por día (últimos 30 días)
- Estudios más solicitados (barras)
- Ingresos por forma de pago (pie chart)
- Tendencia mensual del año

**Dashboard multi-sucursal** (Plan Red):
- Consolidado de todas las sucursales en una vista
- Comparativa entre sucursales

---

### MÓDULO 12 — USUARIOS Y ROLES
**Descripción:** Administración de accesos al sistema.

**Usuarios:**
- Nombre, nickname, contraseña (hash bcrypt), foto, email
- Perfil/rol asignado
- Sucursal asignada (o todas si es admin)
- Activo / Inactivo

**Roles predefinidos:**
- `admin`: acceso total
- `recepcionista`: recepción, pacientes, caja, entrega
- `quimico`: captura, validación, entrega
- `administracion`: reportes, caja, relaciones
- `gerente`: dashboard, reportes, sin captura ni caja

**Permisos granulares por módulo:**
Nuevo paciente, Modificar paciente, Historial, Nueva orden, Editar orden, Cotización, Captura, Validar, Entrega, Cierre caja, Apertura caja, Reportes, Relaciones, Doctores, Empresas, Usuarios, Configuración, Precios

---

### MÓDULO 13 — INVENTARIO DE REACTIVOS (Plan Red)
**Descripción:** Control básico de insumos del laboratorio.

**Funciones:**
- Catálogo de reactivos con stock actual
- Stock mínimo con alerta visual
- Consumo automático al realizar cierto estudio (configurable)
- Entrada de mercancía (compra)
- Salida manual (merma, vencimiento)
- Reporte de consumo por período

---

### MÓDULO 14 — AUDITORÍA / BITÁCORA
**Descripción:** Registro inmutable de cambios críticos para trazabilidad y cumplimiento normativo.

**Registra:**
- Quién / cuándo / qué cambió en analitos, precios, resultados
- Invalidaciones de resultados (con motivo)
- Cambios de precio en órdenes
- Creación/eliminación de usuarios
- Aperturas y cierres de caja

**Consultable por:** Admin únicamente, con filtros de fecha y usuario

---

### MÓDULO 15 — FACTURACIÓN CFDI (Add-on, +$399 MXN/mes)
**Descripción:** Emisión de facturas electrónicas del SAT desde el sistema.

**Funciones:**
- Generar CFDI 4.0 desde cualquier orden
- Datos fiscales del paciente/empresa (RFC, uso de CFDI)
- Timbrado automático vía PAC certificado
- Descarga PDF + XML
- Cancelación de CFDI
- Reporte de facturas emitidas

---

## 7. PORTAL DEL PACIENTE

URL única por resultado: `quimiaio.com/r/{token}`

- No requiere login del paciente
- Muestra: nombre, fecha, estudios, resultados con indicadores
- Token de acceso con expiración configurable (24h, 7 días)
- Link enviado por WhatsApp o email al validar
- QR impreso en la orden que lleva a esta URL
- Opción de descargar PDF directamente

---

## 8. INTEGRACIÓN WHATSAPP (Twilio)

**Mensajes automáticos:**
- Al crear orden: "Su orden #FOLIO está en proceso. Le notificaremos cuando esté lista."
- Al validar resultados: "Sus resultados están listos. Consúltelos aquí: {link}"
- Al entregar físicamente: "Su resultado fue entregado. Gracias por su preferencia."

**Manual desde Entrega:**
- Botón "Enviar por WhatsApp" con mensaje editable
- Adjuntar PDF o solo el link

---

## 9. SCHEMA PRISMA (Base de datos)

```prisma
// Tenant (laboratorio)
model Tenant {
  id          String   @id @default(cuid())
  name        String
  subdomain   String   @unique
  plan        Plan     @default(REACTIVO)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  users       User[]
  patients    Patient[]
  orders      Order[]
}

// Usuario
model User {
  id         String   @id @default(cuid())
  tenantId   String
  name       String
  nickname   String
  email      String
  password   String   // bcrypt
  photo      String?
  roleId     String
  branchId   String?
  active     Boolean  @default(true)
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  role       Role     @relation(fields: [roleId], references: [id])
}

// Paciente
model Patient {
  id        String    @id @default(cuid())
  tenantId  String
  name      String
  birthDate DateTime
  sex       Sex
  phone     String?
  email     String?
  curp      String?
  address   String?
  photo     String?
  orders    Order[]
  tenant    Tenant    @relation(fields: [tenantId], references: [id])
}

// Orden / Solicitud
model Order {
  id          String      @id @default(cuid())
  tenantId    String
  folio       String
  patientId   String
  doctorId    String?
  companyId   String?
  userId      String      // recepcionista
  branchId    String
  status      OrderStatus @default(RECEPTION)
  subtotal    Decimal
  discount    Decimal     @default(0)
  tax         Decimal     @default(0)
  total       Decimal
  paid        Decimal     @default(0)
  debt        Decimal     @default(0)
  notes       String?
  patientCond String?
  qrToken     String      @unique
  createdAt   DateTime    @default(now())
  items       OrderItem[]
  payments    Payment[]
  patient     Patient     @relation(fields: [patientId], references: [id])
  tenant      Tenant      @relation(fields: [tenantId], references: [id])
}

// Estado de la orden (Pipeline Kanban)
enum OrderStatus {
  RECEPTION       // Recepción
  SAMPLE          // Muestra recibida
  IN_ANALYSIS     // En análisis
  VALIDATED       // Validado
  DELIVERED       // Entregado
  CANCELLED       // Cancelado
}

// Estudio en una orden
model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  studyId   String
  price     Decimal
  status    ItemStatus @default(PENDING)
  results   Result[]
  order     Order   @relation(fields: [orderId], references: [id])
  study     Study   @relation(fields: [studyId], references: [id])
}

// Estudio (catálogo)
model Study {
  id            String   @id @default(cuid())
  tenantId      String
  code          String
  name          String
  area          String
  sampleTypeId  String
  containerId   String
  methodId      String
  techniqueId   String
  equipmentId   String
  patientCond   String?
  processDays   Int      @default(1)
  price         Decimal
  tax           Boolean  @default(false)
  printMethod   Boolean  @default(false)
  printTech     Boolean  @default(false)
  printEquip    Boolean  @default(false)
  printSample   Boolean  @default(false)
  active        Boolean  @default(true)
  analytes      StudyAnalyte[]
}

// Analito (catálogo)
model Analyte {
  id           String      @id @default(cuid())
  tenantId     String
  code         String
  name         String
  description  String?
  type         AnalyteType
  unit         String?
  decimals     Int         @default(2)
  defaultValue String?
  formula      String?     // para tipo CALCULATION
  vrLow        Decimal?    // rango simple
  vrHigh       Decimal?
  references   AnalyteRef[] // rangos por edad/sexo/altitud
}

enum AnalyteType {
  NUMERIC
  TEXT
  CALCULATION
  IMAGE
  DOCUMENT
  REFERENCED
}

// Rango de referencia por condición
model AnalyteRef {
  id         String  @id @default(cuid())
  analyteId  String
  ageMin     Int
  ageMax     Int
  ageUnit    String  // days, weeks, years
  sex        Sex?    // null = ambos
  altitude   String? // null = cualquier altitud
  vrLow      Decimal
  vrHigh     Decimal
}

// Resultado capturado
model Result {
  id          String   @id @default(cuid())
  orderItemId String
  analyteId   String
  value       String?
  fileUrl     String?  // para imagen o documento
  status      ResultStatus @default(PENDING)
  validatedBy String?
  validatedAt DateTime?
  createdAt   DateTime @default(now())
}

enum ResultStatus {
  PENDING
  CAPTURED
  VALIDATED
  INVALIDATED
}

// Pago
model Payment {
  id       String      @id @default(cuid())
  orderId  String
  method   PaymentMethod
  amount   Decimal
  date     DateTime    @default(now())
}

enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  CREDIT
}

// Enums generales
enum Plan { REACTIVO CLINICO RED }
enum Sex  { M F }
```

---

## 10. ESTRUCTURA DE ARCHIVOS (Next.js App Router)

```
quimia-io/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── layout.tsx          ← sidebar + topbar
│   │   ├── page.tsx            ← dashboard KPIs
│   │   ├── pacientes/
│   │   ├── ordenes/
│   │   ├── pipeline/           ← Kanban
│   │   ├── captura/
│   │   ├── entrega/
│   │   ├── doctores/
│   │   ├── empresas/
│   │   ├── caja/
│   │   ├── reportes/
│   │   ├── usuarios/
│   │   ├── inventario/
│   │   └── configuracion/
│   ├── r/[token]/              ← portal paciente público
│   └── api/
│       ├── auth/
│       ├── patients/
│       ├── orders/
│       ├── results/
│       ├── reports/
│       └── webhooks/
│           └── twilio/
├── components/
│   ├── ui/                     ← shadcn/ui
│   ├── kanban/
│   ├── forms/
│   ├── charts/
│   └── pdf/
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── twilio.ts
│   ├── resend.ts
│   └── utils.ts
├── prisma/
│   └── schema.prisma
└── public/
```

---

## 11. REGLAS DE NEGOCIO CLAVE

1. **Apertura de caja obligatoria**: sin apertura no se pueden crear órdenes en esa sucursal ese día
2. **Resultado con adeudo**: no se puede imprimir/entregar hasta liquidar el saldo (o permiso especial de admin)
3. **Invalidación con motivo**: al invalidar un resultado queda registro en bitácora con motivo obligatorio
4. **Precio editable solo en la orden**: el precio del catálogo no se modifica, solo el precio de esa orden específica
5. **QR único por orden**: generado al crear la orden, no cambia aunque se edite
6. **RLS siempre activo**: ninguna query puede devolver datos de otro tenant
7. **Multi-pago**: una orden puede tener hasta 3 formas de pago diferentes
8. **Cotización expira**: si no se convierte en 30 días, se archiva automáticamente
9. **Nivel del mar**: si el laboratorio tiene altitud configurada, los VR del analito referenciado se ajustan automáticamente

---

## 12. INSTRUCCIONES PARA CLAUDE CODE

Al comenzar cada sesión de desarrollo:

1. Lee este archivo completo antes de escribir código
2. Pregunta en qué módulo/feature trabajar si no está claro
3. Sigue SDD: SPEC → SCHEMA → API → UI → CÓDIGO → REVIEW
4. TypeScript strict, sin `any`, sin `@ts-ignore`
5. Todos los componentes deben ser mobile-first
6. Usar siempre shadcn/ui para componentes de UI
7. Manejar loading states y error states en cada componente
8. Validar con Zod tanto en cliente como en servidor
9. Nunca hacer queries sin filtrar por `tenantId`
10. Al terminar un módulo, hacer review de edge cases

**Módulo a desarrollar primero:** Dashboard + Auth + Layout base

---

*Quimia IO · v2.0 · Julio 2026 · Jesús Cerritos · jesus@ediservice.net*
