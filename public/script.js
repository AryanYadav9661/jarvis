/**
 * Jarvis — LLM Edition (client)
 *
 * - Keyword commands (time, joke, search, notes, reminders)
 * - Speech Recognition & Speech Synthesis (Web Speech API)
 * - LLM mode: POST /api/chat { prompt } -> expects { reply }
 */

const useLLM = document.getElementById('useLLM');
const micBtn = document.getElementById('micBtn');
const sendBtn = document.getElementById('sendBtn');
const textInput = document.getElementById('textInput');
const conversation = document.getElementById('conversation');
const statusEl = document.getElementById('status');
const voiceSelect = document.getElementById('voiceSelect');
const rateInput = document.getElementById('rate');
const pitchInput = document.getElementById('pitch');
const quick = document.querySelectorAll('.quick button');
const showNotesBtn = document.getElementById('showNotes');
const showRmdBtn = document.getElementById('showRmd');

let synth = window.speechSynthesis;
let voices = [];
let selectedVoiceIndex = 0;

// UI helpers
function setStatus(t){ statusEl.textContent = t; }
function appendMessage(text, who='assistant'){
  const el = document.createElement('div');
  el.className = who === 'user' ? 'user' : 'assistant';
  el.textContent = text;
  conversation.appendChild(el);
  conversation.scrollTop = conversation.scrollHeight;
}
function speak(text){
  if(!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voices[selectedVoiceIndex] || null;
  u.lang = 'en-IN';
  u.rate = Number(rateInput.value) || 1;
  u.pitch = Number(pitchInput.value) || 1;
  synth.cancel();
  synth.speak(u);
}

// load voices
function loadVoices(){
  voices = synth.getVoices() || [];
  voiceSelect.innerHTML = '';
  voices.forEach((v,i)=>{
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${v.name} — ${v.lang}`;
    voiceSelect.appendChild(opt);
  });
}
if(synth){
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
  voiceSelect.addEventListener('change', ()=>{ selectedVoiceIndex = +voiceSelect.value; });
}

// Storage helpers
function getNotes(){ return JSON.parse(localStorage.getItem('jarvis_notes')||'[]'); }
function saveNotes(a){ localStorage.setItem('jarvis_notes', JSON.stringify(a)); }
function addNote(txt){ const arr = getNotes(); arr.push({ text: txt, at: Date.now() }); saveNotes(arr); }

function getReminders(){ return JSON.parse(localStorage.getItem('jarvis_rmd')||'[]'); }
function saveReminders(a){ localStorage.setItem('jarvis_rmd', JSON.stringify(a)); }
function addReminder(text, whenTs){ const arr = getReminders(); arr.push({ text, ts: whenTs }); saveReminders(arr); }

// reminder poller
setInterval(()=>{
  const now = Date.now();
  const rs = getReminders();
  const remaining = [];
  rs.forEach(r=>{
    if(r.ts <= now){
      appendMessage('Reminder: ' + r.text, 'assistant');
      speak('Reminder: ' + r.text);
    } else remaining.push(r);
  });
  if(remaining.length !== rs.length) saveReminders(remaining);
}, 30_000);

// local command handler
function localHandle(command){
  const txt = command.trim();
  const low = txt.toLowerCase();
  if(low === '') return;

  if(low.includes('time')){
    const now = new Date();
    const res = `It's ${now.toLocaleTimeString()}.`;
    appendMessage(res,'assistant'); speak(res);
  } else if(low.includes('date')){
    const now = new Date();
    const res = `Today is ${now.toLocaleDateString()}.`;
    appendMessage(res,'assistant'); speak(res);
  } else if(low.includes('joke')){
    const jokes = [
      "Why did the programmer quit? Because he didn't get arrays.",
      "Why do programmers prefer dark mode? Light attracts bugs."
    ];
    const r = jokes[Math.floor(Math.random()*jokes.length)];
    appendMessage(r,'assistant'); speak(r);
  } else if(low.startsWith('search:') || low.startsWith('search ')){
    const q = txt.split(/search[: ]+/i).pop().trim();
    appendMessage('Searching for ' + q, 'assistant'); speak('Searching ' + q);
    window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
  } else if(low.startsWith('note') || low.startsWith('remember')){
    const note = txt.replace(/^(note|remember)[: ]*/i,'').trim();
    if(note){ addNote(note); appendMessage('Saved note: ' + note, 'assistant'); speak('Saved note'); }
    else { appendMessage('Please add text for the note.', 'assistant'); }
  } else if(low.startsWith('remind me') || low.startsWith('set reminder')){
    const parsed = parseReminder(txt);
    if(parsed){ addReminder(parsed.text, parsed.ts); appendMessage('Reminder set: ' + parsed.text + ' at ' + new Date(parsed.ts).toLocaleString(),'assistant'); speak('Reminder set'); }
    else appendMessage('Could not parse reminder. Use: remind me in 10 minutes to ...', 'assistant');
  } else {
    appendMessage("I don't understand locally. Try time, joke, search:, note, remind me, or enable LLM.", 'assistant');
    speak("Try: time, joke, search, note, or reminders. Or enable LLM for more.");
  }
}

// reminder parser
function parseReminder(text){
  const inMatch = text.match(/in (\d+) (minute|minutes|hour|hours)/i);
  if(inMatch){
    const n = +inMatch[1];
    const unit = inMatch[2].toLowerCase();
    const idx = text.toLowerCase().indexOf('to ');
    const msg = idx > -1 ? text.slice(idx+3) : 'Reminder';
    const ms = unit.startsWith('hour') ? n * 3600000 : n * 60000;
    return { text: msg, ts: Date.now() + ms };
  }
  const atMatch = text.match(/at (\d{1,2}:\d{2})/i);
  if(atMatch){
    const [hh, mm] = atMatch[1].split(':').map(s => +s);
    const now = new Date();
    let t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
    if(t.getTime() < now.getTime()) t.setDate(t.getDate() + 1);
    const idx = text.toLowerCase().indexOf('to ');
    const msg = idx > -1 ? text.slice(idx+3) : 'Reminder';
    return { text: msg, ts: t.getTime() };
  }
  return null;
}

// call LLM on server
async function callLLM(prompt){
  try{
    setStatus('Talking to LLM...');
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    if(!res.ok){
      const txt = await res.text();
      throw new Error('LLM error: ' + res.status + ' ' + txt);
    }
    const j = await res.json();
    return j.reply || 'LLM returned empty reply';
  } catch(err){
    console.error(err);
    return 'LLM request failed: ' + (err.message || err);
  } finally {
    setStatus('Idle');
  }
}

// main dispatch
async function handleCommand(raw){
  appendMessage(raw, 'user');

  if(useLLM.checked){
    appendMessage('Thinking...', 'assistant');
    const reply = await callLLM(raw);
    // append actual reply (don't try to remove the 'Thinking...' placeholder for simplicity)
    appendMessage(reply,'assistant');
    speak(reply);
  } else {
    localHandle(raw);
  }
}

// speech recognition
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;
if(SR){
  recognition = new SR();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  recognition.onstart = ()=>{ listening = true; micBtn.classList.add('on'); setStatus('Listening...'); };
  recognition.onend = ()=>{ listening = false; micBtn.classList.remove('on'); setStatus('Idle'); };
  recognition.onerror = (e)=>{ console.error('recog err', e); setStatus('Recog error'); };
  recognition.onresult = (ev)=>{ const t = ev.results[0][0].transcript; textInput.value = t; handleCommand(t); };
}
micBtn.addEventListener('click', ()=>{
  if(!recognition) { alert('Speech recognition not supported in this browser. Use Chrome.'); return; }
  if(listening) recognition.stop(); else recognition.start();
});

// UI bindings
sendBtn.addEventListener('click', ()=>{ const v = textInput.value.trim(); if(!v) return; handleCommand(v); textInput.value = ''; });
textInput.addEventListener('keydown', e=>{ if(e.key === 'Enter'){ sendBtn.click(); }});
quick.forEach(b => b.addEventListener('click', e=>{ const cmd = e.currentTarget.getAttribute('data-cmd'); handleCommand(cmd); }));
showNotesBtn && showNotesBtn.addEventListener('click', ()=>{
  const notes = getNotes();
  if(!notes.length) appendMessage('No notes saved.','assistant');
  else { appendMessage('Notes:','assistant'); notes.forEach(n=>appendMessage('- '+n.text, 'assistant')); }
});
showRmdBtn && showRmdBtn.addEventListener('click', ()=>{
  const r = getReminders();
  if(!r.length) appendMessage('No reminders.','assistant');
  else { appendMessage('Reminders:','assistant'); r.forEach(n=>appendMessage('- '+new Date(n.ts).toLocaleString()+': '+n.text, 'assistant')); }
});

// greet
appendMessage('Jarvis ready. Toggle "Use LLM" to enable model-based answers.','assistant');
setStatus('Idle');
