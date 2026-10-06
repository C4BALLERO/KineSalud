import { z } from 'zod';
import { CLIENT_STATUSES } from './enums';
import { toDateKey } from './time';

/** Departamentos de expedición del carnet de identidad boliviano. */
export const CI_EXTENSIONS = ['LP', 'CB', 'SC', 'OR', 'PT', 'CH', 'TJ', 'BE', 'PD'] as const;
export type CiExtension = (typeof CI_EXTENSIONS)[number];

export const CI_EXTENSION_LABELS: Record<CiExtension, string> = {
  LP: 'La Paz',
  CB: 'Cochabamba',
  SC: 'Santa Cruz',
  OR: 'Oruro',
  PT: 'Potosí',
  CH: 'Chuquisaca',
  TJ: 'Tarija',
  BE: 'Beni',
  PD: 'Pando',
};

/** Texto sin tildes, en minúsculas y con espacios simples (búsqueda y orden). */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** CI en mayúsculas y sin espacios ni guiones: "1234567-1a" → "12345671A". */
export function normalizeCi(ci: string): string {
  return ci.toUpperCase().replace(/[\s-]/g, '');
}

/** Teléfono solo con dígitos, sin el prefijo de país. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('591') && digits.length > 8 ? digits.slice(3) : digits;
}

const MAX_PREFIX = 15;

function prefixes(word: string): string[] {
  const out: string[] = [];
  for (let i = 1; i <= Math.min(word.length, MAX_PREFIX); i++) out.push(word.slice(0, i));
  return out;
}

/**
 * Palabras clave para buscar con `array-contains`: prefijos de cada palabra
 * del nombre y apellidos, del CI y del teléfono. Firestore no tiene búsqueda
 * de texto completo; esto cubre "empieza por" para cada dato.
 */
export function buildClientSearchKeywords(input: {
  firstName: string;
  lastName: string;
  ci: string;
  phone: string;
}): string[] {
  const words = normalizeSearchText(`${input.firstName} ${input.lastName}`)
    .split(' ')
    .filter((w) => w.length > 0);
  const keywords = new Set<string>();
  for (const w of words) prefixes(w).forEach((p) => keywords.add(p));
  prefixes(normalizeCi(input.ci).toLowerCase()).forEach((p) => keywords.add(p));
  prefixes(normalizePhone(input.phone)).forEach((p) => keywords.add(p));
  return [...keywords];
}

/** Término a enviar a Firestore: la primera palabra, normalizada y recortada. */
export function searchTermFor(query: string): string | null {
  const first = normalizeSearchText(query).split(' ')[0] ?? '';
  const cleaned = /^[\d-]+$/.test(first) ? first.replace(/-/g, '') : first;
  return cleaned.length > 0 ? cleaned.slice(0, MAX_PREFIX) : null;
}

/* ---------- Validación (misma en la web y en Cloud Functions) ---------- */

/** Texto opcional: '' se guarda como null. */
export const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null);

/** Nombres o apellidos de una persona. */
export const nameSchema = (emptyMessage: string) =>
  z
    .string({ error: emptyMessage })
    .trim()
    .min(1, emptyMessage)
    .min(2, 'Debe tener al menos 2 letras.')
    .max(60, 'Máximo 60 caracteres.')
    .regex(/^[\p{L}][\p{L} .'-]*$/u, 'Usa solo letras, espacios, puntos o guiones.');

export const clientInputSchema = z.object({
  firstName: nameSchema('Ingresa los nombres.'),
  lastName: nameSchema('Ingresa los apellidos.'),
  ci: z
    .string({ error: 'Ingresa el número de carnet.' })
    .trim()
    .min(1, 'Ingresa el número de carnet.')
    .transform(normalizeCi)
    .pipe(
      z
        .string()
        .regex(
          /^\d{4,10}[0-9A-Z]{0,2}$/,
          'El carnet debe tener entre 4 y 10 dígitos (y complemento opcional).',
        ),
    ),
  ciExt: z.enum(CI_EXTENSIONS).nullable().default(null),
  phone: z
    .string({ error: 'Ingresa un teléfono.' })
    .trim()
    .min(1, 'Ingresa un teléfono.')
    .transform(normalizePhone)
    .pipe(z.string().regex(/^[2-7]\d{6,7}$/, 'Ingresa un celular de 8 dígitos o un fijo de 7.')),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === '' ? null : v))
    .pipe(z.email('Ingresa un correo electrónico válido.').nullable())
    .nullable()
    .default(null),
  birthDate: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .pipe(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida.')
        .refine((v) => v >= '1900-01-01', 'Revisa el año de nacimiento.')
        .refine((v) => v <= toDateKey(new Date()), 'La fecha de nacimiento no puede ser futura.')
        .nullable(),
    )
    .nullable()
    .default(null),
  address: optionalText(200, 'Máximo 200 caracteres.'),
  adminNotes: optionalText(1000, 'Máximo 1000 caracteres.'),
});
export type ClientInput = z.input<typeof clientInputSchema>;
export type ClientData = z.output<typeof clientInputSchema>;

export const createClientInputSchema = clientInputSchema;

export const updateClientInputSchema = clientInputSchema.extend({
  clientId: z.string().trim().min(1).max(128),
});
export type UpdateClientInput = z.input<typeof updateClientInputSchema>;

export const setClientStatusInputSchema = z.object({
  clientId: z.string().trim().min(1).max(128),
  status: z.enum(CLIENT_STATUSES),
});
export type SetClientStatusInput = z.input<typeof setClientStatusInputSchema>;

export interface CreateClientResult {
  clientId: string;
  /**
   * El profesional registró un carnet que ya existía con el mismo nombre: no se
   * duplicó, se lo agregó a sus pacientes.
   */
  linked?: boolean;
}

/** Edad cumplida a una fecha dada (ambas `YYYY-MM-DD`). */
export function ageOn(birthDate: string, day: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = day.split('-').map(Number);
  let age = y! - by!;
  if (m! < bm! || (m === bm && d! < bd!)) age -= 1;
  return age;
}
