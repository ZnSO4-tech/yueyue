"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  educationChapters,
  flashcards,
  geographyChapters,
  questions,
  type Question,
} from "./study-data";

type View = "home" | "map" | "quiz" | "wrong" | "mind" | "cards";
type SavedState = {
  answered: Record<string, { correct: boolean; selected: string; at: string }>;
  stars: number;
  streak: number;
  wrongIds: string[];
  examDate: string;
};

const defaultState: SavedState = {
  answered: {},
  stars: 12,
  streak: 1,
  wrongIds: [],
  examDate: "2026-09-12",
};

const names = ["宝宝", "老婆", "月月"];
const letters = ["A", "B", "C", "D"];

function encouragement(correct: boolean, index: number, careless = false) {
  const name = names[index % names.length];
  if (correct) {
    return [
      `${name}答得很稳，这个考点已经开始长在脑子里啦。`,
      `${name}拿下这题！这一颗星星是实打实的。`,
      `${name}漂亮！不仅选对了，易错点也避开了。`,
    ][index % 3];
  }
  if (careless) return `啊，${name}在题干这里滑了一下呀。知识其实会，下次先圈关键词就拿稳了。`;
  return `${name}现在不会很正常，我们把这个坑填上，它下次就会变成送分题。`;
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [saved, setSaved] = useState<SavedState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [subject, setSubject] = useState<"all" | "education" | "geography">("all");
  const [difficulty, setDifficulty] = useState("全部");
  const [exam, setExam] = useState("全部年份");
  const [questionType, setQuestionType] = useState("全部题型");
  const [search, setSearch] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [written, setWritten] = useState("");
  const [scoreResult, setScoreResult] = useState<{ score: number; hits: string[] } | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem("yueyue-study-state");
    if (raw) {
      try {
        setSaved({ ...defaultState, ...JSON.parse(raw) });
      } catch {
        setSaved(defaultState);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem("yueyue-study-state", JSON.stringify(saved));
  }, [saved, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredQuestions = useMemo(
    () =>
      questions.filter(
        (q) =>
          (subject === "all" || q.subject === subject) &&
          (difficulty === "全部" || q.difficulty === difficulty) &&
          (exam === "全部年份" || q.exam === exam) &&
          (questionType === "全部题型" || q.type === questionType) &&
          (!search.trim() ||
            `${q.stem}${q.chapter}${q.topic}${q.tags.join("")}`
              .toLowerCase()
              .includes(search.trim().toLowerCase())),
      ),
    [subject, difficulty, exam, questionType, search],
  );
  const examYears = useMemo(
    () => [...new Set(questions.map((q) => q.exam).filter(Boolean) as string[])].sort().reverse(),
    [],
  );

  const current = filteredQuestions[questionIndex % Math.max(filteredQuestions.length, 1)];
  const doneCount = Object.keys(saved.answered).length;
  const correctCount = Object.values(saved.answered).filter((x) => x.correct).length;
  const accuracy = doneCount ? Math.round((correctCount / doneCount) * 100) : 0;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(saved.examDate).getTime() - Date.now()) / 86400000),
  );

  function changeView(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetQuestion() {
    setSelected("");
    setSubmitted(false);
    setWritten("");
    setScoreResult(null);
  }

  function nextQuestion() {
    setQuestionIndex((i) => (i + 1) % Math.max(filteredQuestions.length, 1));
    resetQuestion();
  }

  function submitAnswer() {
    if (!current) return;
    if (current.type === "mcq" && !selected) {
      setToast("先选一个答案哦，宝宝 🌷");
      return;
    }
    if (current.type !== "mcq" && written.trim().length < 2) {
      setToast("先写一点你的思路，再来估分吧 ✍️");
      return;
    }

    let correct = false;
    let answerText = selected;
    if (current.type === "mcq") {
      correct = selected === current.answer;
    } else {
      answerText = written;
      const normalized = written.toLowerCase().replace(/[，。、“”‘’；：\s]/g, "");
      const hits = (current.keywords || []).map((group, i) => ({
        hit: group.some((keyword) => normalized.includes(keyword.toLowerCase().replace(/\s/g, ""))),
        label: current.scoringPoints?.[i] || group[0],
      }));
      const hitLabels = hits.filter((x) => x.hit).map((x) => x.label);
      const structureBonus =
        current.type === "trueFalse" && /错误|不正确|正确/.test(written) ? 0.5 : 0;
      const score = Math.min(
        100,
        Math.round(((hitLabels.length + structureBonus) / Math.max(hits.length, 1)) * 100),
      );
      setScoreResult({ score, hits: hitLabels });
      correct = score >= 60;
    }

    setSubmitted(true);
    setSaved((prev) => {
      const wrong = new Set(prev.wrongIds);
      if (correct) wrong.delete(current.id);
      else wrong.add(current.id);
      return {
        ...prev,
        stars: prev.stars + (correct ? 3 : 1),
        answered: {
          ...prev.answered,
          [current.id]: { correct, selected: answerText, at: new Date().toISOString() },
        },
        wrongIds: [...wrong],
      };
    });
  }

  function jumpToQuiz(nextSubject: "education" | "geography" | "all" = "all") {
    setSubject(nextSubject);
    setExam("全部年份");
    setQuestionType("全部题型");
    setSearch("");
    setQuestionIndex(0);
    resetQuestion();
    changeView("quiz");
  }

  function exportProgress() {
    const blob = new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "月月教资复习进度.json";
    link.click();
    URL.revokeObjectURL(link.href);
    setToast("进度备份好啦，老婆要收好哦 💾");
  }

  if (!hydrated) return <div className="loading-screen">正在铺好月月的上岸地图…</div>;

  return (
    <div className="app-shell">
      {toast && <div className="toast">{toast}</div>}
      <header className="topbar">
        <button className="brand" onClick={() => changeView("home")} aria-label="返回首页">
          <span className="brand-mascot">🌙</span>
          <span><b>月月上岸计划</b><small>教师资格证闯关复习</small></span>
        </button>
        <nav className="desktop-nav" aria-label="主要导航">
          {[
            ["home", "🏠", "首页"],
            ["map", "🗺️", "闯关"],
            ["quiz", "✏️", "题库"],
            ["wrong", "📕", "错题"],
            ["mind", "🧠", "导图"],
          ].map(([id, icon, label]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => changeView(id as View)}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div className="header-stats">
          <span title="连续学习">🔥 {saved.streak} 天</span>
          <span title="获得星星">⭐ {saved.stars}</span>
        </div>
      </header>

      <main>
        {view === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">DAY {Math.max(1, saved.streak)} · 今天也轻轻学一点</span>
                <h1>早呀，月月<br /><em>今天离上岸又近一点点</em></h1>
                <p>不用一次读很多。今天先拿下 5 道题、3 张卡片和 1 个主观题框架，就很棒啦。</p>
                <div className="hero-actions">
                  <button className="primary" onClick={() => jumpToQuiz("all")}>开始今日闯关 <span>→</span></button>
                  <button className="soft" onClick={() => changeView("cards")}>只学 5 分钟</button>
                </div>
              </div>
              <div className="hero-scene" aria-label="月亮小兔陪伴学习插画">
                <div className="cloud cloud-one">☁</div>
                <div className="cloud cloud-two">☁</div>
                <div className="moon-orbit">
                  <div className="moon-face">🌙</div>
                  <span className="star s1">✦</span><span className="star s2">★</span><span className="star s3">✧</span>
                </div>
                <div className="speech">“慢慢来，稳稳过。”</div>
              </div>
            </section>

            <section className="stats-grid">
              <article className="stat-card pink">
                <div><span>今日进度</span><strong>{Math.min(doneCount, 8)}<small>/8 个任务</small></strong></div>
                <div className="mini-ring" style={{ "--value": `${Math.min(100, doneCount * 12.5)}%` } as CSSProperties}><b>{Math.min(100, Math.round(doneCount * 12.5))}%</b></div>
              </article>
              <article className="stat-card yellow">
                <div><span>答题正确率</span><strong>{accuracy}<small>%</small></strong><p>{doneCount ? "每次订正都算进步" : "完成第一题后开始统计"}</p></div>
                <span className="stat-icon">🎯</span>
              </article>
              <article className="stat-card mint">
                <div><span>待拯救错题</span><strong>{saved.wrongIds.length}<small> 道</small></strong><p>它们只是还没学会</p></div>
                <button onClick={() => changeView("wrong")}>去看看 →</button>
              </article>
              <article className="stat-card purple">
                <div><span>距离考试</span><strong>{daysLeft}<small> 天</small></strong><p>按现在的节奏来得及</p></div>
                <span className="stat-icon">🗓️</span>
              </article>
            </section>

            <section className="section-block">
              <div className="section-heading">
                <div><span className="section-kicker">TODAY&apos;S QUEST</span><h2>今天的小任务</h2></div>
                <button className="text-button" onClick={() => jumpToQuiz()}>进入 {questions.length} 道完整题库 →</button>
              </div>
              <div className="quest-grid">
                <button className="quest-card" onClick={() => jumpToQuiz("education")}>
                  <span className="quest-number">01</span><span className="quest-icon pink">📖</span>
                  <div><b>科目二热身</b><small>5 道高频选择题 · 约 6 分钟</small><div className="bar"><i style={{ width: `${Math.min(100, doneCount * 10)}%` }} /></div></div>
                  <span className="go">›</span>
                </button>
                <button className="quest-card" onClick={() => changeView("cards")}>
                  <span className="quest-number">02</span><span className="quest-icon yellow">💡</span>
                  <div><b>到期记忆卡</b><small>人物、口诀和易混点 · 3 张</small><div className="bar yellow"><i style={{ width: "34%" }} /></div></div>
                  <span className="go">›</span>
                </button>
                <button className="quest-card" onClick={() => jumpToQuiz("geography")}>
                  <span className="quest-number">03</span><span className="quest-icon mint">🌍</span>
                  <div><b>地理星球探索</b><small>经纬网与等高线 · 约 8 分钟</small><div className="bar mint"><i style={{ width: "14%" }} /></div></div>
                  <span className="go">›</span>
                </button>
              </div>
            </section>

            <section className="two-column">
              <div className="section-block compact">
                <div className="section-heading"><div><span className="section-kicker">SUBJECTS</span><h2>两科复习进度</h2></div></div>
                <button className="subject-row" onClick={() => { setSubject("education"); changeView("map"); }}>
                  <span className="subject-bubble education">教</span><div><b>教育知识与能力</b><small>八章主线 · 高频章节优先</small><div className="bar"><i style={{ width: "22%" }} /></div></div><strong>22%</strong>
                </button>
                <button className="subject-row" onClick={() => { setSubject("geography"); changeView("map"); }}>
                  <span className="subject-bubble geography">地</span><div><b>初中地理</b><small>学科知识 · 课标 · 教学设计</small><div className="bar mint"><i style={{ width: "11%" }} /></div></div><strong>11%</strong>
                </button>
              </div>
              <aside className="love-note">
                <span>💌</span><div><b>给月月的小纸条</b><p>不是要一口气学完所有资料，而是把今天该记住的，真的记住。</p></div>
              </aside>
            </section>
          </>
        )}

        {view === "map" && (
          <section className="page-section">
            <div className="page-title">
              <span className="eyebrow">LEVEL MAP</span><h1>上岸星球闯关图</h1>
              <p>章节可以自由进入，路线只负责陪你找到下一步。</p>
            </div>
            <div className="subject-tabs">
              <button className={subject !== "geography" ? "active" : ""} onClick={() => setSubject("education")}>📘 科目二</button>
              <button className={subject === "geography" ? "active" : ""} onClick={() => setSubject("geography")}>🌍 初中地理</button>
            </div>
            <div className="level-map">
              {(subject === "geography" ? geographyChapters : educationChapters).map((chapter, i) => (
                <button className={`level-node ${chapter.color}`} key={chapter.title} onClick={() => jumpToQuiz(subject === "geography" ? "geography" : "education")}>
                  <span className="level-count">{String(i + 1).padStart(2, "0")}</span>
                  <span className="level-icon">{chapter.icon}</span>
                  <div><b>{chapter.title}</b><small>{chapter.subtitle}</small><div className="bar"><i style={{ width: `${chapter.progress}%` }} /></div></div>
                  <strong>{chapter.progress ? `${chapter.progress}%` : "未探索"}</strong>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "quiz" && (
          <section className="page-section quiz-page">
            <div className="quiz-toolbar">
              <div><span className="eyebrow">QUESTION BANK</span><h1>真题与高频练习</h1></div>
              <div className="filters">
                <input value={search} onChange={(e) => { setSearch(e.target.value); setQuestionIndex(0); resetQuestion(); }} placeholder="搜索考点或题干" aria-label="搜索题库" />
                <select value={subject} onChange={(e) => { setSubject(e.target.value as typeof subject); setQuestionIndex(0); resetQuestion(); }} aria-label="选择科目">
                  <option value="all">全部科目</option><option value="education">科目二</option><option value="geography">初中地理</option>
                </select>
                <select value={exam} onChange={(e) => { setExam(e.target.value); setQuestionIndex(0); resetQuestion(); }} aria-label="选择年份">
                  <option>全部年份</option>{examYears.map((year) => <option key={year}>{year}</option>)}
                </select>
                <select value={questionType} onChange={(e) => { setQuestionType(e.target.value); setQuestionIndex(0); resetQuestion(); }} aria-label="选择题型">
                  <option value="全部题型">全部题型</option><option value="mcq">单项选择</option><option value="trueFalse">辨析题</option><option value="short">简答题</option><option value="material">材料分析</option>
                </select>
                <select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setQuestionIndex(0); resetQuestion(); }} aria-label="选择难度">
                  <option>全部</option><option>简单</option><option>中等</option><option>困难</option>
                </select>
              </div>
            </div>
            {current ? (
              <article className="question-card">
                <div className="question-meta">
                  <span className={`difficulty d-${current.difficulty}`}>{current.difficulty}</span>
                  <span>{current.subject === "education" ? "📘 科目二" : "🌍 初中地理"}</span>
                  <span>{current.chapter} · {current.topic}</span>
                  {current.exam && <span>{current.exam} · 第 {current.questionNumber} 题</span>}
                  <span className="question-position">{(questionIndex % filteredQuestions.length) + 1} / {filteredQuestions.length}</span>
                </div>
                <h2>{current.stem}</h2>

                {current.type === "mcq" ? (
                  <div className="options">
                    {current.options?.map((option, i) => {
                      const letter = letters[i];
                      const answerState = submitted
                        ? letter === current.answer ? "correct" : letter === selected ? "wrong" : ""
                        : selected === letter ? "selected" : "";
                      return <button key={option} className={answerState} onClick={() => !submitted && setSelected(letter)}>
                        <span>{letter}</span><b>{option}</b>{submitted && letter === current.answer && <i>✓</i>}
                      </button>;
                    })}
                  </div>
                ) : (
                  <div className="written-answer">
                    <label htmlFor="written">把想到的评分点写下来</label>
                    <textarea id="written" value={written} disabled={submitted} onChange={(e) => setWritten(e.target.value)} placeholder="可以分点写：①…… ②…… ③……" />
                    <small>本地估分会检查关键词和答题结构，不会上传你的答案。</small>
                  </div>
                )}

                {!submitted ? (
                  <button className="primary submit" onClick={submitAnswer}>{current.type === "mcq" ? "确认答案" : "提交并本地估分"}</button>
                ) : (
                  <div className={`feedback ${saved.answered[current.id]?.correct ? "success" : "learn"}`}>
                    <div className="feedback-title">
                      <span>{saved.answered[current.id]?.correct ? "🌟" : "🌱"}</span>
                      <div>
                        <b>{encouragement(Boolean(saved.answered[current.id]?.correct), questionIndex)}</b>
                        {scoreResult && <small>本地参考估分：{scoreResult.score}% · 命中 {scoreResult.hits.length}/{current.scoringPoints?.length || 0} 个评分点</small>}
                      </div>
                    </div>
                    <p>{current.explanation}</p>
                    {current.type !== "mcq" && (
                      <details>
                        <summary>展开参考答案与评分点</summary>
                        <div className="answer-box"><b>参考答案</b><p>{current.answer}</p>
                          <b>评分点</b><ul>{current.scoringPoints?.map((point) => <li key={point}>{point}</li>)}</ul>
                        </div>
                      </details>
                    )}
                    <div className="source-line">
                      来源：{current.source} · PDF 第 {current.sourcePage || "待定位"} 页
                      {current.answerConfidence === "cross-checked" && " · 答案已交叉核对"}
                      {current.answerConfidence === "reference-framework" && " · 主观题参考评分框架"}
                    </div>
                    <button className="primary" onClick={nextQuestion}>下一题 <span>→</span></button>
                  </div>
                )}
              </article>
            ) : <div className="empty-state">这个筛选条件下暂时没有题目。</div>}
          </section>
        )}

        {view === "wrong" && (
          <section className="page-section">
            <div className="page-title"><span className="eyebrow">MISTAKE GARDEN</span><h1>错题不是敌人，是藏宝图</h1><p>订正后连续答对，错题就会从这里毕业。</p></div>
            <div className="wrong-summary">
              <div><span>待复习</span><strong>{saved.wrongIds.length}</strong></div>
              <div><span>已完成题目</span><strong>{doneCount}</strong></div>
              <div><span>当前正确率</span><strong>{accuracy}%</strong></div>
            </div>
            <div className="wrong-list">
              {saved.wrongIds.length ? saved.wrongIds.map((id) => {
                const q = questions.find((item) => item.id === id);
                if (!q) return null;
                return <button key={id} onClick={() => { setSubject(q.subject); setDifficulty("全部"); setExam("全部年份"); setQuestionType("全部题型"); setSearch(""); const list = questions.filter((item) => item.subject === q.subject); setQuestionIndex(Math.max(0, list.findIndex((item) => item.id === id))); resetQuestion(); changeView("quiz"); }}>
                  <span>{q.subject === "education" ? "📘" : "🌍"}</span><div><b>{q.topic}</b><p>{q.stem}</p><small>{q.difficulty} · 1 天后复习</small></div><i>去订正 →</i>
                </button>;
              }) : <div className="empty-state"><span>🌷</span><b>错题花园现在空空的</b><p>做错的题会自动来到这里，不会丢掉。</p><button className="primary" onClick={() => jumpToQuiz()}>去做几道题</button></div>}
            </div>
          </section>
        )}

        {view === "cards" && (
          <section className="page-section card-page">
            <div className="page-title"><span className="eyebrow">5-MINUTE REVIEW</span><h1>五分钟记忆卡</h1><p>一张卡只记一件事，记住比看完更重要。</p></div>
            <button className={`flashcard ${cardFlipped ? "flipped" : ""}`} onClick={() => setCardFlipped((x) => !x)}>
              <span className="card-tag">{flashcards[cardIndex].tag}</span>
              <span className="card-side">{cardFlipped ? "答案" : "问题"}</span>
              <strong>{cardFlipped ? flashcards[cardIndex].back : flashcards[cardIndex].front}</strong>
              <small>点击卡片翻面</small>
            </button>
            <div className="card-controls">
              <button className="soft" onClick={() => { setCardFlipped(false); setCardIndex((i) => (i - 1 + flashcards.length) % flashcards.length); }}>← 上一张</button>
              <span>{cardIndex + 1} / {flashcards.length}</span>
              <button className="primary" onClick={() => { setSaved((p) => ({ ...p, stars: p.stars + 1 })); setCardFlipped(false); setCardIndex((i) => (i + 1) % flashcards.length); }}>记住了 →</button>
            </div>
          </section>
        )}

        {view === "mind" && (
          <section className="page-section">
            <div className="page-title"><span className="eyebrow">KNOWLEDGE MAP</span><h1>全科思维导图</h1><p>先看森林，再记每一棵树。</p></div>
            <div className="mindmap">
              <div className="mind-center">教师资格证<br /><small>月月上岸版</small></div>
              <div className="mind-branch left">
                <h3>📘 教育知识与能力</h3>
                {educationChapters.map((x) => <button key={x.title} onClick={() => jumpToQuiz("education")}><b>{x.title}</b><small>{x.subtitle}</small></button>)}
              </div>
              <div className="mind-branch right">
                <h3>🌍 初中地理</h3>
                {geographyChapters.map((x) => <button key={x.title} onClick={() => jumpToQuiz("geography")}><b>{x.title}</b><small>{x.subtitle}</small></button>)}
              </div>
            </div>
            <div className="mind-note">点击任意节点即可进入对应科目练习；题库已覆盖 2014—2025 年科目二真题，并保留原年份与题号。</div>
          </section>
        )}
      </main>

      <footer>
        <div><b>月月上岸计划</b><span>所有学习数据仅保存在当前浏览器中。</span></div>
        <div className="footer-actions">
          <label>考试日期 <input type="date" value={saved.examDate} onChange={(e) => setSaved((p) => ({ ...p, examDate: e.target.value }))} /></label>
          <button onClick={exportProgress}>导出进度备份</button>
        </div>
      </footer>

      <nav className="mobile-nav" aria-label="手机导航">
        {[["home", "🏠", "首页"], ["map", "🗺️", "闯关"], ["quiz", "✏️", "题库"], ["wrong", "📕", "错题"], ["mind", "🧠", "导图"]].map(([id, icon, label]) =>
          <button key={id} className={view === id ? "active" : ""} onClick={() => changeView(id as View)}><span>{icon}</span>{label}</button>
        )}
      </nav>
    </div>
  );
}
