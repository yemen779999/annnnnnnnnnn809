# AI WebCraft Studio — Production Hardening & Full Implementation Plan

A production-grade, portable, full-stack AI Website Cloning, Text-to-Website Generation, and Reverse-Engineering platform built with Next.js 16, Tailwind CSS v4, Lucide React, and Google Gemini AI. Features automated URL DOM/asset analysis, AI-powered code reconstruction, real-time AI conversational editing, full-featured code editor, live responsive sandbox preview, quality comparison scoring, PostgreSQL project persistence, user authentication with role-based access (User vs. Owner/Admin), and ZIP package export with full Arabic (RTL) and English (LTR) localization.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Summary of Mandatory Directives**:
> 1. **PostgreSQL as Primary Production Database**: PostgreSQL is the primary database via `DATABASE_URL` with Prisma/pg client.
> 2. **Owner Account Exclusively from Secrets**: The Owner/Admin account is provisioned strictly through secret environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). No automatic role promotion of regular users in production.
> 3. **SSRF & DNS Rebinding Shield**: Complete URL validation resolving hostnames on every redirect hop, blocking private/internal IP ranges, disallowing loopback and cloud metadata IPs, and guarding against DNS rebinding.
> 4. **Strict Sandbox Isolation**: Preview sandbox executes in a restricted iframe with `sandbox="allow-scripts"` and unique/null origin (without `allow-same-origin`), blocking access to host cookies, session tokens, or internal platform storage.
> 5. **Gemini API Model Live Verification**: Server-side client tests and verifies the `gemini-3.8-flash` model endpoint before synthesis, with graceful error reporting.
> 6. **Automated Verification Suite**: Dedicated test route and CLI scripts verifying user registration, login, RBAC, project isolation, site cloning, and ZIP export.
> 7. **Universal Portability**: Deployable seamlessly on Google AI Studio, Vercel, Docker, or any standard Node.js 20+ VPS. Includes comprehensive `.env.example`, `Dockerfile`, and setup guide.

---

## 1. Overview & Core Concept

**AI WebCraft Studio** is a unified reverse-engineering, generation, and editing studio:
- **Inspect & Dissect**: Automated URL scraper analyzes HTML, styles, dominant color palettes (HEX & OKLCH), typography (Google & system fonts), and visual assets (images and inline SVGs).
- **Gemini AI Synthesis Engine**: Server-side engine utilizing `gemini-3.8-flash` from `@google/genai` to reconstruct semantic, clean Next.js 16 + Tailwind CSS v4 components.
- **Prompt-to-Website Builder**: Generates responsive websites from scratch given plain-language user prompts.
- **Conversational AI Code Copilot**: Real-time chat assistant capable of editing code, adding sections, and resolving layout bugs with instant preview sync.
- **In-Browser Code Editor & Live Sandbox**: Interactive editor with syntax styling, line numbers, and error handling, rendering inside a secure sandboxed responsive iframe (Desktop 1440px, Tablet 768px, Mobile 375px).
- **Quality & Fidelity Audit**: Algorithmic comparison matrix measuring token parity, asset preservation, and responsive tag coverage.
- **User Accounts & Data Isolation**: Multi-user system with encrypted passwords (`bcryptjs`), JWT/session management, and strict project ownership isolation.
- **Owner / Admin Dashboard**: Dedicated administrative view to manage users, projects, system metrics, and AI model configurations.
- **Bilingual Interface**: Full Arabic (RTL) and English (LTR) language support with mirrored layouts and domain-authentic typography.

---

## 2. Technical Architecture & Security Specifications

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js 16 Client (Browser)                     │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Top Bar: Studio Brand · Language (AR/EN) · Auth · Admin Toggle  │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │                                   │
│  ┌─────────────────────────────────▼────────────────────────────────┐  │
│  │                     Main Studio Workspace                        │  │
│  │                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  Creation Header: [URL Cloner Input] OR [Prompt to Site]   │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  │                                                                  │  │
│  │  ┌───────────────────────┐ ┌──────────────────────────────────┐  │  │
│  │  │   Design Token Dock   │ │   Live Responsive Sandbox        │  │  │
│  │  │   - Color Swatches    │ │   - Desktop / Tablet / Mobile    │  │  │
│  │  │   - Font Detector     │ │   - Split View (Source vs Clone) │  │  │
│  │  │   - Asset / SVG Vault │ │   - In-Browser Live Code Editor  │  │  │
│  │  └───────────────────────┘ └─────────────────┬────────────────┘  │  │
│  │                                              │                   │  │
│  │  ┌───────────────────────────────────────────┴────────────────┐  │  │
│  │  │   AI Copilot Chat: Live Section Modification & Bug Fixing  │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  │                                                                  │  │
│  │  ┌───────────────────────────────┐ ┌──────────────────────────┐  │  │
│  │  │ Quality Audit & Comparison    │ │ Admin Console (Owner)    │  │  │
│  │  └───────────────────────────────┘ └──────────────────────────┘  │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │ fetch()
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes (Server)                        │
│                                                                        │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │      /api/clone/analyze      │    │     /api/clone/generate      │  │
│  │ - Strict SSRF & DNS Filter   │    │ - Gemini 3.8 Flash Engine    │  │
│  │ - HTML DOM & CSS Tokenizer   │    │ - URL Clone & Prompt Build   │  │
│  │ - Asset & SVG Extraction     │    │ - AI Copilot Code Editing    │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │       /api/auth & users      │    │     /api/clone/projects      │  │
│  │ - Bcrypt Password Hashing    │    │ - User-Isolated Persistence  │  │
│  │ - Signed Session Cookies     │    │ - Standalone ZIP Generator   │  │
│  │ - Owner Bootstrap via Env    │    │ - Quality Audit Scorer       │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        /api/test/suite                           │  │
│  │ - Automated Test Runner: Auth, Isolation, SSRF, Cloner, ZIP      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬──────────────────────────────────┘
                                      │
                                      ▼
             PostgreSQL Database (Primary via DATABASE_URL)
                      + Google Gemini API (Server-Side)
```

### Security & Isolation Invariants
1. **SSRF & DNS Rebinding**:
   - Hostname resolved to IP before every request.
   - Any IP matching `0.0.0.0/8`, `10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fc00::/7`, `fe80::/10` is blocked.
   - Redirects followed manually up to 3 hops, re-validating the resolved IP on each hop.
2. **Sandbox Isolation**:
   - The preview iframe specifies `sandbox="allow-scripts"` (strictly omitting `allow-same-origin`, `allow-top-navigation`, `allow-modals`, `allow-forms`).
   - The preview cannot read parent cookies, localStorage, indexedDB, or initiate parent navigation.
3. **Owner Bootstrapping**:
   - Admin account is initialized exclusively from `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables.
   - In production, regular user registrations are strictly assigned role `user`.
4. **Standalone ZIP Packaging**:
   - The ZIP generator bundles a standard Next.js 16 + Tailwind CSS v4 project that compiles cleanly on any machine with `npm install && npm run dev`.

---

## 3. Step-by-Step Implementation Roadmap

### Phase 1: Dependencies, Database & Security Foundation
- Install `@google/genai`, `cheerio`, `jszip`, `bcryptjs`, and `@types/bcryptjs`.
- Create `src/lib/db.ts` implementing a unified database adapter supporting PostgreSQL (via connection pool / Prisma) with resilient local dev fallback.
- Create `src/lib/auth.ts` with bcrypt hashing (salt rounds 10), JWT/session cookie management, and environment-based owner bootstrap.
- Create `src/lib/gemini.ts` with live test ping and `gemini-3.8-flash` validation.
- Create `.env.example` with complete configuration documentation.

### Phase 2: Secure URL Analysis & Extraction Engine (`/api/clone/analyze`)
- Build SSRF filter with DNS resolution and redirect verification.
- Implement DOM parsing with `cheerio` for metadata, fonts, color palettes, and assets.
- Provide curated offline reference targets (Stripe, Linear, Vercel, Tailwind UI) for instant testing.

### Phase 3: AI Code Generation & Copilot Chat APIs (`/api/clone/generate`, `/api/clone/chat`)
- Build generation endpoint supporting both URL reconstruction and text prompt building.
- Build interactive AI chat copilot endpoint for incremental modifications.
- Build `/api/clone/verify` for quality and fidelity scoring.

### Phase 4: Standalone ZIP Exporter & Project Persistence (`/api/clone/projects`, `/api/clone/export-zip`)
- Build project persistence with strict user isolation (users can only access their own projects).
- Build standalone Next.js ZIP generator.

### Phase 5: Studio UI, Responsive Dual Sandbox & In-Browser Code Editor
- In `src/app/page.tsx`, build the full studio interface:
  - Top Bar with project title, language toggle (AR/EN), auth modal, and admin dashboard link.
  - Creation modes: "Clone from URL" and "Prompt-to-Site".
  - Design Tokens & Assets Drawer.
  - Dual Sandbox with Desktop/Tablet/Mobile frames and side-by-side comparison.
  - In-browser Code Editor with syntax styling, line numbers, and live re-render.
  - AI Copilot Chat drawer.
  - Quality Audit modal.

### Phase 6: Owner / Admin Dashboard & Multi-User Management
- Dedicated admin console displaying user list, project counts, AI model settings, and system health.
- Enforce strict 403 Forbidden for non-admin users.

### Phase 7: Bilingual RTL/LTR Localization
- Complete translations dictionary for Arabic and English.
- Seamless `dir="rtl"` and `dir="ltr"` layout switching with mirrored layouts.

### Phase 8: Verification, Automated Test Suite & Production Audit
- Implement `/api/test/suite` running automated end-to-end checks:
  1. Auth (register, password hash, login, JWT verification).
  2. Owner bootstrap from env variables.
  3. SSRF & private IP blocking test.
  4. Project isolation test (user A cannot access user B's project).
  5. URL extraction & prompt generation.
  6. ZIP export integrity check.
- Verify compilation via `compile_applet`.
- Produce the final audit report.
