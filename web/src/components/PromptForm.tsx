import { useState, useEffect, type FormEvent } from "react";
import { fetchProjects } from "../api";

interface Props {
  onSubmit: (project: string, prompt: string) => void;
  disabled: boolean;
}

export function PromptForm({ onSubmit, disabled }: Props) {
  const [projects, setProjects] = useState<string[]>([]);
  const [project, setProject] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    fetchProjects().then((p) => {
      setProjects(p);
      if (p.length > 0 && !project) setProject(p[0]);
    });
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!project.trim() || !prompt.trim()) return;
    onSubmit(project.trim(), prompt.trim());
    setPrompt("");
  };

  const inputStyle = {
    padding: "8px 12px",
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 6,
    color: "#c9d1d9",
    fontSize: 14,
    outline: "none",
  } as const;

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", alignItems: "flex-end", gap: 8 }}
    >
      <select
        value={project}
        onChange={(e) => setProject(e.target.value)}
        style={{ ...inputStyle, minWidth: 140, cursor: "pointer", height: 38 }}
      >
        {projects.length === 0 && <option value="">No projects</option>}
        {projects.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Send a message..."
        rows={1}
        style={{
          ...inputStyle,
          flex: 1,
          resize: "none",
          fontFamily: "inherit",
          minHeight: 38,
          maxHeight: 120,
          lineHeight: "22px",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = Math.min(el.scrollHeight, 120) + "px";
        }}
      />
      <button
        type="submit"
        disabled={disabled || !project.trim() || !prompt.trim()}
        style={{
          padding: "8px 16px",
          height: 38,
          background: disabled ? "#21262d" : "#238636",
          color: disabled ? "#484f58" : "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {disabled ? "Running..." : "Send"}
      </button>
    </form>
  );
}
