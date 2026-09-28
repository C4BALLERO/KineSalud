import { ConciergeBell, ShieldCheck, Stethoscope, type LucideIcon } from 'lucide-react';
import type { Role } from '@kinesalud/shared';

export const ROLE_ICONS: Record<Role, LucideIcon> = {
  ADMINISTRADOR: ShieldCheck,
  RECEPCIONISTA: ConciergeBell,
  PROFESIONAL: Stethoscope,
};
