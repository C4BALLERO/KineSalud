import { MapPinOff } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/feedback/States';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<MapPinOff />}
      title="Página no encontrada"
      description="La dirección no existe o el registro fue eliminado. Verifica el enlace o vuelve al inicio."
      action={
        <Button asChild>
          <Link to="/inicio">Ir al inicio</Link>
        </Button>
      }
    />
  );
}
