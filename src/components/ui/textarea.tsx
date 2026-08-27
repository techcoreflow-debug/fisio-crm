import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex w-full rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink shadow-sm placeholder:text-ink-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500/40",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
