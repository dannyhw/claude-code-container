import { useState, useRef, useCallback, type FormEvent } from "react";

interface Props {
  onSubmit: (prompt: string) => void;
  disabled: boolean;
}

export function PromptForm({ onSubmit, disabled }: Props) {
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || disabled) return;
    onSubmit(prompt.trim());
    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "";
    }
  }, [prompt, disabled, onSubmit]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const canSubmit = !disabled && !!prompt.trim();

  return (
    <form onSubmit={handleSubmit}>
      <div
        className={[
          "rounded-xl border bg-surface transition-[border-color,box-shadow] duration-150",
          focused
            ? "border-bdr-light shadow-[0_0_0_1px_var(--color-bdr-light)]"
            : "border-bdr",
        ].join(" ")}
      >
        {/* Textarea */}
        <div className="px-3.5 pt-3 pb-2">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              resizeTextarea();
            }}
            placeholder="Send a message..."
            rows={1}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="block w-full bg-transparent text-tx text-sm font-sans outline-none resize-none leading-6 min-h-6 max-h-40 placeholder:text-tx-3"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSubmit) handleSubmit(e);
              }
            }}
          />
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-end gap-2 px-3 pb-2.5">
          <span className="text-[11px] text-tx-3 hidden sm:inline">
            <kbd className="px-1 py-px bg-root border border-bdr rounded text-[10px] font-mono">
              Enter
            </kbd>
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            className={[
              "flex items-center justify-center h-7 px-3 rounded-md text-xs font-medium transition-all shrink-0 gap-1.5",
              canSubmit
                ? "bg-tx text-root cursor-pointer hover:opacity-90 active:scale-[0.97]"
                : "bg-elevated text-tx-3 border border-bdr cursor-not-allowed",
            ].join(" ")}
            aria-label="Send"
          >
            {disabled ? (
              <>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="animate-spin">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6" />
                </svg>
                <span>Running</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M7 12V2M7 2L3 6M7 2l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
