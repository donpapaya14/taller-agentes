import { describe, expect, it } from 'vitest';
import { esquemaFeature, esquemaRonda, type Comando, type Fallo, type Ronda } from './esquema';

const PASA_CON_ROJO = 'Una ronda que pasa no puede tener fallos ni comandos en rojo';
const FALLA_SIN_ROJO = 'Una ronda que falla necesita al menos un fallo o un comando en rojo';

const falloValido: Fallo = {
  directriz: 'D-2',
  archivo: 'src/adaptadores/proceso/leer-rondas.ts',
  descripcion: 'El adaptador lee la ronda sin validar su forma',
  evidencia: 'leer-rondas.ts:12 llama a JSON.parse y devuelve el resultado sin pasar por zod',
};
const comandoEnVerde: Comando = {
  comando: 'npm run check:full',
  resultado: 'OK',
  resumen: 'sale con 0',
};
const comandoEnRojo: Comando = {
  comando: 'npm run check:full',
  resultado: 'FALLO',
  resumen: 'sale con 1',
};

const rondaQuePasa: Ronda = {
  feature: 'f-ejemplo',
  ronda: 1,
  fecha: '2026-11-23',
  commitRevisado: 'a1b2c3d',
  veredicto: 'PASA',
  comandos: [comandoEnVerde],
  fallos: [],
  observaciones: 'Sin nada que objetar',
};
const rondaQueFalla: Ronda = { ...rondaQuePasa, veredicto: 'FALLA', fallos: [falloValido] };

const conFallo = (cambios: object) => ({
  ...rondaQueFalla,
  fallos: [{ ...falloValido, ...cambios }],
});

const incidenciasDe = (entrada: unknown) => {
  const resultado = esquemaRonda.safeParse(entrada);
  return resultado.success ? [] : resultado.error.issues;
};
const mensajesDe = (entrada: unknown) => incidenciasDe(entrada).map((i) => i.message);
const rutasDe = (entrada: unknown) => incidenciasDe(entrada).map((i) => i.path);
const seAcepta = (entrada: unknown) => esquemaRonda.safeParse(entrada).success;

describe('reglas cruzadas del veredicto', () => {
  it('[D-15] una ronda PASA con un fallo se rechaza', () => {
    const entrada = { ...rondaQuePasa, fallos: [falloValido] };

    expect(mensajesDe(entrada)).toContain(PASA_CON_ROJO);
  });

  it('[D-15] una ronda PASA con un comando en rojo se rechaza', () => {
    const entrada = { ...rondaQuePasa, comandos: [comandoEnVerde, comandoEnRojo] };

    expect(mensajesDe(entrada)).toContain(PASA_CON_ROJO);
  });

  it('[D-15] una ronda FALLA sin fallos ni comandos en rojo se rechaza', () => {
    const entrada = { ...rondaQuePasa, veredicto: 'FALLA' };

    expect(mensajesDe(entrada)).toContain(FALLA_SIN_ROJO);
  });

  it('[D-15] una ronda PASA sin fallos y con todos los comandos en verde se acepta', () => {
    const resultado = esquemaRonda.safeParse(rondaQuePasa);

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual(rondaQuePasa);
  });

  it('[D-15] una ronda FALLA se acepta con un fallo o con un comando en rojo', () => {
    const soloComandoEnRojo = { ...rondaQueFalla, fallos: [], comandos: [comandoEnRojo] };

    expect(seAcepta(rondaQueFalla)).toBe(true);
    expect(seAcepta(soloComandoEnRojo)).toBe(true);
  });
});

describe('fallos y evidencias', () => {
  it('[D-15] un fallo sin evidencia se rechaza', () => {
    expect(rutasDe(conFallo({ evidencia: '' }))).toContainEqual(['fallos', 0, 'evidencia']);
  });

  it('[D-15] una evidencia de solo espacios se rechaza', () => {
    const entrada = conFallo({ evidencia: ' '.repeat(20) });

    expect(rutasDe(entrada)).toContainEqual(['fallos', 0, 'evidencia']);
  });

  it.each([
    ['la directriz con otra forma', { directriz: 'd-2' }, 'directriz'],
    ['la directriz sin número', { directriz: 'D-' }, 'directriz'],
    ['el archivo vacío', { archivo: '' }, 'archivo'],
    ['el archivo de solo espacios', { archivo: '   ' }, 'archivo'],
    ['la descripción de 9 caracteres', { descripcion: 'x'.repeat(9) }, 'descripcion'],
    ['la evidencia de 9 caracteres', { evidencia: 'x'.repeat(9) }, 'evidencia'],
  ])('[D-2] rechaza %s', (_motivo, cambios, campo) => {
    expect(rutasDe(conFallo(cambios))).toContainEqual(['fallos', 0, campo]);
  });

  it('[D-2] acepta la descripción y la evidencia justo en 10 caracteres', () => {
    const entrada = conFallo({ descripcion: 'x'.repeat(10), evidencia: 'y'.repeat(10) });

    expect(seAcepta(entrada)).toBe(true);
  });
});

describe('forma de la ronda', () => {
  const valoresInvalidos: [campo: string, valores: unknown[]][] = [
    ['ronda', [0, -1, 1.5, '1']],
    ['fecha', ['', '23/11/2026', '2026-1-5', '2026-11-23T10:00:00Z']],
    ['commitRevisado', ['', 'abc123', 'ABCDEF1', 'g1h2i3j', 'a'.repeat(41)]],
    ['veredicto', ['', 'pasa', 'QUIZA']],
    ['origen', ['', 'otro']],
    ['comandos', [[]]],
  ];

  it('[D-2] una ronda con campos de más o de menos se rechaza', () => {
    expect(esquemaRonda.safeParse({ feature: 1 }).success).toBe(false);
    expect(esquemaRonda.safeParse({ ...rondaQuePasa, extra: true }).success).toBe(false);
  });

  it('[D-2] rechaza un campo de más dentro de un fallo o de un comando', () => {
    const enUnFallo = conFallo({ extra: true });
    const enUnComando = { ...rondaQuePasa, comandos: [{ ...comandoEnVerde, extra: true }] };

    expect(seAcepta(enUnFallo)).toBe(false);
    expect(seAcepta(enUnComando)).toBe(false);
  });

  it('[D-2] rechaza una ronda a la que le falta un campo', () => {
    const campos = Object.entries(rondaQuePasa);
    const sinObservaciones = Object.fromEntries(
      campos.filter(([campo]) => campo !== 'observaciones'),
    );

    expect(rutasDe(sinObservaciones)).toContainEqual(['observaciones']);
  });

  it.each([null, undefined, 'una ronda', 42, [], {}])('[D-2] rechaza la entrada basura %j', (x) => {
    expect(seAcepta(x)).toBe(false);
  });

  it.each(valoresInvalidos)(
    '[D-2] rechaza valores que no cumplen el formato de %s',
    (campo, valores) => {
      for (const valor of valores) {
        const entrada = { ...rondaQueFalla, [campo]: valor };

        expect(rutasDe(entrada), `${campo} = ${JSON.stringify(valor)}`).toContainEqual([campo]);
      }
    },
  );

  it('[D-2] rechaza un resultado de comando que no es OK ni FALLO', () => {
    const entrada = { ...rondaQueFalla, comandos: [{ ...comandoEnRojo, resultado: 'ROJO' }] };

    expect(rutasDe(entrada)).toContainEqual(['comandos', 0, 'resultado']);
  });
});

describe('valores límite que se aceptan', () => {
  it('[D-2] acepta el commit de 7 y de 40 caracteres y la directriz D-15', () => {
    const corto = { ...rondaQuePasa, commitRevisado: 'a'.repeat(7) };
    const largo = { ...conFallo({ directriz: 'D-15' }), commitRevisado: 'a'.repeat(40) };

    expect(seAcepta(corto)).toBe(true);
    expect(seAcepta(largo)).toBe(true);
  });

  it('[D-2] acepta los dos orígenes y la ronda sin origen', () => {
    expect(seAcepta({ ...rondaQuePasa, origen: 'ronda' })).toBe(true);
    expect(seAcepta({ ...rondaQuePasa, origen: 'revision-final' })).toBe(true);
    expect(seAcepta(rondaQuePasa)).toBe(true);
  });
});

describe('esquemaFeature', () => {
  const feature = {
    id: 'f02-proceso',
    titulo: 'Registro',
    resumen: 'Cómo se lee',
    estado: 'hecha',
  };
  const seAceptaFeature = (entrada: unknown) => esquemaFeature.safeParse(entrada).success;

  it.each(['pendiente', 'en_curso', 'hecha'])('[D-2] acepta una feature en estado %s', (estado) => {
    expect(seAceptaFeature({ ...feature, estado })).toBe(true);
  });

  it('[D-2] rechaza un estado desconocido, un campo de más o de menos y la entrada basura', () => {
    expect(seAceptaFeature({ ...feature, estado: 'terminada' })).toBe(false);
    expect(seAceptaFeature({ ...feature, extra: 1 })).toBe(false);
    expect(seAceptaFeature({ id: 'f02-proceso' })).toBe(false);
    expect(seAceptaFeature(null)).toBe(false);
  });
});
