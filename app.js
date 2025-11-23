/* Boost Révise PRO - front prototype
   Features:
   - Génération locale de fiches
   - Sauvegarde en localStorage
   - Quiz basique depuis une fiche
   - Export JSON / PDF (print)
   - PWA support via manifest + sw
   - IA & Paiement via backend (endpoints expliqués plus bas)
*/

// ---- Helpers & state ----
const saveKey = 'boostrevise_pro_fiches';
let currentFicheId = null;

// Views
const views = {
  home: document.getElementById('home'),
  create: document.getElementById('create'),
  quiz: document.getElementById('quiz'),
  dashboard: document.getElementById('dashboard')
};
function show(v){ Object.values(views).forEach(x=>x.classList.add('hidden')); views[v].classList.remove('hidden'); }

// Basic navigation (header)
document.getElementById('btn-dashboard').onclick = ()=> { renderSaved(); show('dashboard'); };

// Install prompt (PWA)
let deferredPrompt;
const installBtn = document.getElementById('btn-install');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn.onclick = async () => { if(!deferredPrompt) return; deferredPrompt.prompt(); const choice = await deferredPrompt.userChoice; deferredPrompt = null; installBtn.hidden = true; };

// ---- Generation simple (local) ----
function generateLocal(matiere, chapitre, niveau){
  const id = 'fiche_' + Date.now();
  const summary = `FICHE: ${matiere} — ${chapitre}\nNiveau: ${niveau}\n\nRésumé rapide:\n- Point 1 : ...\n- Point 2 : ...\n- Point 3 : ...\n\nFormules / Méthode:\n- ...\n\nExercices:\n1) ...\n2) ...\n3) ...\n\nRéponses :\n1) ...\n2) ...\n3) ...`;
  return { id, matiere, chapitre, niveau, summary, created: new Date().toISOString() };
}

// Save / Load
function loadAll(){ return JSON.parse(localStorage.getItem(saveKey) || '[]'); }
function saveFiche(f){
  const arr = loadAll();
  arr.unshift(f);
  localStorage.setItem(saveKey, JSON.stringify(arr));
}
function deleteFiche(id){
  const arr = loadAll().filter(x=>x.id !== id);
  localStorage.setItem(saveKey, JSON.stringify(arr));
  renderSaved();
}

// Render main result
document.getElementById('generate').onclick = ()=>{
  const mat = document.getElementById('matiere').value;
  const chap = document.getElementById('chapitre').value || 'Chapitre';
  const niv = document.getElementById('nav-niveau').value;
  const f = generateLocal(mat, chap, niv);
  currentFicheId = f.id;
  document.getElementById('result').innerHTML = `<pre>${f.summary}</pre>
    <div class="row" style="margin-top:8px">
      <button id="save-now">Sauvegarder</button>
      <button id="edit-now">Modifier</button>
      <button id="generate-ia">Générer avec IA (option)</button>
    </div>`;
  document.getElementById('save-now').onclick = ()=> { saveFiche(f); alert('Fiche sauvegardée !'); };
  document.getElementById('edit-now').onclick = ()=> { openEditorWith(f); show('create'); };
  document.getElementById('generate-ia').onclick = async ()=>{
    // This calls backend: /api/generate (see server-example.js)
    const target = document.getElementById('result');
    target.innerHTML = '<em>Génération IA en cours…</em>';
    try{
      const resp = await fetch('/api/generate', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ matiere:mat, chapitre:chap, niveau:niv })
      });
      if(!resp.ok) throw new Error('no backend');
      const data = await resp.json();
      const f2 = { id:'fiche_'+Date.now(), matiere:mat, chapitre:chap, niveau:niv, summary:data.text, created:new Date().toISOString() };
      currentFicheId = f2.id;
      target.innerHTML = `<pre>${f2.summary}</pre><div class="row" style="margin-top:8px">
        <button id="save-ia">Sauvegarder</button>
        <button id="edit-ia">Modifier</button>
      </div>`;
      document.getElementById('save-ia').onclick = ()=>{ saveFiche(f2); alert('Fiche IA sauvegardée'); };
      document.getElementById('edit-ia').onclick = ()=>{ openEditorWith(f2); show('create'); };
    }catch(e){
      target.innerHTML = '<em>Erreur : Pas de backend IA configuré (ou problème réseau).</em>';
      console.error(e);
    }
  };
};

// Editor
function openEditorWith(f){
  document.getElementById('edit-matiere').value = f.matiere;
  document.getElementById('edit-chap').value = f.chapitre;
  document.getElementById('edit-niveau').value = f.niveau;
  document.getElementById('edit-content').value = f.summary;
  currentFicheId = f.id;
}
document.getElementById('save-fiche').onclick = ()=>{
  const f = {
    id: currentFicheId || ('fiche_'+Date.now()),
    matiere: document.getElementById('edit-matiere').value,
    chapitre: document.getElementById('edit-chap').value,
    niveau: document.getElementById('edit-niveau').value,
    summary: document.getElementById('edit-content').value,
    created: new Date().toISOString()
  };
  saveFiche(f);
  alert('Fiche sauvegardée');
  renderSaved();
};

// Export PDF (simple: open print)
document.getElementById('export-pdf').onclick = ()=>{
  const content = document.getElementById('edit-content').value || 'Rien à exporter';
  const w = window.open('', '_blank');
  w.document.write(`<pre>${content.replace(/</g,'&lt;')}</pre>`);
  w.document.close();
  w.print();
};

// Dashboard
function renderSaved(){
  const arr = loadAll();
  const el = document.getElementById('saved-list');
  if(arr.length===0){ el.innerHTML = '<em>Aucune fiche sauvegardée.</em>'; return; }
  el.innerHTML = arr.map(f=>`<div>
    <strong>${f.matiere} — ${f.chapitre}</strong> <small>${new Date(f.created).toLocaleString()}</small>
    <p style="white-space:pre-wrap">${f.summary}</p>
    <div class="row">
      <button data-id="${f.id}" class="btn-open">Ouvrir</button>
      <button data-id="${f.id}" class="btn-quiz">Quiz</button>
      <button data-id="${f.id}" class="btn-download">Télécharger</button>
      <button data-id="${f.id}" class="btn-delete danger">Supprimer</button>
    </div>
  </div>`).join('');
  // attach
  Array.from(el.querySelectorAll('.btn-open')).forEach(b=>b.onclick = ()=> {
    const id = b.dataset.id; const f = loadAll().find(x=>x.id===id);
    openEditorWith(f); show('create');
  });
  Array.from(el.querySelectorAll('.btn-download')).forEach(b=>b.onclick = ()=> {
    const id=b.dataset.id; const f = loadAll().find(x=>x.id===id);
    const blob = new Blob([JSON.stringify(f,null,2)],{type:'application/json'}); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download = `${f.matiere}-${f.chapitre}.json`; a.click(); URL.revokeObjectURL(url);
  });
  Array.from(el.querySelectorAll('.btn-delete')).forEach(b=>b.onclick = ()=> { if(confirm('Supprimer ?')){ deleteFiche(b.dataset.id); }});
  Array.from(el.querySelectorAll('.btn-quiz')).forEach(b=>b.onclick = ()=> { createQuizFrom(b.dataset.id); show('quiz'); });
}

// Clear all
document.getElementById('clear-all').onclick = ()=> { if(confirm('Tout supprimer ?')){ localStorage.removeItem(saveKey); renderSaved(); } };
document.getElementById('export-all').onclick = ()=> {
  const arr = loadAll(); const blob = new Blob([JSON.stringify(arr,null,2)],{type:'application/json'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='boostrevise_all.json'; a.click(); URL.revokeObjectURL(url);
};

// Quiz generation (very simple)
function createQuizFrom(id){
  const f = loadAll().find(x=>x.id===id);
  if(!f) { document.getElementById('quiz-area').innerHTML = 'Fiche introuvable.'; return; }
  const questions = [
    {q:`Quel est le thème de la fiche ?`, a:f.matiere},
    {q:`Donne un point clé du chapitre ${f.chapitre}.`, a:'(réponse libre)'},
    {q:`Cite une méthode ou formule importante.`, a:'(réponse libre)'}
  ];
  const html = questions.map((it,i)=>`<div style="margin-bottom:10px"><strong>Q${i+1}</strong> ${it.q}<br/><input id="q${i}" style="width:80%"/></div>`).join('') + '<button id="check-quiz">Terminer</button>';
  document.getElementById('quiz-area').innerHTML = html;
  document.getElementById('check-quiz').onclick = ()=> alert('Quiz terminé — corrigé manuel pour ce prototype.');
}

// Initial render
renderSaved();
show('home');
