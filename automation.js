/* Course File Creator automation layer
   Builds editable drafts from uploaded syllabus text and an imported EduPage/aSc timetable.
   Suggestions are drafts; actual attendance, marks and evidence are never invented. */
(function () {
  'use strict';
  const TIMETABLE_KEY = 'cfc_edupage_timetable_v1';
  const TEMPLATE_KEY = 'cfc_master_template_status_v1';

  const styles = `
    .auto-panel{background:#fff;border:1px solid #dbe5ef;border-radius:12px;padding:16px;margin:0 0 15px;box-shadow:0 2px 8px #142b4908}
    .auto-panel h3{margin:0 0 8px;color:#173653}.auto-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .auto-status{font-size:12px;color:#52647a;margin-top:8px}.auto-status.good{color:#08766f}.auto-status.warn{color:#9a6700}
    .auto-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}.auto-table th,.auto-table td{border:1px solid #e1e7ef;padding:7px;text-align:left;vertical-align:top}
    .auto-table th{background:#f2f6fa}.auto-chip{display:inline-block;background:#edf5ff;color:#245b91;border-radius:20px;padding:3px 8px;font-size:11px;font-weight:700}
    @media(max-width:650px){.auto-grid{grid-template-columns:1fr}}
  `;
  const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style);

  const $ = (id) => document.getElementById(id);
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const escHtml = (s) => String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function addTimetablePanel() {
    const dashboard = $('dashboard');
    if (!dashboard || $('autoTimetablePanel')) return;
    const notice = dashboard.querySelector('.notice');
    const panel = document.createElement('div');
    panel.id = 'autoTimetablePanel';
    panel.className = 'auto-panel';
    panel.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><h3>EduPage / aSc Timetable Import</h3>
        <div class="muted">Admin/faculty can import an XLS, XLSX, CSV or HTML timetable export once in this browser. The portal will match timetable entries to course files.</div></div>
        <span class="auto-chip" id="autoTimetableCount">No timetable imported</span>
      </div>
      <div class="row" style="margin-top:12px">
        <input id="autoTimetableFile" type="file" accept=".xls,.xlsx,.csv,.html,.htm" style="max-width:420px">
        <button type="button" id="autoImportTimetable">Import timetable</button>
        <button type="button" class="alt" id="autoClearTimetable">Clear imported timetable</button>
      </div>
      <div id="autoTimetableStatus" class="auto-status">Import an EduPage/aSc export. A timetable screenshot is useful for reference, but a spreadsheet/HTML export is needed for reliable automatic date and period extraction.</div>
      <div id="autoTimetablePreview"></div>`;
    if (notice) notice.insertAdjacentElement('afterend', panel); else dashboard.insertBefore(panel, dashboard.firstChild);
    $('autoImportTimetable').addEventListener('click', importTimetable);
    $('autoClearTimetable').addEventListener('click', () => {
      localStorage.removeItem(TIMETABLE_KEY); updateTimetableStatus();
      $('autoTimetablePreview').innerHTML = '';
      setStatus('Imported timetable cleared from this browser.', 'warn');
    });
    updateTimetableStatus();
  }

  function setStatus(message, kind) {
    const el = $('autoTimetableStatus');
    if (el) { el.textContent = message; el.className = 'auto-status ' + (kind || ''); }
  }

  function updateTimetableStatus() {
    const data = JSON.parse(localStorage.getItem(TIMETABLE_KEY) || 'null');
    const chip = $('autoTimetableCount');
    if (chip) chip.textContent = data && data.entries && data.entries.length ? data.entries.length + ' timetable entries imported' : 'No timetable imported';
  }

  function loadSheetJs() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = resolve; s.onerror = () => reject(new Error('Spreadsheet reader could not load. Check internet connection and retry.'));
      document.head.appendChild(s);
    });
  }

  function extractEntries(rows, sourceName) {
    const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const entries = [];
    if (!rows.length) return entries;
    const headerAt = rows.findIndex(r => {
      const s = norm((r || []).join(' '));
      return /day|weekday|subject|course|teacher|faculty|classroom|room|time|period/.test(s);
    });
    if (headerAt >= 0) {
      const headers = (rows[headerAt] || []).map(norm);
      const find = (...terms) => headers.findIndex(h => terms.some(t => h === t || h.includes(t)));
      const ix = {
        day: find('day','weekday'), subject: find('subject','course name','lesson'),
        code: find('course code','subject code'), teacher: find('teacher','faculty'),
        batch: find('class','group','student group','form'), room: find('room','classroom'),
        time: find('time','period','lesson time'), date: find('date')
      };
      rows.slice(headerAt + 1).forEach(r => {
        const vals = r || [];
        const value = k => ix[k] >= 0 ? String(vals[ix[k]] || '').trim() : '';
        const day = value('day');
        const subject = value('subject');
        if (subject || day) {
          entries.push({day, subject, code:value('code'), teacher:value('teacher'), batch:value('batch'), room:value('room'), time:value('time'), date:value('date'), raw:vals.map(x=>String(x||'')).filter(Boolean).join(' | ')});
        }
      });
    }
    // aSc grid exports often have weekdays down the first column and periods across columns.
    if (!entries.some(e => e.subject || e.raw)) {
      let periodRow = -1;
      for (let i=0;i<Math.min(rows.length,15);i++) {
        if ((rows[i]||[]).some(v => /\d{1,2}:\d{2}/.test(String(v)))) { periodRow=i; break; }
      }
      if (periodRow >= 0) {
        for (let i=periodRow+1;i<rows.length;i++) {
          const row=rows[i]||[], day=String(row[0]||'').trim();
          if (!days.some(d=>norm(day).startsWith(d.slice(0,2)) || norm(day).startsWith(d))) continue;
          for (let j=1;j<row.length;j++) {
            const cell=String(row[j]||'').trim();
            if (cell) entries.push({day,subject:cell, time:String((rows[periodRow]||[])[j]||''), raw:day+' | '+String((rows[periodRow]||[])[j]||'')+' | '+cell});
          }
        }
      }
    }
    return entries.filter(e => e.raw || e.subject).map(e => ({...e, source:sourceName}));
  }

  async function importTimetable() {
    const file = $('autoTimetableFile') && $('autoTimetableFile').files[0];
    if (!file) { setStatus('Please choose an EduPage/aSc export file first.', 'warn'); return; }
    try {
      setStatus('Reading timetable export...');
      let rows = [];
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'csv') {
        const text = await file.text();
        rows = text.split(/\r?\n/).filter(Boolean).map(line => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v=>v.replace(/^"|"$/g,'').replace(/""/g,'"')));
      } else if (ext === 'html' || ext === 'htm') {
        const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
        rows = [...doc.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('th,td')].map(td=>td.innerText.trim())).filter(r=>r.length);
      } else {
        await loadSheetJs();
        const wb = XLSX.read(await file.arrayBuffer(), {type:'array', cellDates:true});
        wb.SheetNames.forEach(name => {
          const sheet = XLSX.utils.sheet_to_json(wb.Sheets[name], {header:1, defval:''});
          if (sheet.length) rows.push(...sheet);
        });
      }
      const entries = extractEntries(rows, file.name);
      if (!entries.length) throw new Error('No timetable rows could be recognized. This export may use a different aSc layout; please share the XLSX/HTML sample so its exact structure can be mapped.');
      const data = {name:file.name, importedAt:new Date().toISOString(), entries};
      localStorage.setItem(TIMETABLE_KEY, JSON.stringify(data));
      updateTimetableStatus();
      setStatus('Imported ' + entries.length + ' timetable entries. Open a course and use “Generate / Refresh Draft” to match its schedule.', 'good');
      $('autoTimetablePreview').innerHTML = '<table class="auto-table"><thead><tr><th>Day / Date</th><th>Subject</th><th>Batch</th><th>Time / Period</th><th>Room</th></tr></thead><tbody>' +
        entries.slice(0,12).map(e=>'<tr><td>'+escHtml(e.date||e.day)+'</td><td>'+escHtml(e.subject||e.raw)+'</td><td>'+escHtml(e.batch||'—')+'</td><td>'+escHtml(e.time||'—')+'</td><td>'+escHtml(e.room||'—')+'</td></tr>').join('') +
        '</tbody></table><div class="muted">Showing up to 12 entries. Imported source: '+escHtml(file.name)+'. Please verify the preview before using it.</div>';
    } catch (err) { setStatus('Import failed: ' + err.message, 'warn'); }
  }

  function detectTopicLines(syllabus) {
    let raw=String(syllabus||'').replace(/\r/g,'\n');
    // Recover unit boundaries even when PDF extraction has flattened paragraphs.
    raw=raw.replace(/\s+(?=(?:UNIT|MODULE|SECTION)\s+(?:[A-D]|[IVX]+|\d+)\b)/gi,'\n');
    const lines=raw.split(/\n+/).map(x=>x.replace(/[•▪●]/g,' ').trim()).filter(Boolean);
    const topics=[]; let currentUnit=''; let active=false;
    const stop=/^(course objectives?|course outcomes?|text ?books?|reference books?|references|evaluation scheme|assessment|prerequisites|syllabus|contents|learning outcomes?)\b/i;
    const unit=/^(unit|module|section)\s*([a-d]|[ivx]+|\d+)\s*[:.\-–]?\s*(.*)$/i;
    const add=(value)=>{
      let v=value.replace(/^[-*•\d]+[.)\s-]*/,'').replace(/\s+/g,' ').trim();
      v=v.replace(/^(topics? covered|contents?)\s*[:\-]?\s*/i,'').trim();
      if(v.length<5||v.length>220||stop.test(v)) return;
      if(/^(lecture|page|course code|semester|manav rachna|unit wise)/i.test(v)) return;
      if(!topics.some(t=>norm(t.topic)===norm(v))) topics.push({unit:currentUnit||'Unit to verify',topic:v});
    };
    for(const line0 of lines){
      const line=line0.replace(/\s+/g,' ').trim();
      const m=line.match(unit);
      if(m){currentUnit=line;active=true;if(m[3]) m[3].split(/;|\u2022/).forEach(add);continue;}
      if(stop.test(line)){active=false;continue;}
      if(!active && !/^\d+(?:\.\d+)*[.)]?\s+/.test(line) && !/^[-•]/.test(line)) continue;
      if(line.length>260){
        const pieces=line.split(/;|\u2022|(?<=\.)\s+(?=[A-Z][a-z])/);
        pieces.forEach(add);
      } else if(/^\d+(?:\.\d+)*[.)]?\s+/.test(line)||/^[-•]/.test(line)||active){
        add(line);
      }
    }
    // Last-resort extraction: numbered topic headings across syllabus formats.
    if(!topics.length){
      const matches=raw.match(/\b\d+(?:\.\d+){1,3}\s+[A-Z][^\n;]{4,150}/g)||[];
      matches.forEach(x=>add(x));
    }
    return topics.slice(0,100);
  }

  const profiles = [
    {match:/java|programming|object oriented|oops|software|coding/, pedagogy:['Live coding and think-aloud demonstration','Problem-based learning with code tracing','Pair programming and peer code review'], ict:['JDK with IntelliJ IDEA / Eclipse / VS Code','OnlineGDB or Java Tutor','GitHub Classroom / LMS']},
    {match:/database|dbms|sql|data management/, pedagogy:['Case-based schema design','Hands-on SQL query workshop','Collaborative ER modelling'], ict:['MySQL / PostgreSQL','DB Fiddle / SQL Fiddle','Draw.io for ER diagrams']},
    {match:/artificial intelligence|machine learning|deep learning|data science|aiml/, pedagogy:['Case-based model selection','Notebook-based guided experiment','Jigsaw discussion of real-world applications'], ict:['Jupyter Notebook / Google Colab','Python with scikit-learn','Kaggle datasets']},
    {match:/network|computer communication|socket|internet/, pedagogy:['Packet-flow demonstration','Network troubleshooting scenario','Simulation-based learning'], ict:['Cisco Packet Tracer','Wireshark (demonstration)','Socket programming IDE']},
    {match:/mathemat|statistics|probability|calculus|algebra/, pedagogy:['Worked-example discussion','Problem-solving in small groups','Visualisation-led concept exploration'], ict:['GeoGebra','Wolfram Alpha (verification)','Spreadsheet for data exploration']},
    {match:/web|html|css|javascript|servlet|cloud/, pedagogy:['Build-and-demonstrate activity','Project-based learning','Peer review of interface/code'], ict:['Browser developer tools','VS Code','GitHub Pages / StackBlitz']}
  ];
  function profileFor(courseName, syllabus) {
    const text = norm(courseName + ' ' + syllabus);
    return profiles.find(p=>p.match.test(text)) || {pedagogy:['Interactive lecture with questioning','Case-based discussion','Collaborative problem-solving'],ict:['LCD projector / presentation system','LMS / digital course material','Relevant subject-specific simulation or software']};
  }
  function bloom(topic) {
    const t=norm(topic);
    if (/design|develop|construct|implement|create|build/.test(t)) return 'BT6';
    if (/analy[sz]|compare|differentiate|debug|examine|investigate/.test(t)) return 'BT4';
    if (/apply|program|solve|execute|demonstrate|use /.test(t)) return 'BT3';
    if (/explain|describe|discuss|classify|illustrate/.test(t)) return 'BT2';
    return 'BT2 (verify)';
  }
  function suggestCO(topic, coText) {
    const found = String(coText||'').match(/(?:CO\s*\d+|\d+\.\d+O?\d*\.\d+)/ig);
    return found && found.length ? found[0] : 'Faculty to map';
  }

  function matchedTimetable(course) {
    const data=JSON.parse(localStorage.getItem(TIMETABLE_KEY)||'null');
    if (!data || !data.entries) return [];
    const keys=[norm(course.name),norm(course.code)].filter(x=>x.length>2);
    const batch=norm(course.semester);
    return data.entries.filter(e=>{
      const hay=norm([e.subject,e.code,e.batch,e.raw].join(' '));
      const courseMatch=keys.some(k=>hay.includes(k)||k.includes(hay));
      const batchMatch=!batch || !e.batch || hay.includes(batch) || batch.split(' ').some(w=>w.length>2&&hay.includes(w));
      return courseMatch && batchMatch;
    });
  }

  function addGeneratorPanel() {
    const editor=$('editor');
    if (!editor || $('autoGeneratorPanel')) return;
    const heading=editor.querySelector('.heading');
    const panel=document.createElement('div');
    panel.id='autoGeneratorPanel'; panel.className='auto-panel';
    panel.innerHTML=`
      <div class="row" style="justify-content:space-between"><div><h3>Automatic Course File Draft</h3>
      <div class="muted">Generate an editable topic-wise lesson plan, pedagogy, ICT and AI-integration suggestions from the syllabus. Imported timetable entries are matched where possible.</div></div><span class="auto-chip">Faculty review required</span></div>
      <div class="row" style="margin-top:12px"><button type="button" id="autoGenerateDraft">Generate / Refresh Draft</button><span class="muted" id="autoGenerateStatus">Upload or extract the syllabus first, then generate the draft.</span></div>`;
    if (heading) heading.insertAdjacentElement('afterend',panel); else editor.insertBefore(panel,editor.firstChild);
    $('autoGenerateDraft').addEventListener('click', generateDraft);
  }

  function generateDraft() {
    const syllabus=$('d_syllabus') ? $('d_syllabus').value : '';
    const courseName=$('p_name') ? $('p_name').value : '';
    if (syllabus.trim().length<40) { $('autoGenerateStatus').textContent='Upload/extract a readable syllabus first. The system needs syllabus topics to generate topic-wise entries.'; return; }
    const topics=detectTopicLines(syllabus);
    if (!topics.length) { $('autoGenerateStatus').textContent='Syllabus text was found, but unit/topic headings could not be identified. Check that the syllabus includes unit-wise topics, then retry.'; return; }
    const p=profileFor(courseName,syllabus);
    const coText=$('d_cos') ? $('d_cos').value : '';
    const schedule=matchedTimetable({name:courseName,code:$('p_code')?.value||'',semester:$('p_semester')?.value||''});
    const rows=topics.map((t,i)=>{
      const method=p.pedagogy[i%p.pedagogy.length];
      const ict=p.ict[i%p.ict.length];
      const aiIdea=/program|code|algorithm|data|model|database|network|design|analysis/i.test(t.topic)
        ? 'AI-assisted example generation followed by faculty/student validation'
        : 'AI-assisted concept explanation or quiz draft, followed by verification';
      return {no:i+1,unit:t.unit,topic:t.topic,co:suggestCO(t.topic,coText),bloom:bloom(t.topic),pedagogy:method,ict,ai:aiIdea};
    });
    const table=['DRAFT — VERIFY BEFORE TEACHING / APPROVAL','Lecture | Unit | Topic | CO (verify) | Bloom level (verify) | Innovative pedagogy (suggested) | ICT tools (suggested) | AI integration (suggested)',
      ...rows.map(r=>[r.no,r.unit,r.topic,r.co,r.bloom,r.pedagogy,r.ict,r.ai].join(' | '))].join('\n');
    const lp=$('d_lessonPlan'); if(lp) lp.value=table;
    const pedagogy=$('d_pedagogy'); if(pedagogy) pedagogy.value='SUGGESTED PEDAGOGIES — verify which activities were actually conducted\n'+rows.map(r=>r.topic+' → '+r.pedagogy).join('\n');
    const ictBox=$('d_ict'); if(ictBox) ictBox.value='SUGGESTED ICT TOOLS — verify which tools were actually used\n'+rows.map(r=>r.topic+' → '+r.ict).join('\n');
    const ai=$('d_ai'); if(ai) ai.value='SUGGESTED AI INTEGRATION — record only activities actually conducted\n'+rows.map(r=>r.topic+' → '+r.ai).join('\n');
    const timetable=$('d_timetable');
    if(timetable && schedule.length) timetable.value='IMPORTED TIMETABLE MATCHES — VERIFY DATE, BATCH AND PERIOD\n'+schedule.map(e=>[e.date||e.day,e.time,e.subject,e.batch,e.room].filter(Boolean).join(' | ')).join('\n');
    const panel=$('autoGeneratorPanel');
    let preview=$('autoGeneratedPreview');
    if(!preview && panel){preview=document.createElement('div');preview.id='autoGeneratedPreview';panel.appendChild(preview);}
    if(preview) preview.innerHTML='<div class="auto-status good">Generated '+rows.length+' topic-wise suggestions. These are editable drafts, not evidence of activities actually conducted.</div><div style="overflow-x:auto"><table class="auto-table"><thead><tr><th>Topic</th><th>Pedagogy suggestion</th><th>ICT tools suggestion</th><th>AI integration suggestion</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+escHtml(r.topic)+'</td><td>'+escHtml(r.pedagogy)+'</td><td>'+escHtml(r.ict)+'</td><td>'+escHtml(r.ai)+'</td></tr>').join('')+'</tbody></table></div>';
    const status=$('autoGenerateStatus');
    if(status) status.textContent='Generated '+rows.length+' topic-wise entries for '+courseName+'. Lesson Plan, Pedagogy, ICT and AI fields are now populated. Open the relevant tabs to review and edit.';
  }

  function init() {
    addTimetablePanel(); addGeneratorPanel();
    // Existing editor is rebuilt when a course is opened; keep generator controls visible after rebuilds.
    const editor=$('editor');
    if (editor && window.MutationObserver) new MutationObserver(()=>{ if ($('editor').classList.contains('active')) addGeneratorPanel(); }).observe(editor,{childList:true,subtree:true});
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();