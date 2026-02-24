declare module '@zenithbuild/compiler' {
  export function compile(source: string, filePath: string): Promise<unknown>;
}
