/* eslint-disable @typescript-eslint/no-explicit-any -- untyped vendor modules */
/**
 * Ambient declarations for untyped vendor modules.
 *
 * bootstrap ships no type definitions for its ESM bundle entry point, and there is no
 * maintained @types/bootstrap for v5's ESM build. TemplateWrapper imports it dynamically
 * only for its side effects plus the Modal/Offcanvas statics.
 */
declare module "bootstrap/dist/js/bootstrap.esm" {
  const bootstrap: any;
  export = bootstrap;
}

declare module "wowjs" {
  export const WOW: any;
}
