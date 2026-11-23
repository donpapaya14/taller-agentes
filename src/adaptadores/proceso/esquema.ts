import { z } from 'zod';

export type Fallo = { directriz: string; archivo: string; descripcion: string; evidencia: string };

export type Comando = { comando: string; resultado: 'OK' | 'FALLO'; resumen: string };

export type Ronda = {
  feature: string;
  ronda: number;
  fecha: string;
  commitRevisado: string;
  origen?: 'ronda' | 'revision-final';
  veredicto: 'PASA' | 'FALLA';
  comandos: Comando[];
  fallos: Fallo[];
  observaciones: string;
};

export type Feature = {
  id: string;
  titulo: string;
  resumen: string;
  estado: 'pendiente' | 'en_curso' | 'hecha';
};

const MINIMO_DE_TEXTO = 10;

const PASA_CON_ROJO = 'Una ronda que pasa no puede tener fallos ni comandos en rojo';
const FALLA_SIN_ROJO = 'Una ronda que falla necesita al menos un fallo o un comando en rojo';

// Los textos que justifican un fallo no valen en blanco: se recortan antes de contar.
const textoDe = (minimo: number) => z.string().trim().min(minimo);

const esquemaFallo = z.strictObject({
  directriz: z.string().regex(/^D-\d+$/, 'La directriz tiene que ser de la forma D-<número>'),
  archivo: textoDe(1),
  descripcion: textoDe(MINIMO_DE_TEXTO),
  evidencia: textoDe(MINIMO_DE_TEXTO),
});

const esquemaComando = z.strictObject({
  comando: z.string(),
  resultado: z.enum(['OK', 'FALLO']),
  resumen: z.string(),
});

export const esquemaRonda: z.ZodType<Ronda> = z
  .strictObject({
    feature: z.string(),
    ronda: z.int().min(1),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser AAAA-MM-DD'),
    commitRevisado: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/, 'El commit tiene que tener de 7 a 40 caracteres hexadecimales'),
    origen: z.enum(['ronda', 'revision-final']).optional(),
    veredicto: z.enum(['PASA', 'FALLA']),
    comandos: z.array(esquemaComando).min(1),
    fallos: z.array(esquemaFallo),
    observaciones: z.string(),
  })
  .superRefine((ronda, contexto) => {
    const hayComandoEnRojo = ronda.comandos.some((comando) => comando.resultado === 'FALLO');
    const hayRojo = ronda.fallos.length > 0 || hayComandoEnRojo;
    if (ronda.veredicto === 'PASA' && hayRojo) {
      contexto.addIssue({ code: 'custom', message: PASA_CON_ROJO, path: ['veredicto'] });
    }
    if (ronda.veredicto === 'FALLA' && !hayRojo) {
      contexto.addIssue({ code: 'custom', message: FALLA_SIN_ROJO, path: ['veredicto'] });
    }
  });

export const esquemaFeature: z.ZodType<Feature> = z.strictObject({
  id: z.string(),
  titulo: z.string(),
  resumen: z.string(),
  estado: z.enum(['pendiente', 'en_curso', 'hecha']),
});
