import { describe, expect, it } from 'vitest';
import { canAccessRecord, hasPermission, permissionScope } from './permissions';

describe('permisos por rol', () => {
  it('solo el ADMINISTRADOR gestiona usuarios y configuración', () => {
    expect(hasPermission({ role: 'ADMINISTRADOR' }, 'users.manage')).toBe(true);
    expect(hasPermission({ role: 'RECEPCIONISTA' }, 'users.manage')).toBe(false);
    expect(hasPermission({ role: 'PROFESIONAL', professionalId: 'p1' }, 'settings.manage')).toBe(
      false,
    );
  });

  it('la RECEPCIONISTA nunca accede a información clínica', () => {
    expect(hasPermission({ role: 'RECEPCIONISTA' }, 'clinical.read')).toBe(false);
    expect(hasPermission({ role: 'RECEPCIONISTA' }, 'clinical.write')).toBe(false);
  });

  it('el PROFESIONAL solo accede a registros propios', () => {
    const prof = { role: 'PROFESIONAL' as const, professionalId: 'p1' };
    expect(permissionScope(prof, 'clinical.read')).toBe('own');
    expect(canAccessRecord(prof, 'clinical.read', ['p1'])).toBe(true);
    expect(canAccessRecord(prof, 'clinical.read', ['p2'])).toBe(false);
  });

  it('el PROFESIONAL agenda y registra pacientes solo en su propia agenda', () => {
    const prof = { role: 'PROFESIONAL' as const, professionalId: 'p1' };
    expect(permissionScope(prof, 'appointments.manage')).toBe('own');
    expect(permissionScope(prof, 'clients.write')).toBe('own');
    expect(canAccessRecord(prof, 'clients.write', ['p1', 'p2'])).toBe(true);
    expect(canAccessRecord(prof, 'clients.write', ['p2'])).toBe(false);
  });

  it('un PROFESIONAL sin ficha vinculada no accede a registros propios', () => {
    expect(canAccessRecord({ role: 'PROFESIONAL' }, 'clients.read', ['p1'])).toBe(false);
  });

  it('el ADMINISTRADOR accede a todos los registros clínicos', () => {
    expect(canAccessRecord({ role: 'ADMINISTRADOR' }, 'clinical.read', ['p9'])).toBe(true);
  });

  it('un ADMINISTRADOR que atiende conserva el alcance total', () => {
    const adminPro = { role: 'ADMINISTRADOR' as const, professionalId: 'p1' };
    expect(permissionScope(adminPro, 'appointments.manage')).toBe('all');
  });

  it('la RECEPCIONISTA ve reportes operativos pero no la carga por profesional', () => {
    expect(hasPermission({ role: 'RECEPCIONISTA' }, 'reports.view')).toBe(true);
    expect(hasPermission({ role: 'RECEPCIONISTA' }, 'reports.viewWorkload')).toBe(false);
  });
});
