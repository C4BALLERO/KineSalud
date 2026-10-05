/**
 * Animación de los iconos (Lucide). Este módulo solo decide CUÁNDO: marca con
 * `data-icon-motion` los iconos del control que se señala con el mouse, se
 * enfoca con el teclado o se toca. CÓMO se mueve cada icono está en
 * `styles/icon-motion.css`, que también respeta "reducir movimiento".
 */

const INTERACTIVE = [
  'a[href]',
  'button',
  'summary',
  'label',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="checkbox"]',
].join(', ');

export const ICON_MOTION_ATTR = 'data-icon-motion';
/** En pantallas táctiles no hay "salir del control": la animación dura un toque. */
const TOUCH_MS = 700;
/** Solo los iconos propios del control (no los de una fila entera con insignias adentro). */
const MAX_DEPTH = 2;

function safeMatches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

function depthWithin(node: Element, ancestor: Element): number {
  let depth = 0;
  for (let n: Element | null = node; n && n !== ancestor; n = n.parentElement) depth++;
  return depth;
}

/** Iconos del control: hijos directos o dentro de un envoltorio, sin controles anidados. */
export function iconsOf(control: Element): SVGSVGElement[] {
  return Array.from(control.querySelectorAll<SVGSVGElement>('svg.lucide')).filter(
    (svg) => svg.parentElement?.closest(INTERACTIVE) === control && depthWithin(svg, control) <= MAX_DEPTH,
  );
}

function controlOf(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest(INTERACTIVE);
  if (!control || safeMatches(control, ':disabled, [aria-disabled="true"]')) return null;
  return control;
}

export function startIconMotion(control: Element): void {
  for (const svg of iconsOf(control)) {
    svg.removeAttribute(ICON_MOTION_ATTR);
    // Fuerza un nuevo cálculo de estilo para que las animaciones de un solo uso
    // vuelvan a empezar si el icono ya estaba activo.
    void svg.getBoundingClientRect();
    svg.setAttribute(ICON_MOTION_ATTR, '');
  }
}

export function stopIconMotion(control: Element): void {
  for (const svg of iconsOf(control)) svg.removeAttribute(ICON_MOTION_ATTR);
}

/** Instala los escuchas globales (una vez, al iniciar la aplicación). Devuelve cómo quitarlos. */
export function installIconMotion(doc: Document = document): () => void {
  let hovered: Element | null = null;

  const onPointerOver = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const control = controlOf(e.target);
    if (control === hovered) return;
    if (hovered) stopIconMotion(hovered);
    hovered = control;
    if (control) startIconMotion(control);
  };

  const onPointerOut = (e: PointerEvent) => {
    if (!hovered) return;
    const next = e.relatedTarget;
    if (next instanceof Node && hovered.contains(next)) return;
    stopIconMotion(hovered);
    hovered = null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const control = controlOf(e.target);
    if (!control) return;
    startIconMotion(control);
    window.setTimeout(() => stopIconMotion(control), TOUCH_MS);
  };

  const onFocusIn = (e: FocusEvent) => {
    const control = controlOf(e.target);
    // Solo con teclado: un clic ya animó el icono al pasar el mouse.
    if (control && safeMatches(control, ':focus-visible')) startIconMotion(control);
  };

  const onFocusOut = (e: FocusEvent) => {
    const control = controlOf(e.target);
    if (control && control !== hovered) stopIconMotion(control);
  };

  doc.addEventListener('pointerover', onPointerOver);
  doc.addEventListener('pointerout', onPointerOut);
  doc.addEventListener('pointerdown', onPointerDown);
  doc.addEventListener('focusin', onFocusIn);
  doc.addEventListener('focusout', onFocusOut);
  return () => {
    doc.removeEventListener('pointerover', onPointerOver);
    doc.removeEventListener('pointerout', onPointerOut);
    doc.removeEventListener('pointerdown', onPointerDown);
    doc.removeEventListener('focusin', onFocusIn);
    doc.removeEventListener('focusout', onFocusOut);
  };
}
