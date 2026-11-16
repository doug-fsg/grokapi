import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[120px] w-full rounded-md border border-input bg-[var(--grokbott-surface-1)] px-3 py-2 text-sm",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
