import { expect, type Page } from '@playwright/test';
import { USUARIOS_DEMO } from '@/aplicacion/acceso';

type Rol = keyof typeof USUARIOS_DEMO;

// Entra por el formulario de /login, como lo haría quien lo visita, con el correo del rol y la
// contraseña de demostración del entorno. Sin ella no hay forma de entrar: se dice, no se adivina.
export async function entrarComo(page: Page, rol: Rol): Promise<void> {
  const contrasena = process.env.DEMO_PASSWORD;
  if (!contrasena)
    throw new Error('Falta DEMO_PASSWORD en el entorno: sin ella no se puede entrar');

  await page.goto('/login');
  await page.getByLabel('Correo').fill(USUARIOS_DEMO[rol]);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/tablero');
}

// Con el streaming, el evento load llega antes de que React destape lo que la pantalla pide a la base
// de datos: hasta que su titular no se ve, lo que se mida es la pantalla de carga o nada. Todas las
// pantallas empiezan por un h1. Las tarjetas suben del foso con animación y, a medio subir, su texto
// se mide con transparencia: se espera a que acaben para medir la pantalla como se queda.
export async function esperarLaPantalla(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() =>
    Promise.allSettled(document.getAnimations().map((animacion) => animacion.finished)),
  );
}

// El enlace de la matrícula de la primera tarjeta del tablero (de una columna, si se dice cuál). Se
// lee de la página y no se mira si se ve: en móvil solo se ve una columna a la vez.
export async function rutaDeLaPrimeraOrden(page: Page, estado?: string): Promise<string> {
  const columna = estado === undefined ? '' : `[data-estado="${estado}"] `;
  const ruta = await page.locator(`${columna}h3 a`).first().getAttribute('href');
  if (ruta === null) throw new Error('El tablero no tiene ninguna orden que abrir');
  return ruta;
}

// Las matrículas de todas las tarjetas del tablero, también las de las columnas que no se ven.
export function matriculasDelTablero(page: Page): Promise<string[]> {
  return page.locator('.matricula-caracteres').allTextContents();
}
