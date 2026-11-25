import tseslint from "typescript-eslint";

export default [
  { ignores: [".next/**", "out/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "no-debugger": "error",
      "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
      "@typescript-eslint/no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
    },
  },
];
