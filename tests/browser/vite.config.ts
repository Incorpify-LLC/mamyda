import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const stub = fileURLToPath(new URL("./chat-stubs.tsx", import.meta.url));
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: [
      { find: "@/lib/auth/public-config", replacement: stub },
      { find: "@/lib/auth/gates", replacement: stub },
      { find: "@/components/global-search", replacement: stub },
      { find: "@/lib/mamyda/media", replacement: stub },
      { find: "@/lib/mamyda/workspace", replacement: stub },
      { find: "@", replacement: fileURLToPath(new URL("../../src", import.meta.url)) },
    ],
  },
  server: { host: "127.0.0.1", port: 8082, strictPort: true },
});
