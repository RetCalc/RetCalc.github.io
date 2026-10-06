import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { plugin as shadcn } from "@shadcn/lint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // `const { dropped, ...rest } = obj` is how a key is left out of a copy.
  { rules: { "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true, varsIgnorePattern: "^_" }] } },
  // The design system: components/ui/ (shadcn) and the theme tokens in
  // app/globals.css. eslint-config-next already parses JSX and TypeScript.
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { shadcn },
    rules: {
      "shadcn/no-unknown-classes": "error",
      "shadcn/require-static-classes": "error",
      "shadcn/no-raw-colors": "error",
      // Call sites may place a component (margin, width, position) but not
      // restyle it; a new look is a variant or size in its component file.
      "shadcn/no-restyle": ["error", {
        allow: ["layout"],
        // A card's content sets its own padding (a dense table, a roomy hero).
        contracts: [{ pattern: "^CardContent$", allow: ["layout", "spacing"] }],
      }],
      "shadcn/no-arbitrary-values": "error",
      "shadcn/no-inline-styles": "error",
    },
  },
  {
    files: ["components/ui/**"],
    rules: {
      // A component styles itself: its own classes are its look, not a restyle.
      "shadcn/no-restyle": "off",
      // shadcn primitives use structural values such as ring-[3px].
      "shadcn/no-arbitrary-values": "off",
      // A component calls its own cva() variants, which the rule can't resolve.
      "shadcn/require-static-classes": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // built from lib/engine by scripts/build-worker.mjs
    "public/engine-worker.js",
  ]),
]);

export default eslintConfig;
