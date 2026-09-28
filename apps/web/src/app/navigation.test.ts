import { describe, expect, it } from 'vitest';
import { navLabel, NAV_ITEMS, splitForBottomNav, visibleNavItems } from './navigation';

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('navegación por rol', () => {
  it('el ADMINISTRADOR ve todas las secciones', () => {
    expect(ids(visibleNavItems({ role: 'ADMINISTRADOR' }))).toEqual(ids(NAV_ITEMS));
  });

  it('la RECEPCIONISTA no ve Usuarios ni Configuración', () => {
    const v = ids(visibleNavItems({ role: 'RECEPCIONISTA' }));
    expect(v).toContain('personal');
    expect(v).toContain('reportes');
    expect(v).not.toContain('usuarios');
    expect(v).not.toContain('configuracion');
  });

  it('el PROFESIONAL solo ve su operación diaria', () => {
    const v = ids(visibleNavItems({ role: 'PROFESIONAL', professionalId: 'p1' }));
    expect(v).toEqual(['inicio', 'agenda', 'clientes', 'tratamientos']);
  });

  it('usa etiquetas personalizadas para el PROFESIONAL', () => {
    const agenda = NAV_ITEMS.find((i) => i.id === 'agenda')!;
    expect(navLabel(agenda, 'PROFESIONAL')).toBe('Mi agenda');
    expect(navLabel(agenda, 'RECEPCIONISTA')).toBe('Agenda');
  });

  it('la barra inferior móvil muestra 4 accesos y el resto va a "Más"', () => {
    const { primary, overflow } = splitForBottomNav({ role: 'ADMINISTRADOR' });
    expect(primary).toHaveLength(4);
    expect(overflow.length).toBeGreaterThan(0);
  });
});
