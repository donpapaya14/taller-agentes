import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { reponerContrasenas, rpcRestablecer } from './demo';

const { crearClienteSecreto, CONTRASENA } = vi.hoisted(() => ({
  crearClienteSecreto: vi.fn(),
  CONTRASENA: 'contraseña de demostración de prueba',
}));

// `server-only` lanza fuera de un componente de servidor de Next; aquí solo hay que dejarlo pasar.
vi.mock('server-only', () => ({}));
vi.mock('./cliente-secreto', () => ({ crearClienteSecreto }));
vi.mock('./entorno-secreto', () => ({
  leerEntornoSecreto: () => ({
    claveSecreta: 'clave secreta de prueba',
    cronSecret: 'secreto del cron de prueba',
    demoPassword: CONTRASENA,
  }),
}));

const POR_PAGINA = 200;
const CORREOS = ['jefe@demo.example', 'mecanico@demo.example', 'otro@demo.example'];

const usuario = (id: string, email?: string) => ({ id, email });
const ajenos = (cuantos: number) =>
  Array.from({ length: cuantos }, (_, i) => usuario(`ajeno-${i}`, `ajeno-${i}@otro.example`));
const pagina = (users: ReturnType<typeof usuario>[]) => ({ data: { users }, error: null });

let cliente: {
  rpc: ReturnType<typeof vi.fn>;
  listUsers: ReturnType<typeof vi.fn>;
  updateUserById: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  cliente = {
    rpc: vi.fn(),
    listUsers: vi.fn(),
    updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };
  crearClienteSecreto.mockClear();
  crearClienteSecreto.mockReturnValue({
    rpc: cliente.rpc,
    auth: { admin: { listUsers: cliente.listUsers, updateUserById: cliente.updateUserById } },
  });
});

describe('rpcRestablecer', () => {
  it('[C-13] llama a restablecer_demo con el cliente secreto y devuelve lo que responde', async () => {
    cliente.rpc.mockResolvedValue({ data: 'RESTABLECIDO', error: null });

    const respuesta = await rpcRestablecer();

    expect(respuesta).toBe('RESTABLECIDO');
    expect(cliente.rpc).toHaveBeenCalledWith('restablecer_demo');
  });

  it('[D-14] un error de Supabase sale como excepción con su mensaje', async () => {
    cliente.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    await expect(rpcRestablecer()).rejects.toThrow('permission denied');
  });

  // El plazo es el de la operación entera: el cliente lo recibe para no seguir esperando pasado él.
  it('[D-14] el cliente secreto se crea con el plazo de la operación', async () => {
    cliente.rpc.mockResolvedValue({ data: 'RESTABLECIDO', error: null });
    const plazo = new AbortController().signal;

    await rpcRestablecer(plazo);

    expect(crearClienteSecreto).toHaveBeenCalledExactlyOnceWith(plazo);
  });

  it('[D-14] sin plazo se crea con el límite de cada llamada y nada más', async () => {
    cliente.rpc.mockResolvedValue({ data: 'RESTABLECIDO', error: null });

    await rpcRestablecer();

    expect(crearClienteSecreto).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it.each([null, undefined, 42, {}, ['RESTABLECIDO']])(
    '[D-2] una respuesta que no es un texto (%j) es un error',
    async (basura) => {
      cliente.rpc.mockResolvedValue({ data: basura, error: null });

      await expect(rpcRestablecer()).rejects.toBeInstanceOf(ZodError);
    },
  );
});

describe('reponerContrasenas: a quién', () => {
  it('[C-13] pone la contraseña de demostración a cada usuario, por su id y a nadie más', async () => {
    cliente.listUsers.mockResolvedValue(
      pagina([
        usuario('a-1', 'ajeno@otro.example'),
        usuario('j-1', CORREOS[0]),
        usuario('sin-correo'),
        usuario('m-1', CORREOS[1]),
        usuario('o-1', CORREOS[2]),
      ]),
    );

    await reponerContrasenas(CORREOS);

    expect(cliente.updateUserById.mock.calls).toEqual([
      ['j-1', { password: CONTRASENA }],
      ['m-1', { password: CONTRASENA }],
      ['o-1', { password: CONTRASENA }],
    ]);
  });

  it('[C-13] sigue por la página siguiente si en la primera no están todos', async () => {
    cliente.listUsers
      .mockResolvedValueOnce(pagina([...ajenos(POR_PAGINA - 1), usuario('j-1', CORREOS[0])]))
      .mockResolvedValueOnce(
        pagina([usuario('m-1', CORREOS[1]), usuario('o-1', CORREOS[2]), ...ajenos(3)]),
      );

    await reponerContrasenas(CORREOS);

    expect(cliente.listUsers.mock.calls).toEqual([
      [{ page: 1, perPage: POR_PAGINA }],
      [{ page: 2, perPage: POR_PAGINA }],
    ]);
    expect(cliente.updateUserById).toHaveBeenCalledTimes(3);
  });

  it('[C-13] no pide más páginas cuando ya los tiene todos', async () => {
    const todos = CORREOS.map((correo, i) => usuario(`d-${i}`, correo));
    cliente.listUsers.mockResolvedValue(pagina([...todos, ...ajenos(POR_PAGINA - 3)]));

    await reponerContrasenas(CORREOS);

    expect(cliente.listUsers).toHaveBeenCalledTimes(1);
  });

  it('[C-13] sin correos que reponer no llama a Auth', async () => {
    await reponerContrasenas([]);

    expect(cliente.listUsers).not.toHaveBeenCalled();
    expect(cliente.updateUserById).not.toHaveBeenCalled();
  });
});

describe('reponerContrasenas: cuando algo falla', () => {
  it('[D-14] si falta un usuario dice cuál y no cambia ninguna contraseña', async () => {
    cliente.listUsers.mockResolvedValue(
      pagina([usuario('j-1', CORREOS[0]), usuario('o-1', CORREOS[2])]),
    );

    await expect(reponerContrasenas(CORREOS)).rejects.toThrow(`No existe el usuario ${CORREOS[1]}`);
    expect(cliente.updateUserById).not.toHaveBeenCalled();
  });

  it('[D-14] si Auth falla al buscar los usuarios, la excepción lleva su mensaje', async () => {
    cliente.listUsers.mockResolvedValue({ data: { users: [] }, error: { message: 'Auth caído' } });

    await expect(reponerContrasenas(CORREOS)).rejects.toThrow('Auth caído');
    expect(cliente.updateUserById).not.toHaveBeenCalled();
  });

  it('[D-14] si Auth falla al poner una contraseña, la excepción lleva su mensaje', async () => {
    cliente.listUsers.mockResolvedValue(
      pagina(CORREOS.map((correo, i) => usuario(`d-${i}`, correo))),
    );
    cliente.updateUserById.mockResolvedValue({
      data: null,
      error: { message: 'contraseña débil' },
    });

    await expect(reponerContrasenas(CORREOS)).rejects.toThrow('contraseña débil');
  });
});

describe('reponerContrasenas: entrada basura', () => {
  it.each([
    ['sin datos', { data: null, error: null }],
    ['con usuarios que no es una lista', { data: { users: 'todos' }, error: null }],
    ['con un usuario sin id', { data: { users: [{ email: CORREOS[0] }] }, error: null }],
    [
      'con un id que no es un texto',
      { data: { users: [{ id: 42, email: CORREOS[0] }] }, error: null },
    ],
    [
      'con un correo que no es un texto',
      { data: { users: [{ id: 'x', email: 42 }] }, error: null },
    ],
  ])(
    '[D-2] si Auth responde %s es un error y no cambia ninguna contraseña',
    async (_caso, basura) => {
      cliente.listUsers.mockResolvedValue(basura);

      await expect(reponerContrasenas(CORREOS)).rejects.toBeInstanceOf(ZodError);
      expect(cliente.updateUserById).not.toHaveBeenCalled();
    },
  );
});

describe('reponerContrasenas: el plazo', () => {
  it('[D-14] el cliente secreto se crea con el plazo de la operación', async () => {
    cliente.listUsers.mockResolvedValue(
      pagina(CORREOS.map((correo, i) => usuario(`d-${i}`, correo))),
    );
    const plazo = new AbortController().signal;

    await reponerContrasenas(CORREOS, plazo);

    expect(crearClienteSecreto).toHaveBeenCalledExactlyOnceWith(plazo);
  });
});
