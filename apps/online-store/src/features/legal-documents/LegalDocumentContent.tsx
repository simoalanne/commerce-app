import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

import styles from "./LegalDocumentContent.module.css";

type LegalDocumentContentProps = {
  content: string;
  lastUpdatedLabel: string;
  className?: string;
};

export function LegalDocumentContent({
  content,
  lastUpdatedLabel,
  className,
}: LegalDocumentContentProps) {
  const contentClassName = [styles.content, className].filter(Boolean).join(" ");

  return (
    <div className={`${contentClassName} quotes`}>
      <p>{lastUpdatedLabel}</p>
      <ReactMarkdown rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
    </div>
  );
}
