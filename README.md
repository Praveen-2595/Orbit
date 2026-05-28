<div align="center">

```
 ██████╗ ██████╗ ██████╗ ██╗████████╗
██╔═══██╗██╔══██╗██╔══██╗██║╚══██╔══╝
██║   ██║██████╔╝██████╔╝██║   ██║   
██║   ██║██╔══██╗██╔══██╗██║   ██║   
╚██████╔╝██║  ██║██████╔╝██║   ██║   
 ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝  
```

**Your life. In motion. All aligned.**

*A Claude-powered life companion that connects your daily habits → short goals → life vision,*
*and tells you exactly what you're risking when you fall behind.*

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](https://opensource.org/licenses/MIT)
[![Built with Claude](https://img.shields.io/badge/Built%20with-Claude%20API-7C6AFA.svg)](https://anthropic.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org)
[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com)

[**Live Demo →**](https://orbit.vercel.app) · [**Report Bug**](https://github.com/yourusername/orbit/issues) · [**Request Feature**](https://github.com/yourusername/orbit/issues)

</div>

---

## What Is ORBIT?

Most productivity apps ask: *"Did you do the thing?"*

ORBIT asks: *"Do you remember why the thing matters?"*

ORBIT is not a to-do list. Not a habit tracker. Not Notion.

It's a **living companion** — an AI that knows your long-term dreams, your weekly goals, and your daily checklist, and connects all three into one coherent picture. The AI talks to you like a person: sometimes about your goals, sometimes about nothing in particular. It remembers what matters to you.

> *"ORBIT should make users feel like their life is moving — not like they're failing a productivity system."*

---

## The Core Difference

```
Other apps:    Did you complete your task? ✓ / ✗

ORBIT:         You have 3 days until your exam.
               You said your parents are depending
               on this. You've studied 2 hours.
               The gap is real now — not hypothetical.
```

That's the **Stakes Engine** — ORBIT learns what you're actually risking, not just what you're tracking.

---

## Features

### 🎯 Three-Layer Life System
Everything in ORBIT connects upward:
```
Daily habits & checklist
        ↓ feeds into
Short-term goals (weeks/months)
        ↓ feeds into  
Life Vision (1yr / 3yr / 5yr)
        ↓ all seen by
AI Companion — talks freely across all layers
```

### ⚠️ Doom Meter
A real-time pressure gauge that rises every hour you're not progressing toward your goals. Not just a completion bar — it measures your **actual pace vs required pace** with deadline-aware urgency multipliers.

```
0–25%   🟢 SAFE      Calm companion. Goals are background context.
25–50%  🟡 RISING    Firm. Flags what needs attention today.
50–70%  🟠 WARNING   Urgent. Names what's at risk.
70–85%  🔴 DANGER    Honest intervention. References your deadlines.
85–100% 🔴 CRITICAL  Brutally honest. Activates stakes engine.
```

### 🧠 Stakes Engine
The feature that makes ORBIT unforgettable.

During onboarding, ORBIT asks what you're **actually risking** — not your productivity goals, but the real consequences. Who depends on you. What failure looks like in your life. What success unlocks.

When doom rises above 50%, the AI doesn't say *"you're behind on DSA."*

It says *"the interview your parents are depending on is in 3 days. You've studied 2 hours."*

### 🤖 AI Companion (Claude-powered)
- Talks freely — not every message is about goals
- Remembers facts from every conversation automatically
- Personality shifts with doom level
- Dynamic first message based on time of day
- Stakes-aware responses at high doom
- Free conversation mode — sometimes you just need to talk

### ✉️ Letter to Future Self
Write a letter to yourself 90 days from now. Sealed. Locked. Revealed automatically on day 90.

Nobody abandons an app holding a letter from their past self.

### 🎮 Level System
```
○  Drifting        — finding your gravity      (0–99 pts)
◐  Waking Up       — something is shifting     (100–299 pts)
◑  Rising          — momentum is building      (300–699 pts)
◕  In Orbit        — you found your rhythm     (700–1499 pts)
●  Locked In       — nothing can stop this     (1500–2999 pts)
★  Unstoppable     — you became the goal       (3000+ pts)
```

### 🍅 Pomodoro Timer
- Circular SVG progress ring
- Short break (5m) and long break (15m) modes
- Saves progress when stopped — resume or log it
- Auto-logs hours to linked goal on completion
- Custom duration settings

### 📊 Overview Dashboard
- Doom trend chart (last 7 days)
- Habit completion heatmap (last 28 days)
- Focus sessions bar chart (this week)
- Goal progress bars with expected-pace markers
- Weekly summary — "best day", habit rate, hours logged

### 🔄 Retention Hooks
- **Bad Day Protocol** — when doom hits 80%+ at 8pm, AI switches to compassion not pressure
- **Miss Me Message** — after 2+ days away, opens with a personal contextual message
- **Relapse Recovery** — auto-adjusts goals on return, reduces doom 30%, removes shame
- **Reality Check Card** — shows your own words back when you're slipping
- **Weekly Identity Report** — narrative of who you were this week, not just metrics

---

## Screenshots

| Today | Life Vision | Overview |
|-------|-------------|----------|
| ![Today](screenshots/today.png) | ![Vision](screenshots/vision.png) | ![Overview](screenshots/overview.png) |

| Doom Critical | Stakes Card | Letter |
|---------------|-------------|--------|
| ![Doom](screenshots/doom.png) | ![Stakes](screenshots/stakes.png) | ![Letter](screenshots/letter.png) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Claude API key from [console.anthropic.com](https://console.anthropic.com)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/orbit.git
cd orbit

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### Environment Variables

```env
# .env.local
ANTHROPIC_API_KEY=sk-ant-api03-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard:
# ANTHROPIC_API_KEY = your key
```

Or just drag your folder to [vercel.com/new](https://vercel.com/new) — done in 60 seconds.

---

## Tech Stack

```
Frontend    Next.js 15 + Vanilla JS
Styling     CSS Variables + Custom animations  
AI          Claude API (claude-sonnet-4)
Storage     localStorage (no backend required)
Hosting     Vercel (free tier)
Fonts       Custom display + mono stack
```

**No database. No auth. No complexity.**

All data lives in the browser. The Claude API is called directly. Nothing is stored externally — everything is yours.

---

## Project Structure

```
orbit/
├── app/                    # Next.js app router
├── public/
│   ├── index.html          # Main app shell
│   ├── orbit-app.js        # Core logic + AI integration
│   ├── orbit-ui.js         # UI rendering + animations
│   └── orbit-ui.css        # All styles
├── components/             # React components (if any)
├── .env.example            # Environment template
└── README.md
```

---

## Data Models

All data stored in `localStorage`:

| Key | Contains |
|-----|----------|
| `goals` | Short-term goals with deadlines + progress |
| `visions` | Life vision board (1yr/3yr/5yr) |
| `habits` | Daily recurring habits |
| `sessions` | Focus sessions + pomodoro logs |
| `memory` | AI-extracted facts from conversations |
| `orbit_stakes` | Life context + per-goal consequences |
| `orbit_letters` | Letters to future self |
| `orbit_points` | Gamification points + level |
| `chat_history` | Recent conversation history |

---

## Roadmap

### v1 — Current ✅
- [x] Daily checklist + habits
- [x] Short-term goals with time-based deadlines
- [x] Life Vision constellation board
- [x] Pomodoro timer with breaks
- [x] AI companion with memory
- [x] Doom meter (fully reactive)
- [x] Overview dashboard with charts
- [x] Stakes engine + onboarding
- [x] Level system
- [x] Bad Day Protocol
- [x] Miss Me message + Relapse Recovery
- [x] Letter to Future Self

### v2 — In Progress 🔨
- [ ] Weekly Identity Report
- [ ] Goal → Vision alignment visual threads
- [ ] Export / Import data (device switching)
- [ ] Supabase auth + cloud sync
- [ ] Landing page

### v3 — Planned 📋
- [ ] ORBIT Chibi companion (emotional AI character)
- [ ] Mood + journal layer
- [ ] Mobile PWA + push notifications
- [ ] Streak recovery mechanics
- [ ] Exam countdown mode

---

## Philosophy

ORBIT is built around one belief:

**Goals exist to serve your life — not the other way around.**

The doom meter creates pressure. The stakes engine makes it personal. The AI companion makes it human. And the free conversation mode makes it safe to just... exist, without always performing productivity.

The north star: *help people live intentionally without losing the joy of living freely.*

---

## Contributing

ORBIT is open source and contributions are welcome.

```bash
# Fork the repo
# Create your feature branch
git checkout -b feature/your-feature

# Commit your changes  
git commit -m 'add: your feature description'

# Push and open a PR
git push origin feature/your-feature
```

**Good first issues:**
- Mobile responsiveness fixes
- New doom meter calculation improvements
- Additional retention hook ideas
- UI polish and animations
- Documentation improvements

---

## Self-Hosting

ORBIT is designed to be self-hostable with zero cost:

1. Fork this repo
2. Add your `ANTHROPIC_API_KEY` to `.env.local`
3. Deploy to Vercel, Netlify, or GitHub Pages
4. Done — your data never leaves your browser

---

## License

MIT License — see [LICENSE](LICENSE) for details.

Use it, fork it, build on it. Just don't remove the attribution.

---

## Acknowledgments

- Built with [Claude API](https://anthropic.com) by Anthropic
- Inspired by the gap between productivity tools and real human motivation
- Designed for students, builders, and anyone with something to prove

---

<div align="center">

**Built by [Pawin](https://github.com/yourusername) — shipping in public**

*If ORBIT helped you — star the repo. It means more than you think.*

⭐ **Star this repo** · 🐦 **Share on Twitter** · 🐛 **Report issues**

---

*"Not everything needs to be about goals. Life is the point."*

</div>
