import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 16,
  slug: "16-react",
  title: "ReAct: Synergizing Reasoning and Acting in Language Models",
  authors:
    "Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik Narasimhan, Yuan Cao, Princeton and Google Research",
  year: 2023,
  url: "https://arxiv.org/abs/2210.03629",
  sent: "2026-11-14",
  hook: "Interleave a thought with a real action, then read what comes back, so the plan is checked against the world.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "ReAct: Synergizing Reasoning and Acting in Language Models",
        href: "https://arxiv.org/abs/2210.03629",
      },
      " by Shunyu Yao and colleagues at Princeton and Google Research (ICLR 2023). Chain-of-thought prompting got large models to show their working, and self-consistency made that working more reliable by voting. All of that thinking still happens inside the model's head. When it needs a fact it does not really know, it makes one up and keeps reasoning from there. Asked what else can control the program the Apple Remote was built for, chain-of-thought says \"iPhone, iPad, iPod Touch\", which is wrong.",
    ],
    [
      "ReAct lets the model think and act, taking turns. It writes a thought (\"I need to search Apple Remote and find the program it was designed for\"), takes an action such as search[Apple Remote] on a simple Wikipedia tool, reads what comes back, and thinks again. When a search fails, it notices and tries a better one, then finishes with the right answer: keyboard function keys. Thoughts steer the actions, and actions feed real facts into the thoughts. With a few examples in the prompt and no training, hallucination dropped to 0% of its HotpotQA failures against 56% for chain-of-thought. Paired with self-consistency it reached 35.1 exact match on HotpotQA and 64.6 accuracy on FEVER, and it beat agents trained on thousands of examples in a text household game (71% versus 37%) and an online shop (40% versus 29%).",
    ],
  ],
  question:
    "In your own words, why does mixing thinking steps with real actions (like searching Wikipedia) beat thinking alone or acting alone?",
  answer:
    "Thoughts and actions cover each other's weak spots. Thoughts let the model plan, keep track of what it has found, notice when a search came back empty, change course, and put the pieces together into an answer. Actions bring in real, checkable facts, so the next thought rests on what the source actually says rather than on something the model half-remembers. Acting alone can fetch the facts but cannot plan or combine them: in Figure 1 it finds the right pages and answers \"yes\", and on ALFWorld its best trial is 45% against ReAct's 71%. Thinking alone plans well but makes facts up and builds on them: hallucination is 56% of its HotpotQA failures against 0% for ReAct. ReAct can still loop or be derailed by a useless search (23% of its errors), so the best results combine it with self-consistency and switch when one method is stuck or unsure (35.1 exact match on HotpotQA, 64.6 accuracy on FEVER).",
} satisfies PaperMeta;
