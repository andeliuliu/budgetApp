// Let TypeScript understand CSS imports used by the Expo web template files.
declare module '*.css';
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
