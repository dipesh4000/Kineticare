# Kineticare — Technical Disclosure Log

**Preparation status:** AI-assisted project completely by using chat gpt

## 1. Project purpose and architecture

Kineticare connects clinician-prescribed rehabilitation with exercise practice at home. Clinicians onboard patients, approve reference demonstrations, publish exercise assignments, review saved results, and send feedback. Patients follow demonstrations, use camera guidance, save sessions, review progress, and message their clinician.

- **Browser client:** JavaScript/JSX React application with patient and clinician routes, HTML/CSS, and Tailwind/Vite tooling.
- **Movement pipeline:** Movenet Lightning.
- **Demo persistence:** localStorage for records
- **Connected persistence:** Firebase Authentication, Cloud Firestore, and Cloud Storage
- **Server:** Node.js/Express REST endpoints


## 2. AI assistants, agent skills, and development tools

| Resource |
| --- |
| GPT-6-based Codex agent |
| Ponytail skill |
|Firebase SDK|

## 3. Technology stack, dependencies, and upstream repositories


| Package(s) | Declared version(s)|
| --- | --- |
| `express` | `^5.3.0` |
| `react`, `react-dom` | `^19.2.8` each |
| `react-router-dom` | `^7.18.4` | 
| `@tensorflow-models/pose-detection` | `2.1.3` | 
| `@tensorflow/tfjs-converter`, `@tensorflow/tfjs-backend-webgl` | `4.22.0` | 
| `firebase` | `13.0.0` | 
| `tailwindcss`, `@tailwindcss/vite` | `^4.3.3` each |
| `Drizzle ORM` | Latest|



## 4. prompts and resulting development work

The following are actual prompts visible in this conversation. Other earlier requests are summarized in project documents but cannot be reconstructed verbatim; the participant should append the original prompts or clearly labeled summaries from their records.

| Participant prompt / instruction | How it was used |
| --- | --- |
| “Do not touch git related commands, I will myself edit or push or pull whatever i want” | Kept Git operations under participant control; no Git commands were used in the visible work |
| “When we click on contact in the patient portal the write message box should render just below the contact box and not below the interface, and the color should also darken up of the icon showing that the contact box is opened” | Guided relocation of the message composer and persistent dark styling while Contact is expanded |
| “delete this user, it should not be here, I was only testing patient onboarding” | Together with the supplied screenshot, identified the extra local test patient for removal; preserved the built-in demo account |
| “Briefly describe the system architecture, dependencies and use case in the readme” | Guided the README architecture, dependency, and use-case update |

recorded summaries in `plan.md`/`overview.md` include a blue visual theme, preserving the logo design while recoloring it, schedule/session PDF previews, removing the patient-home install button, a complete two-exercise care-loop demonstration, and deployment preparation. These are repository-derived summaries, not verified verbatim quotes and supplied full ideation plan and ppt documented by myseld and claude.


