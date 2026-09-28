# Integraciones (reservado)

Aquí se conectará el **chatbot** en la etapa 2. En la v1 esta carpeta está vacía a propósito.

El adaptador del chatbot (por ejemplo, un webhook HTTP en `api/http/chatbot/`) **no tendrá lógica de negocio propia**. Llamará a los mismos servicios de `domain/` que usa la web, con un `Actor` de tipo `CHATBOT`.

Consulta el contrato en [`docs/integracion-chatbot.md`](../../../docs/integracion-chatbot.md).
