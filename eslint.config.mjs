import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ─────────────────────────────────────────────────────────────────────────────
// Tercera capa de defensa del patrón BFF (ADR-0002, /frontend/bff-pattern/).
//
// Las otras dos son el skill del proyecto (atrapa al asistente AI) y el helper
// `apiServerFetch` (el único export legítimo para hablar con api/). Esta capa
// atrapa lo que se escribe igual: un `fetch()` suelto o un token en el browser.
//
// Si el build falla con alguno de estos mensajes, está haciendo su trabajo.
// ─────────────────────────────────────────────────────────────────────────────

const NO_DIRECT_FETCH = [
  {
    selector: "CallExpression[callee.name='fetch']",
    message:
      "Usá apiServerFetch() de @/lib/api-server en vez de fetch() directo. Ver /frontend/bff-pattern/.",
  },
  {
    // Atrapa `window.fetch(...)` y `globalThis.fetch(...)`, que esquivan el
    // selector de arriba y hacen exactamente el mismo daño.
    selector: "CallExpression[callee.property.name='fetch']",
    message:
      "Usá apiServerFetch() de @/lib/api-server en vez de fetch() directo. Ver /frontend/bff-pattern/.",
  },
];

const NO_CLIENT_STORAGE = [
  {
    selector: "MemberExpression[object.name='localStorage']",
    message: "Nada de tokens en localStorage. Solo cookies httpOnly.",
  },
  {
    selector: "MemberExpression[object.name='sessionStorage']",
    message: "Nada de tokens en sessionStorage. Solo cookies httpOnly.",
  },
  {
    // Variantes con prefijo: `window.localStorage`, `globalThis.sessionStorage`.
    selector: "MemberExpression[property.name='localStorage']",
    message: "Nada de tokens en localStorage. Solo cookies httpOnly.",
  },
  {
    selector: "MemberExpression[property.name='sessionStorage']",
    message: "Nada de tokens en sessionStorage. Solo cookies httpOnly.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reporte HTML de v8. Está en .gitignore, pero ESLint no lee .gitignore:
    // sin esta línea, `pnpm lint` audita el JS generado por el reporter.
    "coverage/**",
  ]),
  {
    rules: {
      "no-restricted-syntax": ["error", ...NO_DIRECT_FETCH, ...NO_CLIENT_STORAGE],
    },
  },
  {
    // El helper es el único lugar donde `fetch()` es legítimo — si no, la regla
    // se muerde la cola.
    //
    // Desvío deliberado respecto del doc: el doc apaga `no-restricted-syntax`
    // entero para este archivo, lo que de paso permitiría localStorage acá
    // adentro. Se re-declara solo con los selectores de storage: habilita
    // exactamente lo que hay que habilitar y ni un selector más.
    files: ["src/lib/api-server.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...NO_CLIENT_STORAGE],
    },
  },
]);

export default eslintConfig;
