import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** No raw HTML or remote images: previews cannot execute code or load tracking pixels. */
export function MarkdownView({ children }: { children: string }) {
  return (
    <div className="markdown-content min-w-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ alt }) => (
            <span className="text-muted-foreground">[Image: {alt || "image"}]</span>
          ),
        }}
      >
        {children.slice(0, 100000)}
      </ReactMarkdown>
      {children.length > 100000 && (
        <p role="status">Preview limited to 100,000 characters. Full text is preserved in Edit.</p>
      )}
    </div>
  );
}
