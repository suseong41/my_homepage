  // secc: 암호 글씨색(=판정), pmf: 802.11w(0없음/1가능/2필수), weak: 구형암호(WEP/WPA1/TKIP)
  const APS = [
    { ss:"DIRECT-02-SA", mac:"C6:65:1A:22:B0:04", sec:"WPA2-PSK-CCMP", secc:"green", pmf:1, weak:0, pwr:-27, pc:"b-strong", ch:4 },
    { ss:"PARK2.4",      mac:"70:5D:CC:E6:DB:FA", sec:"WPA2-PSK-CCMP", secc:"amber", pmf:0, weak:0, pwr:-70, pc:"b-mid",  ch:11 },
    { ss:"PARK5",        mac:"70:5D:CC:E6:DB:F8", sec:"WPA2-PSK-CCMP", secc:"amber", pmf:0, weak:0, pwr:-73, pc:"b-mid",  ch:149 },
    { ss:"SK_E138_2.4G", mac:"38:F4:5E:34:89:B3", sec:"WPA2-PSK-CCMP", secc:"green", pmf:1, weak:0, pwr:-78, pc:"b-weak", ch:2 },
    { ss:"NEXTU AX3000", mac:"20:C0:6D:11:0E:F4", sec:"WPA2-PSK-TKIP", secc:"red",   pmf:0, weak:1, pwr:-87, pc:"b-weak", ch:3 },
    { ss:"U+Net0EF4",    mac:"DC:70:14:8A:0E:F4", sec:"WPA2-PSK-CCMP", secc:"amber", pmf:0, weak:0, pwr:-88, pc:"b-weak", ch:7 },
  ];
  const HOP = [1,6,11,36,149,40,44,48,153,157,2,7,13];
  const $ = id => document.getElementById(id);
  const startBtn=$("startBtn"), list=$("list"), hint=$("hint"), chchip=$("chchip"), bandPop=$("bandPop"),
        ctxPop=$("ctxPop"), atkPop=$("atkPop"), atkTitle=$("atkTitle"), chRow=$("chRow"), chIn=$("chIn"),
        staSel=$("staSel"), banner=$("banner"), steps=$("steps"), cutStep=$("cutStep"),
        why=$("why"), whyH=$("whyH"), whyB=$("whyB"), lid=$("lid"), yt=$("yt"), toast=$("toast");

  let scanning=false, hopTimer=null, toastT=null, sel=null, atk=null;
  const ytCmd = (f,a=[]) => { try { yt.contentWindow.postMessage(JSON.stringify({event:"command",func:f,args:a}),"*"); } catch(e){} };
  let unmuted=false;                                   // 자동재생 정책: 음소거 시작 → 첫 클릭에 소리
  document.addEventListener("pointerdown", ()=>{ if(unmuted) return; unmuted=true; ytCmd("unMute"); ytCmd("setVolume",[100]); });
  const stepDone = s => { const li=steps.querySelector('[data-s="'+s+'"]'); if(li) li.classList.add("done"); };
  const stepsReset = () => steps.querySelectorAll("li").forEach(li=>li.classList.remove("done"));
  function whyReset(){ why.className="why"; whyH.textContent="취약점 분석 대기"; whyB.textContent="AP를 선택해 Deauth·Auth·CSA를 실행하면, 대상의 암호화·PMF에 따라 공격이 왜 통하거나 막히는지 여기서 설명합니다."; why.hidden=false; }
  function showToast(t){ toast.textContent=t; toast.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>toast.hidden=true,1600); }

  function reset() {
    scanning=false; clearInterval(hopTimer); hopTimer=null; sel=null; atk=null;
    startBtn.textContent="▶ Start"; startBtn.classList.remove("on");
    list.innerHTML=""; list.appendChild(hint); hint.hidden=false;
    chchip.hidden=true; banner.hidden=true; ctxPop.hidden=true; atkPop.hidden=true; whyReset();
    lid.classList.remove("buffering"); ytCmd("playVideo");
    cutStep.textContent="프레임 주입 → 연결 해제"; stepsReset();
  }
  function startScan(band) {
    scanning=true; startBtn.textContent="■ Stop"; startBtn.classList.add("on");
    hint.hidden=true; list.innerHTML=""; chchip.hidden=false; stepsReset(); whyReset();
    const rows = APS.filter(a => band==="dual" ? true : band==="24" ? a.ch<=14 : a.ch>=36);
    rows.forEach((a,i)=>{
      const el=document.createElement("div"); el.className="ap"; el.style.animationDelay=(i*0.12)+"s";
      el.dataset.ss=a.ss; el.dataset.mac=a.mac; el.dataset.ch=a.ch; el.dataset.pmf=a.pmf; el.dataset.weak=a.weak;
      el.innerHTML='<div class="r1"><span class="ss">'+a.ss+'</span><span class="pwr '+a.pc+'">'+a.pwr+' dBm</span></div>'+
        '<div class="r2"><span class="mac">'+a.mac.slice(0,8)+'…</span><span class="sec '+a.secc+'">'+a.sec+'</span><span class="ch">CH '+a.ch+'</span></div>';
      list.appendChild(el);
    });
    let hi=0; chchip.textContent="CH:"+String(HOP[0]).padStart(2,"0");
    hopTimer=setInterval(()=>{ hi=(hi+1)%HOP.length; chchip.textContent="CH:"+String(HOP[hi]).padStart(2,"0"); },500);
    setTimeout(()=>stepDone("scan"), rows.length*120+300);
  }
  function runAttack() {
    if(!sel||!atk) return;
    const name = atk==="csa"?"CSA":atk==="auth"?"Auth":"Deauth";
    const sta = staSel.value, ch = atk==="csa" ? chIn.value : sel.dataset.ch;
    const pmf = +sel.dataset.pmf, weak = sel.dataset.weak==="1";
    atkPop.hidden=true; stepDone("lock");

    let success, cls, title, body;
    if(atk==="csa"){
      success=true; cls="warn"; title="CSA 성공 — 비콘 기반 공격";
      body="CSA는 비콘에 '채널 전환' 정보를 실어 보냅니다. PMF(802.11w)는 비콘을 보호하지 않으므로, PMF가 켜진 AP라도 STA를 강제로 다른 채널로 옮겨 연결을 끊을 수 있습니다.";
    } else if(pmf>=1){
      success=false; cls="ok"; title="차단됨 — PMF(802.11w) 적용";
      body="이 AP는 관리 프레임 보호가 켜져 있어 위조된 "+name+" 프레임이 인증 실패로 무시됩니다. 연결이 그대로 유지됩니다. SuNiffing이 이 AP를 초록('견고')으로 표시한 이유입니다.";
    } else if(weak){
      success=true; cls="bad"; title="성공 — 취약: 구형 TKIP";
      body="PMF 미적용 + 구형 TKIP 암호. 관리 프레임을 위조해 연결을 끊을 수 있고, TKIP 자체도 다운그레이드·크랙에 취약합니다. 그래서 빨강('취약')으로 표시됩니다.";
    } else {
      success=true; cls="warn"; title="성공 — PMF 미적용";
      body="WPA2-CCMP라도 관리 프레임(deauth/disassoc)은 암호화되지 않습니다. PMF가 없어 위조된 "+name+" 프레임으로 연결을 끊을 수 있습니다. 그래서 앰버('PMF 없음')로 표시됩니다.";
    }

    banner.innerHTML='<span><span class="dot">●</span> '+name+(success?' 중':' 시도')+' → <b>'+sta+'</b> · CH'+ch+'</span><span class="stop" id="bstop">STOP</span>';
    banner.hidden=false; $("bstop").addEventListener("click", reset);
    sel.classList.add("att");
    cutStep.textContent = success ? (atk==="csa" ? "CSA 비콘 주입 → 채널 강제 이동" : name+" 프레임 주입 → 연결 해제")
                                  : (name+" 프레임 주입 → PMF에 차단됨");
    why.className="why "+cls; whyH.textContent=title; whyB.textContent=body; why.hidden=false;

    if(success){
      setTimeout(()=>{ lid.classList.add("buffering"); ytCmd("pauseVideo"); }, 700);
      setTimeout(()=>{ stepDone("cut"); sel.classList.add("gone"); }, 1200);
    } else {
      setTimeout(()=>{ stepDone("cut"); }, 700);
    }
  }

  startBtn.addEventListener("click", ()=>{ if(scanning) reset(); else bandPop.hidden=false; });
  bandPop.addEventListener("click", e=>{ const b=e.target.closest(".band"); if(!b) return; bandPop.hidden=true; startScan(b.dataset.band); });
  list.addEventListener("click", e=>{
    const ap=e.target.closest(".ap"); if(!ap||!scanning) return;
    list.querySelectorAll(".ap.sel").forEach(x=>x.classList.remove("sel"));
    ap.classList.add("sel"); sel=ap; stepDone("pick"); ctxPop.hidden=false;
  });
  ctxPop.addEventListener("click", e=>{
    const it=e.target.closest(".mitem"); if(!it){ if(e.target===ctxPop) ctxPop.hidden=true; return; }
    const act=it.dataset.act; ctxPop.hidden=true;
    if(act==="copyb") showToast("BSSID 복사됨: "+sel.dataset.mac);
    else if(act==="copye") showToast("ESSID 복사됨: "+sel.dataset.ss);
    else if(act==="stop") reset();
    else { atk=act; atkTitle.textContent=(act==="csa"?"CSA":act==="auth"?"Auth":"Deauth")+" Attack"; chRow.hidden=act!=="csa"; chIn.value=11; atkPop.hidden=false; }
  });
  $("atkCancel").addEventListener("click", ()=>{ atkPop.hidden=true; if(sel) sel.classList.remove("sel"); });
  $("atkOk").addEventListener("click", runAttack);

  reset();
