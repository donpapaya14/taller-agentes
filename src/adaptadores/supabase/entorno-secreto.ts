import 'server-only';
import { z } from 'zod';
import { type Entorno, leerConEsquema, obligatoria } from './entorno';

// La clave secreta se lee aquí y no en entorno.ts: con la guarda de server-only, un componente de
// cliente que importe este módulo rompe la compilación en vez de acercarse a la clave.
const esquemaSecreto = z.object({
  SUPABASE_SECRET_KEY: obligatoria('SUPABASE_SECRET_KEY'),
  CRON_SECRET: obligatoria('CRON_SECRET'),
  DEMO_PASSWORD: obligatoria('DEMO_PASSWORD'),
});

export function leerEntornoSecreto(env: Entorno = process.env): {
  claveSecreta: string;
  cronSecret: string;
  demoPassword: string;
} {
  const { SUPABASE_SECRET_KEY, CRON_SECRET, DEMO_PASSWORD } = leerConEsquema(esquemaSecreto, env);
  return {
    claveSecreta: SUPABASE_SECRET_KEY,
    cronSecret: CRON_SECRET,
    demoPassword: DEMO_PASSWORD,
  };
}
