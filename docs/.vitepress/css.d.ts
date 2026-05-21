// Allow CSS side-effect imports (e.g. highlight.js styles via Vite)
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
declare module "*.min.css" {
  const content: Record<string, string>;
  export default content;
}
// highlight.js style side-effect imports
declare module "highlight.js/styles/*";
