/** 前端构建版本。
 *
 * 由 vite.config.ts 在构建时从 package.json 注入。
 * 供状态指示的「前后端版本不匹配」判定使用（与服务端 /health 返回的 version 比对）。
 * 注意：发布时需与后端 app/version.py 的 __version__ 保持同步。
 */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '0.0.0';
