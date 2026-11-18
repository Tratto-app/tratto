// Permite destacar palabras en los títulos del contenido.yaml escribiéndolas
// entre asteriscos: "lo que sale *en papel*" → "en papel" va en cursiva y color.
export function destacar(texto: string): string {
  const seguro = texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
  return seguro.replace(/\*(.+?)\*/g, '<em>$1</em>');
}
