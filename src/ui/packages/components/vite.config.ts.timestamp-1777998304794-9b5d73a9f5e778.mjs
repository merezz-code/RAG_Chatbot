// vite.config.ts
import { fileURLToPath } from "node:url";
import react from "file:///C:/Users/FINREG/Documents/Chatbot_RAG/Projet/ChatBot/RAG_Chatbot/src/ui/node_modules/.pnpm/@vitejs+plugin-react@4.7.0__bed7b1dad5ae522a6195217ab33f65f4/node_modules/@vitejs/plugin-react/dist/index.js";
import { dirname, resolve } from "path";
import { defineConfig } from "file:///C:/Users/FINREG/Documents/Chatbot_RAG/Projet/ChatBot/RAG_Chatbot/src/ui/node_modules/.pnpm/vite@5.4.21_@types+node@22.17.0_sass@1.90.0/node_modules/vite/dist/node/index.js";
import dts from "file:///C:/Users/FINREG/Documents/Chatbot_RAG/Projet/ChatBot/RAG_Chatbot/src/ui/node_modules/.pnpm/vite-plugin-dts@4.5.4_@type_a59da168803b286cb9ee01c36a747f3d/node_modules/vite-plugin-dts/dist/index.mjs";
import viteTsconfigPaths from "file:///C:/Users/FINREG/Documents/Chatbot_RAG/Projet/ChatBot/RAG_Chatbot/src/ui/node_modules/.pnpm/vite-tsconfig-paths@5.1.4_t_fab1da3a575126759956444a3c3f4857/node_modules/vite-tsconfig-paths/dist/index.js";
var __vite_injected_original_import_meta_url = "file:///C:/Users/FINREG/Documents/Chatbot_RAG/Projet/ChatBot/RAG_Chatbot/src/ui/packages/components/vite.config.ts";
var __dirname = dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var vite_config_default = defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "intel-enterprise-rag-ui-components",
      fileName: "intel-enterprise-rag-ui-components",
      formats: ["es"]
    },
    rollupOptions: {
      external: ["react", "react-dom", "react-redux"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react-redux": "ReactRedux"
        }
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern"
      }
    }
  },
  plugins: [react(), viteTsconfigPaths(), dts()],
  resolve: {
    alias: {
      "@/": resolve(__dirname, "./src/")
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxGSU5SRUdcXFxcRG9jdW1lbnRzXFxcXENoYXRib3RfUkFHXFxcXFByb2pldFxcXFxDaGF0Qm90XFxcXFJBR19DaGF0Ym90XFxcXHNyY1xcXFx1aVxcXFxwYWNrYWdlc1xcXFxjb21wb25lbnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxGSU5SRUdcXFxcRG9jdW1lbnRzXFxcXENoYXRib3RfUkFHXFxcXFByb2pldFxcXFxDaGF0Qm90XFxcXFJBR19DaGF0Ym90XFxcXHNyY1xcXFx1aVxcXFxwYWNrYWdlc1xcXFxjb21wb25lbnRzXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9GSU5SRUcvRG9jdW1lbnRzL0NoYXRib3RfUkFHL1Byb2pldC9DaGF0Qm90L1JBR19DaGF0Ym90L3NyYy91aS9wYWNrYWdlcy9jb21wb25lbnRzL3ZpdGUuY29uZmlnLnRzXCI7Ly8gQ29weXJpZ2h0IChDKSAyMDI0LTIwMjYgSW50ZWwgQ29ycG9yYXRpb25cclxuLy8gU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFwYWNoZS0yLjBcclxuXHJcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tIFwibm9kZTp1cmxcIjtcclxuXHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHsgZGlybmFtZSwgcmVzb2x2ZSB9IGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCBkdHMgZnJvbSBcInZpdGUtcGx1Z2luLWR0c1wiO1xyXG5pbXBvcnQgdml0ZVRzY29uZmlnUGF0aHMgZnJvbSBcInZpdGUtdHNjb25maWctcGF0aHNcIjtcclxuXHJcbmNvbnN0IF9fZGlybmFtZSA9IGRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgYnVpbGQ6IHtcclxuICAgIGxpYjoge1xyXG4gICAgICBlbnRyeTogcmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjL2luZGV4LnRzXCIpLFxyXG4gICAgICBuYW1lOiBcImludGVsLWVudGVycHJpc2UtcmFnLXVpLWNvbXBvbmVudHNcIixcclxuICAgICAgZmlsZU5hbWU6IFwiaW50ZWwtZW50ZXJwcmlzZS1yYWctdWktY29tcG9uZW50c1wiLFxyXG4gICAgICBmb3JtYXRzOiBbXCJlc1wiXSxcclxuICAgIH0sXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIGV4dGVybmFsOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInJlYWN0LXJlZHV4XCJdLFxyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBnbG9iYWxzOiB7XHJcbiAgICAgICAgICByZWFjdDogXCJSZWFjdFwiLFxyXG4gICAgICAgICAgXCJyZWFjdC1kb21cIjogXCJSZWFjdERPTVwiLFxyXG4gICAgICAgICAgXCJyZWFjdC1yZWR1eFwiOiBcIlJlYWN0UmVkdXhcIixcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIGNzczoge1xyXG4gICAgcHJlcHJvY2Vzc29yT3B0aW9uczoge1xyXG4gICAgICBzY3NzOiB7XHJcbiAgICAgICAgYXBpOiBcIm1vZGVyblwiLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtyZWFjdCgpLCB2aXRlVHNjb25maWdQYXRocygpLCBkdHMoKV0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAL1wiOiByZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyYy9cIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBR0EsU0FBUyxxQkFBcUI7QUFFOUIsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsU0FBUyxlQUFlO0FBQ2pDLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sU0FBUztBQUNoQixPQUFPLHVCQUF1QjtBQVR1UixJQUFNLDJDQUEyQztBQVd0VyxJQUFNLFlBQVksUUFBUSxjQUFjLHdDQUFlLENBQUM7QUFFeEQsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsT0FBTztBQUFBLElBQ0wsS0FBSztBQUFBLE1BQ0gsT0FBTyxRQUFRLFdBQVcsY0FBYztBQUFBLE1BQ3hDLE1BQU07QUFBQSxNQUNOLFVBQVU7QUFBQSxNQUNWLFNBQVMsQ0FBQyxJQUFJO0FBQUEsSUFDaEI7QUFBQSxJQUNBLGVBQWU7QUFBQSxNQUNiLFVBQVUsQ0FBQyxTQUFTLGFBQWEsYUFBYTtBQUFBLE1BQzlDLFFBQVE7QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNQLE9BQU87QUFBQSxVQUNQLGFBQWE7QUFBQSxVQUNiLGVBQWU7QUFBQSxRQUNqQjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gscUJBQXFCO0FBQUEsTUFDbkIsTUFBTTtBQUFBLFFBQ0osS0FBSztBQUFBLE1BQ1A7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUyxDQUFDLE1BQU0sR0FBRyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7QUFBQSxFQUM3QyxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxNQUFNLFFBQVEsV0FBVyxRQUFRO0FBQUEsSUFDbkM7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
