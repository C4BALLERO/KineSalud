/**
 * Punto de entrada de Cloud Functions.
 *
 * Estructura (ver docs/arquitectura.md):
 * - api/callable   adaptadores para la web (auth + validación + dominio)
 * - domain/        servicios de negocio independientes del transporte
 * - triggers/      reacciones a cambios en Firestore
 * - scheduled/     tareas programadas (cola de recordatorios)
 * - notifications/ canales de notificación desacoplados
 * - integrations/  punto de anclaje para el chatbot (etapa 2, vacío en v1)
 */
import './core/config';

export * as clients from './api/callable/clients';
export * as settings from './api/callable/settings';
export * as staff from './api/callable/staff';
export * as users from './api/callable/users';
