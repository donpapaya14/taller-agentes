import { z } from 'zod';

type Entorno = Record<string, string | undefined>;

// Una variable ausente y una vacía son lo mismo, y el error dice cuál falta.
function obligatoria(nombre: string) {
  const mensaje = `Falta la variable de entorno ${nombre}`;
  return z.string({ error: mensaje }).min(1, { error: mensaje });
}

const esquemaPublico = z.object({
  SUPABASE_URL: obligatoria('SUPABASE_URL'),
  SUPABASE_PUBLISHABLE_KEY: obligatoria('SUPABASE_PUBLISHABLE_KEY'),
});

const esquemaSecreto = z.object({
  SUPABASE_SECRET_KEY: obligatoria('SUPABASE_SECRET_KEY'),
  CRON_SECRET: obligatoria('CRON_SECRET'),
  DEMO_PASSWORD: obligatoria('DEMO_PASSWORD'),
});

function leer<T extends z.ZodType>(esquema: T, env: Entorno): z.infer<T> {
  const resultado = esquema.safeParse(env);
  if (!resultado.success) throw new Error(resultado.error.issues[0].message);
  return resultado.data;
}

export function leerEntorno(env: Entorno = process.env): { url: string; clavePublicable: string } {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = leer(esquemaPublico, env);
  return { url: SUPABASE_URL, clavePublicable: SUPABASE_PUBLISHABLE_KEY };
}

export function leerEntornoSecreto(env: Entorno = process.env): {
  claveSecreta: string;
  cronSecret: string;
  demoPassword: string;
} {
  const { SUPABASE_SECRET_KEY, CRON_SECRET, DEMO_PASSWORD } = leer(esquemaSecreto, env);
  return {
    claveSecreta: SUPABASE_SECRET_KEY,
    cronSecret: CRON_SECRET,
    demoPassword: DEMO_PASSWORD,
  };
}
