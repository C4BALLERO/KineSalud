# Errores frecuentes

1. **Escribir en Firestore desde la web.** Las reglas niegan toda escritura de negocio. Cada cambio pasa por una callable (`functions/src/api/callable`), que valida con el esquema zod de `packages/shared`, autoriza (`requirePermission` / `requireClinicWide` / `requireRecordAccess`) y audita.
2. **Duplicar reglas de negocio.** Una regla que usan la web y el servidor (disponibilidad, estados, montos, permisos) va en `packages/shared` con sus pruebas, no copiada en cada lado.
3. **Consultas del PROFESIONAL sin filtrar por su ficha.** Las reglas rechazan una consulta que pueda devolver datos ajenos: debe llevar `where('professionalId', '==', …)` (o `array-contains` en clientes).
4. **Fechas y montos.** Hora del consultorio `America/La_Paz` (UTC−4), días como `DateKey` `'YYYY-MM-DD'` (`toDateKey`, `clinicDateTime`). Los montos van en **centavos enteros** (`parseMoney`, `formatMoney`). `Intl` separa "Bs" del monto con un espacio que no se corta: en las pruebas, los nombres accesibles lo conservan; `getByText` lo normaliza.
5. **Transacciones de Firestore.** Todas las lecturas van antes de las escrituras. Las reservas usan el candado `scheduleLocks/{fecha}` y la caja usa `cashRegister/main`. Los resúmenes de reportes se recalculan completos, nunca con incrementos sueltos.
6. **Herramientas en Windows.**
   - Los heredocs largos de Bash fallan: escribir los archivos con el editor o con scripts en la carpeta temporal.
   - El editor de archivos convierte las secuencias de escape del espacio duro y del BOM en caracteres invisibles reales (que ESLint rechaza): usar `String.fromCharCode(0xa0)` o `String.fromCharCode(0xfeff)`.
   - Vitest a veces no levanta hilos con carga alta: reintentar o usar `--pool=forks`.
   - Los emuladores necesitan el JDK 21 en el PATH y ocupan el 8080: `test:rules` y `test:integration` no corren mientras están levantados.
