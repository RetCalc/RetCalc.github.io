/* For `npm run test:guide`: lets node --test load the guide's TypeScript the
   way the baseline scripts do (loader.mjs: "@/..." means web/, and an
   import may leave off ".ts"). */
import { register } from "node:module";

register(new URL("./baseline/loader.mjs", import.meta.url));
