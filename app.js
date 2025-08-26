/***********************
 * Subrain 문법 퀴즈 (세트 메뉴 선택 버전)
 ************************/

let allProblems = [];
let sets = [];                 // [{label, files}] 형태
let activePool = [];
let currentIndex = 0;
let score = 0;
let round = 1;                 // 1: 전체, 2: 오답
let wrongListRound1 = [];      // 라운드1 오답
let totalAnswered = 0;         // 라운드에서 '맞혀서 끝낸' 개수
let totalToSolve = 0;          // 라운드 총 문제 수
let wrongTries = 0;            // 라운드2 틀린 시도 누계

/* DOM */
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

/* 효과음 */
function playCorrect(){ new Audio("sounds/correct.mp3").play(); }
function playWrong(){ new Audio("sounds/wrong.mp3").play(); }

/* 유틸 */
function escapeHTML(str){
  return String(str ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function getParam(name){ const u=new URL(location.href); return u.searchParams.get(name); }

/* 문제 표준화 */
function normalizeProblem(raw) {
  const q = { ...raw };
  q.id = q.id ?? Math.random().toString(36).slice(2);
  q.stem = q.stem ?? q.question ?? "";
  q.choices = Array.isArray(q.choices) ? q.choices.slice() : [];
  q.explain_short = q.explain_short ?? q.shortExp ?? "";
  q.explain_long  = q.explain_long  ?? q.longExp  ?? "";
  q.examples = Array.isArray(q.examples) ? q.examples.slice() : [];
  q._answerIndex = (typeof q.answer === "number") ? q.answer : 0;
  return q;
}

/* 매니페스트 로딩 → 메뉴 구성
   - m1_manifest.json
   - 지원 형식:
     A) { "sets":[ { "label":"M1 1-20", "files":["data/m1_1-20.json"] }, ... ] }
     B) { "files":[ "data/m1_1-20.json", ... ] }  // 단일 세트로 취급
*/
async function loadManifest() {
  const manifestPath = getParam("manifest") || "m1_manifest.json";
  try {
    const res = await fetch(manifestPath);
    if (!res.ok) throw new Error("manifest fetch failed");
    const mj = await res.json();
    if (Array.isArray(mj.sets) && mj.sets.length) {
      sets = mj.sets;
    } else if (Array.isArray(mj.files) && mj.files.length) {
      sets = [{ label: "전체 문제", files: mj.files }];
    } else {
      throw new Error("manifest has no sets/files");
    }
    renderSetMenu();
    setStatus.textContent = "세트를 선택하고 ‘세트 불러오기’를 누르세요.";
  } catch (e) {
    console.error(e);
    setStatus.textContent = "❌ 매니페스트를 불러오지 못했습니다.";
  }
}

function renderSetMenu() {
  setSelect.innerHTML = "";
  sets.forEach((s, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = s.label || `세트 ${idx+1}`;
    setSelect.appendChild(opt);
  });
  const qs = getParam("set"); // ?set=라벨이름 (선택사항)
  if (qs) {
    const i = sets.findIndex(s => s.label === qs);
    if (i >= 0) setSelect.value = String(i);
  }
}

/* 세트 로딩 */
async function loadSelectedSet() {
  const idx = Number(setSelect.value);
  const choice = sets[idx];
  if (!choice) return;
  setStatus.textContent = "📦 문제 불러오는 중...";
  try {
    const merged = [];
    for (const path of choice.files) {
      const r = await fetch(path);
      if (!r.ok) throw new Error(`fetch failed: ${path}`);
      const data = await r.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
      for (const it of arr) merged.push(normalizeProblem(it));
    }
    allProblems = merged;
    startBtn.disabled = false;
    setStatus.textContent = `✅ '${choice.label}' 세트 준비 완료! (총 ${allProblems.length}문제)`;
  } catch (e) {
    console.error(e);
    setStatus.textContent = "❌ 세트 로딩 실패. 다시 시도하세요.";
    startBtn.disabled = true;
  }
}

/* 시작 버튼 */
startBtn.addEventListener("click", () => {
  if (!allProblems.length) {
    alert("세트를 먼저 불러오세요!");
    return;
  }
  document.querySelector(".start-screen").style.display = "none";
  document.querySelector(".quiz-screen").style.display = "block";
  startRound1();
});

/* 세트 불러오기 버튼 */
loadSetBtn.addEventListener("click", loadSelectedSet);

/* 홈으로 */
function goHome(){
  document.querySelector(".quiz-screen").style.display = "none";
  document.querySelector(".start-screen").style.display = "block";
}

/* 라운드 제어 */
function startRound1(){
  round = 1;
  activePool = allProblems.map(p => p);
  currentIndex = 0;
  score = 0;
  totalAnswered = 0;
  totalToSolve = activePool.length;
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

/* 문제 출력 */
function showQuestion(q){
  stemEl.textContent = q.stem;
  progressEl.textContent = `${totalAnswered + 1} / ${totalToSolve}`;
  progressFill.style.width = `${((totalAnswered + 1)/Math.max(totalToSolve,1))*100}%`;

  choicesDiv.innerHTML = "";
  q.choices.forEach((c,i)=>{
    const btn = document.createElement("button");
    btn.textContent = c;
    btn.addEventListener("click", ()=>checkAnswer(i,q,btn), { once:true });
    choicesDiv.appendChild(btn);
  });

  answerDiv.innerHTML = "";
  nextBtn.style.display = "none";
}

/* 정답 체크 */
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
      if (!wrongListRound1.some(p => p.id === q.id)) wrongListRound1.push(q);
    } else {
      wrongTries++;
    }
  }

  // More 토글
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
    });

    moreWrap.appendChild(moreBtn);
    moreWrap.appendChild(moreBody);
    answerDiv.appendChild(moreWrap);
  }

  nextBtn.style.display = "inline-block";
  nextBtn._lastWasCorrect = isCorrect;
}

/* 다음 버튼 */
nextBtn.addEventListener("click", ()=>{
  const wasCorrect = !!nextBtn._lastWasCorrect;

  if (round === 2) {
    if (!wasCorrect) {
      const item = activePool[currentIndex];
      activePool.splice(currentIndex, 1);
      activePool.push(item);
    } else {
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
  if(currentIndex >= activePool.length) endRound1();
  else showQuestion(activePool[currentIndex]);
});

/* 라운드1 종료 (상세 통계 + 오답 라운드 버튼) */
function endRound1(){
  stemEl.textContent = "라운드 1 완료!";
  choicesDiv.innerHTML = "";
  answerDiv.innerHTML = "";

  const total = allProblems.length;
  const wrongCnt = wrongListRound1.length;
  const correctCnt = score;
  const accuracy = ((correctCnt/total)*100).toFixed(1);

  const summary = document.createElement("div");
  summary.innerHTML = `
    <p>총 문제: <b>${total}</b></p>
    <p>맞힌 문제: <b>${correctCnt}</b></p>
    <p>틀린 문제: <b>${wrongCnt}</b></p>
    <p>정답률: <b>${accuracy}%</b></p>
  `;
  answerDiv.appendChild(summary);

  if (wrongCnt === 0) {
    const doneMsg = document.createElement("p");
    doneMsg.innerHTML = "<b>🎉 완벽합니다! 오답이 없습니다.</b>";
    answerDiv.appendChild(doneMsg);
  }

  const wrap = document.createElement("div");
  wrap.className = "actions";

  const btnHome = document.createElement("button");
  btnHome.className = "btn-ghost";
  btnHome.textContent = "처음으로";
  btnHome.addEventListener("click", goHome);
  wrap.appendChild(btnHome);

  const btnRestartAll = document.createElement("button");
  btnRestartAll.className = "btn-ghost";
  btnRestartAll.textContent = "처음부터 다시";
  btnRestartAll.addEventListener("click", startRound1);
  wrap.appendChild(btnRestartAll);

  if (wrongCnt > 0) {
    const btnRetryWrong = document.createElement("button");
    btnRetryWrong.className = "btn-blue";
    btnRetryWrong.textContent = "오답 다시 풀기 ▶";
    btnRetryWrong.addEventListener("click", startWrongRound);
    wrap.appendChild(btnRetryWrong);
  }

  answerDiv.appendChild(wrap);
  nextBtn.style.display = "none";
  progressFill.style.width = "100%";
  progressEl.textContent = `${total} / ${total}`;
}

/* 라운드2 종료 (상세 통계 + 처음으로) */
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

  const btnRestartAll = document.createElement("button");
  btnRestartAll.className = "btn-blue";
  btnRestartAll.textContent = "전체 다시 풀기 ▶";
  btnRestartAll.addEventListener("click", startRound1);
  wrap.appendChild(btnRestartAll);

  answerDiv.appendChild(wrap);
  nextBtn.style.display = "none";
  progressFill.style.width = "100%";
  progressEl.textContent = "완료";
}

/* 시작 시 매니페스트 읽어서 메뉴 구성 */
loadManifest();
