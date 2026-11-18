# Manim Community Edition scenes for paper #20: RAG
# "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"
# (Lewis, Perez, Piktus, Petroni, Karpukhin, Goyal, Kuttler, Lewis, Yih, Rocktaschel, Riedel, Kiela;
#  Facebook AI Research / UCL / NYU; NeurIPS 2020; arXiv 2005.11401)
# Render: manim -qm rag_scenes.py RetrieveTopK SequenceVsToken HotSwapIndex
# Text-only (no LaTeX). Middle-ear example = Figure 1 / Table 3; Hemingway example = Figure 2;
# results = Tables 1, 2, 4 and the index hot-swap paragraph (Section 4.5); sizes = Section 3 and Appendix G.
# Positions of points in the embedding plane, dot-product scores and per-document probabilities are illustrative (toy).
from manim import *

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"; RED_ = "#f87171"; PURP_ = "#a78bfa"
config.background_color = BG


def box(label, col, w=1.8, h=0.6, fs=18):
    r = RoundedRectangle(corner_radius=0.12, width=w, height=h, stroke_color=col, fill_color=col, fill_opacity=0.15, stroke_width=2.5)
    t = Text(label, font_size=fs, color=WHITE)
    if t.width > w - 0.15:
        t.scale_to_fit_width(w - 0.15)
    if t.height > h - 0.1:
        t.scale_to_fit_height(h - 0.1)
    t.move_to(r)
    return VGroup(r, t)


def note(label, col, w=3.0, fs=13):
    t = Text(label, font_size=fs, color=WHITE, line_spacing=0.8)
    if t.width > w - 0.2:
        t.scale_to_fit_width(w - 0.2)
    r = RoundedRectangle(corner_radius=0.08, width=w, height=t.height + 0.25, stroke_color=col, fill_color=col, fill_opacity=0.18, stroke_width=2)
    t.move_to(r)
    return VGroup(r, t)


class RetrieveTopK(Scene):
    """Figure 1 + Section 2.2: query encoder -> q(x), MIPS over the passage index -> top-K, BART writes the answer."""
    def construct(self):
        title = Text("Step 1: look it up. Step 2: write the answer.", font_size=30).to_edge(UP)
        self.play(Write(title))
        query = box('x = "define middle ear"', BLUE_, 3.6, 0.6, 18).move_to([-4.6, 2.2, 0])
        enc = box("query encoder\nBERT_q", BLUE_, 2.0, 0.9, 16).move_to([-4.6, 0.9, 0])
        self.play(FadeIn(query))
        a_qe = Arrow(query.get_bottom(), enc.get_top(), buff=0.06, color=BLUE_)
        self.play(GrowArrow(a_qe), FadeIn(enc))
        # embedding plane (2D picture of a 768-d space)
        plane = RoundedRectangle(corner_radius=0.15, width=6.4, height=4.6, stroke_color=GREY_, stroke_width=1.5, fill_color="#111a33", fill_opacity=0.6).move_to([1.6, -0.3, 0])
        pl = Text("passage index: 21M Wikipedia chunks of 100 words, each a vector d(z) = BERT_d(z)", font_size=12, color=GREY_).next_to(plane, UP, buff=0.08)
        self.play(FadeIn(plane), FadeIn(pl))
        import random
        random.seed(3)
        dots = VGroup()
        for _ in range(70):
            x = random.uniform(-1.4, 4.6); y = random.uniform(-2.3, 1.7)
            dots.add(Dot([x, y, 0], radius=0.045, color=GREY_).set_opacity(0.6))
        special = [((2.9, 0.9), "The middle ear ... tympanic cavity ... ossicles"), ((3.3, 0.35), "eardrum separates outer and middle ear"),
                   ((2.4, 0.5), "ossicles: malleus, incus, stapes"), ((-0.8, -1.7), "Scotland uses the pound sterling"), ((0.2, 1.3), "Mount Rainier National Park")]
        sdots = VGroup(*[Dot([p[0], p[1], 0], radius=0.07, color=GREY_) for p, _ in special])
        self.play(LaggedStart(*[FadeIn(d) for d in dots], lag_ratio=0.01), FadeIn(sdots), run_time=1.2)
        origin = np.array([1.6, -0.3, 0])
        qv = Arrow(origin, [3.0, 0.75, 0], buff=0, color=BLUE_, stroke_width=6)
        ql = Text("q(x)", font_size=18, color=BLUE_).next_to(qv.get_end(), UP + LEFT, buff=0.05)
        a_eo = Arrow(enc.get_right(), origin + LEFT * 0.1, buff=0.08, color=BLUE_, stroke_width=2)
        self.play(GrowArrow(a_eo), GrowArrow(qv), FadeIn(ql))
        mips = Text("MIPS: find the passages with the largest dot product d(z) . q(x)", font_size=15, color=YEL_).move_to([1.6, -2.95, 0])
        self.play(FadeIn(mips))
        top = [0, 1, 2]
        rings = VGroup(*[Circle(radius=0.2, color=GREEN_, stroke_width=3).move_to(sdots[i]) for i in top])
        self.play(*[sdots[i].animate.set_color(GREEN_) for i in top], LaggedStart(*[Create(r) for r in rings], lag_ratio=0.2))
        self.wait(0.3)
        # top-K list with toy probabilities
        probs = [0.55, 0.30, 0.15]
        cards = VGroup()
        for k, i in enumerate(top):
            cards.add(note(f"z{k+1}: {special[i][1]}   p(z|x) = {probs[k]:.2f}", GREEN_, 4.6, 13))
        cards.arrange(DOWN, buff=0.12).move_to([-4.0, -1.3, 0])
        ktxt = Text("top-K documents (toy probabilities: softmax of the scores)", font_size=12, color=GREY_).next_to(cards, UP, buff=0.1)
        self.play(FadeOut(mips), FadeIn(ktxt), LaggedStart(*[TransformFromCopy(sdots[i], cards[k]) for k, i in enumerate(top)], lag_ratio=0.2))
        self.wait(0.6)
        # generator
        self.play(FadeOut(VGroup(dots, sdots, rings, qv, ql, plane, pl, a_qe, a_eo)), FadeOut(enc), FadeOut(query))
        gen = box("generator: BART-large (400M)\ninput = x + one document z, joined", ORANGE_, 4.6, 1.0, 16).move_to([2.6, -1.3, 0])
        self.play(cards.animate.move_to([-3.4, -1.3, 0]), FadeIn(gen))
        arr = VGroup(*[Arrow(c.get_right(), gen.get_left(), buff=0.08, color=ORANGE_, stroke_width=2, max_tip_length_to_length_ratio=0.08) for c in cards])
        self.play(LaggedStart(*[GrowArrow(a) for a in arr], lag_ratio=0.15))
        marg = Text("each document gives an answer probability; weight by p(z|x) and add up (marginalize)", font_size=12, color=ORANGE_).next_to(gen, DOWN, buff=0.15)
        self.play(FadeIn(marg))
        out = Text('"The middle ear includes the tympanic cavity and the three ossicles."', font_size=19, color=YEL_).move_to([0, 1.5, 0])
        lab = Text("RAG-Sequence's real answer (Table 3)", font_size=13, color=GREY_).next_to(out, DOWN, buff=0.12)
        bart = Text('BART alone: "The middle ear is the part of the ear between the middle ear and the nose."  (marked wrong)', font_size=14, color=RED_).move_to([0, 0.5, 0])
        self.play(AddTextLetterByLetter(out), run_time=1.6)
        self.play(FadeIn(lab), FadeIn(bart))
        foot = Text("Retriever finds evidence, generator writes. Query encoder + BART are fine-tuned together.", font_size=19, color=GREEN_).to_edge(DOWN, buff=0.15)
        self.play(Write(foot))
        self.wait(1.8)


class SequenceVsToken(Scene):
    """Section 2.1 + Figure 2: two ways to marginalize over the retrieved documents."""
    def construct(self):
        title = Text("Two ways to mix the documents", font_size=30).to_edge(UP)
        self.play(Write(title))
        x = Text('Jeopardy input x = "Hemingway"', font_size=20, color=BLUE_).move_to([0, 2.55, 0])
        self.play(FadeIn(x))
        d1 = note('z1 (p=0.5): "...his novel A Farewell to Arms (1929)..."', GREEN_, 6.0, 14).move_to([-3.4, 1.75, 0])
        d2 = note('z2 (p=0.5): "...His debut novel, The Sun Also Rises, 1926"', PURP_, 6.0, 14).move_to([3.4, 1.75, 0])
        self.play(FadeIn(d1, shift=DOWN * 0.2), FadeIn(d2, shift=DOWN * 0.2))
        tag = Text("documents from the paper's Figure 2; probabilities here are toy", font_size=12, color=GREY_).next_to(VGroup(d1, d2), DOWN, buff=0.08)
        self.play(FadeIn(tag))
        # RAG-Sequence
        h1 = Text("RAG-Sequence: one document writes the WHOLE answer, then average", font_size=18, color=YEL_).move_to([0, 0.75, 0])
        self.play(FadeIn(h1))
        a1 = Text('with z1: "... author of A Farewell to Arms"', font_size=15, color=GREEN_).move_to([-3.4, 0.2, 0])
        a2 = Text('with z2: "... author of The Sun Also Rises"', font_size=15, color=PURP_).move_to([3.4, 0.2, 0])
        self.play(FadeIn(a1), FadeIn(a2))
        f1 = Text("p(y|x) = sum over z of  p(z|x) * p(whole y | x, z)", font_size=16, color=WHITE).move_to([0, -0.35, 0])
        self.play(Write(f1))
        self.wait(0.8)
        lim = Text("Each candidate answer can only use ONE document's facts.", font_size=15, color=GREY_).move_to([0, -0.85, 0])
        self.play(FadeIn(lim))
        self.wait(0.8)
        self.play(FadeOut(VGroup(h1, a1, a2, f1, lim)))
        # RAG-Token
        h2 = Text("RAG-Token: re-mix the documents at EVERY word", font_size=18, color=YEL_).move_to([0, 0.75, 0])
        self.play(FadeIn(h2))
        words = ['"The', 'Sun', 'Also', 'Rises"', 'is', 'a', 'novel', 'by', 'this', 'author', 'of', '"A', 'Farewell', 'to', 'Arms"']
        # toy posterior for z1 at each token (shape follows Figure 2: z2 dominates "Sun", z1 dominates "A Farewell", flat after the first word of a title)
        post1 = [0.45, 0.08, 0.40, 0.45, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.55, 0.92, 0.55, 0.5]
        toks = VGroup(*[Text(w, font_size=16, color=WHITE) for w in words]).arrange(RIGHT, buff=0.14).move_to([0, -0.05, 0])
        toks.scale_to_fit_width(13.0)
        bars = VGroup()
        for t, p in zip(toks, post1):
            b1 = Rectangle(width=0.32, height=1.6 * p, stroke_width=0, fill_color=GREEN_, fill_opacity=0.85)
            b2 = Rectangle(width=0.32, height=1.6 * (1 - p), stroke_width=0, fill_color=PURP_, fill_opacity=0.85)
            col = VGroup(b1, b2).arrange(UP, buff=0).next_to(t, DOWN, buff=0.15)
            col.align_to(np.array([0, -2.4, 0]), DOWN)
            bars.add(col)
        cap = Text("bars = share of z1 (green) vs z2 (purple) behind each word (toy, shaped like Figure 2)", font_size=12, color=GREY_).move_to([0, -2.75, 0])
        for t, b in zip(toks, bars):
            self.play(FadeIn(t, shift=UP * 0.1), GrowFromEdge(b, DOWN), run_time=0.22)
        self.play(FadeIn(cap))
        self.play(Indicate(toks[1], color=PURP_), Indicate(bars[1], color=PURP_))
        self.play(Indicate(toks[12], color=GREEN_), Indicate(bars[12], color=GREEN_))
        f2 = Text("p(y|x) = product over words of  [ sum over z of p(z|x) * p(word | x, z, words so far) ]", font_size=15, color=WHITE).move_to([0, 0.35, 0])
        self.play(h2.animate.shift(UP * 0.0), FadeIn(f2))
        self.wait(0.8)
        self.play(FadeOut(VGroup(toks, bars, cap, f2, tag)))
        res = note("Real result (Table 2, Jeopardy Q-BLEU-1): BART 19.7 · RAG-Sequence 21.4 · RAG-Token 22.2\n"
                   "Jeopardy clues often join two facts, so mixing documents word by word helps.\n"
                   "After the first word of a title the mix goes flat: BART's own memory finishes the title.", YEL_, 12.0, 15).move_to([0, -0.6, 0])
        self.play(FadeIn(res, shift=UP * 0.2))
        self.wait(2.2)


class HotSwapIndex(Scene):
    """Section 4.5 'Index hot-swapping' + Appendix G: knowledge lives in a swappable index."""
    def construct(self):
        title = Text("Two memories: weights you train, an index you can swap", font_size=28).to_edge(UP)
        self.play(Write(title))
        par = box("parametric memory\nBART weights (406M)\nchanging it = retraining", ORANGE_, 3.8, 1.4, 16).move_to([-3.6, 1.4, 0])
        non = box("non-parametric memory\nWikipedia index: 21M vectors\nchanging it = swap the file", GREEN_, 3.8, 1.4, 16).move_to([3.6, 1.4, 0])
        self.play(FadeIn(par), FadeIn(non))
        self.wait(0.5)
        q = box('"Who is {position}?"  e.g. "Who is the President of Peru?"', BLUE_, 7.6, 0.6, 16).move_to([0, -0.6, 0])
        qn = Text("82 world leaders who changed between Dec 2016 and Dec 2018, NQ RAG model", font_size=13, color=GREY_).next_to(q, DOWN, buff=0.1)
        self.play(FadeIn(q), FadeIn(qn))
        i18 = box("index: Dec 2018 Wikipedia", GREEN_, 3.4, 0.5, 15).move_to(non.get_center() + DOWN * 1.05)
        i16 = box("index: Dec 2016 Wikipedia", PINK_, 3.4, 0.5, 15).move_to([7.5, -0.2, 0])
        self.play(FadeIn(i18))
        self.play(i18.animate.shift(RIGHT * 4.5).set_opacity(0), i16.animate.move_to(non.get_center() + DOWN * 1.05), run_time=1.2)
        sw = Text("swapped in seconds, no training", font_size=14, color=PINK_).next_to(i16, DOWN, buff=0.08)
        self.play(FadeIn(sw))
        self.wait(0.4)
        self.play(FadeOut(VGroup(sw, q, qn)), i16.animate.set_opacity(0.4))
        hd = Text("Share answered correctly (Section 4.5)", font_size=18, color=WHITE).move_to([0, -0.4, 0])
        self.play(FadeIn(hd))
        data = [("2016 index\n2016 leaders", 70, GREEN_), ("2018 index\n2018 leaders", 68, GREEN_), ("2018 index\n2016 leaders", 12, RED_), ("2016 index\n2018 leaders", 4, RED_)]
        base_y = -3.3
        for i, (lab, v, c) in enumerate(data):
            xx = -4.5 + 3.0 * i
            r = Rectangle(width=1.0, height=v / 100 * 2.2, stroke_width=0, fill_color=c, fill_opacity=0.85).move_to([xx, base_y + 0.45, 0], aligned_edge=DOWN)
            self.play(GrowFromEdge(r, DOWN), run_time=0.4)
            self.add(Text(f"{v}%", font_size=16).next_to(r, UP, buff=0.05), Text(lab, font_size=11, color=GREY_, line_spacing=0.7).move_to([xx, base_y + 0.1, 0]))
        self.wait(1.0)
        foot = Text("Matching index = right answers. Update the world's facts by replacing the index.", font_size=18, color=YEL_).to_edge(DOWN, buff=0.08)
        self.play(Write(foot))
        self.wait(1.0)
        self.clear()
        self.add(title)
        h2 = Text("Open-domain QA, exact match on Natural Questions (Table 1)", font_size=20, color=BLUE_).move_to([0, 2.2, 0])
        self.play(FadeIn(h2))
        rows = [("T5-11B (closed book, 11B params)", 34.5, GREY_), ("T5-11B + SSM (closed book)", 36.6, GREY_), ("REALM (open book)", 40.4, PURP_),
                ("DPR (retrieve + extract)", 41.5, PURP_), ("RAG-Token (626M trainable)", 44.1, GREEN_), ("RAG-Sequence (626M trainable)", 44.5, GREEN_)]
        for i, (lab, v, c) in enumerate(rows):
            y = 1.4 - 0.62 * i
            t = Text(lab, font_size=15, color=WHITE).move_to([-3.6, y, 0])
            r = Rectangle(width=v / 50 * 6.0, height=0.4, stroke_width=0, fill_color=c, fill_opacity=0.85).move_to([-0.9, y, 0], aligned_edge=LEFT)
            self.play(FadeIn(t), GrowFromEdge(r, LEFT), run_time=0.35)
            self.add(Text(f"{v}", font_size=15).next_to(r, RIGHT, buff=0.1))
        tail = note("A model with 626M trainable parameters plus a 21M-passage index beats an 11B model that must\n"
                    "store every fact in its weights. And it can say which passages it used.", YEL_, 12.0, 15).move_to([0, -2.55, 0])
        self.play(FadeIn(tail, shift=UP * 0.2))
        self.wait(2.2)
