// ===== 工具函数 =====
export function qPrefix(prefix: string, root: ParentNode = document) {
  return root.querySelector(`[class*="${prefix}"]`);
}
export function qAllPrefix(prefix: string, root: ParentNode = document) {
  return root.querySelectorAll(`[class*="${prefix}"]`);
}
