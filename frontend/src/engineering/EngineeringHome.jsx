// engineering/EngineeringHome.jsx
//
// tnega.app's home since 2026-10-19 (owner): the structural engineering
// review agent. The tokenized-stock product moved to /finance (basePath.js).
//
// WHAT THIS PAGE MAY SAY. The agent is in development: nothing here reads a
// drawing yet, so the page never says it does. It describes what is being
// built, shows the check library (the 3D town, public/town/, general
// engineering content from the public codes) and says who builds it.
//
// Loaded on its own by main.jsx, without the finance product's wallet
// providers, so the home page carries none of that code.

import React, { useEffect } from 'react';
import { ArrowRight, Maximize2, FileSearch, ListChecks, Calculator, Users, ShieldAlert, Linkedin, PlayCircle } from 'lucide-react';
import Brand from '../shell/Brand';
import ThemeToggle from '../theme/ThemeToggle';
import { updatePageMeta } from '../seoMeta';
import { ENGINEERING_COPY } from '../siteCopy';

const LINKEDIN = 'https://www.linkedin.com/in/saba-azadegan-2974b622a/';
// The owner's talk on YouTube (2026-10-26), embedded from youtube-nocookie.com (allowed in vercel.json frame-src).
const VIDEO_ID = 'JYRgS2VCLQQ';
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

const STEPS = [
  { icon: FileSearch, title: 'Read the drawing set', text: 'Every sheet of the PDF, at full resolution: plans, sections, schedules and general notes, with the code edition of record taken from the notes, never assumed.' },
  { icon: ListChecks, title: 'Run the checks for each member', text: 'One check module per member type, from the library in the town below: the governing clauses, the inputs each one needs, and what to ask for when an input is missing.' },
  { icon: Calculator, title: 'Calculate in code, not in the model', text: 'Lap lengths, shear capacities and drift limits are computed by deterministic code. The model decides which provision applies; it does not do the arithmetic.' },
  { icon: Users, title: 'Check it a second time, independently', text: 'A second reviewer that has not seen the first answer repeats the check. Where the two disagree, the finding is marked for the engineer.' },
  { icon: ShieldAlert, title: 'The engineer decides', text: 'Disagreements, missing inputs and every life-safety finding go to an engineer first. The report cites each clause, its consequence and the fix. The engineer of record signs, not the agent.' },
];

const WHY = [
  ['The code edition changes the answer', 'Rules that changed between ACI 318-14 and 318-19, or between ASCE 7-10 and 7-16, are applied in their old form from memory.'],
  ['Multi-part clauses are applied in half', 'A provision with several conditions is checked for the first one, and the rest is missed.'],
  ['Site inputs are assumed', 'Soil bearing, exposure class or seismic parameters that the documents do not give are filled in with a "typical" value instead of being asked for.'],
];

export default function EngineeringHome() {
  useEffect(() => { updatePageMeta({ ...ENGINEERING_COPY, path: '/' }); }, []);

  return (
    <div className="min-h-screen bg-page text-fg">
      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <a href="/" aria-label="Tnega home"><Brand markClassName="w-[32px] h-[32px]" wordClassName="text-[20px]" /></a>
          <nav className="flex items-center gap-4 sm:gap-6 text-[13px] font-semibold">
            <a href="#how" className="hidden sm:inline hover:underline">How it works</a>
            <a href="#town" className="hidden sm:inline hover:underline">Code town</a>
            <a href="#pipeline" className="hidden sm:inline hover:underline">Task pipeline</a>
            <a href="#talk" className="hidden md:inline hover:underline">Talk</a>
            <a href="/finance" className="inline-flex items-center gap-1 hover:underline">Tnega Finance <ArrowRight size={13} aria-hidden="true" /></a>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main>
        <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-14 pb-12 sm:pt-20">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Structural engineering · in development</p>
          <h1 className="mt-3 max-w-[820px] text-[34px] leading-[40px] sm:text-[48px] sm:leading-[54px] font-semibold tracking-[-0.02em] [text-wrap:balance]">
            An AI reviewer for structural drawings that knows where AI goes wrong.
          </h1>
          <p className="mt-5 max-w-[680px] text-[16px] leading-[26px] text-muted">
            Tnega is building an agent that checks reinforced concrete drawings against the code of record,
            ACI 318-19 and ASCE 7-16, marks the provisions general AI models tend to misapply, and sends every
            life-safety finding to an engineer before anything is approved.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#town" className="h-11 px-5 rounded bg-accent text-accent-fg text-[14px] font-semibold inline-flex items-center gap-2">
              Explore the code town <ArrowRight size={15} aria-hidden="true" />
            </a>
            <a href="#talk" className="h-11 px-5 rounded border border-line-strong text-[14px] font-semibold inline-flex items-center gap-2">
              <PlayCircle size={15} aria-hidden="true" /> Watch the talk
            </a>
            <a href={LINKEDIN} target="_blank" rel="noreferrer" className="h-11 px-5 rounded border border-line-strong text-[14px] font-semibold inline-flex items-center gap-2">
              <Linkedin size={15} aria-hidden="true" /> Talk to us about a pilot
            </a>
          </div>
          <p className="mt-4 text-[12px] text-muted">The agent does not review drawings yet. This page shows what it is being built to check.</p>
        </section>

        <section id="talk" className="max-w-[1180px] mx-auto px-4 sm:px-6 pb-12 scroll-mt-4">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
            <div className="rounded-lg border border-line overflow-hidden bg-black aspect-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0`}
                title="How AI is trained on structural engineering, a talk by Saba Azadegan"
                className="block w-full h-full border-0"
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Talk · 4 minutes</p>
              <h2 className="mt-2 text-[24px] leading-[30px] font-semibold tracking-[-0.01em]">How AI is trained on structural engineering</h2>
              <p className="mt-3 text-[14px] leading-[22px] text-muted">
                How a realistic engineering task is designed, how models attempt it and are graded against an answer key,
                and why a structural engineer who knows the governing codes has to stay in control of the loop.
              </p>
              <a href={VIDEO_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline">
                <PlayCircle size={14} aria-hidden="true" /> Watch on YouTube
              </a>
            </div>
          </div>
        </section>

        <section id="town" className="border-y border-line bg-surface scroll-mt-4">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[24px] leading-[30px] font-semibold tracking-[-0.01em]">The code town</h2>
                <p className="mt-1 max-w-[720px] text-[14px] leading-[22px] text-muted">
                  Six kinds of concrete structure and their members. Click one to see the governing provisions,
                  the checks that matter, and where a general AI model is likely to go wrong, with what that error costs.
                </p>
              </div>
              <a href="/town/" target="_blank" rel="noreferrer" className="text-[13px] font-semibold inline-flex items-center gap-1.5 hover:underline">
                <Maximize2 size={14} aria-hidden="true" /> Open full screen
              </a>
            </div>
            <div className="mt-5 rounded-lg border border-line overflow-hidden bg-page">
              <iframe
                src="/town/"
                title="RC Code Town: an interactive 3D model of concrete structures and their code checks"
                className="block w-full h-[1100px] md:h-[720px] border-0"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section id="pipeline" className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-14 scroll-mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[24px] leading-[30px] font-semibold tracking-[-0.01em]">How the test tasks are built</h2>
              <p className="mt-1 max-w-[720px] text-[14px] leading-[22px] text-muted">
                Before the agent is trusted, it is measured on expert-written tasks. Each task moves through nine stages;
                the engineer signs the design basis and the final result, and checks one decisive point at every other stage.
                The page shows where each task stands and how the models score. Prompts, answer keys and traps stay private.
              </p>
            </div>
            <a href="/eval/" target="_blank" rel="noreferrer" className="text-[13px] font-semibold inline-flex items-center gap-1.5 hover:underline">
              <ListChecks size={14} aria-hidden="true" /> Open the task pipeline
            </a>
          </div>
          <div className="mt-5 rounded-lg border border-line overflow-hidden bg-page">
            <iframe
              src="/eval/"
              title="Task pipeline: where each expert evaluation task stands, where the engineer signs, and how the models score"
              className="block w-full h-[900px] md:h-[760px] border-0"
              loading="lazy"
            />
          </div>
        </section>

        <section id="how" className="max-w-[1180px] mx-auto px-4 sm:px-6 py-14 scroll-mt-4">
          <h2 className="text-[24px] leading-[30px] font-semibold tracking-[-0.01em]">How the review will work</h2>
          <p className="mt-1 max-w-[720px] text-[14px] leading-[22px] text-muted">
            One pipeline for every drawing set. The agent prepares the review; an engineer makes every decision that matters.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex items-center gap-2 text-muted">
                  <Icon size={18} aria-hidden="true" />
                  <span className="text-[12px] font-semibold">{i + 1}</span>
                </div>
                <h3 className="mt-3 text-[15px] leading-[20px] font-semibold">{title}</h3>
                <p className="mt-2 text-[13px] leading-[20px] text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-line">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-14 grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-[24px] leading-[30px] font-semibold tracking-[-0.01em]">Why general models get it wrong</h2>
              <p className="mt-1 text-[14px] leading-[22px] text-muted">
                A general AI model reads every page of a drawing set. Where it fails is in applying the code.
              </p>
              <ul className="mt-6 grid gap-4">
                {WHY.map(([t, d]) => (
                  <li key={t} className="border-l-2 border-line-strong pl-4">
                    <p className="text-[15px] font-semibold">{t}</p>
                    <p className="mt-1 text-[13px] leading-[20px] text-muted">{d}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-[24px] leading-[30px] font-semibold tracking-[-0.01em]">Who builds it</h2>
              <p className="mt-4 text-[14px] leading-[22px]">
                Saba Azadegan, a structural engineer (MSc Structural Engineering) who works in AI training for civil
                and structural engineering: writing expert-level engineering problems and judging how AI models answer them.
              </p>
              <a href={LINKEDIN} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline">
                <Linkedin size={14} aria-hidden="true" /> Saba on LinkedIn
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-[12px] text-muted">
          <p>
            Also from Tnega: <a href="/finance" className="font-semibold text-fg hover:underline">Tnega Finance</a>, tokenized stocks
            and what each one really costs to buy.
          </p>
          <p>
            <a href="/finance/privacy" className="hover:underline">Privacy</a>
            <span aria-hidden="true"> · </span>
            ACI 318 and ASCE 7 are standards of their publishers; clause numbers only, no code text.
          </p>
        </div>
      </footer>
    </div>
  );
}
