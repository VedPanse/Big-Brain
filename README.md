# Big Brain

**An Agentic Learning OS that Understands How You Think**

![NexHacks](https://img.shields.io/badge/NexHacks-2026-blue)
![Track](https://img.shields.io/badge/Track-Education%20%26%20AGI-purple)
![Status](https://img.shields.io/badge/Status-Prototype-orange)
![UI/UX](https://img.shields.io/badge/Focus-High%20UI%2FUX%20Impact-green)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

Big Brain is not a chatbot tutor.
It is a **learning operating system** that builds a cognitive model of the learner, actively diagnoses misunderstandings, and adapts the learning path in real time using an interactive canvas.

Instead of passively answering questions, Big Brain **probes, corrects, and reshapes understanding**.

---

## Development

1. Install deps: `npm install`
2. Run app + API together: `npm run dev`
3. Ensure `.env` in project root includes `OPENAI_QUIZ_API_KEY`.

The API runs on `http://localhost:8000` and Vite proxies `/api`.

---

## Why Big Brain?

Most AI education tools:

* generate explanations
* quiz users
* move on

Big Brain does something fundamentally different:

**It learns the learner.**

Big Brain builds a *mental model* of the user’s strengths, weaknesses, misconceptions, and learning patterns — and uses that model to drive every lesson, quiz, and interaction.

---

## Core Features

### 1. Adaptive Diagnostic Engine

* Initial quizzes are **diagnostic**, not graded
* Questions target:

  * conceptual understanding
  * prerequisite gaps
  * common misconception patterns
* Supports multiple formats:

  * MCQs
  * short explanations
  * diagram labeling
  * step-by-step reasoning

**Output:**

* Concept mastery map
* False-confidence detection
* Weak prerequisite identification

---

### 2. Personalized Learning Graph

* Learning path is a **dynamic dependency graph**, not a static syllabus
* Big Brain:

  * prunes concepts the user already understands
  * expands weak or fragile areas
  * reorders lessons automatically as the user improves

#### Smart Content Pulling

* Matches each concept to:

  * timestamped video segments
  * short explanations from multiple sources
* Chooses content based on:

  * user’s learning style
  * prior errors
  * abstraction preference (visual vs symbolic)

---

### 3. Cognitive Fingerprint

Big Brain continuously learns *how the user thinks*:

* Error types (algebraic slip, intuition failure, overgeneralization)
* Learning preferences inferred from interaction (not self-reported)
* Retention decay and concept fragility
* Patterns such as:

  * “Struggles when variables are introduced”
  * “Confuses definitions with applications”

This profile powers **true personalization**, not generic AI responses.

---

### 4. Interactive Learning Canvas (Key Differentiator)

Learning happens on a **canvas**, not in chat.

Users can:

* annotate diagrams
* draw graphs
* write partial solutions
* highlight confusion points
* cross out incorrect ideas

Big Brain responds *directly* to canvas interactions:

* Corrects faulty diagrams
* Identifies incorrect reasoning steps
* Zooms into highlighted concepts
* Suggests targeted exercises

This interaction model **cannot be replicated** in standard chat interfaces.

---

### 5. Teach-Back Mode (Signature Feature)

Big Brain verifies understanding by asking the user to **teach the concept back**.

* User explains on the canvas
* AI:

  * interrupts when logic breaks
  * asks clarification questions
  * challenges vague explanations
* Concepts are marked “mastered” **only after successful teach-back**

This ensures real learning, not surface-level correctness.

---

## End-to-End Learning Loop

1. User selects a topic or course
2. Big Brain runs diagnostic assessment
3. Personalized learning graph is generated
4. User learns via:

   * canvas interactions
   * micro-lessons
   * targeted videos
5. Continuous quizzes and feedback
6. Teach-back validation
7. Retention tracking and adaptive review

No passive consumption. No dead ends.

---

## Why Not Just Use ChatGPT?

| ChatGPT                     | Big Brain                    |
| --------------------------- | ---------------------------- |
| Reactive answers            | Proactive learning agent     |
| Linear chat                 | Visual interactive canvas    |
| Same output for everyone    | Personalized cognitive model |
| No memory of misconceptions | Long-term learning profile   |
| One-shot explanations       | Feedback-driven mastery      |

---

## Target Use Cases

* College students learning technical subjects
* Concept-heavy courses (CS, math, physics, ML)
* Self-learners seeking actual mastery
* Educators seeking diagnostic insights

---

## Built for NexHacks

Big Brain was designed with:

* High UI/UX impact via canvas-based learning
* Visible intelligence through diagnostics and adaptation
* Agentic behavior with feedback loops and teach-back
* A future-of-learning vision aligned with AGI principles

---

## Future Extensions

* Collaborative canvas sessions
* Instructor dashboards
* LMS integrations
* Long-term learner memory across courses
* AR and spatial learning modes

---

## Final Thought

Big Brain doesn’t just answer questions.

**It understands how you think — and teaches accordingly.**

---

## Getting Started

```bash
npm install
npm run dev
```

Open the local URL printed in the terminal.

## 1-Minute Demo Flow

1. Land on the **Landing** page and tap “Start learning”.
2. Choose a topic on **/learn**.
3. Explore the **Course** tabs (Videos → Quizzes → Canvas).
4. Open the **Fullscreen Canvas** for focused work.
5. Optional: run the **Diagnostic** from the course page.

## Local API

The app runs a Node/Express backend on port 8000 with OpenAI-powered quiz generation.
`npm run dev` starts both Vite and the API server.
