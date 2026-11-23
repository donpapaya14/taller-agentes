-- Un número de factura no se repite dentro de un taller (C-8). cerrar_orden() lo saca de un contador
-- y este índice es la red por si el contador se desajusta (alguien lo retrocede, una restauración
-- de copia): la entrega falla en vez de repetir número.
--
-- Parcial porque las órdenes sin entregar no tienen número. Lleva el taller porque cada taller
-- numera por su cuenta: el mismo número puede estar en dos talleres.
create unique index ordenes_numero_factura_unico
  on public.ordenes (taller_id, numero_factura)
  where numero_factura is not null;
