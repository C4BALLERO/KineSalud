import { Construction } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';

interface ModulePlaceholderProps {
  title: string;
  description: string;
  /** Fase del plan en la que se implementa el módulo. */
  phase: number;
  actions?: ReactNode;
}

/**
 * Pantalla provisional de un módulo aún no implementado. Mantiene navegable
 * la estructura completa de la aplicación mientras se trabaja por fases.
 */
export function ModulePlaceholder({ title, description, phase, actions }: ModulePlaceholderProps) {
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      <Panel>
        <EmptyState
          icon={<Construction />}
          title="Módulo en construcción"
          description={`Esta sección se implementa en la Fase ${phase} del plan de desarrollo.`}
        />
      </Panel>
    </>
  );
}
