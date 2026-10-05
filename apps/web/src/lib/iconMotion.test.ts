import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ICON_MOTION_ATTR, iconsOf, installIconMotion } from './iconMotion';

const icon = (name = 'bell') =>
  `<svg class="lucide lucide-${name}" aria-hidden="true"><path d="M0 0"/></svg>`;

function pointer(type: string, target: Element, init: Record<string, unknown> = {}) {
  const event = new MouseEvent(type, { bubbles: true, ...init });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'mouse' });
  target.dispatchEvent(event);
}

describe('iconMotion', () => {
  let uninstall: () => void;

  beforeEach(() => {
    document.body.innerHTML = `
      <nav><a href="/agenda" id="link">${icon('calendar-days')}<span>Agenda</span></a></nav>
      <button id="btn"><span>${icon('plus')}</span>Nueva cita</button>
      <button id="row"><div><div><span>${icon('check')}</span></div></div></button>
      <button id="off" disabled>${icon('trash')}</button>
      <p id="plain">${icon('info')}</p>`;
    uninstall = installIconMotion(document);
  });
  afterEach(() => uninstall());

  const animated = () =>
    Array.from(document.querySelectorAll(`[${ICON_MOTION_ATTR}]`)).map(
      (svg) => svg.closest('[id]')?.id,
    );

  it('anima los iconos del control señalado y los suelta al salir', () => {
    pointer('pointerover', document.querySelector('#link span')!);
    expect(animated()).toEqual(['link']);
    pointer('pointerover', document.querySelector('#btn')!);
    expect(animated()).toEqual(['btn']);
    pointer('pointerout', document.querySelector('#btn')!, { relatedTarget: document.body });
    expect(animated()).toEqual([]);
  });

  it('solo toma los iconos propios del control, no los de una fila con insignias', () => {
    expect(iconsOf(document.querySelector('#btn')!)).toHaveLength(1);
    expect(iconsOf(document.querySelector('#row')!)).toHaveLength(0);
  });

  it('ignora controles deshabilitados e iconos fuera de controles', () => {
    pointer('pointerover', document.querySelector('#off')!);
    pointer('pointerover', document.querySelector('#plain svg')!);
    expect(animated()).toEqual([]);
  });

  it('con un toque, anima por un momento', async () => {
    pointer('pointerdown', document.querySelector('#btn')!, { pointerType: 'touch' });
    expect(animated()).toEqual(['btn']);
    await new Promise((r) => setTimeout(r, 750));
    expect(animated()).toEqual([]);
  });
});
