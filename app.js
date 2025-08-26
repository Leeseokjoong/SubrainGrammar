/***********************
 * Subrain 문법 퀴즈 — 세트 드롭다운 선택 (20문제 고정)
 ************************/

// 상태
let allProblems = [];           // 현재 세트의 문제(20문제)
let activePool = [];            // 현재 라운드에서 풀 문제 큐
let currentIndex = 0;
let score = 0;
let round = 1;                  // 1: 전체, 2: 오답 라운드
let wrongListRound1 = [];       // 라운드1에서 틀린 문제 목록
let totalAnswered = 0;          // 현재 라운드에서 '맞혀서 끝낸' 개수
let totalToSolve = 0;           // 현재 라운드 총 문항
let wrongTries = 0;             // 라운드2에서 틀린 시도 횟수(통계용)

// DOM
const stemEl = document.getElementById("stem");
const choicesDiv = document.querySelector(".choices");
const answerDiv = document.querySelector(".answer");
const progressEl = document.getElementById("progress-count");
const progressFill = document.getElementById("progress-fill");
const nextBtn = document.getElementById("next-btn");
const startBtn = document.getElementById("start-btn");
const setSelect = document.getElementById("set-select");
const loadSetBtn = document.getElementById("load-set");
const setStatus = document.getElementById("set-status");

// 효과음(mp3)
function playCorrect(){ new Audio("sounds/correct.mp3").play(); }
function playWrong(){ new Audio("sounds/wrong.mp3").play(); }

// 유틸
function escapeHTML(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

// 문제 표준화
function normalizeProblem(raw) {
  const q = { ...raw };
  q.id = q.id ?? Math.random().toString(36).slice(2);
  q.stem = q.stem ?? q.question ?? "";
  q.choices = Array.isArray(q.choices) ? q.choices.slice() : [];
  q.explain_short = q.explain_short ?? "";
  q.explain_long  = q.explain_long  ?? "";
  q.examples = Array.isArray(q.examples) ? q.examples.slice() : [];
  q._answerIndex = (typeof q.answer === "number") ? q.answer : 0; // 0-based
  return q;
}

/* ─────────────  매니페스트 로드 → 드롭다운 채우기  ─────────────
   m1_manifest.json 예시:
   {
     "sets": [
       { "label": "1~20",   "files": ["data/m1_1-20.json"] },
       { "label": "21~40",  "files": ["data/m1_21-40.json"] },
       ...
     ]
   }
*/
async function loadManifest() {
  try {
    setStatus.textContent = "매니페스트를 읽는 중...";
    const res = await fetch("m1_manifest.json");
    if (!res.ok) throw new Error("manifest fetch failed");
    const mj = await res.json();
    const sets = Array.isArray(mj.sets) ? mj.sets : [];
    if (sets.length === 0) throw new Error("no sets in manifest");

    // 드롭다운 옵션 채우기
    setSelect.innerHTML = "";
    sets.forEach((s, idx) => {
      const opt = document.createElement("option");
      opt.value = s.files?.[0] || "";         // 파일 경로(한 세트당 1파일 가정)
      opt.textContent = s.label || `세트 ${idx+1}`;
      setSelect.appendChild(opt);
    });

    setStatus.textContent = "세트를 선택한 뒤 ‘세트 불러오기’를 누르세요.";
  } catch (e) {
    console.error(e);
    setStatus.textContent = "❌ 매니페스트 로딩 실패";
  }
}

/* ─────────────  세트 JSON 로드(20문제)  ───────────── */
async function loadSelectedSet() {
  const filePath = setSelect.value;
  if (!filePath) return;
  try {
    setStatus.textContent = "📦 세트 불러오는 중...";
    const r = await fetch(filePath);
    if (!r.ok) throw new Error("set fetch failed");
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
    allProblems = arr.map(normalizeProblem);
    if (allProblems.length === 0) throw new Error("no problems in set");

    setStatus.textContent = `✅ 세트 준비 완료! (${allProblems.length}문제) ‘퀴즈 시작’을 누르세요.`;
    startBtn.disabled = false;
  } catch (e) {
    console.error(e);
    setStatus.textContent = "❌ 세트 로딩 실패";
    startBtn.disabled = true;
  }
}

/* ─────────────  시작/홈  ───────────── */
startBtn.addEventListener("click", () => {
  if (!allProblems.length) {
    alert("세트를 먼저 불러오세요!");
    return;
  }
  document.querySelector(".start-screen").style.display = "none";
  document.querySelector(".quiz-screen").style.display = "block";
  startRound1();
});

function goHome(){
  document.querySelector(".quiz-screen").style.display = "none";
  document.querySelector(".start-screen").style.display = "block";
  // 메뉴판으로 돌아온 뒤에도 방금 불러온 세트는 유지 (원하면 startBtn을 비활성화 해도 됨)
}

/* ─────────────  라운드 제어  ───────────── */
function startRound1(){
  round = 1;
  activePool = allProblems.map(p => p);
  currentIndex = 0;
  score = 0;
  totalAnswered = 0;
  totalToSolve = activePool.length; // 보통 20
  wrongListRound1 = [];
  showQuestion(activePool[currentIndex]);
}

function startWrongRound(){
  round = 2;
  activePool = wrongListRound1.map(p => p);
  currentIndex = 0;
  score = 0;
  totalAnswered = 0;
  totalToSolve = activePool.length;
  wrongTries = 0;
  showQuestion(activePool[currentIndex]);
}

/* ─────────────  문제 출력  ───────────── */
function showQuestion(q){
  // 진행 표시
  progressEl.textContent = `${totalAnswered + 1} / ${totalToSolve}`;
  const ratio = totalToSolve ? ((totalAnswered + 1)/totalToSolve) : 1;
  progressFill.style.width = `${Math.min(100, Math.max(0, ratio*100)).toFixed(2)}%`;

  // 본문
  stemEl.textContent = q.stem;

  // 보기
  choicesDiv.innerHTML = "";
  q.choices.forEach((c,i)=>{
    const btn = document.createElement("button");
    btn.textContent = c;
    btn.addEventListener("click", ()=>checkAnswer(i,q,btn), { once:true });
    choicesDiv.appendChild(btn);
  });

  // 해설/다음 초기화
  answerDiv.innerHTML = "";
  nextBtn.style.display = "none";

  // (레이아웃 안정화를 위해) 문제 시작 시 카드 내부 스크롤 최상단으로
  // 실제 스크롤 컨테이너는 CSS 2단계에서 지정 예정. 임시로 윈도우 스크롤 리셋:
  try { document.querySelector(".quiz-screen").scrollTop = 0; } catch(e){}
}

/* ─────────────  정답 체크 + 해설 + More  ───────────── */
function checkAnswer(choiceIndex, q){
  const correctIndex = q._answerIndex;

  const buttons = choicesDiv.querySelectorAll("button");
  buttons.forEach((b,i)=>{
    if(i===correctIndex) b.classList.add("choice-correct");
    if(i===choiceIndex && i!==correctIndex) b.classList.add("choice-wrong");
    b.disabled = true;
  });

  const isCorrect = (choiceIndex===correctIndex);
  if (isCorrect){
    score++;
    answerDiv.innerHTML = `<p><strong>정답!</strong> ${escapeHTML(q.explain_short)}</p>`;
    playCorrect();
  }else{
    const answerText = q.choices[correctIndex];
    answerDiv.innerHTML =
      `<p><strong>오답!</strong> 정답은 <b>${escapeHTML(answerText)}</b> 입니다.<br>${escapeHTML(q.explain_short)}</p>`;
    playWrong();

    if (round === 1) {
      // id 기준 중복 방지
      if (!wrongListRound1.some(p => p.id === q.id)) wrongListRound1.push(q);
    } else {
      wrongTries++;
    }
  }

  // More 토글 (긴 해설/예문이 있어도 카드 높이는 다음 단계 CSS가 잡아줌)
  const hasLong = (q.explain_long && q.explain_long.trim().length > 0);
  const hasEx = Array.isArray(q.examples) && q.examples.length > 0;
  if (hasLong || hasEx) {
    const moreWrap = document.createElement("div");
    moreWrap.className = "more";

    const moreBtn = document.createElement("button");
    moreBtn.className = "btn-more";
    moreBtn.textContent = "More ▾";
    moreBtn.setAttribute("aria-expanded", "false");

    const moreBody = document.createElement("div");
    moreBody.className = "more-body";
    const exList = hasEx ? `<ul>${q.examples.map(ex => `<li>${escapeHTML(ex)}</li>`).join("")}</ul>` : "";
    moreBody.innerHTML = `${hasLong ? `<p>${escapeHTML(q.explain_long)}</p>` : ""}${exList}`;

    moreBtn.addEventListener("click", ()=>{
      const open = moreBody.classList.toggle("open");
      moreBtn.textContent = open ? "Less ▴" : "More ▾";
      moreBtn.setAttribute("aria-expanded", String(open));
      // 펼칠 때도 스크롤만 생기고 카드 높이는 유지되도록(다음 단계 CSS에서 처리)
    });

    moreWrap.appendChild(moreBtn);
    moreWrap.appendChild(moreBody);
    answerDiv.appendChild(moreWrap);
  }

  nextBtn.style.display = "inline-block";
  nextBtn._lastWasCorrect = isCorrect;
}

/* ─────────────  다음 버튼  ───────────── */
nextBtn.addEventListener("click", ()=>{
  const wasCorrect = !!nextBtn._lastWasCorrect;

  if (round === 2) {
    if (!wasCorrect) {
      // 틀리면 다시 큐 뒤로
      const item = activePool[currentIndex];
      activePool.splice(currentIndex, 1);
      activePool.push(item);
    } else {
      // 맞히면 제거
      activePool.splice(currentIndex, 1);
      totalAnswered++;
      if (activePool.length === 0) { endWrongRound(); return; }
    }
    if (currentIndex >= activePool.length) currentIndex = 0;
    showQuestion(activePool[currentIndex]);
    return;
  }

  // 라운드1
  totalAnswered++;
  currentIndex++;
  if(currentIndex >= activePool.length){
    endRound1();
  } else {
    showQuestion(activePool[currentIndex]);
  }
});

/* ─────────────  라운드1 종료  ───────────── */
function endRound1(){
  stemEl.textContent = "라운드 1 완료!";
  choicesDiv.innerHTML = "";
  answerDiv.innerHTML = "";

  const total = activePool.length + totalAnswered; // 원래 세트 문제수(보통 20)
  const wrongCnt = wrongListRound1.length;
  const correctCnt = score;
  const accuracy = total ? ((correctCnt/total)*100).toFixed(1) : "0.0";

  const summary = document.createElement("div");
  summary.innerHTML = `
    <p>총 문제: <b>${total}</b></p>
    <p>맞힌 문제: <b>${correctCnt}</b></p>
    <p>틀린 문제: <b>${wrongCnt}</b></p>
    <p>정답률: <b>${accuracy}%</b></p>
  `;
  answerDiv.appendChild(summary);

  const wrap = document.createElement("div");
  wrap.className = "actions";

  const btnHome = document.createElement("button");
  btnHome.className = "btn-ghost";
  btnHome.textContent = "처음으로";
  btnHome.addEventListener("click", goHome);
  wrap.appendChild(btnHome);

  if (wrongCnt > 0) {
    const btnRetryWrong = document.createElement("button");
    btnRetryWrong.className = "btn-blue";
    btnRetryWrong.textContent = "오답 다시 풀기 ▶";
    btnRetryWrong.style.marginLeft = "8px";
    btnRetryWrong.addEventListener("click", startWrongRound);
    wrap.appendChild(btnRetryWrong);
  } else {
    const doneMsg = document.createElement("p");
    doneMsg.style.marginTop = "10px";
    doneMsg.innerHTML = "<b>🎉 완벽합니다! 오답이 없습니다.</b>";
    answerDiv.appendChild(doneMsg);
  }

  answerDiv.appendChild(wrap);

  nextBtn.style.display = "none";
  progressFill.style.width = "100%";
  progressEl.textContent = `${total} / ${total}`;
}

/* ─────────────  라운드2(오답) 종료  ───────────── */
function endWrongRound(){
  stemEl.textContent = "🎉 오답 정복 완료!";
  choicesDiv.innerHTML = "";
  answerDiv.innerHTML = "";

  const totalWrong = wrongListRound1.length;
  const totalTries = totalAnswered + wrongTries;
  const summary = document.createElement("div");
  summary.innerHTML = `
    <p>오답 라운드 시작 문제 수: <b>${totalWrong}</b></p>
    <p>총 시도 횟수: <b>${totalTries}</b></p>
    <p>최종 정답률: <b>100%</b></p>
  `;
  answerDiv.appendChild(summary);

  const wrap = document.createElement("div");
  wrap.className = "actions";

  const btnHome = document.createElement("button");
  btnHome.className = "btn-ghost";
  btnHome.textContent = "처음으로";
  btnHome.addEventListener("click", goHome);
  wrap.appendChild(btnHome);

  answerDiv.appendChild(wrap);

  nextBtn.style.display = "none";
  progressFill.style.width = "100%";
  progressEl.textContent = "완료";
}

/* ─────────────  이벤트 바인딩 & 초기화  ───────────── */
loadSetBtn.addEventListener("click", loadSelectedSet);

// 페이지 진입 시 매니페스트 로딩 → 드롭다운 채우기
loadManifest();
