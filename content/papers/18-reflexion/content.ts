import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 18,
  slug: "18-reflexion",
  title: "Reflexion: Language Agents with Verbal Reinforcement Learning",
  authors:
    "Noah Shinn, Federico Cassano, Edward Berman, Ashwin Gopinath, Karthik Narasimhan, Shunyu Yao, Northeastern, MIT, and Princeton",
  year: 2023,
  url: "https://arxiv.org/abs/2303.11366",
  sent: "2026-11-16",
  hook: "After a failed try, write a short lesson and keep it in the prompt. The weights stay frozen.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Reflexion: Language Agents with Verbal Reinforcement Learning",
        href: "https://arxiv.org/abs/2303.11366",
      },
      " by Noah Shinn, Shunyu Yao (ReAct, Tree of Thoughts) and colleagues at Northeastern, MIT, and Princeton (NeurIPS 2023). ReAct agents can think and act, and Tree of Thoughts lets them explore options within one attempt. When an agent finished a try and failed, it learned nothing: the next try made the same mistake. Classic reinforcement learning would retrain the weights over thousands of tries, and a reward of 0 does not say which step was wrong.",
    ],
    [
      "Reflexion has the model read its own failed attempt and write a short lesson (\"I grabbed the mug before finding the lamp; next time go to desk 1 first\"). The last one to three lessons go into the prompt for the next try. Same model, no training: it solved 130 of 134 household tasks in ALFWorld, and reached 91% pass@1 on HumanEval Python versus GPT-4's 80.1%. It is only as good as its judge. When its own unit tests passed buggy code on MBPP, it stopped early and did slightly worse, 77.1% versus 80.1%. The code is at ",
      { text: "noahshinn/reflexion", href: "https://github.com/noahshinn/reflexion" },
      ".",
    ],
  ],
  question:
    "In your own words, how does a Reflexion agent get better from one try to the next without any training, and why would a written lesson help more than just being told \"you failed\"?",
  answer:
    "Nothing in the model changes. After a failed trial the same language model reads its attempt and the pass or fail signal, writes a short diagnosis and plan, and the last one to three such notes are put in the prompt for the next try. A bare fail, or a reward of 0, does not say which of many steps caused the failure, so plain retries repeat the mistake. HotpotQA baselines never fixed a first-trial failure, and ReAct alone plateaued in ALFWorld. The written lesson points at the specific step and a fix, so it can work in one or two trials: ALFWorld 130 of 134, HumanEval 91% versus 80.1%, and about 8 points over just remembering the last attempt. In Rust, tests without a reflection gave no gain, 60% versus 60%, while the full method reached 68%. It is only as good as the evaluator: MBPP false positives of 16.3% led to 77.1%, below GPT-4's 80.1%, and WebShop showed no gain.",
} satisfies PaperMeta;
