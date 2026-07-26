import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium font-body",
  {
    variants: {
      variant: {
        neutral: "bg-surface-sunken text-ink-soft",
        clinical: "bg-clinical-50 text-clinical-700",
        recovery: "bg-recovery-100 text-recovery-600",
        attention: "bg-attention-100 text-attention-600",
        critical: "bg-critical-100 text-critical-600",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
