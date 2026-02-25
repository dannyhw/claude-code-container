import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { Select } from "@base-ui/react/select";
import { fetchProjects, createProject } from "../api";

const NEW_PROJECT = "__new__";

interface Props {
  onSubmit: (project: string, prompt: string) => void;
  onProjectChange?: (project: string | null) => void;
  disabled: boolean;
}

export function PromptForm({ onSubmit, onProjectChange, disabled }: Props) {
  const [projects, setProjects] = useState<string[]>([]);
  const [project, setProject] = useState("");
  const [newName, setNewName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);
  const newNameRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchProjects().then((p) => {
      setProjects(p);
      if (p.length > 0 && !project) {
        setProject(p[0]);
        onProjectChange?.(p[0]);
      }
    });
  }, []);

  const isNewMode = project === NEW_PROJECT;
  const resolvedProject = isNewMode ? newName.trim() : project.trim();

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!resolvedProject || !prompt.trim() || disabled || creatingProject) return;

    if (isNewMode) {
      if (!/^[a-zA-Z0-9_-]+$/.test(resolvedProject)) return;
      setCreatingProject(true);
      try {
        await createProject(resolvedProject);
        setProjects((prev) => [...prev, resolvedProject]);
        setProject(resolvedProject);
        setNewName("");
      } catch {
        return;
      } finally {
        setCreatingProject(false);
      }
    }

    onSubmit(resolvedProject, prompt.trim());
    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "";
    }
  }, [resolvedProject, prompt, disabled, creatingProject, isNewMode, onSubmit]);

  const handleProjectChange = (value: string | null) => {
    if (!value) return;
    setProject(value);
    onProjectChange?.(value === NEW_PROJECT ? null : value);
    if (value === NEW_PROJECT) {
      setTimeout(() => newNameRef.current?.focus(), 0);
    }
  };

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const canSubmit =
    !disabled &&
    !creatingProject &&
    !!resolvedProject &&
    (!isNewMode || /^[a-zA-Z0-9_-]+$/.test(resolvedProject)) &&
    !!prompt.trim();

  const selectItems = [
    ...projects.map((p) => ({ label: p, value: p })),
    { label: "+ New project", value: NEW_PROJECT },
  ];

  return (
    <form onSubmit={handleSubmit}>
      {/* Composer box */}
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
        <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
          {/* Left: project selector */}
          <div className="flex items-center gap-1.5">
            <Select.Root
              value={project}
              onValueChange={handleProjectChange}
            >
              <Select.Trigger
                className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-md text-[12px] font-mono text-tx-2 bg-elevated border border-bdr cursor-pointer hover:border-bdr-light hover:text-tx transition-colors outline-none data-[popup-open]:border-bdr-light"
              >
                <Select.Value placeholder="Select project" />
                <Select.Icon className="text-tx-3">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner sideOffset={6} alignItemWithTrigger={false} side="top">
                  <Select.Popup className="bg-elevated border border-bdr rounded-lg shadow-lg shadow-black/40 py-1 outline-none">
                    <Select.List>
                      {selectItems.map((item) => (
                        <Select.Item
                          key={item.value}
                          value={item.value}
                          className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-mono text-tx-2 outline-none cursor-pointer data-[highlighted]:bg-hovr data-[highlighted]:text-tx data-[selected]:text-tx transition-colors"
                        >
                          <Select.ItemIndicator className="text-ok">
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </Select.ItemIndicator>
                          <Select.ItemText>{item.label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>

            {isNewMode && (
              <input
                ref={newNameRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="project-name"
                className="h-7 px-2 bg-elevated border border-bdr rounded-md text-[12px] font-mono text-tx outline-none w-32 focus:border-bdr-light transition-colors placeholder:text-tx-3"
              />
            )}
          </div>

          {/* Right: send button + hint */}
          <div className="flex items-center gap-2">
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
      </div>
    </form>
  );
}
