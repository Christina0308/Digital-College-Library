import type { ReactNode } from "react";

export function SectionHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {detail ? <p className="section-detail">{detail}</p> : null}
      </div>
      {action ? <div className="section-heading-action">{action}</div> : null}
    </div>
  );
}
