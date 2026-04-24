/* Host4Me — Dashboard interactivity */

// View switching
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-view]');
  if (!trigger) return;
  // Only if it's a link/item with data-view set to a known view
  const view = trigger.getAttribute('data-view');
  if (!view) return;
  e.preventDefault();
  showView(view);
});

function showView(view) {
  document.body.setAttribute('data-view', view);
  document.querySelectorAll('.view').forEach(v => v.hidden = true);
  const target = document.querySelector('.view-' + view);
  if (target) target.hidden = false;

  // active state on sidebar
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  const sidebarItem = document.querySelector('.sb-item[data-view="' + view + '"]');
  if (sidebarItem) sidebarItem.classList.add('active');

  // topbar title
  const titles = {
    brief: ['Morning brief', 'Tuesday, March 11 · 07:14'],
    inbox: ['Inbox', '24 threads · 2 waiting'],
    approvals: ['Approvals queue', '2 drafts waiting for your tap'],
    properties: ['Properties', '6 units · 4 occupied'],
    calendar: ['Calendar', 'Mar 11 – Mar 31'],
    automations: ['Automations', '12 rules active'],
    insights: ['Insights', 'Last 30 days'],
    settings: ['Settings', 'Account · Connections · Team']
  };
  const t = titles[view] || ['Host4Me', ''];
  document.getElementById('tbTitle').textContent = t[0];
  document.getElementById('tbSub').textContent = t[1];

  // persist
  try { localStorage.setItem('h4m_view', view); } catch(e) {}

  window.scrollTo(0, 0);
}

// ============ INBOX ============
const THREADS = [
  {id:'t1', name:'Jamal Reyes', unit:'Unit 4 · Loft', platform:'airbnb', time:'2m', status:'draft',
   preview:'"Hi — the heating isn\'t coming on. Is there a trick, or should I call someone?"',
   messages:[
     {who:'guest', text:'Hey! Just arrived, the place looks great. Quick q — the heating isn\'t coming on?', t:'03:20', av:'JR'},
     {who:'guest', text:'Is there a trick, or should I call someone?', t:'03:22', av:'JR'},
     {who:'agent', text:'Flagged this for Priya — maintenance keyword + late hour. Draft prepared below.', t:'03:22', av:'H4'}
   ],
   draft:'Hi Jamal — sorry about that! The thermostat is behind the kitchen door — give it a firm press and hold MODE until you see "HEAT". If it still won\'t fire, I\'ll send Luis over within the hour. Let me know!'
  },
  {id:'t2', name:'Sarah Kim', unit:'Unit 7 · Studio', platform:'vrbo', time:'47m', status:'draft',
   preview:'"The wifi was down most of yesterday. Could you refund a night? I work remotely."',
   messages:[
     {who:'guest', text:'Hi — just wanted to flag that the wifi was down most of yesterday afternoon.', t:'06:10', av:'SK'},
     {who:'guest', text:'Could you refund a night? I work remotely and lost a few hours.', t:'06:18', av:'SK'},
     {who:'agent', text:'Money mentioned. Drafted a 20% goodwill offer for Priya to review.', t:'06:19', av:'H4'}
   ],
   draft:'Hi Sarah — totally fair, that shouldn\'t have happened. Comcast shows an outage 2–6pm yesterday. I\'d like to offer a 20% refund for last night (~$48) as a goodwill. Would that work, or would you prefer a free night on a future stay?'
  },
  {id:'t3', name:'Miguel Torres', unit:'Unit 7 · Studio', platform:'vrbo', time:'2h', status:'auto',
   preview:'"Are there extra towels in the closet?" → Auto-sent.',
   messages:[
     {who:'guest', text:'Hey, are there extra towels somewhere?', t:'04:05', av:'MT'},
     {who:'me', text:'Yes — top shelf of the hallway closet, plus beach towels in the laundry room. Enjoy!', t:'04:05', av:'PM', meta:'AUTO · Priya\'s voice · 1.4s'}
   ]
  },
  {id:'t4', name:'Alicia Ng', unit:'Unit 2 · Cottage', platform:'airbnb', time:'4h', status:'auto',
   preview:'"Late check-in — can I get the door code?" → Auto-sent with entry video.',
   messages:[
     {who:'guest', text:'Hi! Getting in around midnight — can I get the door code?', t:'23:40', av:'AN'},
     {who:'me', text:'Welcome Alicia! Door code is 4815. Here\'s a 30-sec video showing the entry: [link]. Lights turn on automatically.', t:'23:40', av:'PM', meta:'AUTO · 1.9s'}
   ]
  },
  {id:'t5', name:'Reyes family', unit:'Unit 11 · House', platform:'booking', time:'6h', status:'auto',
   preview:'"Parking directions?" → Auto-sent with map.',
   messages:[
     {who:'guest', text:'Hola! Parking directions please?', t:'00:12', av:'RF'},
     {who:'me', text:'Hi! Pull into the driveway on the right side of the house (there\'s a blue mailbox). Street parking is also free overnight. Map here: [link]', t:'00:12', av:'PM', meta:'AUTO · 2.3s'}
   ]
  },
  {id:'t6', name:'Tom Baker', unit:'Unit 4 · Loft', platform:'airbnb', time:'8h', status:'auto',
   preview:'"Wifi password please" → Auto-sent.'
  },
  {id:'t7', name:'Jessie Park', unit:'Unit 11 · House', platform:'booking', time:'12h', status:'auto',
   preview:'"Check-out time?" → Auto-sent, offered 1pm option.'
  },
  {id:'t8', name:'David L.', unit:'Unit 9 · Apt', platform:'airbnb', time:'1d', status:'closed',
   preview:'Stayed 4 nights · Left 5★ review · No issues.'
  },
  {id:'t9', name:'Hannah W.', unit:'Unit 2 · Cottage', platform:'vrbo', time:'1d', status:'closed',
   preview:'Resolved · key left in lockbox as requested.'
  }
];

function initialsOf(name) {
  return name.split(' ').filter(Boolean).slice(0,2).map(p => p[0].toUpperCase()).join('');
}

function renderThreads(filter) {
  const threads = filter === 'all' ? THREADS : THREADS.filter(t => t.status === filter);
  const list = document.getElementById('ibThreads');
  list.innerHTML = threads.map(t => `
    <div class="ib-thread" data-id="${t.id}">
      <div class="ib-thread-head">
        <span class="plat plat-${t.platform}">${t.platform[0].toUpperCase()}</span>
        <span class="ib-thread-name">${t.name}</span>
        <span class="ib-thread-time">${t.time}</span>
      </div>
      <div class="ib-thread-preview">${t.preview}</div>
      <div class="ib-thread-meta">
        <span class="ib-thread-unit">${t.unit}</span>
        <span class="ib-status ${t.status}">${t.status.toUpperCase()}</span>
      </div>
    </div>
  `).join('');
  // select first
  if (threads.length) selectThread(threads[0].id);
}

function selectThread(id) {
  document.querySelectorAll('.ib-thread').forEach(t => t.classList.toggle('active', t.dataset.id === id));
  const t = THREADS.find(x => x.id === id);
  if (!t) return;
  const detail = document.getElementById('ibDetail');
  const msgs = t.messages || [{who:'guest', text:t.preview.replace(/^"|"$/g,''), t:t.time, av:initialsOf(t.name)}];
  detail.innerHTML = `
    <div class="ib-detail-head">
      <div class="ib-dh-left">
        <div class="ib-dh-av">${initialsOf(t.name)}</div>
        <div>
          <div class="ib-dh-name">${t.name}</div>
          <div class="ib-dh-sub">
            <span class="plat plat-${t.platform}">${t.platform[0].toUpperCase()}</span>
            ${t.unit} · ${t.time} ago · <span class="ib-status ${t.status}">${t.status.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <div class="ib-dh-right">
        <button class="btn-ghost">Guest profile</button>
        <button class="btn-ghost">Mute unit</button>
      </div>
    </div>
    <div class="ib-conversation">
      <div class="msg-sep">Today · ${msgs[0]?.t || ''}</div>
      ${msgs.map(m => `
        <div class="msg ${m.who}">
          <div class="msg-av">${m.av}</div>
          <div>
            <div class="msg-bubble">${m.text}</div>
            <div class="msg-meta">${m.t}${m.meta ? ' · ' + m.meta : ''}</div>
          </div>
        </div>
      `).join('')}
    </div>
    ${t.draft ? `
      <div class="ib-composer">
        <div class="ib-composer-label">Draft · waiting for your tap</div>
        <div class="ib-composer-box">
          <div class="ib-composer-text">${t.draft}</div>
          <div class="ib-composer-actions">
            <button class="btn-solid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg>Approve &amp; send</button>
            <button class="btn-ghost">Edit</button>
            <button class="btn-ghost">Regenerate</button>
            <div class="spacer"></div>
            <span class="hint">⏎ to approve</span>
          </div>
        </div>
      </div>
    ` : `
      <div class="ib-composer">
        <div class="ib-composer-label" style="color:var(--fg-mute);">Reply</div>
        <div class="ib-composer-box" style="border-color:var(--line-2);">
          <div class="ib-composer-text" style="color:var(--fg-mute);">Type a message, or let the agent keep handling this thread automatically…</div>
          <div class="ib-composer-actions">
            <button class="btn-ghost">Take over</button>
            <div class="spacer"></div>
            <span class="hint">Agent will auto-reply to future messages like this</span>
          </div>
        </div>
      </div>
    `}
  `;
}

document.addEventListener('click', (e) => {
  const thread = e.target.closest('.ib-thread');
  if (thread) selectThread(thread.dataset.id);
  const tab = e.target.closest('.ib-tab');
  if (tab) {
    document.querySelectorAll('.ib-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderThreads(tab.dataset.filter);
  }
});

// Boot
(function boot() {
  renderThreads('all');
  let view = 'brief';
  try { view = localStorage.getItem('h4m_view') || 'brief'; } catch(e) {}
  showView(view);
})();
