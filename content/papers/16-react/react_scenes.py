# Manim Community Edition scenes for paper #16: ReAct
# "ReAct: Synergizing Reasoning and Acting in Language Models"
# (Yao, Zhao, Yu, Du, Shafran, Narasimhan, Cao — Princeton University + Google Research, Brain team, ICLR 2023, arXiv 2210.03629)
# Render: manim -qm react_scenes.py ThoughtActObserve FourWaysCompared DecisionMaking
# Text-only (no LaTeX). Example trajectory is from the paper's Figure 1 (1); numbers from Tables 1, 3 and 4.
from manim import *

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"; RED_ = "#f87171"; PURP_ = "#a78bfa"
config.background_color = BG


def panel(w, h, col):
    return RoundedRectangle(corner_radius=0.2, width=w, height=h, stroke_color=col, fill_color=col, fill_opacity=0.08, stroke_width=2.5)


class ThoughtActObserve(Scene):
    """Paper Figure 1 (1d): ReAct answers a HotpotQA question by looping Thought -> Act -> Observation over a Wikipedia API."""
    def construct(self):
        title = Text("ReAct: think, act, look at the result, repeat", font_size=30).to_edge(UP)
        self.play(Write(title))
        q = Text("Q: Aside from the Apple Remote, what other device can control the program\nthe Apple Remote was originally designed to interact with?   (HotpotQA, paper Fig. 1)",
                 font_size=17, line_spacing=0.9).next_to(title, DOWN, buff=0.25)
        self.play(FadeIn(q, shift=DOWN * 0.2))

        # loop diagram on the left
        c = [-5.3, -0.45, 0]
        r = 1.2
        pos = {"Thought": [c[0], c[1] + r, 0], "Act": [c[0] + r * 0.95, c[1] - r * 0.6, 0], "Obs": [c[0] - r * 0.95, c[1] - r * 0.6, 0]}
        cols = {"Thought": PURP_, "Act": ORANGE_, "Obs": BLUE_}
        nodes = {}
        for k in ["Thought", "Act", "Obs"]:
            d = Circle(radius=0.56, color=cols[k], fill_color=cols[k], fill_opacity=0.15, stroke_width=3).move_to(pos[k])
            t = Text(k, font_size=16, color=cols[k]).move_to(d)
            nodes[k] = VGroup(d, t)
        arrows = VGroup(
            CurvedArrow(nodes["Thought"].get_right() + DOWN * 0.1, nodes["Act"].get_top(), angle=-0.8, color=GREY_),
            CurvedArrow(nodes["Act"].get_left(), nodes["Obs"].get_right(), angle=-0.8, color=GREY_),
            CurvedArrow(nodes["Obs"].get_top(), nodes["Thought"].get_left() + DOWN * 0.1, angle=-0.8, color=GREY_),
        )
        wiki = Text("Wikipedia API:\nsearch[entity]\nlookup[string]\nfinish[answer]", font_size=14, color=GREY_, line_spacing=0.85).move_to([c[0], -2.65, 0])
        self.play(*[FadeIn(n) for n in nodes.values()], Create(arrows), FadeIn(wiki))

        steps = [
            ("I need to search Apple Remote and find the program\nit was originally designed to interact with.",
             "Search[Apple Remote]",
             "The Apple Remote is a remote control ... originally designed\nto control the Front Row media center program ..."),
            ("Apple Remote was originally designed to control Front Row.\nI need to search Front Row next.",
             "Search[Front Row]",
             "Could not find [Front Row]. Similar: ['Front Row Seat to Earth',\n'Front Row Motorsports', 'Front Row (software)', ...]"),
            ("Front Row is not found. I need to search Front Row (software).",
             "Search[Front Row (software)]",
             "Front Row is a discontinued media center software ..."),
            ("Front Row (software) is controlled by an Apple Remote or the\nkeyboard function keys. So the answer is keyboard function keys.",
             "Finish[keyboard function keys]",
             None),
        ]
        x0 = -2.9
        cur = None
        step_lab = None
        for i, (th, ac, ob) in enumerate(steps):
            lab = Text(f"step {i + 1} of 4", font_size=16, color=GREY_).move_to([x0, 1.15, 0], aligned_edge=LEFT)
            tt = Text("Thought: " + th, font_size=16, color=PURP_, line_spacing=0.9).move_to([x0, 0.4, 0], aligned_edge=LEFT)
            at = Text("Act: " + ac, font_size=17, color=ORANGE_).move_to([x0, -0.65, 0], aligned_edge=LEFT)
            grp = [lab, tt, at]
            anims_out = [FadeOut(cur), FadeOut(step_lab)] if cur is not None else []
            if anims_out:
                self.play(*anims_out, run_time=0.3)
            self.play(FadeIn(lab), Indicate(nodes["Thought"], color=PURP_), Write(tt), run_time=1.1)
            self.play(Indicate(nodes["Act"], color=ORANGE_), FadeIn(at, shift=RIGHT * 0.2), run_time=0.7)
            if ob is not None:
                ot = Text("Obs: " + ob, font_size=16, color=BLUE_, line_spacing=0.9).move_to([x0, -1.6, 0], aligned_edge=LEFT)
                self.play(Indicate(nodes["Obs"], color=BLUE_), FadeIn(ot, shift=UP * 0.2), run_time=0.8)
                grp.append(ot)
            self.wait(0.7)
            step_lab = lab
            cur = VGroup(*grp[1:])
        ok = Text("✓ correct, every fact came from a real lookup", font_size=19, color=GREEN_).move_to([x0, -1.6, 0], aligned_edge=LEFT)
        self.play(FadeIn(ok))
        self.wait(0.8)
        self.play(FadeOut(cur), FadeOut(step_lab), FadeOut(ok))
        # compare the other 3 methods from Fig. 1
        rows = [
            ("Standard (answer only)", "iPod", "✗", RED_),
            ("Chain of thought (reason only)", "iPhone, iPad, iPod Touch  (made-up facts)", "✗", RED_),
            ("Act only (no thoughts)", "Finish[yes]  (searched, but lost the plot)", "✗", RED_),
            ("ReAct (reason + act)", "keyboard function keys", "✓", GREEN_),
        ]
        objs = []
        for i, (m, a, mark, col) in enumerate(rows):
            y = 0.9 - i * 0.7
            mt = Text(m, font_size=17, color=GREY_).move_to([x0, y, 0], aligned_edge=LEFT)
            atx = Text(a + "  " + mark, font_size=17, color=col).move_to([x0 + 3.7, y, 0], aligned_edge=LEFT)
            objs += [mt, atx]
            self.play(FadeIn(mt), FadeIn(atx, shift=RIGHT * 0.2), run_time=0.5)
        note = Text("Thoughts plan the next search; searches feed real facts back into the thoughts.", font_size=19, color=YEL_).to_edge(DOWN, buff=0.15)
        self.play(FadeIn(note))
        self.wait(2)


class FourWaysCompared(Scene):
    """Paper Table 1: PaLM-540B prompting results on HotpotQA (exact match) and FEVER (accuracy)."""
    def construct(self):
        title = Text("Reason, act, or both? (PaLM 540B, prompting only)", font_size=30).to_edge(UP)
        sub = Text("paper Table 1   ·   HotpotQA: exact match %   ·   FEVER: accuracy %", font_size=19, color=GREY_).next_to(title, DOWN, buff=0.15)
        self.play(Write(title), FadeIn(sub))
        rows = [
            ("Standard", 28.7, 57.1, GREY_),
            ("CoT (reason only)", 29.4, 56.3, PURP_),
            ("CoT-SC (21 samples, vote)", 33.4, 60.4, PINK_),
            ("Act (act only)", 25.7, 58.9, ORANGE_),
            ("ReAct", 27.4, 60.9, BLUE_),
            ("CoT-SC → ReAct", 34.2, 64.6, GREEN_),
            ("ReAct → CoT-SC", 35.1, 62.0, GREEN_),
        ]
        sc = 0.062
        xh, xf = -2.2, 1.6
        hh = Text("HotpotQA", font_size=20, color=YEL_).move_to([xh + 0.9, 1.95, 0])
        hf = Text("FEVER", font_size=20, color=YEL_).move_to([xf + 1.6, 1.95, 0])
        self.play(FadeIn(hh), FadeIn(hf))
        hbars, fbars = [], []
        for i, (name, h, f, col) in enumerate(rows):
            y = 1.4 - i * 0.62
            lab = Text(name, font_size=17, color=col).move_to([xh - 0.25, y, 0], aligned_edge=RIGHT)
            bh = Rectangle(width=h * sc, height=0.38, fill_color=col, fill_opacity=0.85, stroke_width=0).move_to([xh, y, 0], aligned_edge=LEFT)
            bf = Rectangle(width=f * sc, height=0.38, fill_color=col, fill_opacity=0.85, stroke_width=0).move_to([xf, y, 0], aligned_edge=LEFT)
            th = Text(f"{h}", font_size=16).next_to(bh, RIGHT, buff=0.08)
            tf = Text(f"{f}", font_size=16).next_to(bf, RIGHT, buff=0.08)
            self.play(FadeIn(lab), GrowFromEdge(bh, LEFT), GrowFromEdge(bf, LEFT), run_time=0.55)
            self.play(FadeIn(th), FadeIn(tf), run_time=0.2)
            hbars.append(bh); fbars.append(bf)
        note = Text("ReAct beats Act on both, beats CoT on FEVER (60.9 vs 56.3), trails it on HotpotQA (27.4 vs 29.4).\nBest of all: switch between ReAct and CoT-SC. (Fine-tuned supervised SoTA: 67.5 / 89.5)",
                    font_size=17, color=YEL_, line_spacing=0.9).to_edge(DOWN, buff=0.15)
        self.play(FadeIn(note))
        self.play(Indicate(hbars[6], color=YEL_), Indicate(fbars[5], color=YEL_))
        self.wait(2)


class DecisionMaking(Scene):
    """Paper Tables 3 and 4: success rates on ALFWorld (text household game) and WebShop (online shopping)."""
    def construct(self):
        title = Text("Thinking helps agents act: success rate %", font_size=30).to_edge(UP)
        sub = Text("ALFWorld: 134 unseen games, 'All' column (Table 3)   ·   WebShop: 500 test instructions (Table 4)", font_size=17, color=GREY_).next_to(title, DOWN, buff=0.15)
        self.play(Write(title), FadeIn(sub))
        groups = [
            ("ALFWorld", -6.2, [("BUTLER\nbest of 8", 37, GREY_), ("Act\nbest of 6", 45, ORANGE_), ("ReAct-IM\nbest of 6", 53, PINK_), ("ReAct\naverage", 57, BLUE_), ("ReAct\nbest of 6", 71, GREEN_)]),
            ("WebShop", 0.9, [("IL", 29.1, GREY_), ("IL+RL", 28.7, GREY_), ("Act", 30.1, ORANGE_), ("ReAct", 40.0, GREEN_), ("Human\nexpert", 59.6, YEL_)]),
        ]
        sc = 0.045
        base = -2.15
        best = []
        for gname, x0, items in groups:
            gl = Text(gname, font_size=22, color=YEL_).move_to([x0 + 2.6, 2.0, 0])
            axis = Line([x0 - 0.2, base, 0], [x0 + 5.6, base, 0], color=GREY_, stroke_width=2)
            self.play(FadeIn(gl), Create(axis), run_time=0.5)
            for j, (lab, v, col) in enumerate(items):
                x = x0 + 0.5 + j * 1.2
                b = Rectangle(width=0.75, height=v * sc, fill_color=col, fill_opacity=0.85, stroke_width=0).move_to([x, base, 0], aligned_edge=DOWN)
                vt = Text(f"{v}", font_size=17).next_to(b, UP, buff=0.08)
                lt = Text(lab, font_size=14, color=col, line_spacing=0.8).next_to([x, base, 0], DOWN, buff=0.12)
                self.play(GrowFromEdge(b, DOWN), FadeIn(lt), run_time=0.45)
                self.play(FadeIn(vt), run_time=0.15)
                if (gname, lab) in [("ALFWorld", "ReAct\nbest of 6"), ("WebShop", "ReAct")]:
                    best.append(b)
        note = Text("1-2 example prompts beat agents trained on thousands of examples: +34 points on ALFWorld\n(71 vs BUTLER 37) and +10 on WebShop. Humans are still far ahead on shopping (59.6).",
                    font_size=17, color=YEL_, line_spacing=0.9).to_edge(DOWN, buff=0.12)
        self.play(FadeIn(note))
        self.play(*[Indicate(b, color=YEL_) for b in best])
        self.wait(2)
