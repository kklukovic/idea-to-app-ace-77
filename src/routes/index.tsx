import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Sparkles, Zap, Target, FileCode, Rocket, Check, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

const steps = [
  { icon: Target, label: "Profile", desc: "Tell ZITA who you are, who you help, what you sell." },
  { icon: Sparkles, label: "Discover", desc: "Fast AI mode or paste your own research — 5-7 evidence-led ideas." },
  { icon: Zap, label: "Score", desc: "Each idea ranked across 6 dimensions. Pick your winner." },
  { icon: FileCode, label: "Blueprint", desc: "Full PRD + a copy-paste Lovable build prompt." },
  { icon: Rocket, label: "Launch", desc: "Founder offer, posts, DMs, 7-day plan, $1 auction template." },
];

const faqs = [
  { q: "What is ZITA OS?", a: "A guided assistant that takes you from zero idea to app blueprint, build prompt, and launch plan — in one sitting." },
  { q: "How is this different from ChatGPT?", a: "ZITA is an opinionated workflow. Profile → Discover → Score → Blueprint → Launch. Each step builds on the last, with founder-tested prompts under the hood." },
  { q: "What do I get with founder access?", a: "100 credits per month (3+ complete projects), Growth Library, and lifetime founder pricing locked at $47 while I build the MVP live. Price moves to $97 once v1 ships." },
  { q: "Do I need to code?", a: "No. ZITA outputs a Lovable-ready prompt. Paste it, ship it." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-electric shadow-glow">
              <span className="text-sm font-bold text-primary-foreground">Z</span>
            </div>
            <span className="text-lg font-bold tracking-tight">ZITA OS</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link to="/auth" search={{ mode: "signup" }} className="rounded-md bg-gradient-electric px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow">
              Founder access
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          Building live — founder access $47
        </div>
        <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-7xl">
          Zero Idea <span className="text-gradient-electric">To App</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          ZITA OS is your guided app-building assistant. From blank page to researched idea, ranked
          score, full blueprint, and a launch plan — in one sitting.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-2 rounded-md bg-gradient-electric px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
            Let ZITA help you find your app idea <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/auth" className="inline-flex items-center rounded-md border border-border bg-card/50 px-6 py-3 text-sm font-medium">
            Sign in
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight">Five steps. One sitting.</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
          Each step unlocks the next. No blank pages, no choice paralysis.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {steps.map((s, i) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs font-mono text-muted-foreground">0{i + 1}</span>
              </div>
              <div className="mt-3 font-semibold">{s.label}</div>
              <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-card to-accent/30 p-8 text-center shadow-glow">
          <div className="text-xs uppercase tracking-widest text-primary">Founder pricing</div>
          <div className="mt-2 text-5xl font-bold">$47<span className="text-base font-normal text-muted-foreground">/lifetime</span></div>
          <p className="mt-2 text-sm text-muted-foreground">
            Locked while I build the MVP live. Goes to $97 once v1 ships.
          </p>
          <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
            {[
              "100 credits / month (3+ full projects)",
              "Full 5-step workflow",
              "Growth Library + launch templates",
              "Every feature I ship next",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-success shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link to="/auth" search={{ mode: "signup" }} className="mt-8 inline-flex rounded-md bg-gradient-electric px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
            Claim founder access
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight">FAQ</h2>
        <div className="mt-8 space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-xl border border-border bg-card p-5">
              <div className="font-semibold">{f.q}</div>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        ZITA OS — Zero Idea To App. Built live.
      </footer>
    </div>
  );
}
