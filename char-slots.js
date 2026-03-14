/* ═══════════════════════════════════════════════════════════════
   CHAR-SLOTS.JS  v3 — Clean Architecture

   Core principle:
   • S always holds the ACTIVE character's per-char keys
   • charSlots[] is the persistent store — saved on every rebuild
   • buildPosText reads from charSlots[], never from S directly
   • buildPosGroups patched to show combined multi-char chips
   • csSwitchTo: save S→old slot, load new slot→S, repaint UI only
     NO rebuild() call — the prompt does NOT change on tab switch
═══════════════════════════════════════════════════════════════ */

var CHAR_KEYS = [
  '_name','_age',
  'age','skin','body',
  'hairColor1','hairstyle',
  'eyeColor','eyeShape',
  'clothing','clothingColor',
  'clothingTop','clothingTopColor',
  'clothingBottom','clothingBottomColor',
  'clothingAcc','clothingAccColor','clothingCondition','bodyParts',
  'sockColor','sockLength','shoes','shoeColor','faceAcc','faceAccColor',
  'nsfwTop','nsfwTopColor','nsfwBottom','nsfwBottomColor',
  'nsfwClothing','nsfwClothingColor',
  'expression','poses','effects','liquids',
  'weapons','props','electronics','otherItems',
  'nsfwBody','nsfwPose','nsfwFluid','nsfwIndicator'
];

var GENDER_TAG = { female:'1girl', male:'1boy' };
var CS_GCOLOR  = { female:'#f472b6', male:'#60a5fa' };
var CS_GICON   = { female:'👩', male:'👨' };

var charSlots  = [null, null];
var activeChar = 0;

/* Array keys in CHAR_KEYS — everything else is null (scalar) */
var CHAR_ARRAY_KEYS = {
  clothingAcc:1, clothingCondition:1, bodyParts:1, faceAcc:1,
  poses:1, effects:1, liquids:1,
  weapons:1, props:1, electronics:1, otherItems:1,
  nsfwBody:1, nsfwClothing:1, nsfwPose:1, nsfwFluid:1, nsfwIndicator:1
};

function csEmptySlot(){
  var o = {};
  CHAR_KEYS.forEach(function(k){ o[k] = CHAR_ARRAY_KEYS[k] ? [] : null; });
  return o;
}

function csSave(idx){
  if(!charSlots[idx]) charSlots[idx] = csEmptySlot();
  CHAR_KEYS.forEach(function(k){
    var v = S[k];
    charSlots[idx][k] = Array.isArray(v) ? v.slice() : v;
  });
}

function csLoad(idx){
  var slot = charSlots[idx];
  CHAR_KEYS.forEach(function(k){
    S[k] = slot
      ? (Array.isArray(slot[k]) ? slot[k].slice() : slot[k])
      : (CHAR_ARRAY_KEYS[k] ? [] : null);
  });
}

/* Switch active editing slot — UI only, prompt unchanged */
function csSwitchTo(idx){
  if(idx === activeChar) return;
  csSave(activeChar);
  activeChar = idx;
  csLoad(idx);
  csReflectButtons();
  csRenderTabs();
  if(typeof refreshGenderGrids==='function') refreshGenderGrids();
  csUpdateSaveBar(0); csUpdateSaveBar(1);
  /* intentionally NO rebuild() — switching edit target never changes prompt */
  if(typeof renderCharCards==='function') renderCharCards();
}

function csReflectButtons(){
  var singles = {
    ageGrid:'age', bodyGrid:'body',
    hairstyleGrid:'hairstyle',
    eyeShapeGrid:'eyeShape',
    clothingGrid:'clothing',
    clothingTopGrid:'clothingTop', clothingBottomGrid:'clothingBottom',
    nsfwTopGrid:'nsfwTop', nsfwBottomGrid:'nsfwBottom',
    sockLengthGrid:'sockLength', shoesGrid:'shoes', expressionGrid:'expression'
  };
  /* skin grid uses .sb buttons — reflect separately */
  (function(){
    var sv = S.skin;
    var sg = document.getElementById('skinGrid');
    if(sg) sg.querySelectorAll('.sb').forEach(function(btn){
      var matches = btn.getAttribute('data-val') === sv;
      btn.classList.toggle('on', matches);
      btn.style.borderColor = matches ? 'white' : (SKINS[Array.from(sg.querySelectorAll('.sb')).indexOf(btn)]||{bg:'transparent'}).bg;
    });
    /* hair color bar: show on selected hairstyle button only, clear others */
    var hg=document.getElementById('hairstyleGrid');
    if(hg) hg.querySelectorAll('.ob').forEach(function(btn){
      var bar=btn.querySelector('.hcp-bar');
      if(!bar) return;
      if(btn.classList.contains('on')){
        if(typeof _hcpUpdateBar==='function') _hcpUpdateBar(btn,'hairColor1');
      } else {
        bar.style.background='transparent';
      }
    });
    /* eye color bar: show on selected eyeShape button only, clear others */
    var eg=document.getElementById('eyeShapeGrid');
    if(eg) eg.querySelectorAll('.ob').forEach(function(btn){
      var bar=btn.querySelector('.hcp-bar');
      if(!bar) return;
      if(btn.classList.contains('on')){
        if(typeof _hcpUpdateBar==='function') _hcpUpdateBar(btn,'eyeColor');
      } else {
        bar.style.background='transparent';
      }
    });
  })();
  Object.keys(singles).forEach(function(gid){
    var k = singles[gid];
    var g = document.getElementById(gid); if(!g) return;
    g.querySelectorAll('.ob').forEach(function(b){
      var v = (b.getAttribute('data-val')||'').toLowerCase();
      b.classList.toggle('on', !!(S[k] && v && v === String(S[k]).toLowerCase()));
    });
  });
  var multis = {
    clothingAccGrid:'clothingAcc', clothingConditionGrid:'clothingCondition',
    faceAccGrid:'faceAcc', poseGrid:'poses', effectsGrid:'effects',
    liquidsGrid:'liquids', nsfwBodyGrid:'nsfwBody', nsfwClothingGrid:'nsfwClothing',
    nsfwPoseGrid:'nsfwPose', nsfwFluidGrid:'nsfwFluid',
    nsfwIndicatorGrid:'nsfwIndicator', bodyPartsGrid:'bodyParts',
    weaponGrid:'weapons', propsGrid:'props',
    electronicsGrid:'electronics', otherItemsGrid:'otherItems'
  };
  Object.keys(multis).forEach(function(gid){
    var k = multis[gid];
    var g = document.getElementById(gid); if(!g) return;
    var vals = (S[k]||[]).map(function(v){ return String(v).toLowerCase(); });
    g.querySelectorAll('.ob').forEach(function(b){
      var v = (b.getAttribute('data-val')||'').toLowerCase();
      b.classList.toggle('on', !!(v && vals.includes(v)));
    });
  });
  /* color dots on clothing/sock/shoe buttons */
  ['clothingColor','clothingTopColor','clothingBottomColor',
   'nsfwTopColor','nsfwBottomColor','nsfwClothingColor','sockColor','shoeColor'
  ].forEach(function(k){ if(window._updateColorDot) _updateColorDot(k); });
}

function csSummary(idx){
  var d = charSlots[idx]; if(!d) return null;
  var parts = [];
  if(d.hairColor1&&d.hairstyle) parts.push(d.hairColor1+' '+d.hairstyle);
  else if(d.hairColor1) parts.push(d.hairColor1+' hair');
  else if(d.hairstyle)  parts.push(d.hairstyle);
  if(d.eyeColor) parts.push(d.eyeColor+' eyes');
  var outfit = d.clothing||(d.clothingTop?d.clothingTop+(d.clothingBottom?' + '+d.clothingBottom:''):null);
  if(outfit) parts.push(outfit);
  if(d.expression) parts.push(d.expression);
  if(d.poses&&d.poses[0]) parts.push(d.poses[0]);
  return parts.length ? parts.map(function(p){return p.charAt(0).toUpperCase()+p.slice(1);}).join(' · ') : null;
}

function csGetCharName(idx){
  var d = charSlots[idx];
  if(d && d._name) return d._name;
  var saved = csPresets[idx];
  return saved ? saved.name : null;
}

/* CS_WRAP_IDS / CS_TAB_IDS removed — sticky-wrap system deleted */

function csRenderTabs(){
  /* Update IDC card badges (EDITING/STANDBY, mini chips, tags) */
  if(typeof renderCharCards==='function') renderCharCards();
}

/* ── Build prompt tokens for one slot ── */
function csBuildCharText(d, gTag){
  var p = [];
  if(gTag) p.push(gTag);
  var ageVal = d._age ? (typeof _ageLabel==='function' ? _ageLabel(d._age) : d._age+' years old') : d.age;
  if(ageVal) p.push(ageVal);
  if(d.body) p.push(d.body);
  if(d.skin) p.push(d.skin);
  if(S.nsfw&&d.nsfwBody&&d.nsfwBody.length) p.push(d.nsfwBody.join(', '));
  if(d.eyeShape&&d.eyeColor) p.push(d.eyeShape+', '+d.eyeColor+' eyes');
  else if(d.eyeShape) p.push(d.eyeShape+' eyes');
  else if(d.eyeColor) p.push(d.eyeColor+' eyes');
  if(d.hairColor1&&d.hairstyle) p.push(d.hairColor1+' '+d.hairstyle+' hair');
  else if(d.hairColor1) p.push(d.hairColor1+' hair');
  else if(d.hairstyle)  p.push(d.hairstyle+' hair');
  var wear = [];
  if(d.clothing) wear.push(d.clothingColor?d.clothingColor+' '+d.clothing:d.clothing);
  else {
    if(d.clothingTop)    wear.push(d.clothingTopColor   ?d.clothingTopColor+' '+d.clothingTop      :d.clothingTop);
    if(d.clothingBottom) wear.push(d.clothingBottomColor?d.clothingBottomColor+' '+d.clothingBottom:d.clothingBottom);
  }
  if(S.nsfw){
    if(d.nsfwTop)    wear.push(d.nsfwTopColor   ?d.nsfwTopColor+' '+d.nsfwTop      :d.nsfwTop);
    if(d.nsfwBottom) wear.push(d.nsfwBottomColor?d.nsfwBottomColor+' '+d.nsfwBottom:d.nsfwBottom);
    var nc=d.nsfwClothing;
    if(nc)(Array.isArray(nc)?nc:[nc]).forEach(function(c){wear.push(d.nsfwClothingColor?d.nsfwClothingColor+' '+c:c);});
  }
  if(wear.length) p.push('wearing '+wear.join(', '));
  if(d.clothingCondition&&d.clothingCondition.length) p.push(d.clothingCondition.map(function(c){return c+' clothes';}).join(', '));
  if(d.clothingAcc&&d.clothingAcc.length) p.push(d.clothingAccColor ? d.clothingAccColor+' '+d.clothingAcc.join(', ') : d.clothingAcc.join(', '));
  if(S.nsfw&&d.bodyParts&&d.bodyParts.length) p.push(d.bodyParts.join(', '));
  if(d.sockColor&&d.sockLength) p.push(d.sockColor+' '+d.sockLength+' socks');
  else if(d.sockLength) p.push(d.sockLength+' socks');
  if(d.shoes) p.push(d.shoeColor?d.shoeColor+' '+d.shoes:d.shoes);
  if(d.faceAcc&&d.faceAcc.length) p.push(d.faceAccColor ? d.faceAccColor+' '+d.faceAcc.join(', ') : d.faceAcc.join(', '));
  if(d.expression) p.push(d.expression+' expression');
  var poses=(d.poses||[]).concat(S.nsfw?(d.nsfwPose||[]):[]);
  if(poses.length) p.push(poses.join(', '));
  if(d.effects&&d.effects.length) p.push(d.effects.join(', '));
  var fluids=(d.liquids||[]).concat(S.nsfw?(d.nsfwFluid||[]):[]);
  if(fluids.length) p.push(fluids.join(', '));
  if(S.nsfw&&d.nsfwIndicator&&d.nsfwIndicator.length) p.push(d.nsfwIndicator.join(', '));
  /* Tools per-character */
  var tools=[].concat(d.weapons||[],d.props||[],d.electronics||[],d.otherItems||[]);
  if(tools.length) p.push('holding '+tools.join(', '));
  return p;
}

function csSharedTail(){
  var p=[];
  /* tools are now per-character — not in shared tail */
  var envs=(S.environment?['in '+S.environment]:[]).concat(S.nsfw?S.nsfwEnv.map(function(e){return 'in '+e;}):[]);
  if(envs.length) p.push(envs.join(', '));
  if(S.era)         p.push(S.era+' style');
  if(S.style)       p.push(S.style);
  if(S.animeStudio) p.push(S.animeStudio);
  if(S.colorGrade)  p.push(S.colorGrade);
  if(S.stroke)      p.push(S.stroke);
  if(S.shadow)      p.push(S.shadow);
  if(S.lights.length) p.push(S.lights.join(', '));
  if(S.glow&&S.glow.toLowerCase()!=='no glow') p.push(S.glow);
  if(S.smooth) p.push(S.smooth);
  if(S.angle) p.push(S.angle);
  if(S.shot)  p.push(S.shot);
  if(S.nsfw&&S.nsfwShot.length) p.push(S.nsfwShot.join(', '));
  if(S.look)  p.push('looking '+S.look);
  if(S.lens)  p.push(S.lens+' lens');
  if(S.lensEffect&&S.lensEffect.toLowerCase()!=='none') p.push(S.lensEffect);
  return p;
}

/* ══ OVERRIDE buildPosText — reads from charSlots[], not S ══ */
var _origBuildPosText = buildPosText;
buildPosText = function(){
  var activeChars = S.characters.map(function(g,i){return {g:g,i:i};}).filter(function(x){return !!x.g;});
  if(!activeChars.length) return _origBuildPosText();

  csSave(activeChar); /* flush live S → active slot */

  var quality = S.quality.length ? S.quality.join(', ') : '';
  var tail    = csSharedTail();

  if(activeChars.length === 1){
    var sc = activeChars[0];
    var slot = charSlots[sc.i] || csEmptySlot();
    var p = [];
    if(quality) p.push(quality);
    csBuildCharText(slot, GENDER_TAG[sc.g]||'1girl').forEach(function(x){p.push(x);});
    tail.forEach(function(x){p.push(x);});
    return p.join(', ').replace(/,\s*$/,'');
  }

  /* Multi-char: quality, countTag, (char1), AND (char2), scene */
  var genders  = activeChars.map(function(x){return x.g;});
  var fCnt     = genders.filter(function(g){return g==='female';}).length;
  var mCnt     = genders.filter(function(g){return g==='male';}).length;
  var countTag = fCnt===2?'2girls':mCnt===2?'2boys':(fCnt>=1&&mCnt>=1)?'1girl, 1boy':'2characters';

  var blocks = activeChars.map(function(item){
    var slot  = charSlots[item.i] || csEmptySlot();
    var parts = csBuildCharText(slot, GENDER_TAG[item.g]||'1girl');
    return parts.length ? '('+parts.join(', ')+')' : '';
  }).filter(Boolean);

  var tailStr = tail.join(', ');
  var head    = [quality, countTag].filter(Boolean).join(', ');
  return [head, blocks.join(', AND '), tailStr].filter(Boolean).join(', ').replace(/,\s*$/,'');
};

/* ══ OVERRIDE buildPosGroups — multi-char chips ══ */
var _origBuildPosGroups = buildPosGroups;
buildPosGroups = function(){
  var activeChars = S.characters.map(function(g,i){return {g:g,i:i};}).filter(function(x){return !!x.g;});
  if(activeChars.length <= 1) return _origBuildPosGroups();

  csSave(activeChar);

  var G=[];
  function add(cls,items){var f=items.filter(Boolean);if(f.length)G.push({cls:cls,items:f});}

  if(S.quality.length) add('q',[S.quality.join(', ')]);

  var genders  = activeChars.map(function(x){return x.g;});
  var fCnt     = genders.filter(function(g){return g==='female';}).length;
  var mCnt     = genders.filter(function(g){return g==='male';}).length;
  var countTag = fCnt===2?'2girls':mCnt===2?'2boys':(fCnt>=1&&mCnt>=1)?'1girl, 1boy':'2characters';
  add('c',[countTag]);

  activeChars.forEach(function(item){
    var slot  = charSlots[item.i] || csEmptySlot();
    var parts = csBuildCharText(slot, GENDER_TAG[item.g]||'1girl');
    if(parts.length) add('c', parts);
  });

  var sc=[];
  var envs=(S.environment?['in '+S.environment]:[]).concat(S.nsfw?S.nsfwEnv.map(function(e){return 'in '+e;}):[]);
  if(envs.length) sc.push(envs.join(', '));
  if(S.era) sc.push(S.era+' style');
  if(S.style) sc.push(S.style);
  if(S.animeStudio) sc.push(S.animeStudio);
  if(S.colorGrade) sc.push(S.colorGrade);
  if(S.stroke) sc.push(S.stroke);
  if(S.shadow) sc.push(S.shadow);
  if(S.lights.length) sc.push(S.lights.join(', '));
  if(S.glow&&S.glow.toLowerCase()!=='no glow') sc.push(S.glow);
  if(S.smooth) sc.push(S.smooth);
  if(sc.length) add('s',sc);

  var cm=[];
  if(S.angle) cm.push(S.angle);
  if(S.shot) cm.push(S.shot);
  if(S.nsfw&&S.nsfwShot.length) S.nsfwShot.forEach(function(x){cm.push(x);});
  if(S.look) cm.push('looking '+S.look);
  if(S.lens) cm.push(S.lens+' lens');
  if(S.lensEffect&&S.lensEffect.toLowerCase()!=='none') cm.push(S.lensEffect);
  if(cm.length) add('cam',cm);

  /* tools per-char — already in char blocks */

  return G;
};

/* ══ HOOK rebuild ══ */
var _origRebuild = rebuild;
rebuild = function(){
  csSave(activeChar);
  csRenderTabs();
  _origRebuild();
};

/* ══ HOOK resetAll ══ */
var _origResetAll = resetAll;
resetAll = function(silent){
  charSlots[0]=null; charSlots[1]=null;
  activeChar=0;
  _origResetAll(silent);
};

/* ══ HOOK randomize ══ */
var _origRandomize = (typeof randomize==='function') ? randomize : null;
if(_origRandomize){
  randomize = function(){
    _origRandomize();
    csSave(0); activeChar=0;

    S.characters.forEach(function(gender,i){
      if(!gender||i===0) return;

      charSlots[i] = csEmptySlot();
      var s0 = charSlots[0] || {};

      /* helpers */
      function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
      function maybe(p){ return Math.random() < p; }
      function pickN(arr,n){ var a=arr.slice().sort(function(){return .5-Math.random();}); return a.slice(0,n); }

      /* ── Appearance ── */
      var oH = HAIR_COLORS.filter(function(h){ return h.id !== s0.hairColor1; });
      var oE = EYE_COLORS.filter(function(e){ return e.id !== s0.eyeColor; });
      charSlots[i].hairColor1 = oH.length ? pick(oH).id : (HAIR_COLORS[0]||{}).id;
      charSlots[i].eyeColor   = oE.length ? pick(oE).id : null;

      /* hairstyle — prefer gender-appropriate */
      var hList = D&&D.hairstyle ? (gender==='male'
        ? (D.hairstyle.male||[]).concat(D.hairstyle.shared||[])
        : (D.hairstyle.female||[]).concat(D.hairstyle.shared||[])
      ) : [];
      if(hList.length) charSlots[i].hairstyle = pick(hList).toLowerCase();

      if(maybe(.25)) charSlots[i].eyeShape = D&&D.eyeShape ? pick(D.eyeShape.lbl).toLowerCase() : null;
      charSlots[i].age  = s0.age || null;
      if(maybe(.65)) charSlots[i].skin = D&&D.skin ? pick(SKINS).val : null;
      if(maybe(.40)) charSlots[i].body = D&&D.body ? pick(D.body.val) : null;

      /* ── Outfit ── */
      var g2 = gender || 'female';
      if(maybe(.60)){
        /* Top + Bottom */
        var tops    = D&&D.clothingTop    ? (D.clothingTop[g2]||[]).concat(D.clothingTop.shared||[])       : [];
        var bottoms = D&&D.clothingBottom ? (D.clothingBottom[g2]||[]).concat(D.clothingBottom.shared||[]) : [];
        if(tops.length    && maybe(.75)) charSlots[i].clothingTop    = pick(tops).toLowerCase();
        if(bottoms.length && maybe(.75)) charSlots[i].clothingBottom = pick(bottoms).toLowerCase();
      } else {
        /* Full outfit */
        var fullList = D&&D.clothing ? (D.clothing[g2]||[]).concat(D.clothing.shared||[]).filter(function(x){ return !x.startsWith('—'); }) : [];
        if(fullList.length) charSlots[i].clothing = pick(fullList).toLowerCase();
      }
      if(maybe(.30)&&D&&D.shoes)      charSlots[i].shoes      = pick(D.shoes.lbl).toLowerCase();
      if(maybe(.30)&&D&&D.sockLength) charSlots[i].sockLength  = pick(D.sockLength.lbl.filter(function(x){return x!=='None';})).toLowerCase();
      if(maybe(.35)&&D&&D.clothingAcc) charSlots[i].clothingAcc = pickN(D.clothingAcc.lbl,Math.ceil(Math.random()*2)).map(function(x){return x.toLowerCase();});

      /* ── Mood ── */
      if(D&&D.expression) charSlots[i].expression = pick(D.expression.lbl).toLowerCase();
      if(D&&D.pose&&maybe(.80)) charSlots[i].poses = [pick(D.pose.lbl).toLowerCase()];
      if(D&&D.effects&&maybe(.30)) charSlots[i].effects = pickN(D.effects.lbl,1).map(function(x){return x.toLowerCase();});

      /* ── Tools ── */
      if(D&&D.weapons&&maybe(.30)) charSlots[i].weapons = [pick(D.weapons.lbl).toLowerCase()];
      if(D&&D.props&&maybe(.25))   charSlots[i].props   = [pick(D.props.lbl).toLowerCase()];
    });

    csRenderTabs();
  };
}

/* ══ PRESET SAVE SYSTEM ══ */
var csPresets = [null, null]; // {name, slot} per character index

function csSavePreset(charIdx){
  csLibSave(charIdx);
}

function csLoadPreset(charIdx){
  if(!csPresets[charIdx]){ csToast('No saved character for slot '+(charIdx+1),'warn'); return; }
  charSlots[charIdx] = JSON.parse(JSON.stringify(csPresets[charIdx].slot));
  if(charIdx===activeChar) csLoad(charIdx);
  csReflectButtons();
  csRenderTabs();
  rebuild();
  csToast('✓ Loaded "'+csPresets[charIdx].name+'"','ok');
}

function csToast(msg, type){
  var t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:.5rem 1.1rem;border-radius:100px;font-size:.78rem;font-weight:700;z-index:9999;pointer-events:none;transition:opacity .4s;'+(type==='ok'?'background:#10b981;color:#fff;':'background:#f59e0b;color:#000;');
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){t.style.opacity='0';setTimeout(function(){t.remove();},400);},2000);
}

function csUpdateSaveBar(charIdx){
  var bar = document.getElementById('csSaveBar'+charIdx);
  if(!bar) return;
  var preset = csPresets[charIdx];
  var nameInput = document.getElementById('csNameInput'+charIdx);
  if(nameInput && preset) nameInput.value = preset.name;
  var loadBtn = bar.querySelector('.cs-load-btn');
  if(loadBtn) loadBtn.style.display = preset ? '' : 'none';
}

function csBuildSaveBar(charIdx){
  var bar = document.createElement('div');
  bar.id = 'csSaveBar'+charIdx;
  bar.className = 'cs-save-bar';
  bar.innerHTML =
    '<div class="cs-save-bar-inner">'+
      '<span class="cs-bar-num">Char '+(charIdx+1)+'</span>'+
      '<input class="cs-name-input" id="csNameInput'+charIdx+'" placeholder="Name this character…" maxlength="32">'+
      '<button class="cs-save-char-btn cs-save-btn" title="Save to library"><i class="fas fa-star"></i></button>'+
      '<button class="cs-lib-char-btn" title="Browse saved characters"><i class="fas fa-address-book"></i></button>'+
    '</div>';
  bar.querySelector('.cs-save-char-btn').addEventListener('click', function(){ csSavePreset(charIdx); });
  bar.querySelector('.cs-lib-char-btn').addEventListener('click', function(){ csOpenLibraryFor(charIdx); });
  return bar;
}

/* ══ CHARACTER LIBRARY ══ */
var csLibrary = JSON.parse(localStorage.getItem('aps_charLib') || '[]');

function csLibSave(charIdx){
  /* Read name: from slot (always synced via mirror/blur), then from card input as fallback */
  var name = '';
  /* 1. Try slot._name (updated on every input event via mirror) */
  if(charIdx === activeChar && S._name) name = S._name.trim();
  if(!name && charSlots[charIdx] && charSlots[charIdx]._name) name = charSlots[charIdx]._name.trim();
  /* 2. Fallback: read directly from IDC card input */
  if(!name){
    var row = document.getElementById('charCardsRow');
    if(row){
      var card = row.querySelector('[data-card-idx="'+charIdx+'"]');
      if(card){ var cin = card.querySelector('.c-name-input'); if(cin) name = cin.value.trim(); }
    }
  }
  if(!name){ csToast('Enter a character name first','warn'); return; }
  var duplicate = csLibrary.find(function(c){ return c.name.toLowerCase()===name.toLowerCase(); });
  if(duplicate){ csToast('Name "'+name+'" already exists in library','warn'); return; }
  if(!charSlots[charIdx]) charSlots[charIdx] = csEmptySlot();
  charSlots[charIdx]._name = name;
  if(charIdx === activeChar) S._name = name;
  csSave(charIdx);
  var entry = {
    id: Date.now(),
    name: name,
    gender: S.characters ? S.characters[charIdx] : null,
    slot: JSON.parse(JSON.stringify(charSlots[charIdx]||csEmptySlot())),
    date: new Date().toLocaleDateString()
  };
  csLibrary.unshift(entry);
  localStorage.setItem('aps_charLib', JSON.stringify(csLibrary));
  csToast('✓ Saved "'+name+'" to library','ok');
  csRenderTabs();
  csRenderLibrary();
}

function csLibLoad(entry, charIdx){
  if(typeof charIdx === 'undefined') charIdx = activeChar;
  charSlots[charIdx] = JSON.parse(JSON.stringify(entry.slot));
  if(entry.gender && S.characters) S.characters[charIdx] = entry.gender;
  if(charIdx === activeChar) csLoad(charIdx);
  csReflectButtons();
  csRenderTabs();
  if(typeof refreshGenderGrids==='function') refreshGenderGrids();
  rebuild();
  csToast('✓ Loaded "'+entry.name+'"','ok');
}

function csLibDelete(id){
  csLibrary = csLibrary.filter(function(c){ return c.id!==id; });
  localStorage.setItem('aps_charLib', JSON.stringify(csLibrary));
  csRenderLibrary();
  csToast('Deleted','ok');
}

function csRenderLibrary(){
  var list = document.getElementById('csLibList'); if(!list) return;
  list.innerHTML = '';
  if(!csLibrary.length){
    list.innerHTML = '<div class="cs-lib-empty"><i class="fas fa-user-slash"></i><span>No saved characters yet</span></div>';
    return;
  }
  csLibrary.forEach(function(entry){
    var gender = entry.gender || 'unset';
    var color  = CS_GCOLOR[gender] || '#a78bfa';
    var icon   = CS_GICON[gender]  || '🧑';
    var summary = '';
    var d = entry.slot || {};
    if(d.hairColor1) summary += d.hairColor1+' ';
    if(d.hairstyle)  summary += d.hairstyle+' hair';
    if(d.eyeColor)   summary += (summary?' · ':'')+d.eyeColor+' eyes';
    var outfit = d.clothing||(d.clothingTop?d.clothingTop+(d.clothingBottom?' + '+d.clothingBottom:''):null);
    if(outfit) summary += (summary?' · ':'')+outfit;

    var item = document.createElement('div');
    item.className = 'cs-lib-item';
    item.style.setProperty('--cs-color', color);
    item.innerHTML =
      '<div class="cs-lib-icon">'+icon+'</div>'+
      '<div class="cs-lib-info">'+
        '<div class="cs-lib-name">'+entry.name+'</div>'+
        '<div class="cs-lib-meta">'+(gender||'?')+' · '+entry.date+'</div>'+
        (summary?'<div class="cs-lib-summary">'+summary+'</div>':'')+
      '</div>'+
      '<div class="cs-lib-actions">'+
        '<button class="cs-lib-load-btn" title="Load to active character"><i class="fas fa-arrow-down"></i> Load</button>'+
        (S.characters&&S.characters[_csLibTargetChar===0?1:0]?'<button class="cs-lib-load2-btn" title="Load to other character"><i class="fas fa-arrow-down"></i> Other</button>':'')+
        '<button class="cs-lib-del-btn" title="Delete"><i class="fas fa-trash"></i></button>'+
      '</div>';
    item.querySelector('.cs-lib-load-btn').addEventListener('click', function(e){ e.stopPropagation(); csLibLoad(entry, _csLibTargetChar); document.getElementById('csLibOverlay').classList.remove('open'); });
    var l2btn = item.querySelector('.cs-lib-load2-btn');
    if(l2btn) l2btn.addEventListener('click', function(e){ e.stopPropagation(); csLibLoad(entry, _csLibTargetChar===0?1:0); document.getElementById('csLibOverlay').classList.remove('open'); });
    item.querySelector('.cs-lib-del-btn').addEventListener('click', function(e){ e.stopPropagation(); csLibDelete(entry.id); });
    list.appendChild(item);
  });
}

var _csLibTargetChar = 0;

function csOpenLibrary(){
  _csLibTargetChar = activeChar;
  csRenderLibrary();
  document.getElementById('csLibOverlay').classList.add('open');
}

function csOpenLibraryFor(charIdx){
  _csLibTargetChar = charIdx;
  csRenderLibrary();
  document.getElementById('csLibOverlay').classList.add('open');
}

/* ══ DOM INIT ══ */
document.addEventListener('DOMContentLoaded', function(){
  // ── Build library overlay ──
  if(!document.getElementById('csLibOverlay')){
    var overlay = document.createElement('div');
    overlay.id = 'csLibOverlay';
    overlay.className = 'cs-lib-overlay';
    overlay.innerHTML =
      '<div class="cs-lib-modal">'+
        '<div class="cs-lib-modal-hd">'+
          '<div class="cs-lib-modal-title"><i class="fas fa-address-book"></i> Character Library</div>'+
          '<button class="cs-lib-close" id="csLibClose"><i class="fas fa-xmark"></i></button>'+
        '</div>'+
        '<div class="cs-lib-list" id="csLibList"></div>'+
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.classList.remove('open'); });
    document.getElementById('csLibClose').addEventListener('click', function(){ overlay.classList.remove('open'); });
  }

  csRenderTabs();
});

/* ════════════════════════════════════════════════════════════════
   SLOT MIRROR — intercept every S[charKey] write via defineProperty
   
   Any code anywhere (app.js buttons, color picker, randomize...)
   that writes S[k] where k is a CHAR_KEY will automatically mirror
   the value into charSlots[activeChar][k].
   
   This means slot[0] and slot[1] are truly independent with zero
   changes needed to app.js button handlers.
════════════════════════════════════════════════════════════════ */
(function installSlotMirror(){
  var CHAR_KEY_SET = {};
  CHAR_KEYS.forEach(function(k){ CHAR_KEY_SET[k] = true; });

  CHAR_KEYS.forEach(function(k){
    var _val = S[k]; /* capture current value before redefining */

    Object.defineProperty(S, k, {
      enumerable:   true,
      configurable: true,
      get: function(){ return _val; },
      set: function(v){
        _val = v;
        /* Mirror to active slot — but only when charSlots is ready */
        if(typeof charSlots !== 'undefined' && typeof activeChar !== 'undefined'){
          if(!charSlots[activeChar]) charSlots[activeChar] = csEmptySlot();
          charSlots[activeChar][k] = Array.isArray(v) ? v.slice() : v;
        }
      }
    });
  });



})();

/* ════════════════════════════════════════════════════════════════
   SAVE CHARACTER DIALOG — star button flow
════════════════════════════════════════════════════════════════ */
var _scTargetIdx = 0;

function openSaveCharDialog(charIdx){
  _scTargetIdx = charIdx;
  var overlay = document.getElementById('scOverlay');
  var inp     = document.getElementById('scNameInput');
  if(!overlay || !inp) return;
  /* Pre-fill if name already exists in slot */
  var existingName = '';
  if(charIdx === activeChar && S._name) existingName = S._name;
  else if(charSlots[charIdx] && charSlots[charIdx]._name) existingName = charSlots[charIdx]._name;
  inp.value = existingName;
  overlay.classList.add('open');
  setTimeout(function(){ inp.focus(); inp.select(); }, 80);
}

function closeSaveCharDialog(){
  var overlay = document.getElementById('scOverlay');
  if(overlay) overlay.classList.remove('open');
}

/* Intercept the existing idc-save-btn click — open our dialog instead */
document.addEventListener('DOMContentLoaded', function(){
  /* ── Save dialog logic ── */
  var scOverlay = document.getElementById('scOverlay');
  var scInp     = document.getElementById('scNameInput');
  var scSave    = document.getElementById('scSave');
  var scCancel  = document.getElementById('scCancel');

  function _doSave(){
    var name = scInp ? scInp.value.trim() : '';
    if(!name){ if(scInp){ scInp.focus(); scInp.style.borderColor='rgba(239,68,68,.6)'; setTimeout(function(){ scInp.style.borderColor=''; },1200); } return; }
    /* Write name into slot */
    if(!charSlots[_scTargetIdx]) charSlots[_scTargetIdx] = csEmptySlot();
    charSlots[_scTargetIdx]._name = name;
    if(_scTargetIdx === activeChar) S._name = name;
    /* Also update the card input so it shows immediately */
    var row = document.getElementById('charCardsRow');
    if(row){
      var card = row.querySelector('[data-card-idx="'+_scTargetIdx+'"]');
      if(card){ var cin = card.querySelector('.c-name-input'); if(cin) cin.value = name; }
    }
    closeSaveCharDialog();
    csLibSave(_scTargetIdx);
  }

  if(scSave) scSave.addEventListener('click', _doSave);
  if(scCancel) scCancel.addEventListener('click', closeSaveCharDialog);
  if(scOverlay) scOverlay.addEventListener('click', function(e){ if(e.target===scOverlay) closeSaveCharDialog(); });
  if(scInp) scInp.addEventListener('keydown', function(e){ if(e.key==='Enter') _doSave(); if(e.key==='Escape') closeSaveCharDialog(); });

  /* Override save-btn click on IDC cards to use dialog */
  document.addEventListener('click', function(e){
    var btn = e.target.closest('.idc-save-btn');
    if(!btn) return;
    /* Don't stopPropagation — just open the dialog */
    var idx = parseInt(btn.getAttribute('data-idx'));
    if(isNaN(idx)) return;
    openSaveCharDialog(idx);
  });

  /* ── Gender modal "Saved Character" button ── */
  var savedBtn = document.getElementById('genderModalSaved');
  if(savedBtn){
    savedBtn.addEventListener('click', function(e){
      e.stopPropagation();
      /* Capture idx BEFORE closeGenderModal nulls _gIdx */
      var targetIdx = (typeof window._gIdx !== 'undefined' && window._gIdx !== null)
        ? window._gIdx
        : activeChar;
      /* Close gender modal */
      var gOver = document.getElementById('genderOverlay');
      if(gOver) gOver.classList.remove('open');
      /* Open passport library */
      openPassportLibrary(targetIdx);
    });
  }
});

/* ════════════════════════════════════════════════════════════════
   PASSPORT LIBRARY
════════════════════════════════════════════════════════════════ */
var _ppTargetChar = 0;
var _ppIndex      = 0;  /* current card index */

/* Build full prompt text for a saved character entry */
function _ppBuildPrompt(entry){
  var d = entry.slot || {};
  var g = entry.gender || 'female';
  var parts = csBuildCharText(d, GENDER_TAG[g]||'1girl');
  return parts.join(', ');
}

/* Build passport card DOM — clean ID card style */
function _ppBuildCard(entry, idx, total){
  var d     = entry.slot || {};
  var g     = entry.gender || 'female';
  var isFem = g === 'female';
  var gCls  = isFem ? 'female' : 'male';
  var gIcon = isFem ? '<i class="fa-solid fa-person-dress"></i>' : '<i class="fa-solid fa-person"></i>';
  var gSex  = isFem ? 'F' : 'M';
  var gLabel= isFem ? 'FEMALE' : 'MALE';

  /* helper: field row */
  function fld(label, val){
    if(!val) return '';
    return '<div class="pp-card-field"><span class="pp-card-field-label">'+label+'</span><span class="pp-card-field-value">'+val+'</span></div>';
  }
  function fldFull(label, val){
    if(!val) return '';
    return '<div class="pp-card-field full"><span class="pp-card-field-label">'+label+'</span><span class="pp-card-field-value">'+val+'</span></div>';
  }
  function attr(label, val){
    if(!val) return '';
    return '<div class="pp-card-attr"><span class="pp-card-attr-lbl">'+label+'</span><span class="pp-card-attr-val">'+val+'</span></div>';
  }
  function attrFull(label, val){
    if(!val) return '';
    return '<div class="pp-card-attr full"><span class="pp-card-attr-lbl">'+label+'</span><span class="pp-card-attr-val">'+val+'</span></div>';
  }

  /* ── Data assembly ── */
  var ageStr = '';
  if(d._age) ageStr = d._age + (typeof _ageLabel==='function' ? ' ('+_ageLabel(d._age)+')' : '');
  else if(d.age) ageStr = d.age;

  var hairStr = [d.hairColor1, d.hairstyle].filter(Boolean).join(' ') || '';
  var eyeStr  = [d.eyeColor, d.eyeShape].filter(Boolean).join(' · ') || '';

  var outfitParts = [];
  if(d.clothing) outfitParts.push((d.clothingColor?d.clothingColor+' ':'')+d.clothing);
  else {
    if(d.clothingTop)    outfitParts.push((d.clothingTopColor?d.clothingTopColor+' ':'')+d.clothingTop);
    if(d.clothingBottom) outfitParts.push((d.clothingBottomColor?d.clothingBottomColor+' ':'')+d.clothingBottom);
  }
  if(d.sockLength) outfitParts.push((d.sockColor?d.sockColor+' ':'')+d.sockLength+' socks');
  if(d.shoes)      outfitParts.push((d.shoeColor?d.shoeColor+' ':'')+d.shoes);
  var outfitStr = outfitParts.join(', ');

  var accStr = (d.clothingAcc||[]).concat(d.faceAcc||[]).join(', ');

  var moodParts = [];
  if(d.expression) moodParts.push(d.expression);
  (d.poses||[]).forEach(function(p){ moodParts.push(p); });
  var moodStr = moodParts.join(', ');

  var toolStr = (d.weapons||[]).concat(d.props||[]).concat(d.electronics||[]).concat(d.otherItems||[]).join(', ');

  /* ── MRZ lines ── */
  var mrzName = entry.name.toUpperCase().replace(/\s+/g,'<');
  var mrzPad  = 'P<APS<'+mrzName;
  while(mrzPad.length < 44) mrzPad += '<';
  var mrzId   = entry.id.toString(36).toUpperCase().slice(-9).padEnd(9,'<')+'<'+gSex+'<';
  while(mrzId.length < 44) mrzId += '<';

  /* ── Photo area: entire box is clickable for upload ── */
  var photoHtml;
  if(entry.photo){
    photoHtml = '<label class="pp-card-photo pp-card-photo-'+gCls+' pp-has-photo" title="Change photo" style="cursor:pointer">'
      +'<input type="file" accept="image/*" class="pp-photo-file" data-entry-id="'+entry.id+'" style="display:none">'
      +'<img src="'+entry.photo+'" class="pp-photo-img" alt="character photo">'
      +'<div class="pp-photo-overlay"><span>⬆</span></div>'
    +'</label>';
  } else {
    photoHtml = '<label class="pp-card-photo pp-card-photo-'+gCls+' pp-no-photo" title="Upload photo" style="cursor:pointer">'
      +'<input type="file" accept="image/*" class="pp-photo-file" data-entry-id="'+entry.id+'" style="display:none">'
      +'<div class="pp-card-photo-icon">'+gIcon+'</div>'
      +'<div class="pp-card-photo-sex">'+gSex+'</div>'
      +'<div class="pp-photo-overlay"><span>＋</span></div>'
    +'</label>';
  }

  return '<div class="pp-card pp-card-'+gCls+'" data-entry-id="'+entry.id+'">'

  /* color band */
  +'<div class="pp-card-band"></div>'

  /* header */
  +'<div class="pp-card-head">'
  +  '<span class="pp-card-issuer">Anime Prompt Studio &middot; Character ID</span>'
  +  '<span class="pp-card-doc-type">'+gLabel+'</span>'
  +  '<span class="pp-card-serial">'+String(idx+1).padStart(2,'0')+'/'+String(total).padStart(2,'0')+'</span>'
  +'</div>'

  /* main: photo + info */
  +'<div class="pp-card-main">'
  +  photoHtml

  +  '<div class="pp-card-info">'
  +    '<div class="pp-card-name-lbl">Surname / Name</div>'
  +    '<div class="pp-card-fullname">'+entry.name+'</div>'
  +    '<div class="pp-card-grid">'
  +      fld('Date Saved', entry.date)
  +      fld('Age', ageStr || '—')
  +      fld('Skin', d.skin || '—')
  +      fld('Body', d.body || '—')
  +      '<div class="pp-card-field"><span class="pp-card-field-label">Document No.</span><span class="pp-card-field-value muted" style="font-size:.58rem;letter-spacing:.05em">'+entry.id.toString(36).toUpperCase().slice(-8)+'</span></div>'
  +    '</div>'
  +  '</div>'

  +'</div>'/* /pp-card-main */

  /* appearance attributes */
  +'<div class="pp-card-divider"></div>'
  +'<div class="pp-card-attrs">'
  +  '<div class="pp-card-attrs-title">Appearance &amp; Details</div>'
  +  '<div class="pp-card-attr-grid">'
  +    attr('Hair', hairStr || '—')
  +    attr('Eyes', eyeStr || '—')
  +    (outfitStr ? attrFull('Outfit', outfitStr) : '')
  +    (accStr    ? attrFull('Accessories', accStr) : '')
  +    (moodStr   ? attr('Expression', moodStr) : '')
  +    (toolStr   ? attr('Weapons / Props', toolStr) : '')
  +  '</div>'
  +'</div>'

  /* MRZ */
  +'<div class="pp-mrz">'
  +  '<div class="pp-mrz-line">'+mrzPad+'</div>'
  +  '<div class="pp-mrz-line">'+mrzId+'</div>'
  +'</div>'

  +'</div>'; /* /pp-card */
}

function _ppRenderDots(total, current){
  var dots = document.getElementById('ppDots');
  if(!dots) return;
  dots.innerHTML = '';
  for(var i=0;i<total;i++){
    var d = document.createElement('button');
    d.className = 'pp-dot'+(i===current?' on':'');
    d.setAttribute('data-i', i);
    d.addEventListener('click', (function(idx){ return function(){ ppGoTo(idx); }; })(i));
    dots.appendChild(d);
  }
}

function ppGoTo(idx){
  var lib = csLibrary;
  if(!lib.length) return;
  _ppIndex = Math.max(0, Math.min(idx, lib.length-1));
  _ppRenderCard(lib, _ppIndex);
  _ppRenderDots(lib.length, _ppIndex);
  var prev = document.getElementById('ppPrev');
  var next = document.getElementById('ppNext');
  if(prev) prev.disabled = _ppIndex === 0;
  if(next) next.disabled = _ppIndex === lib.length - 1;
}

function _ppRenderCard(lib, idx){
  var track = document.getElementById('ppTrack');
  if(!track || !lib[idx]) return;
  track.style.transition = 'opacity .15s';
  track.style.opacity = '0';
  setTimeout(function(){
    track.innerHTML = _ppBuildCard(lib[idx], idx, lib.length);
    track.style.opacity = '1';
  }, 150);
}


function openPassportLibrary(charIdx){
  _ppTargetChar = typeof charIdx !== 'undefined' ? charIdx : activeChar;
  _ppIndex = 0;

  var overlay  = document.getElementById('ppOverlay');
  var track    = document.getElementById('ppTrack');
  var viewport = document.getElementById('ppViewport');
  var nav      = document.getElementById('ppNav');
  var empty    = document.getElementById('ppEmpty');
  var actions  = overlay ? overlay.querySelector('.pp-actions') : null;

  if(!overlay) return;
  var lib = csLibrary;

  if(!lib.length){
    if(track)    track.innerHTML        = '';
    if(viewport) viewport.style.display = 'none';
    if(nav)      nav.style.display      = 'none';
    if(empty)    empty.style.display    = 'flex';
    if(actions)  actions.style.display  = 'none';
  } else {
    if(empty)    empty.style.display    = 'none';
    if(viewport) viewport.style.display = '';
    if(nav)      nav.style.display      = lib.length > 1 ? '' : 'none';
    if(actions)  actions.style.display  = '';

    /* Show only card 0 — navigation swaps content */
    if(track){
      track.style.opacity = '1';
      track.innerHTML = _ppBuildCard(lib[0], 0, lib.length);
    }
    _ppRenderDots(lib.length, 0);
    var prev = document.getElementById('ppPrev');
    var next = document.getElementById('ppNext');
    if(prev) prev.disabled = true;
    if(next) next.disabled = lib.length <= 1;
  }

  overlay.classList.add('open');
}
function closePassportLibrary(){
  var overlay = document.getElementById('ppOverlay');
  if(overlay) overlay.classList.remove('open');
}

/* Wire up passport overlay controls */
document.addEventListener('DOMContentLoaded', function(){
  var overlay  = document.getElementById('ppOverlay');
  var closeBtn = document.getElementById('ppClose');
  var prevBtn  = document.getElementById('ppPrev');
  var nextBtn  = document.getElementById('ppNext');
  var loadBtn  = document.getElementById('ppLoadBtn');
  var delBtn   = document.getElementById('ppDelBtn');

  if(closeBtn) closeBtn.addEventListener('click', closePassportLibrary);
  if(overlay)  overlay.addEventListener('click',  function(e){ if(e.target===overlay) closePassportLibrary(); });

  if(prevBtn) prevBtn.addEventListener('click', function(){ ppGoTo(_ppIndex-1); });
  if(nextBtn) nextBtn.addEventListener('click', function(){ ppGoTo(_ppIndex+1); });

  /* Keyboard left/right */
  document.addEventListener('keydown', function(e){
    var ov = document.getElementById('ppOverlay');
    if(!ov || !ov.classList.contains('open')) return;
    if(e.key==='ArrowLeft')  ppGoTo(_ppIndex-1);
    if(e.key==='ArrowRight') ppGoTo(_ppIndex+1);
    if(e.key==='Escape')     closePassportLibrary();
  });

  /* Touch swipe */
  var _touchStartX = null;
  if(overlay){
    overlay.addEventListener('touchstart', function(e){ _touchStartX = e.touches[0].clientX; }, {passive:true});
    overlay.addEventListener('touchend', function(e){
      if(_touchStartX===null) return;
      var dx = e.changedTouches[0].clientX - _touchStartX;
      _touchStartX = null;
      if(Math.abs(dx) < 40) return;
      if(dx < 0) ppGoTo(_ppIndex+1);
      else        ppGoTo(_ppIndex-1);
    }, {passive:true});
  }

  /* ── Photo upload via event delegation on the track ── */
  var track2 = document.getElementById('ppTrack');
  if(track2){
    track2.addEventListener('change', function(e){
      if(!e.target.classList.contains('pp-photo-file')) return;
      var file = e.target.files[0];
      if(!file) return;
      var entryId = parseInt(e.target.getAttribute('data-entry-id'));
      var reader = new FileReader();
      reader.onload = function(ev){
        var b64 = ev.target.result;
        var entry = csLibrary.find(function(c){ return c.id === entryId; });
        if(entry){
          entry.photo = b64;
          localStorage.setItem('aps_charLib', JSON.stringify(csLibrary));
          openPassportLibrary(_ppTargetChar);
          ppGoTo(_ppIndex);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  /* Load button */
  if(loadBtn){
    loadBtn.addEventListener('click', function(){
      var lib = csLibrary;
      if(!lib.length || _ppIndex >= lib.length) return;
      var entry = lib[_ppIndex];
      csLibLoad(entry, _ppTargetChar);
      closePassportLibrary();
    });
  }

  /* Delete button */
  if(delBtn){
    delBtn.addEventListener('click', function(){
      var lib = csLibrary;
      if(!lib.length || _ppIndex >= lib.length) return;
      var entry = lib[_ppIndex];
      csLibDelete(entry.id);
      /* Re-render or close if empty */
      if(!csLibrary.length){
        closePassportLibrary();
        return;
      }
      _ppIndex = Math.max(0, _ppIndex-1);
      openPassportLibrary(_ppTargetChar);
    });
  }
});

/* Also override the csOpenLibrary / csOpenLibraryFor to use passport UI */
window.csOpenLibrary = function(){ openPassportLibrary(activeChar); };
window.csOpenLibraryFor = function(charIdx){ openPassportLibrary(charIdx); };
