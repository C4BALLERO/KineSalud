import { useSearchParams } from 'react-router';
import { ErrorState } from '@/components/feedback/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useClinicSettings } from '../api/catalog';
import { RoomsPanel, ServicesPanel } from '../components/CatalogPanels';
import { ClinicSettingsPanel } from '../components/ClinicSettingsPanel';

const TABS = ['consultorio', 'espacios', 'servicios'] as const;
type Tab = (typeof TABS)[number];

/** Configuración del consultorio: horario de atención, espacios y servicios. */
export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'consultorio';
  const clinic = useClinicSettings();

  const changeTab = (next: string) =>
    setParams(next === 'consultorio' ? {} : { tab: next }, { replace: true });

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Horario de atención, espacios y catálogo de servicios del consultorio."
      />
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList label="Secciones de configuración">
          <TabsTrigger value="consultorio">Consultorio</TabsTrigger>
          <TabsTrigger value="espacios">Espacios</TabsTrigger>
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
        </TabsList>

        <TabsContent value="consultorio">
          {clinic.status === 'loading' ? (
            <LoadingRegion label="Cargando configuración" className="flex flex-col gap-6">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-96 w-full rounded-lg" />
            </LoadingRegion>
          ) : clinic.status === 'error' ? (
            <ErrorState description={clinic.error.message} onRetry={clinic.retry} />
          ) : (
            <ClinicSettingsPanel
              // Se reinicia cuando la configuración pasa a existir (primer guardado).
              key={clinic.status}
              settings={clinic.status === 'success' ? clinic.data : null}
            />
          )}
        </TabsContent>
        <TabsContent value="espacios">
          <RoomsPanel />
        </TabsContent>
        <TabsContent value="servicios">
          <ServicesPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}
