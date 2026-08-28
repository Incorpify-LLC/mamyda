//#region node_modules/.nitro/vite/services/ssr/assets/tags-gdYcVXxO.js
var TAG_RE = /#([a-zA-Z][a-zA-Z0-9_-]{0,47})/g;
function extractTags(body) {
	const found = /* @__PURE__ */ new Set();
	for (const match of body.matchAll(TAG_RE)) {
		const tag = match[1]?.toLowerCase();
		if (tag) found.add(tag);
	}
	return [...found];
}
function titleFromBody(body) {
	return (body.split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find((l) => l.length > 0) ?? "Untitled note").replace(/#([a-zA-Z][a-zA-Z0-9_-]{0,47})/g, "$1").slice(0, 80);
}
//#endregion
export { titleFromBody as n, extractTags as t };
