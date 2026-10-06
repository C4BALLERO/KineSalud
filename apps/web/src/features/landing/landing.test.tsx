import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TestSessionProvider } from '@/test/TestSessionProvider';
import { LandingPage } from './LandingPage';

function renderLanding(asRole?: 'ADMINISTRADOR') {
  return render(
    <MemoryRouter>
      <TestSessionProvider asRole={asRole}>
        <LandingPage />
      </TestSessionProvider>
    </MemoryRouter>,
  );
}

describe('página pública', () => {
  it('presenta el consultorio con sus secciones', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Recupera tu movimiento, cuida tu bienestar',
    );
    for (const name of [
      'Tres áreas, un mismo cuidado',
      'Un centro de fisioterapia cercano',
      'Encuéntranos en Cochabamba',
      'Escríbenos o llámanos',
    ]) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  it('enlaza WhatsApp con mensaje, el teléfono, el correo, Facebook y el mapa', () => {
    renderLanding();
    const contact = screen.getByRole('region', { name: 'Escríbenos o llámanos' });
    expect(within(contact).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/wa\.me\/59177442133\?text=/),
    );
    expect(within(contact).getByRole('link', { name: /Llámanos/ })).toHaveAttribute(
      'href',
      'tel:+59177442133',
    );
    expect(within(contact).getByRole('link', { name: /Correo/ })).toHaveAttribute(
      'href',
      'mailto:kinesaludyvida@gmail.com',
    );
    expect(within(contact).getByRole('link', { name: /Facebook/ })).toHaveAttribute(
      'href',
      'https://www.facebook.com/kinesaludyvida',
    );
    expect(screen.getByTitle('Mapa de Kinesalud y Vida en Google Maps')).toHaveAttribute(
      'src',
      expect.stringContaining('-17.3570588,-66.1862205'),
    );
  });

  it('el personal entra desde la portada; con sesión, va directo al sistema', () => {
    const { unmount } = renderLanding();
    expect(screen.getAllByRole('link', { name: /Acceso del personal/ })[0]).toHaveAttribute(
      'href',
      '/login',
    );
    unmount();
    renderLanding('ADMINISTRADOR');
    expect(screen.getAllByRole('link', { name: /Ir al sistema/ })[0]).toHaveAttribute(
      'href',
      '/inicio',
    );
  });
});
