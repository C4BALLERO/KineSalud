import {
  CalendarCheck,
  Clock,
  HeartPulse,
  LogIn,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Sparkles,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/features/auth/session';
import { cn } from '@/utils/cn';
import { CLINIC, LINKS, SERVICES, STEPS } from './content';
import './landing.css';

const SERVICE_ICONS: Record<(typeof SERVICES)[number]['tone'], LucideIcon> = {
  fisioterapia: Activity,
  rehabilitacion: HeartPulse,
  estetica: Sparkles,
};
const SERVICE_TONES: Record<(typeof SERVICES)[number]['tone'], string> = {
  fisioterapia: 'lp-icon-tile',
  rehabilitacion: 'lp-icon-tile',
  estetica: 'lp-icon-tile',
};

const NAV = [
  { href: '#servicios', label: 'Servicios' },
  { href: '#nosotros', label: 'Nosotros' },
  { href: '#ubicacion', label: 'Ubicación' },
  { href: '#contacto', label: 'Contacto' },
];

const HEADLINE = ['Recupera', 'tu', 'movimiento,', 'cuida', 'tu', 'bienestar'];
const MARQUEE = [
  'Fisioterapia',
  'Rehabilitación',
  'Estética',
  'Electroterapia',
  'Terapia manual',
  'Ejercicio guiado',
  'Seguimiento de tu evolución',
];

const vars = (values: Record<string, number>) => values as CSSProperties;

/**
 * Página pública del consultorio (portada). Presentación, servicios, sobre
 * nosotros, ubicación con mapa y contacto. El personal entra al sistema desde
 * "Acceso del personal". El video de portada se hizo con HyperFrames
 * (videos/kinesalud-hero).
 */
export function LandingPage() {
  const { status } = useSession();
  const root = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const signedIn = status === 'signed-in';

  // Aparición al hacer scroll: cada bloque con data-reveal entra una sola vez.
  useEffect(() => {
    const nodes = root.current?.querySelectorAll<HTMLElement>('[data-reveal]') ?? [];
    if (typeof IntersectionObserver === 'undefined') {
      nodes.forEach((n) => n.setAttribute('data-revealed', ''));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute('data-revealed', '');
          observer.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  // El fondo del documento acompaña la estética (rebote del scroll, barras nativas).
  useEffect(() => {
    document.documentElement.setAttribute('data-landing', '');
    return () => document.documentElement.removeAttribute('data-landing');
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={root} className="lp min-h-dvh text-fg">
      <div aria-hidden="true" className="lp-ambient">
        <span className="lp-blob lp-blob-a" />
        <span className="lp-blob lp-blob-b" />
        <span className="lp-blob lp-blob-c" />
      </div>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>

      {/* ---------- Navegación ---------- */}
      <header
        data-scrolled={scrolled ? '' : undefined}
        className="lp-nav sticky top-0 z-40 border-b border-transparent"
      >
        <nav
          aria-label="Principal"
          className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6"
        >
          <a href="#inicio" aria-label="Kinesalud y Vida — inicio" className="rounded-md">
            <Logo size="sm" />
          </a>
          <ul className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="rounded-md px-3 py-2 text-body-sm font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <Button asChild variant={signedIn ? 'primary' : 'secondary'} size="sm">
            <Link to={signedIn ? '/inicio' : '/login'}>
              <LogIn aria-hidden="true" />
              {signedIn ? 'Ir al sistema' : 'Acceso del personal'}
            </Link>
          </Button>
        </nav>
      </header>

      <main id="contenido">
        {/* ---------- Portada ---------- */}
        <section id="inicio" className="relative overflow-hidden">
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 md:grid-cols-[1.1fr_1fr] md:px-6 md:pt-16 md:pb-24">
            <div className="flex flex-col gap-6">
              <p className="lp-eyebrow inline-flex w-fit items-center gap-2 rounded-full border border-primary-border bg-primary-subtle px-3 py-1 text-caption font-semibold text-primary">
                <span aria-hidden="true" className="lp-dot" />
                Fisioterapia · Rehabilitación · Estética
              </p>
              <h1 className="text-[2.5rem] leading-[1.08] font-bold tracking-tight text-fg md:text-[3.5rem]">
                {HEADLINE.map((w, i) => (
                  // El espacio va fuera del bloque animado: dentro de un inline-block se pierde.
                  <Fragment key={i}>
                    <span className="lp-word" style={vars({ '--i': i })}>
                      {i === 2 || i === 5 ? <span className="lp-gradient-text">{w}</span> : w}
                    </span>
                    {i < HEADLINE.length - 1 ? ' ' : ''}
                  </Fragment>
                ))}
              </h1>
              <p
                className="lp-fade max-w-xl text-body text-fg-muted md:text-[1.0625rem] md:leading-7"
                style={vars({ '--i': 7 })}
              >
                En Kinesalud y Vida te acompañamos con un plan de tratamiento a tu medida y un
                seguimiento cercano de tu evolución, sesión a sesión, en {CLINIC.city}.
              </p>
              <div className="lp-fade flex flex-wrap gap-3" style={vars({ '--i': 9 })}>
                <Button asChild size="lg">
                  <a href={LINKS.whatsapp} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon />
                    Agenda por WhatsApp
                  </a>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <a href="#ubicacion">
                    <MapPin aria-hidden="true" />
                    Cómo llegar
                  </a>
                </Button>
              </div>
            </div>

            <div className="lp-hero-media relative mx-auto w-full max-w-md">
              <div className="lp-video-frame relative aspect-square overflow-hidden rounded-[2rem] border border-primary-border shadow-lg">
                <HeroVideo />
              </div>
              <span className="lp-chip lp-chip-a">
                <CalendarCheck aria-hidden="true" className="size-4 text-primary" />
                Atención con cita previa
              </span>
              <span className="lp-chip lp-chip-b">
                <MapPin aria-hidden="true" className="size-4 text-primary" />
                Cochabamba
              </span>
            </div>
          </div>

          {/* Cinta de especialidades */}
          <div
            aria-hidden="true"
            className="lp-glass relative overflow-hidden border-y border-border py-3"
          >
            <div className="lp-marquee-track flex w-max gap-10 pr-10 whitespace-nowrap">
              {[...MARQUEE, ...MARQUEE].map((m, i) => (
                <span
                  key={i}
                  className="flex items-center gap-10 text-body-sm font-semibold tracking-wide text-fg-muted uppercase"
                >
                  {m}
                  <span className="size-1.5 rounded-full bg-primary" />
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Servicios ---------- */}
        <Section
          id="servicios"
          eyebrow="Servicios"
          title="Tres áreas, un mismo cuidado"
          intro="Cada tratamiento empieza con una evaluación y un plan pensado para ti."
        >
          <ul className="grid gap-5 md:grid-cols-3">
            {SERVICES.map((s, i) => {
              const Icon = SERVICE_ICONS[s.tone];
              return (
                <li
                  key={s.key}
                  data-reveal
                  style={vars({ '--d': i })}
                  className="lp-card flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'lp-card-icon flex size-12 items-center justify-center rounded-xl',
                      SERVICE_TONES[s.tone],
                    )}
                  >
                    <Icon className="size-6" />
                  </span>
                  <h3 className="text-h2 text-fg">{s.title}</h3>
                  <p className="text-body-sm text-fg-muted">{s.description}</p>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* ---------- Cómo trabajamos ---------- */}
        <Section id="proceso" eyebrow="Cómo trabajamos" title="Tu recuperación, paso a paso" muted>
          <ol className="grid gap-5 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                data-reveal
                style={vars({ '--d': i })}
                className="relative flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5"
              >
                <span className="lp-step-number tabular" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-h3 text-fg">{s.title}</h3>
                <p className="text-body-sm text-fg-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* ---------- Sobre nosotros ---------- */}
        <Section id="nosotros" eyebrow="Sobre nosotros" title="Un centro de fisioterapia cercano">
          <div className="grid items-center gap-10 md:grid-cols-[1fr_1.1fr]">
            <div data-reveal className="lp-about-art relative mx-auto w-full max-w-sm">
              <Logo variant="brand" size="lg" className="relative z-10 h-auto w-full" />
            </div>
            <div className="flex flex-col gap-5">
              <p data-reveal className="text-body text-fg-muted md:text-[1.0625rem] md:leading-7">
                Kinesalud y Vida es un centro de fisioterapia, rehabilitación y estética en
                Cochabamba. Creemos que recuperar el movimiento cambia la vida de las personas, por
                eso trabajamos con un plan claro para cada paciente y le damos seguimiento en cada
                sesión.
              </p>
              <ul className="grid gap-3 sm:grid-cols-3">
                {[
                  { t: 'Cercanía', d: 'Te escuchamos y te explicamos cada paso.' },
                  { t: 'Profesionalismo', d: 'Licenciados en fisioterapia a tu cuidado.' },
                  { t: 'Constancia', d: 'Medimos tu evolución para ajustar el plan.' },
                ].map((v, i) => (
                  <li
                    key={v.t}
                    data-reveal
                    style={vars({ '--d': i + 1 })}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <p className="text-body-sm font-semibold text-primary">{v.t}</p>
                    <p className="mt-1 text-caption text-fg-muted">{v.d}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ---------- Ubicación ---------- */}
        <Section
          id="ubicacion"
          eyebrow="Ubicación"
          title="Encuéntranos en Cochabamba"
          intro={`${CLINIC.address}, ${CLINIC.city}.`}
          muted
        >
          <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
            <div
              data-reveal
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
            >
              <iframe
                title="Mapa de Kinesalud y Vida en Google Maps"
                src={LINKS.mapEmbed}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="lp-map block h-80 w-full md:h-full md:min-h-96"
              />
            </div>
            <div
              data-reveal
              style={vars({ '--d': 1 })}
              className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6"
            >
              <InfoRow icon={MapPin} title="Dirección">
                {CLINIC.address}
                <br />
                <span className="text-fg-subtle">
                  {CLINIC.city} · {CLINIC.plusCode}
                </span>
              </InfoRow>
              <InfoRow icon={Clock} title="Horario de atención">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  {CLINIC.hours.map((h) => (
                    <div key={h.days} className="contents">
                      <dt className="text-fg-muted">{h.days}</dt>
                      <dd className="tabular text-fg">{h.ranges.join(' · ')}</dd>
                    </div>
                  ))}
                </dl>
              </InfoRow>
              <div className="mt-auto flex flex-wrap gap-3">
                <Button asChild>
                  <a href={LINKS.directions} target="_blank" rel="noopener noreferrer">
                    <Navigation aria-hidden="true" />
                    Cómo llegar
                  </a>
                </Button>
                <Button asChild variant="secondary">
                  <a href={CLINIC.mapsPlace} target="_blank" rel="noopener noreferrer">
                    <MapPin aria-hidden="true" />
                    Ver en Google Maps
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Section>

        {/* ---------- Contacto ---------- */}
        <Section id="contacto" eyebrow="Contacto" title="Escríbenos o llámanos">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ContactCard
              index={0}
              href={LINKS.whatsapp}
              external
              icon={<WhatsAppIcon className="size-6" />}
              title="WhatsApp"
              detail={CLINIC.phone}
              cta="Agendar una cita"
              accent
            />
            <ContactCard
              index={1}
              href={LINKS.call}
              icon={<Phone aria-hidden="true" className="size-6" />}
              title="Llámanos"
              detail={CLINIC.phone}
              cta="Llamar"
            />
            <ContactCard
              index={2}
              href={LINKS.email}
              icon={<Mail aria-hidden="true" className="size-6" />}
              title="Correo"
              detail={CLINIC.email}
              cta="Escribir"
            />
            <ContactCard
              index={3}
              href={CLINIC.facebook}
              external
              icon={<FacebookIcon className="size-6" />}
              title="Facebook"
              detail="KINE Salud y Vida"
              cta="Seguirnos"
            />
          </ul>
        </Section>
      </main>

      {/* ---------- Pie ---------- */}
      <footer className="lp-footer relative border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-10 pb-24 md:flex-row md:items-center md:justify-between md:px-6 md:pr-24 md:pb-10">
          <div className="flex flex-col gap-2">
            <Logo size="sm" />
            <p className="text-caption text-fg-subtle">
              {CLINIC.address}, {CLINIC.city}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={CLINIC.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook de Kinesalud y Vida"
              className="lp-social"
            >
              <FacebookIcon className="size-5" />
            </a>
            <a
              href={LINKS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp de Kinesalud y Vida"
              className="lp-social"
            >
              <WhatsAppIcon className="size-5" />
            </a>
            <a href={LINKS.email} aria-label="Correo de Kinesalud y Vida" className="lp-social">
              <Mail aria-hidden="true" className="size-5" />
            </a>
            <Link
              to={signedIn ? '/inicio' : '/login'}
              className="ml-2 rounded-md px-3 py-2 text-body-sm font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
            >
              {signedIn ? 'Ir al sistema' : 'Acceso del personal'}
            </Link>
          </div>
        </div>
      </footer>

      {/* Botón flotante de WhatsApp */}
      <a
        href={LINKS.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escríbenos por WhatsApp"
        className="lp-wa fixed right-4 bottom-4 z-40 flex size-14 items-center justify-center rounded-full text-white shadow-lg md:right-6 md:bottom-6"
      >
        <WhatsAppIcon className="size-7" />
      </a>
    </div>
  );
}

/** Video de marca hecho con HyperFrames. Sin "reducir movimiento" se reproduce en bucle. */
function HeroVideo() {
  const [still, setStill] = useState(
    () =>
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setStill(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  if (still) {
    return (
      <img
        src="/media/kinesalud-hero-poster.jpg"
        alt=""
        className="size-full object-cover"
        width={800}
        height={800}
      />
    );
  }
  return (
    <video
      className="size-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster="/media/kinesalud-hero-poster.jpg"
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src="/media/kinesalud-hero.webm" type="video/webm" />
      <source src="/media/kinesalud-hero.mp4" type="video/mp4" />
    </video>
  );
}

function Section({
  id,
  eyebrow,
  title,
  intro,
  muted,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className={cn('relative scroll-mt-16', muted && 'lp-band')}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 md:px-6 md:py-24">
        <div data-reveal className="flex max-w-2xl flex-col gap-3">
          <p className="text-overline text-primary uppercase">{eyebrow}</p>
          <h2
            id={`${id}-titulo`}
            className="text-[1.875rem] leading-tight font-bold text-fg md:text-[2.25rem]"
          >
            {title}
          </h2>
          {intro && <p className="text-body text-fg-muted">{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function InfoRow({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary"
      >
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-1 text-body-sm">
        <p className="font-semibold text-fg">{title}</p>
        <div className="text-fg-muted">{children}</div>
      </div>
    </div>
  );
}

function ContactCard({
  index,
  href,
  external,
  icon,
  title,
  detail,
  cta,
  accent,
}: {
  index: number;
  href: string;
  external?: boolean;
  icon: ReactNode;
  title: string;
  detail: string;
  cta: string;
  accent?: boolean;
}) {
  return (
    <li data-reveal style={vars({ '--d': index })}>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={cn(
          'lp-card group flex h-full flex-col gap-3 rounded-2xl border p-5',
          accent ? 'border-primary-border bg-primary-subtle' : 'border-border bg-surface',
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-surface text-primary shadow-sm">
          {icon}
        </span>
        <span className="text-h3 text-fg">{title}</span>
        <span className="truncate text-body-sm text-fg-muted">{detail}</span>
        <span className="mt-auto text-body-sm font-semibold text-primary">
          {cta}
          <span
            aria-hidden="true"
            className="inline-block transition-transform group-hover:translate-x-1"
          >
            {' '}
            →
          </span>
        </span>
      </a>
    </li>
  );
}

/** Logotipos de las redes (las marcas no forman parte de Lucide). */
function WhatsAppIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.06 0 1.22.89 2.39 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}

function FacebookIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}
