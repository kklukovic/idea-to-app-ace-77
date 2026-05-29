import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Check, X, ArrowRight,
  Target, Sparkles, Zap, FileCode, Rocket,
  Mail, Users, Briefcase, Star, Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const CTA_URL = "https://earnmoon.thrivecart.com/zita-os-founder-access/";

const amberGradient: React.CSSProperties = {
  background: "linear-gradient(135deg, #F5A623 0%, #FFD166 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

const steps = [
  {
    icon: Target,
    label: "Profile",
    desc: "Tell ZITA who you are, who you help, and what you sell. This shapes every idea and recommendation that follows.",
  },
  {
    icon: Sparkles,
    label: "Discover",
    desc: "Fast AI mode or paste your own research. ZITA surfaces 5-7 evidence-led app ideas matched to your audience and skills.",
  },
  {
    icon: Zap,
    label: "Score",
    desc: "Each idea is ranked across 6 dimensions: market size, competition, buildability, monetization potential, and more. Pick your winner with confidence, not guesswork.",
  },
  {
    icon: FileCode,
    label: "Blueprint",
    desc: "Full product requirements document plus a copy-paste build prompt for Lovable, Cursor, or Claude Code. Your developer or the AI knows exactly what to build.",
  },
  {
    icon: Rocket,
    label: "Launch",
    desc: "A founder offer, social posts, DM templates, 7-day launch plan, and a $1 auction template. Because building the app is only half the job.",
  },
];

const appTypes = [
  {
    icon: Mail,
    title: "Lead Magnet App",
    text: "Turn your knowledge into a free tool that captures emails and grows your audience on autopilot. Build once, collect leads forever.",
  },
  {
    icon: Users,
    title: "Membership or Community App",
    text: "Give your audience a private space with tools, resources, or automation baked in. Charge monthly. Build loyalty.",
  },
  {
    icon: Briefcase,
    title: "App You Sell to Local Businesses",
    text: "Restaurants, clinics, salons, real estate agents. They all have repetitive problems you can solve with a simple app. Build it once, license it many times.",
  },
  {
    icon: Star,
    title: "Tool for Influencers and Creators",
    text: "Creators with audiences need tools their followers will love. Build the app they would promote to their list and split the revenue.",
  },
  {
    icon: Settings,
    title: "Internal Tool to Save Time and Money",
    text: "Automate what your team does manually. Cut costs. Eliminate repetitive tasks. Your own business becomes more valuable and you can sell the tool to others doing the same thing.",
  },
  {
    icon: Zap,
    title: "Micro App That Solves One Real Problem",
    text: "The best-selling apps do one thing perfectly. ZITA helps you find that one problem worth solving, validate it, and build it right.",
  },
];

const forYou = [
  "You have ideas but don't know which one to build",
  "You've built things nobody used or paid for",
  "You want to use AI to build but need a validated direction first",
  "You're a consultant or freelancer who wants a productized offer",
  "You want to build apps you can sell to businesses or creators",
  "You're tired of starting over",
];

const notForYou = [
  "You want someone to build the app for you",
  "You're looking for get-rich-quick shortcuts",
  "You already have a validated idea and a paying customer",
];

const features = [
  "Full 5-step ZITA OS workflow",
  "100 credits per month (3+ complete projects)",
  "Blueprint + Lovable-ready build prompt",
  "Complete launch system per project",
  "Growth Library and templates",
  "Every feature shipped going forward",
  "Founder pricing locked forever",
];

const faqs = [
  {
    q: "What exactly is ZITA OS?",
    a: "A guided 5-step system that takes you from zero idea to a validated app blueprint and launch plan in one sitting. It's not a course. It's a working tool.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. ZITA outputs a Lovable-ready build prompt. You paste it, and AI builds your app.",
  },
  {
    q: "How is this different from ChatGPT?",
    a: "ChatGPT gives you answers. ZITA gives you a system. Profile, Discover, Score, Blueprint, Launch. Each step builds on the last with proven logic under the hood.",
  },
  {
    q: "What do 100 credits get me?",
    a: "Enough to complete 3 or more full projects per month, from idea discovery to launch plan.",
  },
  {
    q: "Is there a discount available?",
    a: "If you received a coupon code, enter it at checkout. Codes are shared privately and are limited.",
  },
  {
    q: "What if I already have an idea?",
    a: "Skip to Step 3, Score. Validate your existing idea before you build it. Most people are surprised by what the scoring reveals.",
  },
];

function CtaButton({ label = "Get Founder Access - $97", large = false }: { label?: string; large?: boolean }) {
  return (
    <a
      href={CTA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-[6px] bg-[#F5A623] text-[#0D0D0D] font-bold hover:bg-[#E09520] transition-colors ${large ? "px-8 py-4 text-base" : "px-6 py-3 text-sm"}`}
    >
      {label} <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#D4D4D4]">

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-[#0D0D0D] border-b border-[#2A2A2A]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center">
            <img src="/brand/horizontal_transparent.png" alt="ZITA OS" className="hidden h-8 w-auto sm:block" />
            <img src="/brand/app_icon_512.png" alt="ZITA OS" className="block h-7 w-7 rounded-lg sm:hidden" />
          </Link>
          <a
            href={CTA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[6px] bg-[#F5A623] px-4 py-2 text-sm font-bold text-[#0D0D0D] hover:bg-[#E09520] transition-colors"
          >
            Get Founder Access - $97
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-16 text-center">
        <div
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-[#F5A623]"
          style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)" }}
        >
          Founder Access - One Time $97
        </div>
        <h1
          className="mt-6 text-4xl font-black text-white md:text-6xl leading-tight"
          style={{ letterSpacing: "-0.02em" }}
        >
          Building an app is now the easy part.<br />
          <span style={amberGradient}>Building one people actually buy</span><br />
          is where everyone fails.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[#D4D4D4]">
          ZITA OS is a guided 5-step system that takes you from zero idea to a validated, blueprinted, launch-ready app in one sitting. No guessing. No wasted builds. No dev bills.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <CtaButton label="Get Instant Access - $97" large />
          <p className="text-xs text-[#707070]">One-time payment. Lifetime access. No subscription.</p>
        </div>
      </section>

      {/* PAIN */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-3xl font-extrabold uppercase tracking-[0.05em] text-white">
          You're probably here because...
        </h2>
        <ul className="mt-8 space-y-4">
          {[
            "You have ideas but have no clue which one is actually worth building",
            "You've already built something nobody paid for and you don't want to repeat that",
            "You see people way less technical than you launching apps and charging for them",
            "You've been \"figuring out where to start\" for months while others are shipping",
            "You're spending money on AI tools but still staring at a blank page",
            "You're afraid to build the wrong thing again and waste another 3 months",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-[#D4D4D4]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A623]" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-base font-bold text-white">That stops here.</p>
      </section>

      {/* BEFORE / AFTER */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-extrabold uppercase tracking-[0.05em] text-white">
          The way app building used to work vs. now
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-[8px] border border-[#FF4444]/30 bg-[#FF4444]/5 p-7">
            <div className="mb-5 text-xs font-bold uppercase tracking-widest text-[#FF4444]">Before</div>
            <ul className="space-y-4">
              {[
                "Hiring a developer: $5,000-$50,000 minimum",
                "Waiting 3-6 months to see anything working",
                "Building based on a gut feeling, not validated data",
                "Launching something nobody wanted",
                "Going back to zero",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[#707070]">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4444]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[8px] border border-[#F5A623]/30 bg-[#F5A623]/5 p-7">
            <div className="mb-5 text-xs font-bold uppercase tracking-widest text-[#F5A623]">After ZITA OS</div>
            <ul className="space-y-4">
              {[
                "First working version in hours, not months",
                "Idea validated before you write a single line of code",
                "Blueprint generated automatically, ready for Lovable or Cursor",
                "Launch plan included from day one",
                "Built to sell, not just to exist",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[#D4D4D4]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A623]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* WHAT WILL YOU BUILD */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-extrabold uppercase tracking-[0.05em] text-white">What will you build?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-[#707070]">
          ZITA OS works for any solo builder, consultant, or entrepreneur. Here are the most common apps our users build:
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {appTypes.map((type) => (
            <div
              key={type.title}
              className="rounded-[8px] border border-[#2A2A2A] bg-[#161616] p-6 transition-all duration-200 hover:border-[#F5A623] hover:shadow-[0_0_20px_rgba(245,166,35,0.08)]"
            >
              <div className="grid h-10 w-10 place-items-center rounded-[6px] bg-[#1E1E1E]">
                <type.icon className="h-5 w-5 text-[#F5A623]" />
              </div>
              <div className="mt-4 font-bold text-white">{type.title}</div>
              <p className="mt-2 text-sm text-[#707070] leading-relaxed">{type.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CORE MESSAGE */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-[8px] border border-[#2A2A2A] bg-[#161616] p-10">
          <h2
            className="text-2xl font-extrabold uppercase tracking-[0.05em] text-white md:text-3xl leading-snug"
          >
            The market is flooded with apps nobody needs.<br />
            <span style={amberGradient}>ZITA makes sure yours isn't one of them.</span>
          </h2>
          <div className="mt-6 space-y-4 text-sm text-[#707070] leading-relaxed">
            <p>
              AI tools like Lovable, Cursor, and Claude have made building apps accessible to everyone. That's great news. And a serious problem.
            </p>
            <p className="font-semibold text-[#D4D4D4]">
              Everyone is building. Few are selling.
            </p>
            <p>
              The difference between an app that generates income and one that collects digital dust is not the code. It's the thinking that happened before the first line was written.
            </p>
            <p>
              ZITA OS forces that thinking. Every step, from your profile to your launch plan, is designed to make sure you build something the market actually wants to pay for.
            </p>
          </div>
        </div>
      </section>

      {/* FIVE STEPS */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-extrabold uppercase tracking-[0.05em] text-white">Five steps. One sitting.</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[#707070]">
          Each step builds on the last. You don't move forward until the previous step is solid.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {steps.map((s, i) => (
            <div
              key={s.label}
              className="rounded-[8px] border border-[#2A2A2A] bg-[#161616] p-5 transition-all duration-200 hover:border-[#F5A623] hover:shadow-[0_0_20px_rgba(245,166,35,0.08)]"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-[6px] bg-[#1E1E1E]">
                  <s.icon className="h-4 w-4 text-[#F5A623]" />
                </div>
                <span className="text-xs font-mono text-[#707070]">0{i + 1}</span>
              </div>
              <div className="mt-3 font-bold text-white">{s.label}</div>
              <p className="mt-1 text-xs text-[#707070] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* LAUNCH SECTION */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-3xl font-extrabold uppercase tracking-[0.05em] text-white leading-snug">
          Most tools stop at "build it."<br />
          <span style={amberGradient}>We don't.</span>
        </h2>
        <div className="mx-auto mt-6 max-w-2xl space-y-4 text-sm text-[#707070] leading-relaxed">
          <p>
            Every project inside ZITA OS ends with a full launch system. Posts. DMs. Offer structure. Pricing suggestions. A 7-day action plan.
          </p>
          <p>
            Because the goal was never to have an app.<br />
            The goal was to have an app that earns.
          </p>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-extrabold uppercase tracking-[0.05em] text-white">ZITA OS is for you if...</h2>
            <ul className="mt-6 space-y-3">
              {forYou.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[#D4D4D4]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A623]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-extrabold uppercase tracking-[0.05em] text-white">ZITA OS is NOT for you if...</h2>
            <ul className="mt-6 space-y-3">
              {notForYou.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[#707070]">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4444]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div
          className="rounded-[8px] border border-[#F5A623]/30 bg-[#161616] p-10 text-center"
          style={{ boxShadow: "0 0 40px rgba(245,166,35,0.07)" }}
        >
          <div className="text-xs font-bold uppercase tracking-widest text-[#F5A623]">Founder Access</div>
          <div className="mt-3 flex items-baseline justify-center gap-3">
            <span className="text-5xl font-black text-white">$97</span>
            <span className="text-xl text-[#707070] line-through">$197</span>
            <span className="text-sm text-[#707070]">one-time</span>
          </div>
          <ul className="mx-auto mt-8 max-w-sm space-y-3 text-left text-sm">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[#D4D4D4]">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A623]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <CtaButton large />
          </div>
          <p className="mt-3 text-xs text-[#707070]">
            One-time payment. No subscription. Use a coupon code at checkout if you have one.
          </p>
        </div>
      </section>

      {/* GUARANTEE */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div
          className="rounded-[8px] border border-[#F5A623]/40 bg-[#1A1600] p-10"
          style={{ boxShadow: "0 0 40px rgba(245,166,35,0.05)" }}
        >
          <div className="text-xs font-bold uppercase tracking-widest text-[#F5A623]">Risk-free</div>
          <h2 className="mt-3 text-2xl font-extrabold uppercase tracking-[0.05em] text-white md:text-3xl">
            The One Sitting Guarantee
          </h2>
          <div className="mt-6 space-y-4 text-sm text-[#D4D4D4] leading-relaxed">
            <p>
              Go through the full ZITA OS workflow. Complete all 5 steps. If you don't walk away with a validated app idea, a full blueprint, and a launch plan you can actually use — email me and I'll refund every cent.
            </p>
            <p>
              No hoops. No questions. The only condition: you actually use it.
            </p>
          </div>
          <p className="mt-6 text-sm font-semibold text-[#F5A623]">Kreso, Founder of ZITA OS</p>
        </div>
      </section>

      {/* VALUE STACK */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-center text-3xl font-extrabold uppercase tracking-[0.05em] text-white">
          Everything included at founder pricing
        </h2>
        <div className="mt-8 rounded-[8px] border border-[#2A2A2A] bg-[#161616] overflow-hidden">
          {[
            { label: "Full 5-step ZITA OS workflow", value: "$197 value" },
            { label: "AI-powered idea discovery (Fast Mode)", value: "$97 value" },
            { label: "6-dimension scoring system", value: "$97 value" },
            { label: "Full PRD + Lovable-ready build prompt", value: "$147 value" },
            { label: "Complete launch system (posts, DMs, 7-day plan)", value: "$147 value" },
            { label: "Growth Library and templates", value: "$97 value" },
            { label: "All future features at founder price", value: "priceless" },
          ].map((item, i, arr) => (
            <div
              key={item.label}
              className={`flex items-center justify-between px-6 py-4 text-sm ${i < arr.length - 1 ? "border-b border-[#2A2A2A]" : ""}`}
            >
              <div className="flex items-center gap-3 text-[#D4D4D4]">
                <Check className="h-4 w-4 shrink-0 text-[#F5A623]" />
                {item.label}
              </div>
              <span className="shrink-0 pl-4 text-[#707070]">{item.value}</span>
            </div>
          ))}
          <div className="border-t border-[#2A2A2A] bg-[#1A1A1A] px-6 py-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#707070]">Total value</span>
              <span className="text-[#707070] line-through">$782</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-bold text-white">Founder price</span>
              <span className="text-2xl font-black text-[#F5A623]">$97 <span className="text-sm font-normal text-[#707070]">one-time</span></span>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          <CtaButton large />
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-center text-3xl font-extrabold uppercase tracking-[0.05em] text-white">FAQ</h2>
        <div className="mt-8 space-y-4">
          {faqs.map((f) => (
            <div
              key={f.q}
              className="rounded-[8px] border border-[#2A2A2A] bg-[#161616] p-5 transition-all duration-200 hover:border-[#F5A623] hover:shadow-[0_0_20px_rgba(245,166,35,0.08)]"
            >
              <div className="font-bold text-white">{f.q}</div>
              <p className="mt-2 text-sm text-[#707070] leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-3xl font-extrabold uppercase tracking-[0.05em] text-white">Ready to build something that earns?</h2>
        <p className="mt-3 text-sm text-[#707070]">
          Join founders who stopped guessing and started building with a system.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <CtaButton label="Get Founder Access - $97" large />
          <p className="text-xs text-[#707070]">One-time payment. Lifetime access. No subscription.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#2A2A2A] py-10 text-center text-xs text-[#707070]">
        <div className="flex items-center justify-center gap-4 mb-2">
          <Link to="/auth" className="hover:text-white transition-colors">Sign in</Link>
          <span>zitaos.com</span>
        </div>
        <div>ZITA OS - Zero Idea To App</div>
      </footer>

    </div>
  );
}
