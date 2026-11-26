import Link from "next/link";
import type React from "react";

// Currently unused since <MenuLinks> is in use
// DO not remove this component in case component above is removed later

interface ButtonProps {
  title: string;
  link: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function LinkButton({ title, link, className, style }: ButtonProps) {
  return (
    <div className={className} style={style}>
      <Link href={link}>{title}</Link>
    </div>
  );
}
