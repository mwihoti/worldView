import sanitizeHtml from "sanitize-html";

/*
 * Article bodies come from three places — the Hashnode RSS feed, the CMS's
 * rich-text editor, and the restored markdown posts — and are inserted into
 * the page as HTML. Clean them first so none of those can run script on the
 * site: no <script>/<style>/event handlers, no javascript: or data: links,
 * iframes only from video embeds. Formatting the articles actually use
 * (headings, lists, tables, code, images, quotes) is kept.
 */

const EMBED_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "codepen.io",
  "open.spotify.com",
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "figure",
    "figcaption",
    "picture",
    "source",
    "iframe",
    "del",
    "ins",
    "sup",
    "sub",
    "mark",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
    source: ["srcset", "type", "media"],
    iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "frameborder"],
    code: ["class"],
    pre: ["class"],
    span: ["class"],
    th: ["colspan", "rowspan", "align"],
    td: ["colspan", "rowspan", "align"],
    ol: ["start", "type"],
    "*": ["id"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: EMBED_HOSTS,
  // Only syntax-highlighting classes survive (e.g. "language-ts", "hljs-…").
  allowedClasses: {
    code: [/^language-/, /^hljs/],
    pre: [/^language-/, /^hljs/],
    span: [/^hljs/],
  },
  transformTags: {
    // Links that open elsewhere can't reach back into this page.
    a: (tagName, attribs) => {
      if (attribs.target === "_blank") {
        attribs.rel = "noopener noreferrer";
      }
      return { tagName, attribs };
    },
  },
};

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}
