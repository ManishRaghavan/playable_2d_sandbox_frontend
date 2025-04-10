import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Next.js & React Rules
      "react/no-unescaped-entities": "off",
      "@next/next/no-page-custom-font": "off",

      // Dev Warnings Only
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-interface": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",

      // You can disable errors completely if needed:
      // "react-hooks/exhaustive-deps": "off",
      // "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

export default eslintConfig;
