// Metro resuelve cada imagen importada a un identificador de recurso que entiende `Image`.
declare module '*.jpg' {
  const source: number;
  export default source;
}
