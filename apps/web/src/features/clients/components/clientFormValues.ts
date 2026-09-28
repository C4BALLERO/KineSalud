/** Valores del formulario de cliente: todo es texto ('' = vacío). */
export interface ClientFormValues {
  firstName: string;
  lastName: string;
  ci: string;
  ciExt: string;
  phone: string;
  email: string;
  birthDate: string;
  address: string;
  adminNotes: string;
}

/** Cochabamba por defecto: el consultorio está en Cochabamba. */
export const EMPTY_CLIENT_FORM: ClientFormValues = {
  firstName: '',
  lastName: '',
  ci: '',
  ciExt: 'CB',
  phone: '',
  email: '',
  birthDate: '',
  address: '',
  adminNotes: '',
};
