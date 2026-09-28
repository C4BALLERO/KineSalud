// Generador de datos operativos de demostración (solo emuladores).
// Las fechas se calculan respecto de "hoy" en America/La_Paz, así el
// dashboard y la agenda siempre muestran actividad reciente y futura.

/* ---------- Fechas del consultorio (UTC−4 fijo, sin horario de verano) ---------- */
const OFFSET = '-04:00';
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/La_Paz',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const toDateKey = (d) => dayKeyFormat.format(d);
const parseKey = (k) => new Date(`${k}T00:00:00Z`);
export const addDays = (k, n) => {
  const d = parseKey(k);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const weekdayOf = (k) => WEEKDAYS[(parseKey(k).getUTCDay() + 6) % 7];
const at = (k, hhmm) => new Date(`${k}T${hhmm}:00${OFFSET}`);
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fromMinutes = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/* ---------- Aleatoriedad reproducible (mulberry32) ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Catálogos ---------- */
export const ROOMS = {
  'sala-camilla-1': {
    name: 'Camilla 1',
    kind: 'CAMILLA',
    capacity: 1,
    allowedCategories: ['FISIOTERAPIA', 'REHABILITACION'],
    active: true,
  },
  'sala-camilla-2': {
    name: 'Camilla 2',
    kind: 'CAMILLA',
    capacity: 1,
    allowedCategories: ['FISIOTERAPIA', 'REHABILITACION'],
    active: true,
  },
  'sala-gimnasio': {
    name: 'Gimnasio',
    kind: 'GIMNASIO',
    capacity: 1,
    allowedCategories: ['REHABILITACION'],
    active: true,
  },
  'sala-estetica': {
    name: 'Cabina de estética',
    kind: 'CABINA_ESTETICA',
    capacity: 1,
    allowedCategories: ['ESTETICA'],
    active: true,
  },
};

export const SERVICES = {
  'srv-fisio-lumbar': {
    name: 'Fisioterapia lumbar',
    category: 'FISIOTERAPIA',
    durationMin: 45,
    bufferMin: 15,
    defaultSessions: 10,
    roomKinds: ['CAMILLA'],
    active: true,
  },
  'srv-fisio-cervical': {
    name: 'Fisioterapia cervical',
    category: 'FISIOTERAPIA',
    durationMin: 45,
    bufferMin: 15,
    defaultSessions: 8,
    roomKinds: ['CAMILLA'],
    active: true,
  },
  'srv-rehab-rodilla': {
    name: 'Rehabilitación de rodilla',
    category: 'REHABILITACION',
    durationMin: 60,
    bufferMin: 0,
    defaultSessions: 12,
    roomKinds: ['GIMNASIO', 'CAMILLA'],
    active: true,
  },
  'srv-rehab-hombro': {
    name: 'Rehabilitación de hombro',
    category: 'REHABILITACION',
    durationMin: 60,
    bufferMin: 0,
    defaultSessions: 10,
    roomKinds: ['GIMNASIO', 'CAMILLA'],
    active: true,
  },
  'srv-est-facial': {
    name: 'Limpieza facial profunda',
    category: 'ESTETICA',
    durationMin: 60,
    bufferMin: 0,
    defaultSessions: 1,
    roomKinds: ['CABINA_ESTETICA'],
    active: true,
  },
  'srv-est-drenaje': {
    name: 'Drenaje linfático',
    category: 'ESTETICA',
    durationMin: 60,
    bufferMin: 0,
    defaultSessions: 8,
    roomKinds: ['CABINA_ESTETICA'],
    active: true,
  },
  'srv-est-reductor': {
    name: 'Masaje reductor',
    category: 'ESTETICA',
    durationMin: 60,
    bufferMin: 0,
    defaultSessions: 10,
    roomKinds: ['CABINA_ESTETICA'],
    active: true,
  },
};

const morning = [{ start: '08:00', end: '12:00' }];
const full = [
  { start: '08:00', end: '12:00' },
  { start: '14:30', end: '18:30' },
];
const esthetic = [
  { start: '09:00', end: '13:00' },
  { start: '15:00', end: '19:00' },
];
const afternoon = [{ start: '14:30', end: '18:30' }];

export const PROFESSIONALS = {
  'prof-ana': {
    title: 'Lic.',
    firstName: 'Ana',
    lastName: 'Gutiérrez',
    displayName: 'Lic. Ana Gutiérrez',
    specialties: ['Fisioterapia'],
    categories: ['FISIOTERAPIA'],
    serviceIds: ['srv-fisio-lumbar', 'srv-fisio-cervical'],
    phone: '70712345',
    active: true,
    userId: 'demo-admin',
    weeklySchedule: { mon: morning, tue: morning, wed: morning, thu: morning, fri: morning },
  },
  'prof-diego': {
    title: 'Lic.',
    firstName: 'Diego',
    lastName: 'Pérez',
    displayName: 'Lic. Diego Pérez',
    specialties: ['Fisioterapia', 'Rehabilitación'],
    categories: ['FISIOTERAPIA', 'REHABILITACION'],
    serviceIds: ['srv-fisio-lumbar', 'srv-fisio-cervical', 'srv-rehab-rodilla', 'srv-rehab-hombro'],
    phone: '71234567',
    active: true,
    userId: 'demo-fisio',
    weeklySchedule: { mon: full, tue: full, wed: full, thu: full, fri: full, sat: morning },
  },
  'prof-carla': {
    title: 'Lic.',
    firstName: 'Carla',
    lastName: 'Vargas',
    displayName: 'Lic. Carla Vargas',
    specialties: ['Estética'],
    categories: ['ESTETICA'],
    serviceIds: ['srv-est-facial', 'srv-est-drenaje', 'srv-est-reductor'],
    phone: '76543210',
    active: true,
    userId: 'demo-estetica',
    weeklySchedule: {
      mon: esthetic,
      tue: esthetic,
      wed: esthetic,
      thu: esthetic,
      fri: esthetic,
      sat: [{ start: '09:00', end: '13:00' }],
    },
  },
  'prof-jorge': {
    title: 'Lic.',
    firstName: 'Jorge',
    lastName: 'Quispe',
    displayName: 'Lic. Jorge Quispe',
    specialties: ['Rehabilitación'],
    categories: ['REHABILITACION'],
    serviceIds: ['srv-rehab-rodilla', 'srv-rehab-hombro'],
    phone: '72345678',
    active: true,
    userId: null,
    weeklySchedule: { mon: afternoon, wed: afternoon, fri: afternoon },
  },
};

const CLIENT_NAMES = [
  ['Carla', 'Rojas Vda.'],
  ['Luis', 'Mamani Choque'],
  ['María', 'Fernández López'],
  ['José', 'Quiroga Arce'],
  ['Rosa', 'Condori Flores'],
  ['Andrés', 'Villarroel Paz'],
  ['Gabriela', 'Salazar Rivero'],
  ['Miguel', 'Torrico Vargas'],
  ['Patricia', 'Claros Méndez'],
  ['Fernando', 'Guzmán Soria'],
  ['Lucía', 'Arnez Camacho'],
  ['Ricardo', 'Montaño Zurita'],
  ['Valeria', 'Céspedes Rocha'],
  ['Jorge', 'Ayala Heredia'],
  ['Daniela', 'Ortuño Pinto'],
  ['Sergio', 'Balderrama Ruiz'],
];

function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
function prefixes(word) {
  const w = normalize(word);
  const out = [];
  for (let i = 1; i <= Math.min(w.length, 15); i++) out.push(w.slice(0, i));
  return out;
}

/* ---------- Generación ---------- */
export function buildDemoData(now = new Date()) {
  const random = rng(20260927);
  const pick = (arr) => arr[Math.floor(random() * arr.length)];
  const today = toDateKey(now);

  const clients = {};
  CLIENT_NAMES.forEach(([firstName, lastName], i) => {
    const id = `cli-${String(i + 1).padStart(2, '0')}`;
    const ci = String(3400000 + i * 73519);
    const phone = `7${String(1000000 + i * 381277).slice(0, 7)}`;
    clients[id] = {
      firstName,
      lastName,
      ci,
      ciExt: 'CB',
      phone,
      phoneE164: `+591${phone}`,
      email:
        i % 3 === 0
          ? `${normalize(firstName)}.${normalize(lastName.split(' ')[0])}@correo.bo`
          : null,
      birthDate: `${1960 + ((i * 7) % 40)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(3 + i).padStart(2, '0')}`,
      address: 'Cochabamba',
      adminNotes: null,
      status: i === 15 ? 'INACTIVO' : 'ACTIVO',
      assignedProfessionalIds: [],
      searchKeywords: [
        ...new Set([
          ...prefixes(firstName),
          ...lastName.split(' ').flatMap(prefixes),
          ...prefixes(ci),
          ...prefixes(phone),
        ]),
      ],
      lastNameLower: normalize(`${lastName} ${firstName}`),
      stats: { lastVisitAt: null, activeTreatments: 0, noShowCount: 0 },
      createdAt: at(addDays(today, -60 + i * 2), '10:00'),
      createdBy: 'demo-recepcion',
      updatedAt: at(addDays(today, -60 + i * 2), '10:00'),
    };
  });
  // Índice de CI único (el mismo que mantiene la Cloud Function).
  const clientCiIndex = Object.fromEntries(
    Object.entries(clients).map(([id, c]) => [c.ci, { clientId: id }]),
  );

  const assign = (clientId, profId) => {
    const list = clients[clientId].assignedProfessionalIds;
    if (!list.includes(profId)) list.push(profId);
  };

  // Tratamientos: varios cerca de terminar para alimentar las alertas.
  const treatmentPlan = [
    ['cli-01', 'prof-diego', 'srv-fisio-lumbar', 10, 8],
    ['cli-02', 'prof-jorge', 'srv-rehab-rodilla', 12, 11],
    ['cli-03', 'prof-carla', 'srv-est-drenaje', 8, 3],
    ['cli-04', 'prof-diego', 'srv-rehab-hombro', 10, 5],
    ['cli-05', 'prof-ana', 'srv-fisio-cervical', 8, 7],
    ['cli-06', 'prof-carla', 'srv-est-reductor', 10, 2],
    ['cli-07', 'prof-diego', 'srv-rehab-rodilla', 12, 4],
    ['cli-08', 'prof-ana', 'srv-fisio-lumbar', 10, 9],
    ['cli-09', 'prof-jorge', 'srv-rehab-hombro', 10, 6],
  ];
  const treatments = {};
  treatmentPlan.forEach(([clientId, profId, srvId, planned, done], i) => {
    const id = `trt-${String(i + 1).padStart(2, '0')}`;
    const c = clients[clientId];
    const s = SERVICES[srvId];
    treatments[id] = {
      clientId,
      clientName: `${c.firstName} ${c.lastName}`,
      professionalId: profId,
      professionalName: PROFESSIONALS[profId].displayName,
      serviceId: srvId,
      serviceName: s.name,
      category: s.category,
      startDate: addDays(today, -(done * 4 + 3)),
      plannedSessions: planned,
      completedSessions: done,
      status: 'ACTIVO',
      nextAppointmentAt: null,
      lastSessionAt: at(addDays(today, -2), '10:00'),
    };
    c.stats.activeTreatments += 1;
    assign(clientId, profId);
  });
  // Un tratamiento finalizado, para el historial.
  treatments['trt-10'] = {
    ...treatments['trt-03'],
    clientId: 'cli-10',
    clientName: 'Fernando Guzmán Soria',
    plannedSessions: 1,
    completedSessions: 1,
    serviceId: 'srv-est-facial',
    serviceName: SERVICES['srv-est-facial'].name,
    status: 'FINALIZADO',
  };
  assign('cli-10', treatments['trt-10'].professionalId);

  const treatmentsByProf = {};
  for (const [id, t] of Object.entries(treatments)) {
    if (t.status !== 'ACTIVO') continue;
    (treatmentsByProf[t.professionalId] ??= []).push(id);
  }

  // Citas: desde el lunes de esta semana hasta 7 días después de hoy.
  const monday = addDays(today, -WEEKDAYS.indexOf(weekdayOf(today)));
  const lastDay = addDays(today, 7);
  const appointments = {};
  const busy = { room: new Map(), clientDay: new Set() };
  const nowMs = now.getTime();
  let seq = 0;

  for (let day = monday; day <= lastDay; day = addDays(day, 1)) {
    const wd = weekdayOf(day);
    for (const [profId, prof] of Object.entries(PROFESSIONALS)) {
      for (const block of prof.weeklySchedule[wd] ?? []) {
        let t = toMinutes(block.start);
        const end = toMinutes(block.end);
        while (t + 45 <= end) {
          const occupancy = day === today || day === addDays(today, 1) ? 0.75 : 0.55;
          if (random() > occupancy) {
            t += 60;
            continue;
          }
          // Preferir clientes con tratamiento activo con este profesional.
          const ownTreatments = treatmentsByProf[profId] ?? [];
          const treatmentId = ownTreatments.length && random() < 0.7 ? pick(ownTreatments) : null;
          const srvId = treatmentId ? treatments[treatmentId].serviceId : pick(prof.serviceIds);
          const clientId = treatmentId
            ? treatments[treatmentId].clientId
            : pick(Object.keys(clients).filter((c) => clients[c].status === 'ACTIVO'));
          const s = SERVICES[srvId];
          const startMin = t;
          const endMin = t + s.durationMin;
          if (endMin > end) break;

          // El espacio queda ocupado durante la cita y su preparación.
          const blockEnd = endMin + s.bufferMin;
          const roomFree = (rid) =>
            !(busy.room.get(`${rid}|${day}`) ?? []).some(([a, b]) => startMin < b && a < blockEnd);
          const room = Object.entries(ROOMS).find(
            ([rid, r]) =>
              s.roomKinds.includes(r.kind) &&
              r.allowedCategories.includes(s.category) &&
              roomFree(rid),
          );
          // Un cliente tiene como máximo una cita por día.
          if (!room || busy.clientDay.has(`${clientId}|${day}`)) {
            t += 60;
            continue;
          }
          const roomKey = `${room[0]}|${day}`;
          busy.room.set(roomKey, [...(busy.room.get(roomKey) ?? []), [startMin, blockEnd]]);
          busy.clientDay.add(`${clientId}|${day}`);

          const startAt = at(day, fromMinutes(startMin));
          const endAt = at(day, fromMinutes(endMin));
          const r = random();
          let status;
          if (endAt.getTime() < nowMs) {
            status = r < 0.8 ? 'ATENDIDA' : r < 0.9 ? 'NO_ASISTIO' : 'CANCELADA';
            // Algunas citas de hoy ya pasadas quedan sin registrar asistencia (alerta).
            if (day === today && r > 0.7) status = 'CONFIRMADA';
          } else if (day === addDays(today, 1)) {
            status = r < 0.6 ? 'PENDIENTE' : r < 0.95 ? 'CONFIRMADA' : 'CANCELADA';
          } else {
            status = r < 0.6 ? 'CONFIRMADA' : r < 0.93 ? 'PENDIENTE' : 'CANCELADA';
          }

          const c = clients[clientId];
          if (status === 'NO_ASISTIO') c.stats.noShowCount += 1;
          assign(clientId, profId);

          const id = `apt-${String(++seq).padStart(4, '0')}`;
          appointments[id] = {
            clientId,
            clientName: `${c.firstName} ${c.lastName}`,
            professionalId: profId,
            professionalName: prof.displayName,
            roomId: room[0],
            roomName: room[1].name,
            serviceId: srvId,
            serviceName: s.name,
            category: s.category,
            treatmentId,
            sessionNumber: treatmentId ? treatments[treatmentId].completedSessions + 1 : null,
            date: day,
            startAt,
            endAt,
            status,
            source: 'WEB',
            cancelReason: status === 'CANCELADA' ? 'Solicitud del cliente' : null,
            bufferMin: s.bufferMin,
            notes: null,
            createdBy: 'demo-recepcion',
            createdAt: now,
            updatedAt: now,
          };
          t += s.durationMin + s.bufferMin;
        }
      }
    }
  }

  const clinicDay = [
    { start: '08:00', end: '13:00' },
    { start: '14:30', end: '19:00' },
  ];
  const settings = {
    clinic: {
      name: 'Kinesalud y Vida',
      timezone: 'America/La_Paz',
      slotMinutes: 15,
      reminderLeadHours: 24,
      // Cubre los horarios de todo el personal (estética atiende hasta las 19:00).
      openingHours: {
        mon: clinicDay,
        tue: clinicDay,
        wed: clinicDay,
        thu: clinicDay,
        fri: clinicDay,
        sat: [{ start: '08:00', end: '13:00' }],
      },
    },
  };

  // Ausencias futuras (después del rango de citas generado, para no dejar citas en conflicto).
  const professionalExceptions = {
    'exc-jorge-vacaciones': {
      professionalId: 'prof-jorge',
      type: 'VACACIONES',
      dateFrom: addDays(today, 10),
      dateTo: addDays(today, 16),
      note: 'Vacaciones de fin de gestión',
      createdAt: now,
      createdBy: 'demo-admin',
    },
    'exc-carla-permiso': {
      professionalId: 'prof-carla',
      type: 'PERMISO',
      dateFrom: addDays(today, 9),
      dateTo: addDays(today, 9),
      note: 'Capacitación en drenaje linfático',
      createdAt: now,
      createdBy: 'demo-admin',
    },
  };

  return {
    settings,
    rooms: ROOMS,
    services: SERVICES,
    professionals: PROFESSIONALS,
    professionalExceptions,
    clients,
    clientCiIndex,
    treatments,
    appointments,
  };
}
