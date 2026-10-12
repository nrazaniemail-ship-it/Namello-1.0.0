import {defineConfig} from "vite";
// Only used by `npm run dev` / `npm run build:vite`. The production build is scripts/build-web.mjs.
export default defineConfig({base:"./",build:{rollupOptions:{input:"index.html"}}});
