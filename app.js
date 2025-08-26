/***********************
 * Subrain 문법 퀴즈 (상세 통계 요약 포함)
 ************************/

let allProblems = [];
let activePool = [];
let currentIndex = 0;
let score = 0;
let round = 1;                 
let wrongListRound1 = [];      
let totalAnswered = 0;         
let totalToSolve = 0;          
let wrongTries = 0;            // 라운드2에서 시도 횟수 카운트

/* DOM */
const stemEl = document.getElementById("stem");
const choicesDiv = document.querySelector(".choices");
const answerDiv = document.querySelector(".answer");
const progressEl = document.getElementById("progress-count");
const progressFill = document.getElementById("progress-fill");
const nextBtn = document.getElementById("next-btn");

/* 효과음 */
function playCorrect(){ new Audio("sounds/correct.mp3").play(); }
function playWrong(){ new Audio("sounds/wrong.mp3").play(); }

/* 문제 표준화 */
function normalizeProblem(raw) {
  const q = { ...raw };
  q.stem = q.stem ?? q.question ?? "";
  q.choices = Array.isArray(q.choices) ? q.choices.slice() : [];
  q.explain_short = q.explain_short ?? "";
  q.explain_long  = q.explain_long  ?? "";
  q.examples = Array.isArray(q.examples) ? q.examples.slice() : [];
  q._answerIndex = (typeof q.answer === "number") ? q.answer : 0;
  return q;
}

/* 파일 로딩 */
document.getElementById("file-input").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
    allProblems = arr.map(normalizeProblem).filter(p => p.stem && p.choices.length >= 2);
    alert(`${file.name} 불러오기 완료! (${allProblems.length}문제)`);
  } catch (err) {
    alert("JSON 파싱 실패");
  }
});

/* 시작 */
document.getElementById("start-btn").addEventListener("click", () => {
  if (!allProblems || allProblems.length === 0) {
    alert("문제 파일을 먼저 선택해주세요!");
    return;
  }
  document.querySelector(".start-screen").style.display = "none";
  document.querySelector(".quiz-screen").style.display = "block";
  startRound1();
});

/* 홈 */
function goHome(){
  document.querySelector(".quiz-screen").style.display = "none";
  document.querySelector(".start-screen").style.display = "block";
}

/* 라운드 시작 */
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
      `<p><strong>오답!</strong> 정답은 <b>${escapeHTML(answerText)}</b><br>${escapeHTML(q.explain_short)}</p>`;
    playWrong();
    if (round === 1 && !wrongListRound1.some(p => p.id === q.id)) {
      wrongListRound1.push(q);
    }
    if (round === 2) wrongTries++;
  }

  // More 버튼
  if (q.explain_long || (q.examples && q.examples.length > 0)) {
    const moreWrap = document.createElement("div");
    moreWrap.className = "more";
    const moreBtn = document.createElement("button");
    moreBtn.className = "btn-more";
    moreBtn.textContent = "More ▾";
    const moreBody = document.createElement("div");
    moreBody.className = "more-body";
    moreBody.innerHTML = `${q.explain_long ? `<p>${escapeHTML(q.explain_long)}</p>` : ""}${q.examples.map(ex=>`<li>${escapeHTML(ex)}</li>`).join("")}`;
    moreBtn.addEventListener("click", ()=>{
      const open = moreBody.classList.toggle("open");
      moreBtn.textContent = open ? "Less ▴" : "More ▾";
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
      if (activePool.length === 0) {
        endWrongRound();
        return;
      }
    }
    if (currentIndex >= activePool.length) currentIndex = 0;
    showQuestion(activePool[currentIndex]);
    return;
  }

  totalAnswered++;
  currentIndex++;
  if(currentIndex >= activePool.length){
    endRound1();
  } else {
    showQuestion(activePool[currentIndex]);
  }
});

/* 라운드1 종료 */
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

/* 라운드2 종료 */
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

/* XSS 방지 */
function escapeHTML(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
