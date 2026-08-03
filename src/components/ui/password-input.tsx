import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de senha com botão de mostrar/esconder — mesma API do Input,
 * só ignora a prop `type` (sempre alterna entre "password" e "text").
 */
const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, ...props }, ref) => {
    const [visivel, setVisivel] = React.useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={visivel ? "text" : "password"} className={cn("pr-9", className)} {...props} />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
          aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
          tabIndex={-1}
        >
          {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
