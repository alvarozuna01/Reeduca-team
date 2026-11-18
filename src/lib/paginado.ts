/**
 * Supabase devuelve como mucho 1000 filas por consulta. Pedir una tabla sin
 * límite NO da error: simplemente corta y la app se queda con menos datos de
 * los que hay (pasó con `tasks` al cruzar las 1000 tareas: el Panel mostraba
 * 285 activas cuando en la base había 316).
 *
 * `leerTodo` pide de a tandas hasta que una vuelve incompleta, que es la señal
 * de que ya no queda nada. Devuelve la misma forma `{ data, error }` que el
 * cliente de Supabase, así los lugares que ya controlaban el error no cambian.
 */
export async function leerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tam = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const todo: T[] = []
  // Tope de seguridad: 100 tandas (100 mil filas). Si alguna vez se llega acá,
  // el problema es de volumen y hay que paginar en la pantalla, no en la carga.
  for (let tanda = 0; tanda < 100; tanda++) {
    const desde = tanda * tam
    const { data, error } = await pagina(desde, desde + tam - 1)
    if (error) return { data: todo, error }
    const filas = data ?? []
    todo.push(...filas)
    if (filas.length < tam) break
  }
  return { data: todo, error: null }
}
