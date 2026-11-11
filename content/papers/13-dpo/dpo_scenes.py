# Manim Community Edition scenes for paper #13: DPO
# "Direct Preference Optimization: Your Language Model is Secretly a Reward Model"
# (Rafailov, Sharma, Mitchell, Ermon, Manning, Finn — Stanford, NeurIPS 2023, arXiv 2305.18290)
# Render: manim -qm dpo_scenes.py TwoPipelines ImplicitReward LossAndWeight
# Text-only (no LaTeX). Formulas follow the paper: implicit reward r = beta * log(pi_theta / pi_ref),
# L_DPO = -log sigmoid(beta*log(pi(yw)/pi_ref(yw)) - beta*log(pi(yl)/pi_ref(yl))).
# Probabilities in ImplicitReward are made-up toy numbers for illustration.
from manim import *
import numpy as np

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"; RED_ = "#f87171"
config.background_color = BG


def box(label, col, w=2.3, h=0.9, fs=20):
    r = RoundedRectangle(corner_radius=0.15, width=w, height=h, stroke_color=col, fill_color=col, fill_opacity=0.18, stroke_width=3)
    t = Text(label, font_size=fs, color=WHITE)
    if t.width > w - 0.2:
        t.scale_to_fit_width(w - 0.2)
    return VGroup(r, t)


class TwoPipelines(Scene):
    """RLHF needs a reward model plus an RL loop; DPO is one supervised step on the same preference pairs."""
    def construct(self):
        title = Text("Same goal, two routes", font_size=34).to_edge(UP)
        self.play(Write(title))
        lab1 = Text("RLHF (InstructGPT)", font_size=22, color=ORANGE_).move_to([-5.2, 1.9, 0])
        data = box("preference pairs\n(chosen vs rejected)", BLUE_, 2.6, 1.0, 18).move_to([-4.6, 0.9, 0])
        rm = box("train a reward model", ORANGE_, 2.4).move_to([-1.3, 0.9, 0])
        ppo = box("PPO: sample, score,\nupdate, repeat", PINK_, 2.6, 1.0, 18).move_to([2.2, 0.9, 0])
        out1 = box("aligned model", GREEN_, 2.0).move_to([5.3, 0.9, 0])
        a1 = Arrow(data.get_right(), rm.get_left(), buff=0.1, color=GREY_)
        a2 = Arrow(rm.get_right(), ppo.get_left(), buff=0.1, color=GREY_)
        a3 = Arrow(ppo.get_right(), out1.get_left(), buff=0.1, color=GREY_)
        self.play(FadeIn(lab1), FadeIn(data))
        self.play(GrowArrow(a1), FadeIn(rm))
        self.play(GrowArrow(a2), FadeIn(ppo))
        loop = CurvedArrow(ppo.get_top() + RIGHT * 0.6 + UP * 0.08, ppo.get_top() + LEFT * 0.6 + UP * 0.08, angle=TAU / 2.2, color=PINK_)
        self.play(Create(loop))
        for _ in range(2):
            self.play(Rotate(loop, angle=0.001), Indicate(ppo, color=YEL_, scale_factor=1.06), run_time=0.6)
        self.play(GrowArrow(a3), FadeIn(out1))
        note1 = Text("extra reward model, sampling during training, often unstable", font_size=18, color=GREY_).move_to([0, -0.05, 0])
        self.play(FadeIn(note1))
        self.wait(0.6)
        lab2 = Text("DPO", font_size=22, color=GREEN_).move_to([-5.9, -1.2, 0])
        data2 = box("preference pairs\n(chosen vs rejected)", BLUE_, 2.6, 1.0, 18).move_to([-4.6, -2.2, 0])
        loss = box("one classification-style loss", YEL_, 3.6).move_to([-0.4, -2.2, 0])
        out2 = box("aligned model", GREEN_, 2.0).move_to([5.3, -2.2, 0])
        b1 = Arrow(data2.get_right(), loss.get_left(), buff=0.1, color=GREY_)
        b2 = Arrow(loss.get_right(), out2.get_left(), buff=0.1, color=GREY_)
        self.play(FadeIn(lab2), FadeIn(data2))
        self.play(GrowArrow(b1), FadeIn(loss))
        self.play(GrowArrow(b2), FadeIn(out2))
        note2 = Text("no reward model, no RL, no sampling while training", font_size=18, color=GREEN_).next_to(loss, DOWN, buff=0.3)
        self.play(FadeIn(note2))
        self.play(Indicate(out2, color=YEL_))
        self.wait(1.6)


class ImplicitReward(Scene):
    """Toy numbers: the model's probability of each answer relative to the frozen reference IS the reward."""
    def construct(self):
        title = Text("Your language model is secretly a reward model", font_size=30).to_edge(UP)
        self.play(Write(title))
        formula = Text("implicit reward  =  β × log( π_new(answer) / π_ref(answer) )", font_size=24, color=YEL_).next_to(title, DOWN, buff=0.3)
        self.play(FadeIn(formula))
        toy = Text("toy numbers", font_size=16, color=GREY_).to_corner(DR)
        self.add(toy)
        base = -2.6
        axis = Line([-5.5, base, 0], [5.5, base, 0], color=GREY_)
        self.play(Create(axis))
        def bar(x, h, col):
            return Rectangle(width=1.1, height=max(h, 0.01), stroke_width=0, fill_color=col, fill_opacity=0.85).move_to([x, base + h / 2, 0])
        ref_w = 1.6; ref_l = 1.6
        rw = bar(-3.2, ref_w, GREY_); rl = bar(1.8, ref_l, GREY_)
        lw = Text("chosen answer", font_size=20, color=GREEN_).move_to([-2.6, base - 0.4, 0])
        ll = Text("rejected answer", font_size=20, color=RED_).move_to([2.4, base - 0.4, 0])
        refl1 = Text("reference", font_size=14, color=GREY_).next_to(rw, UP, buff=0.1)
        refl2 = Text("reference", font_size=14, color=GREY_).next_to(rl, UP, buff=0.1)
        self.play(FadeIn(rw), FadeIn(rl), FadeIn(lw), FadeIn(ll), FadeIn(refl1), FadeIn(refl2))
        hw = ValueTracker(ref_w); hl = ValueTracker(ref_l)
        nw = always_redraw(lambda: bar(-2.0, hw.get_value(), GREEN_))
        nl = always_redraw(lambda: bar(3.0, hl.get_value(), RED_))
        newl1 = always_redraw(lambda: Text("new model", font_size=14, color=GREEN_).next_to(nw, UP, buff=0.1))
        newl2 = always_redraw(lambda: Text("new model", font_size=14, color=RED_).next_to(nl, UP, buff=0.1))
        beta = 0.1
        def rtxt():
            r1 = beta * np.log(hw.get_value() / ref_w); r2 = beta * np.log(hl.get_value() / ref_l)
            return Text(f"reward(chosen) = {r1:+.3f}    reward(rejected) = {r2:+.3f}    gap = {r1 - r2:+.3f}", font_size=20, color=WHITE).move_to([0, 1.2, 0])
        rt = always_redraw(rtxt)
        self.play(FadeIn(nw), FadeIn(nl), FadeIn(newl1), FadeIn(newl2), FadeIn(rt))
        self.play(hw.animate.set_value(2.5), hl.animate.set_value(0.6), run_time=3, rate_func=smooth)
        msg = Text("training pushes chosen up and rejected down, relative to the reference", font_size=20, color=YEL_).move_to([0, 0.5, 0])
        self.play(FadeIn(msg))
        self.wait(2)


class LossAndWeight(Scene):
    """The DPO loss is -log sigmoid(gap); pairs the model already orders correctly get tiny updates."""
    def construct(self):
        title = Text("The DPO loss: a logistic loss on the reward gap", font_size=30).to_edge(UP)
        self.play(Write(title))
        ax = Axes(x_range=[-6, 6, 2], y_range=[0, 6.5, 1], x_length=7.5, y_length=4.2, axis_config={"color": GREY_, "include_numbers": False}).shift(LEFT * 2 + DOWN * 0.5)
        xl = Text("reward gap (chosen minus rejected)", font_size=18, color=GREY_).next_to(ax, DOWN, buff=0.45)
        nums = VGroup(*[Text(str(v), font_size=16, color=GREY_).next_to(ax.c2p(v, 0), DOWN, buff=0.12) for v in [-6, -4, -2, 0, 2, 4, 6]])
        self.play(Create(ax), FadeIn(xl), FadeIn(nums))
        lossc = ax.plot(lambda m: np.log1p(np.exp(-m)), x_range=[-6, 6], color=YEL_)
        wc = ax.plot(lambda m: 5 / (1 + np.exp(m)), x_range=[-6, 6], color=PINK_)
        ll = Text("loss = −log σ(gap)", font_size=20, color=YEL_).move_to([4.2, 1.6, 0])
        wl = Text("update size ∝ σ(−gap)", font_size=20, color=PINK_).move_to([4.2, 0.9, 0])
        self.play(Create(lossc), FadeIn(ll))
        self.play(Create(wc), FadeIn(wl))
        g = ValueTracker(-4)
        dot = always_redraw(lambda: Dot(ax.c2p(g.get_value(), np.log1p(np.exp(-g.get_value()))), color=YEL_, radius=0.1))
        dot2 = always_redraw(lambda: Dot(ax.c2p(g.get_value(), 5 / (1 + np.exp(g.get_value()))), color=PINK_, radius=0.1))
        info = always_redraw(lambda: Text(f"gap = {g.get_value():+.1f}   weight = {1 / (1 + np.exp(g.get_value())):.2f}", font_size=20).move_to([4.2, -0.2, 0]))
        self.play(FadeIn(dot), FadeIn(dot2), FadeIn(info))
        self.play(g.animate.set_value(5), run_time=4, rate_func=smooth)
        msg1 = Text("wrong order (gap < 0): big push", font_size=18, color=RED_).move_to([4.2, -1.0, 0])
        msg2 = Text("already right (gap > 0): gentle nudge", font_size=18, color=GREEN_).move_to([4.2, -1.5, 0])
        self.play(FadeIn(msg1), FadeIn(msg2))
        self.play(g.animate.set_value(-3), run_time=2)
        self.wait(1.5)
