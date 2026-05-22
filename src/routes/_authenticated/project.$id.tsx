import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Target, Sparkles, Zap, FileCode, Rocket, Check, Lock, ArrowRight, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/project/$id")({
  component: ProjectWorkspace,
});

type Status = "profile" | "discover" | "score" | "blueprint" | "launch" | "completed";
const STEPS: { key: Status; label: string; icon: any; desc: string }[] = [
  { key: "profile", label: "Profile", icon: Target, desc: "Tell ZITA about you and your audience." },
  { key: "discover", label: "Discover", icon: Sparkles, desc: "Find real, painful problems worth solving." },
  { key: "score", label: "Score", icon: Zap, desc: "Rank ideas across 6 dimensions." },
  { key: "blueprint", label: "Blueprint", icon: FileCode, desc: "Generate the build spec for your tool." },
  { key: "launch", label: "Launch", icon: Rocket, desc: "Get your launch kit and go live." },
];
const idx = (s: string) => Math.max(0, STEPS.findIndex((x) => x.key === s));

function ProjectWorkspace() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) {
        console.error("Failed to load project:", error);
        throw error;
      }
      return data;
    },
  });

  useEffect(() => {
    if (error) console.error("Project workspace error:", error);
  }, [error]);

  const reached = project ? (project.status === "completed" ? 4 : idx(project.status)) : 0;
  const [active, setActive] = useState<Status>("profile");

  useEffect(() => {
    if (project) setActive((project.status === "completed" ? "launch" : project.status) as Status);
  }, [project?.status]);

  if (isLoading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (error || !project) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-center text-sm text-muted-foreground">Could not load this project.</div>;
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["project", id] });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <ProjectHeader project={project} onSaved={refresh} />

      <StepBar active={active} reached={reached} status={project.status} onPick={setActive} />

      <div className="mt-8">
        {active === "profile" && <ProfilePanel project={project} onSaved={(next) => { refresh(); setActive(next); }} />}
        {active === "discover" && <Placeholder step={STEPS[1]} />}
        {active === "score" && <Placeholder step={STEPS[2]} />}
        {active === "blueprint" && <Placeholder step={STEPS[3]} />}
        {active === "launch" && <Placeholder step={STEPS[4]} />}
      </div>
    </div>
  );
}

// ---------- Header with inline-editable name + status badge ----------
function ProjectHeader({ project, onSaved }: { project: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  useEffect(() => setName(project.name), [project.name]);

  const save = async () => {
    setEditing(false);
    const trimmed = name.trim() || "Untitled Project";
    if (trimmed === project.name) return;
    const { error } = await supabase.from("projects").update({ name: trimmed, updated_at: new Date().toISOString() }).eq("id", project.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Renamed");
    onSaved();
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="text-xs uppercase tracking-widest text-primary">Project</div>
      {editing ? (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setName(project.name); setEditing(false); } }}
          className="h-9 max-w-md text-xl font-bold"
        />
      ) : (
        <h1 onClick={() => setEditing(true)} className="cursor-text rounded px-1 text-2xl font-bold hover:bg-accent/40" title="Click to rename">
          {project.name}
        </h1>
      )}
      <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs uppercase tracking-wider text-primary">
        {project.status}
      </span>
    </div>
  );
}

// ---------- Step bar ----------
function StepBar({ active, reached, status, onPick }: { active: Status; reached: number; status: string; onPick: (s: Status) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="relative flex items-center justify-between gap-2">
        <div className="absolute left-5 right-5 top-5 h-0.5 -translate-y-1/2 bg-border" />
        <div className="absolute left-5 top-5 h-0.5 -translate-y-1/2 bg-gradient-electric transition-all" style={{ width: `calc((100% - 2.5rem) * ${reached / (STEPS.length - 1)})` }} />
        {STEPS.map((s, i) => {
          const locked = i > reached;
          const done = i < reached || status === "completed";
          const current = active === s.key;
          return (
            <button
              key={s.key}
              disabled={locked}
              onClick={() => !locked && onPick(s.key)}
              title={locked ? "Complete previous steps first" : s.label}
              className={cn(
                "relative z-10 flex flex-1 flex-col items-center gap-1.5 rounded-lg px-2 py-2 transition",
                locked ? "cursor-not-allowed opacity-40" : "hover:bg-accent/40",
              )}
            >
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition",
                current && "border-primary bg-gradient-electric text-primary-foreground shadow-glow",
                !current && done && "border-success bg-success/20 text-success",
                !current && !done && !locked && "border-border bg-card text-foreground",
                locked && "border-border bg-card text-muted-foreground",
              )}>
                {locked ? <Lock className="h-4 w-4" /> : done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <s.icon className={cn("h-3 w-3", current ? "text-primary" : "text-muted-foreground")} />
                <span className={cn(current && "font-semibold text-foreground", !current && "text-muted-foreground")}>{s.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Step 1: Profile (fully functional) ----------
const TOOL_TYPES = ["Lead magnet", "Paid mini-tool", "Client tool", "Internal business tool", "Not sure yet"];
const SKILLS = ["Beginner", "Intermediate", "Advanced"];
const TIMES = ["<5h", "5-10h", "10-20h", "20+h"];

function ProfilePanel({ project, onSaved }: { project: any; onSaved: (next: Status) => void }) {
  const existing = (project.profile_data ?? {}) as Record<string, string>;
  const [form, setForm] = useState({
    expertise: existing.expertise ?? "",
    audience: existing.audience ?? "",
    offer: existing.offer ?? "",
    topic: existing.topic ?? "",
    tool_type: existing.tool_type ?? "Not sure yet",
    skill_level: existing.skill_level ?? "Beginner",
    time_per_week: existing.time_per_week ?? "5-10h",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.expertise.trim() || !form.audience.trim() || !form.offer.trim()) {
      toast.error("Please fill the first three fields.");
      return;
    }
    setSaving(true);
    const nextStatus = project.status === "profile" ? "discover" : project.status;
    const { error } = await supabase
      .from("projects")
      .update({ profile_data: form, status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved — Discover unlocked");
    onSaved("discover");
  };

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
      <div>
        <h2 className="text-lg font-semibold">Step 1 — Your Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">ZITA uses this to tailor every idea to you.</p>
      </div>

      <Field label="What do you do? *">
        <Textarea rows={2} value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })} placeholder="Your expertise / background" />
      </Field>
      <Field label="Who do you help? *">
        <Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Target audience" />
      </Field>
      <Field label="What do you sell or want to sell? *">
        <Textarea rows={2} value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="Your current or planned offer" />
      </Field>
      <Field label="Problem area or niche (optional)">
        <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
      </Field>

      <RadioGroup label="Preferred tool type" value={form.tool_type} options={TOOL_TYPES} onChange={(v) => setForm({ ...form, tool_type: v })} />
      <RadioGroup label="Your build skill level" value={form.skill_level} options={SKILLS} onChange={(v) => setForm({ ...form, skill_level: v })} />
      <RadioGroup label="Time available per week" value={form.time_per_week} options={TIMES} onChange={(v) => setForm({ ...form, time_per_week: v })} />

      <Button type="submit" disabled={saving} className="bg-gradient-electric text-primary-foreground shadow-glow">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save & Continue → Discover <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RadioGroup({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              value === o
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Placeholder for steps 2-5 ----------
function Placeholder({ step }: { step: { key: Status; label: string; icon: any; desc: string } }) {
  const Icon = step.icon;
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-primary" />
      <h2 className="mt-3 text-lg font-semibold">{step.label}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{step.desc}</p>
      <Button disabled className="mt-5 opacity-50">Run {step.label}</Button>
      <div className="mt-3 text-xs uppercase tracking-widest text-primary/70">Building this step next</div>
    </div>
  );
}
