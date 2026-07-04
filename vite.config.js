import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base:"./" — 登録 URL 直下以外に置かれてもアセット参照が壊れないよう相対パスにする
export default defineConfig({
  base: "./",
  plugins: [react()],
});
