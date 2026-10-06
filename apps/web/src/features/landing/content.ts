/**
 * Datos públicos del consultorio para la página de presentación.
 * Fuente: página de Facebook y ficha de Google Maps del consultorio
 * (dirección, celular y correo publicados por el propio consultorio).
 * El horario es el configurado en el sistema; si cambia en Configuración,
 * actualízalo también aquí.
 */
export const CLINIC = {
  name: 'Kinesalud y Vida',
  city: 'Cochabamba, Bolivia',
  address: 'Av. Simón López, calle Luis Humberto Baya',
  plusCode: 'JRV7+5GC',
  coordinates: { lat: -17.3570588, lng: -66.1862205 },
  phone: '77442133',
  phoneE164: '+59177442133',
  email: 'kinesaludyvida@gmail.com',
  facebook: 'https://www.facebook.com/kinesaludyvida',
  mapsPlace: 'https://maps.app.goo.gl/4sgnj5pDkFyeTQ16A',
  hours: [
    { days: 'Lunes a viernes', ranges: ['08:00 – 13:00', '14:30 – 19:00'] },
    { days: 'Sábado', ranges: ['08:00 – 13:00'] },
    { days: 'Domingo', ranges: ['Cerrado'] },
  ],
} as const;

const WHATSAPP_MESSAGE = 'Hola, quisiera agendar una cita en Kinesalud y Vida.';

export const LINKS = {
  whatsapp: `https://wa.me/${CLINIC.phoneE164.replace('+', '')}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`,
  call: `tel:${CLINIC.phoneE164}`,
  email: `mailto:${CLINIC.email}`,
  directions: `https://www.google.com/maps/dir/?api=1&destination=${CLINIC.coordinates.lat},${CLINIC.coordinates.lng}`,
  mapEmbed: `https://www.google.com/maps?q=${CLINIC.coordinates.lat},${CLINIC.coordinates.lng}&z=17&output=embed`,
} as const;

export const SERVICES = [
  {
    key: 'fisioterapia',
    title: 'Fisioterapia',
    description:
      'Tratamiento del dolor y de lesiones musculares y articulares, con terapia manual y fisioterapia instrumental como la electroterapia.',
    tone: 'fisioterapia',
  },
  {
    key: 'rehabilitacion',
    title: 'Rehabilitación',
    description:
      'Recupera fuerza y movilidad después de una lesión, una cirugía o un tiempo de inactividad, con un plan de ejercicios guiado sesión a sesión.',
    tone: 'rehabilitacion',
  },
  {
    key: 'estetica',
    title: 'Estética',
    description:
      'Tratamientos corporales y faciales pensados para tu bienestar, en un espacio tranquilo y con atención personalizada.',
    tone: 'estetica',
  },
] as const;

/** Cómo trabajamos: lo que de verdad hace el consultorio con su sistema. */
export const STEPS = [
  {
    title: 'Evaluación',
    text: 'Escuchamos lo que te pasa y evaluamos tu caso antes de empezar.',
  },
  {
    title: 'Plan a tu medida',
    text: 'Definimos objetivos y la cantidad de sesiones que necesitas.',
  },
  {
    title: 'Seguimiento',
    text: 'Registramos tu evolución en cada sesión, incluido tu nivel de dolor.',
  },
  {
    title: 'Te recordamos tu cita',
    text: 'Te contactamos antes de cada sesión para confirmar tu horario.',
  },
] as const;
