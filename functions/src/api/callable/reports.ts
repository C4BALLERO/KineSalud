import { callable } from '../../core/callable';
import { firestoreReportsGateway } from '../../domain/reports/firestoreReportsGateway';
import { rebuildReports } from '../../domain/reports/reportsService';

/** Reportes. Nombre publicado: reports-rebuild (solo administración). */
export const rebuild = callable((actor, data) =>
  rebuildReports(firestoreReportsGateway, actor, data),
);
