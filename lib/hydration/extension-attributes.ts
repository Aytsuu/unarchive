export type StripTarget = {
  attributes: ArrayLike<{ name: string }>
  removeAttribute: (name: string) => void
  querySelectorAll?: (selector: string) => ArrayLike<StripTarget>
}

export function isExtensionHydrationAttribute(name: string) {
  return name === "bis_skin_checked" || name === "bis_register" || name.startsWith("__processed_")
}

export function stripExtensionHydrationAttributes(root: StripTarget) {
  const visit = (node: StripTarget) => {
    for (const attr of Array.from(node.attributes)) {
      if (isExtensionHydrationAttribute(attr.name)) node.removeAttribute(attr.name)
    }
  }
  visit(root)
  const descendants = root.querySelectorAll?.("*")
  if (!descendants) return
  for (const node of Array.from(descendants)) visit(node)
}

export const stripExtensionHydrationAttributesScript = `(function(){function isInjected(n){return n==="bis_skin_checked"||n==="bis_register"||n.startsWith("__processed_")}function stripNode(node){if(!node||node.nodeType!==1)return;for(var attrs=Array.prototype.slice.call(node.attributes),i=0;i<attrs.length;i++){if(isInjected(attrs[i].name))node.removeAttribute(attrs[i].name)}}function stripTree(root){stripNode(root);if(!root||!root.querySelectorAll)return;var nodes=root.querySelectorAll("*");for(var i=0;i<nodes.length;i++)stripNode(nodes[i])}function run(){if(document.documentElement)stripTree(document.documentElement)}run();if(typeof MutationObserver!=="function")return;var observer=new MutationObserver(function(mutations){for(var i=0;i<mutations.length;i++){var mutation=mutations[i];if(mutation.type==="attributes")stripNode(mutation.target);var added=mutation.addedNodes;for(var j=0;j<added.length;j++)stripTree(added[j])}});observer.observe(document.documentElement,{attributes:true,childList:true,subtree:true});document.addEventListener("DOMContentLoaded",function(){run();setTimeout(function(){observer.disconnect()},4000)})})();`
