# Quimia IO — Cronograma del Proyecto

**Sistema de Información de Laboratorio (LIS) · Preparado para el laboratorio cliente**
**Fecha: 6 de julio de 2026**

---

## Resumen

Quimia IO se entregará en dos fases. La **Fase 1** construye el sistema operativo completo para su laboratorio: registro de pacientes, órdenes de trabajo, captura y validación de resultados, entrega digital, control de caja y tablero de seguimiento en tiempo real. La **Fase 2** amplía la plataforma con mensajería por WhatsApp, cotizaciones, convenios con empresas y médicos, interfaz con equipos de laboratorio, facturación electrónica (CFDI 4.0) y demás capacidades de la plataforma en la nube.

| Fase | Duración | Inversión |
|------|----------|-----------|
| Fase 1 — Sistema operativo del laboratorio | 17 semanas | $32,000 MXN (precio fijo) |
| Fase 2 — Plataforma ampliada | ~14 semanas (estimado) | Por definir al cierre de la Fase 1 |

---

## Fase 1 — Sistema operativo del laboratorio (17 semanas)

### Qué incluye

- Acceso seguro con tres perfiles: administrador, recepcionista y químico
- Catálogos completos: estudios, analitos con valores de referencia por edad y sexo, paquetes, métodos, equipos, contenedores y tipos de muestra
- Registro de pacientes y creación de órdenes con pagos y folio
- Captura de resultados de todo tipo (numéricos, calculados por fórmula, texto, imagen y documento) con validación por el químico
- Alerta visual de valores críticos con confirmación obligatoria al validar
- **Tablero visual (Kanban)** con todas las órdenes activas y alertas de tiempo a los 45 y 90 minutos
- Entrega de resultados: PDF oficial, correo electrónico y **portal del paciente** con código QR (con verificación de fecha de nacimiento)
- Control de caja: apertura, cierre, corte por método de pago y detalle por vendedor
- Reportes básicos de ventas y tablero de indicadores del día
- Bitácora de auditoría de los eventos importantes del sistema

**Nota sobre facturación:** durante la Fase 1, la emisión de facturas continúa por el canal contable actual del laboratorio. La facturación electrónica integrada (CFDI 4.0) se incorpora en la Fase 2 como módulo adicional.

### Calendario semanal

| Semanas | Entregable |
|---------|-----------|
| 1–2 | Fundamentos del sistema (accesos y perfiles) y **visita de descubrimiento**: confirmación de personal, volumen diario y equipos |
| 3–5 | Catálogos de configuración: estudios, analitos, valores de referencia, paquetes y plantilla de PDF |
| 5–7 | Pacientes, órdenes, pagos, folio/ticket y apertura de caja |
| 8–10 | Captura de resultados (todos los tipos), cálculos y validación |
| 10–12 | Tablero Kanban y tablero de indicadores |
| 12–13 | Entrega de resultados: PDF, correo y portal del paciente |
| 13–14 | Control de caja completo, reportes básicos y bitácora de auditoría |
| 15–16 | Pruebas con el personal del laboratorio, carga de catálogos y capacitación |
| 17 | **Puesta en marcha** con acompañamiento intensivo |

### Punto de revisión intermedio

En la **semana 8** se realizará una demostración de avance con el laboratorio. Si algún ajuste de alcance resultara necesario, se acordará en conjunto en ese momento — nunca de forma unilateral.

### Qué necesitamos del laboratorio

- **Semana 1:** una visita de trabajo para conocer la operación diaria, el personal y los equipos
- **Semanas 3–5:** la información de catálogos (lista de estudios, precios y valores de referencia)
- **Semanas 15–16:** disponibilidad del personal para pruebas y capacitación

### Regla de cambios

Para proteger la fecha de entrega, cualquier funcionalidad nueva que se solicite durante la Fase 1 se **intercambia** por una de alcance equivalente (no se suma). Las primeras candidatas a intercambio, si el laboratorio lo prefiere, son cotizaciones y mensajería por WhatsApp, hoy planeadas para la Fase 2.

---

## Fase 2 — Plataforma ampliada (~14 semanas, estimado)

El calendario definitivo se acordará al cierre de la Fase 1, con lo aprendido en la operación real.

| Semanas | Entregable |
|---------|-----------|
| 1–4 | Infraestructura de la plataforma en la nube y acceso por subdominio propio |
| 5–8 | WhatsApp (envío de resultados y avisos), cotizaciones, convenios con empresas y comisiones de médicos |
| 9–11 | Interfaz con equipos de laboratorio (importación automática de resultados) y reportes completos con gráficas |
| 12–14 | Inventario de reactivos, soporte multisucursal, **facturación electrónica CFDI 4.0** y ajuste de valores de referencia por altitud |

Incluye además: umbrales de alerta configurables en el tablero, permisos por módulo, notificaciones al paciente y firma digital de recibido.

---

## Fase 3 — Visión a futuro

Agenda de citas, módulo de imagenología, integraciones con expedientes clínicos y aplicaciones móviles. Se priorizará según las necesidades del laboratorio después de la Fase 2.

---

*Documento informativo de planeación. Los alcances detallados constan en el documento de requerimientos del proyecto.*
