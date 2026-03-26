# Factoring Practice

A web app for grade 9–10 students to practice polynomial factoring — one method at a time, with guided steps, hints, and shareable problems.

**[Try it live →](https://faamorim.github.io/Factoring/)**

---

## What it does

Students select a factoring method and proficiency level, then work through problems step by step. Each problem walks through the full solution process — not just "is the answer right?" but "what's the next step, and why?"

Proficiency levels follow the BC curriculum scale:
**Emerging → Developing → Proficient → Extending**

Two practice modes:
- **Guided** — step-by-step workflow with optional hints at each stage
- **Final Answer** — just the expression, student enters the fully factored form

Every problem has a shareable URL — copy the link and anyone gets the exact same problem, same seed, same steps.

---

## Factoring methods

| Method | What students practice |
|---|---|
| **GCF** | Numeric and variable GCF, optional y variable at Extending |
| **Difference of Squares** | a²x^2n − b²y² → (ax^n + by)(ax^n − by) |
| **Perfect Square Trinomial** | a²x^2n ± 2abx^n + b² → (ax^n ± b)² |
| **Simple Trinomial** | x² + bx + c → (x + p)(x + q), a = 1 |
| **Grouping** | Four-term polynomials → (ax + b)(cx² + d) |
| **General Trinomial** | ax² + bx + c → split middle term, group |
| **Mixed Method** | Student identifies the method before factoring |
| **Full Factoring** | Multi-step chained problems (GCF → inner method) |

---

## Project structure

```
index.html      — layout, controls, keypad, method/proficiency selects
style.css       — theming, responsive layout, keypad, step cards
utils.js        — shared math utilities (RNG, formatting, prime builder)
generators.js   — problem generators, one per factoring method
input.js        — keypad, input state, answer normalization
render.js       — DOM rendering, step cards, hint display
app.js          — app state, event wiring, URL sharing
```

All plain HTML/CSS/JS — no build step, no dependencies, no backend.

---

## Running locally

Clone the repo and open `index.html` in a browser. That's it.

```bash
git clone https://github.com/faamorim/Factoring.git
cd Factoring
open index.html   # or just drag it into a browser
```

No server required — everything runs client-side.

---

## Sharing a problem

After generating a problem, a **Copy Link** button appears. The URL encodes the method, proficiency level, mode, and seed — anyone who opens it gets the exact same problem. Useful for teachers pointing students to a specific example, or students sharing a problem they got stuck on.

URL format: `?p=method.proficiency.mode.seed`

---

## Roadmap

See [ROADMAP.md](https://github.com/faamorim/Factoring/blob/main/ROADMAP.md) for planned features including incremental hints, progress tracking, quiz/worksheet generation, print modes, and extended Full Factoring structures.

---

## Built with

Made by a math teacher, for math students — built iteratively with a lot of "wait, that problem is too hard" and "students need to see this step explicitly" along the way.

Initially started with the help of [ChatGPT](https://chatgpt.com) (OpenAI), which laid the early groundwork. Architecture, generators, and features were then developed in collaboration with [Claude](https://claude.ai) (Anthropic) — including a surprising amount of conversation about prime factorization and xylophone x-rays.