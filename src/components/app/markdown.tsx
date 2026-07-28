import ReactMarkdown from "react-markdown";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-theory max-w-none text-[0.95rem] leading-relaxed text-(--color-ink)">
      <ReactMarkdown
        components={{
          p: (props) => <p className="mb-4" {...props} />,
          strong: (props) => <strong className="font-bold text-(--color-ink)" {...props} />,
          ul: (props) => <ul className="mb-4 list-disc space-y-1.5 pl-5" {...props} />,
          ol: (props) => <ol className="mb-4 list-decimal space-y-1.5 pl-5" {...props} />,
          li: (props) => <li className="text-(--color-ink-soft)" {...props} />,
          h1: (props) => <h2 className="font-display mb-3 mt-2 text-xl font-extrabold" {...props} />,
          h2: (props) => <h3 className="font-display mb-3 mt-2 text-lg font-extrabold" {...props} />,
          code: (props) => (
            <code className="rounded bg-black/5 px-1.5 py-0.5 text-sm" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
