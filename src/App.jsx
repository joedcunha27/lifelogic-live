import { useState, useCallback } from "react";

// ── TOKENS ───────────────────────────────────────────────────────────────────
const A="#f59e0b",DARK="#0a0f1e",CARD="#111827",INNER="#1a2235",BORDER="#1f2937",
      BORDERL="#374151",TEXT="#f9fafb",TEXTM="#d1d5db",TEXTD="#9ca3af",
      EMERALD="#10b981",ROSE="#f43f5e",BLUE="#3b82f6";
const MODEL="claude-sonnet-4-5";

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt=n=>n?`£${Number(n).toLocaleString()}`:"—";
const fmtM=n=>n?`£${Number(n).toLocaleString()}/mo`:"—";
function calcAge(d){if(!d)return null;const b=new Date(d),t=new Date();let a=t.getFullYear()-b.getFullYear();if(t.getMonth()-b.getMonth()<0||(t.getMonth()===b.getMonth()&&t.getDate()<b.getDate()))a--;return a>=0&&a<120?a:null;}
function getSPA(d){if(!d)return 68;const b=new Date(d);if(b<new Date(1960,3,6))return 66;if(b<new Date(1977,3,6))return 67;return 68;}

// ── DEFAULT STEPS ─────────────────────────────────────────────────────────────
// next is stored as a string key: "ALWAYS:stepId" | "IF:ffKey=value:stepId:elseStepId"
// Multiple conditions: "IF:ffKey=value:stepId|IF:ffKey2=value2:stepId2|ELSE:stepId"
const DEFAULT_STEPS = [
  { id:"intro", section:"Introduction", script:"Hi, is that [firstName]?", subScript:"Hi [firstName], it's [Your Name] calling from First Thought Financial. You made an enquiry about Income Protection online, so I just wanted to follow up with some quotes. I just need to confirm a few quick bits first — is that alright?", type:"tap", options:["Yes, go ahead","Not a good time"], note:"", next:"IF:options[0]:data_protection|ELSE:bad_time" },
  { id:"bad_time", section:"Introduction", script:"No problem at all — when would be a better time to call you back?", type:"info", options:[], note:"Note the callback time and end the call.", next:"ALWAYS:intro" },
  { id:"data_protection", section:"Introduction", script:"Before we start — can I just confirm the first line of your address and postcode for Data Protection?", type:"input", options:[], inputs:[{key:"address",label:"Address / Postcode",placeholder:"e.g. 12 High Street, SW1A 1AA"}], note:"", next:"ALWAYS:client_name" },
  { id:"client_name", section:"Introduction", script:"And your full name and date of birth?", type:"input", options:[], inputs:[{key:"firstName",label:"First Name",placeholder:"John"},{key:"lastName",label:"Last Name",placeholder:"Smith"},{key:"dob",label:"Date of Birth",placeholder:"",inputType:"date"}], note:"", next:"ALWAYS:situation_intro" },
  { id:"situation_intro", section:"Situation", script:"There are a few different types of Income Protection, so to make sure I look at the right one for you — could you give me a brief overview of your situation and what made you look into this?", type:"info", options:[], note:"Listen carefully. Note any key details before continuing.", next:"ALWAYS:marital" },
  { id:"marital", section:"Situation", script:"Are you single, or do you have a partner or spouse?", type:"tap", options:["Single","Partner / Spouse"], ffKey:"marital", note:"", next:"IF:options[0]:occupation|ELSE:partner_name" },
  { id:"partner_name", section:"Situation", script:"What's your partner's name and date of birth?", type:"input", options:[], inputs:[{key:"partnerFirstName",label:"Partner First Name",placeholder:"Jane"},{key:"partnerDob",label:"Partner DOB",placeholder:"",inputType:"date"}], note:"", next:"ALWAYS:occupation" },
  { id:"occupation", section:"Situation", script:"What do you do for work?", type:"input", options:[], inputs:[{key:"occupation",label:"Occupation",placeholder:"e.g. Carpenter, Nurse, Project Manager"}], note:"", next:"ALWAYS:emp_type" },
  { id:"emp_type", section:"Situation", script:"And are you employed by a company, or are you self-employed?", type:"tap", options:["Employed","Self-employed","Ltd Company Director","Contractor"], ffKey:"empType", note:"", next:"ALWAYS:income" },
  { id:"income", section:"Situation", script:"What's your annual income roughly, and what does that work out to take-home each month after tax?", type:"input", options:[], inputs:[{key:"grossIncome",label:"Gross Annual Income (£)",placeholder:"50000",inputType:"number"},{key:"takeHome",label:"Monthly Take-home (£)",placeholder:"3200",inputType:"number"}], note:"", next:"ALWAYS:housing" },
  { id:"housing", section:"Situation", script:"Are you renting, or do you have a mortgage?", type:"tap", options:["Mortgage","Renting","Own outright","Living with family"], ffKey:"housing", note:"", next:"IF:options[0]:mortgage_details|ELSE:kids" },
  { id:"mortgage_details", section:"Situation", script:"What's the outstanding balance, remaining term, and monthly payment on the mortgage?", type:"input", options:[], inputs:[{key:"mortgageBalance",label:"Outstanding Balance (£)",placeholder:"250000",inputType:"number"},{key:"mortgageTerm",label:"Remaining Term (years)",placeholder:"22",inputType:"number"},{key:"mortgagePayment",label:"Monthly Payment (£)",placeholder:"1200",inputType:"number"},{key:"mortgageType",label:"Repayment Type",type:"select",options:["Repayment","Interest Only","Part & Part"]}], note:"", next:"ALWAYS:kids" },
  { id:"kids", section:"Situation", script:"Do you have any dependent children?", type:"tap", options:["No children","Yes — 1","Yes — 2","Yes — 3 or more"], ffKey:"hasKids", note:"", next:"IF:options[0]:health|ELSE:kids_ages" },
  { id:"kids_ages", section:"Situation", script:"How old are they?", type:"input", options:[], inputs:[{key:"kidsAges",label:"Ages (comma separated)",placeholder:"e.g. 4, 7, 11"}], note:"", next:"ALWAYS:health" },
  { id:"health", section:"Situation", script:"Any medical conditions or health issues I should be aware of — anything your GP knows about?", type:"tap", options:["No — all clear","Yes — minor / managed","Yes — significant condition"], ffKey:"healthFlag", note:"", next:"IF:options[0]:confirm_need|ELSE:health_detail" },
  { id:"health_detail", section:"Situation", script:"Can you give me a brief overview?", type:"input", options:[], inputs:[{key:"healthDetail",label:"Health Details",placeholder:"e.g. Type 2 diabetes, well controlled"}], note:"", next:"ALWAYS:confirm_need" },
  { id:"confirm_need", section:"Confirm Need", script:"So just to confirm — you're looking to make sure that if you're signed off work due to illness or injury, your income is replaced so you can keep covering your bills. Is that right?", type:"tap", options:["Yes, exactly","Slightly different"], note:"", next:"IF:options[0]:explain_ip|ELSE:clarify_need" },
  { id:"clarify_need", section:"Confirm Need", script:"Of course — what are you specifically looking for?", type:"input", options:[], inputs:[{key:"needDetail",label:"Their specific need",placeholder:"Note what they said..."}], note:"", next:"ALWAYS:explain_ip" },
  { id:"explain_ip", section:"Income Protection", script:"Great. Let me quickly explain how Income Protection works — it's very straightforward.", subScript:"If you're signed off work by your GP due to illness or injury, this policy replaces your income each month until you return to work. You can claim for both physical and mental health reasons — as long as you're signed off, you're covered. Does that make sense?", type:"tap", options:["Yes, makes sense","Can you explain more?"], note:"", next:"IF:options[0]:outgoings|ELSE:explain_ip_more" },
  { id:"explain_ip_more", section:"Income Protection", script:"Think of it like this — if you broke your leg and couldn't work for 3 months, the policy would pay a set monthly amount directly into your bank account, like a salary. It covers anything from a broken bone to cancer to depression. As long as your doctor signs you off, you get paid. Does that make sense now?", type:"tap", options:["Yes, got it"], note:"", next:"ALWAYS:outgoings" },
  { id:"outgoings", section:"Monthly Benefit", script:"You mentioned your [housingLabel] is [housingCost]. What would you say your total monthly outgoings are — including all bills, food, council tax, transport, everything?", type:"input", options:[], inputs:[{key:"totalOutgoings",label:"Total Monthly Outgoings (£)",placeholder:"3500",inputType:"number"}], note:"", next:"ALWAYS:benefit_check" },
  { id:"benefit_check", section:"Monthly Benefit", script:"So if you weren't working, would [outgoings] per month be enough to cover everything?", type:"tap", options:["Yes, that covers it","I'd need a bit more","I could manage on less"], ffKey:"benefitConfirm", note:"", next:"IF:marital=Partner / Spouse:partner_contribution|ELSE:waiting_intro" },
  { id:"partner_contribution", section:"Monthly Benefit", script:"Would your partner contribute to the bills if you weren't working, or would you need to cover the full amount yourself?", type:"tap", options:["Partner would contribute","I'd need to cover it all"], ffKey:"partnerContrib", note:"", next:"IF:options[0]:partner_income|ELSE:waiting_intro" },
  { id:"partner_income", section:"Monthly Benefit", script:"What does your partner take home each month?", type:"input", options:[], inputs:[{key:"partnerIncome",label:"Partner Monthly Take-home (£)",placeholder:"2400",inputType:"number"}], note:"", next:"ALWAYS:waiting_intro" },
  { id:"waiting_intro", section:"Waiting Period", script:"Now let's look at how quickly you'd want payments to start if you were off work. The longer you can wait, the cheaper the policy — this is called the waiting period.", type:"info", options:[], note:"", next:"ALWAYS:sick_pay_check" },
  { id:"sick_pay_check", section:"Waiting Period", script:"Do you get sick pay from your employer?", type:"tap", options:["Yes — full pay","Yes — partial pay","No sick pay","Self-employed — no sick pay"], ffKey:"sickPayType", note:"", next:"IF:options[0]:sick_pay_duration|IF:options[1]:sick_pay_duration|ELSE:savings_check" },
  { id:"sick_pay_duration", section:"Waiting Period", script:"How long does your sick pay last?", type:"tap", options:["1 month","2 months","3 months","4–6 months","6+ months"], ffKey:"sickPayDuration", note:"", next:"ALWAYS:deferred_rec" },
  { id:"savings_check", section:"Waiting Period", script:"Do you have any savings you could rely on to tide you over if you were off work?", type:"tap", options:["No / very little","1–2 months worth","3+ months worth"], ffKey:"savingsLevel", note:"", next:"ALWAYS:deferred_rec" },
  { id:"deferred_rec", section:"Waiting Period", script:"Based on what you've told me, I'd suggest a waiting period of [DEFERRED]. [DEFERRED_REASON]. Does that sound reasonable?", type:"tap", options:["Yes, that works","I'd prefer shorter","I'd prefer longer"], ffKey:"deferredConfirm", note:"", next:"ALWAYS:summary_quote" },
  { id:"summary_quote", section:"Summary", script:"So we're looking at a policy that will pay you [benefit] per month after [DEFERRED] if you're signed off work for any reason — physical or mental — for as long as you need it right up to your retirement. There are a number of providers, so let's see who's most competitive.", type:"info", options:[], note:"", next:"IF:marital=Partner / Spouse:life_check|IF:hasKids!=No children:life_check|ELSE:quote_type" },
  { id:"life_check", section:"Life Cover", script:"While that's loading — just one quick thing. We're looking at what happens if you can't work, but if you passed away, would your partner or family have enough money to manage everything?", type:"tap", options:["They'd really struggle","They'd manage OK"], ffKey:"lifeNeed", note:"Only ask if client has a partner or children.", next:"ALWAYS:existing_life" },
  { id:"existing_life", section:"Life Cover", script:"Do you already have Life Insurance in place?", type:"tap", options:["Yes","No"], ffKey:"hasLife", note:"", next:"IF:options[0]:existing_life_detail|ELSE:quote_type" },
  { id:"existing_life_detail", section:"Life Cover", script:"Great — who's it with, what's the cover amount, and the monthly premium?", type:"input", options:[], inputs:[{key:"lifeProvider",label:"Provider",placeholder:"e.g. Aviva"},{key:"lifeCoverAmount",label:"Cover Amount (£)",placeholder:"300000",inputType:"number"},{key:"lifePremium",label:"Monthly Premium (£)",placeholder:"45",inputType:"number"}], note:"", next:"ALWAYS:quote_type" },
  { id:"quote_type", section:"Quote", script:"You've got two types of Income Protection. Option 1 pays until your retirement — no cap on how long you can claim. Option 2 is more cost-effective — pays for up to 2 years per claim, but you can claim unlimited times as long as you've returned to work for 6 months in between. I'll get quotes for both.", type:"tap", options:["Show me both","Full term only","2-year option only"], ffKey:"quotePreference", note:"", next:"ALWAYS:affordability" },
  { id:"affordability", section:"Quote", script:"The most competitive provider for the full term option is [PROVIDER]. Is the premium going to be comfortable for you monthly?", type:"tap", options:["Yes, comfortable","It's a bit much","Need to think about it"], ffKey:"affordability", note:"", next:"IF:options[1]:budget_adjust|ELSE:close" },
  { id:"budget_adjust", section:"Quote", script:"No problem — what monthly amount would be comfortable for you? We can adjust the cover level or waiting period to bring it down.", type:"input", options:[], inputs:[{key:"budget",label:"Monthly Budget (£)",placeholder:"40",inputType:"number"}], note:"", next:"ALWAYS:close" },
  { id:"close", section:"Close", script:"Just to confirm — this is a fixed premium. It won't increase with age or after a claim. You'll also get some great additional benefits included with [PROVIDER].", subScript:"The next step is to run through some basic medical questions to make sure they're happy to cover you — based on what you've shared this should be very straightforward.", type:"tap", options:["Great, let's proceed","I have a question"], note:"", next:"IF:marital=Partner / Spouse:life_upsell|IF:hasKids!=No children:life_upsell|ELSE:generate" },
  { id:"life_upsell", section:"Close", script:"Before the medical questions — would you like me to also show you what it would cost to add Life Insurance? A few providers offer multi-product discounts so it can work out better value doing both together.", type:"tap", options:["Yes, show me","No thanks — just IP for now"], ffKey:"lifeUpsell", note:"Only reaches here if client has partner or children.", next:"ALWAYS:generate" },
  { id:"generate", section:"Advice", script:"All the information has been captured. Tap below to generate the full LifeLogic advice report.", type:"generate", options:[], note:"", next:"ALWAYS:null" },
];

const SECTIONS=["Introduction","Situation","Confirm Need","Income Protection","Monthly Benefit","Waiting Period","Summary","Life Cover","Quote","Close","Advice"];

// ── NEXT STEP RESOLVER ────────────────────────────────────────────────────────
// Parses "IF:options[0]:stepA|ELSE:stepB" etc.
function resolveNext(nextStr, selectedOption, step, ff) {
  if (!nextStr) return null;
  const parts = nextStr.split("|");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith("ALWAYS:")) {
      const dest = trimmed.replace("ALWAYS:","");
      return dest==="null"?null:dest;
    }
    if (trimmed.startsWith("ELSE:")) {
      const dest = trimmed.replace("ELSE:","");
      return dest==="null"?null:dest;
    }
    if (trimmed.startsWith("IF:")) {
      const body = trimmed.replace("IF:","");
      const colonParts = body.split(":");
      // Format: condition:dest
      const condition = colonParts[0];
      const dest = colonParts[1];
      if (!dest) continue;
      // options[0] = first option was selected
      if (condition.startsWith("options[")) {
        const idx = parseInt(condition.match(/\[(\d+)\]/)?.[1]);
        if (!isNaN(idx) && step.options && selectedOption === step.options[idx]) return dest==="null"?null:dest;
        continue;
      }
      // ffKey=value
      if (condition.includes("=")) {
        const [ffk, val] = condition.split("=");
        if (ff[ffk.trim()] === val.trim()) return dest==="null"?null:dest;
        continue;
      }
      // ffKey!=value
      if (condition.includes("!=")) {
        const [ffk, val] = condition.split("!=");
        if (ff[ffk.trim()] !== val.trim()) return dest==="null"?null:dest;
        continue;
      }
    }
  }
  return null;
}

// ── PROMPT BUILDER ────────────────────────────────────────────────────────────
function buildPrompt(ff) {
  const age=calcAge(ff.dob), spa=getSPA(ff.dob);
  const pAge=calcAge(ff.partnerDob), pSpa=getSPA(ff.partnerDob);
  const hasP=ff.marital==="Partner / Spouse";
  const hasMort=ff.housing==="Mortgage";
  const hasKids=ff.hasKids&&ff.hasKids!=="No children";
  const gross60=(parseFloat(ff.grossIncome)||0)*0.6/12;
  const out=parseFloat(ff.totalOutgoings)||0;
  const pInc=parseFloat(ff.partnerIncome)||0;
  const ipBen=hasP&&ff.partnerContrib==="Partner would contribute"?Math.min(Math.max(0,out-pInc),gross60):Math.min(out,gross60);
  const def=ff.sickPayDuration||(ff.savingsLevel==="3+ months worth"?"3 months":"1 month");
  return `You are an expert UK protection insurance adviser. Analyse this fact-find and give exactly four clearly labelled sections.

ADVICE RULES:
LIFE INSURANCE: If mortgage, primary goal = pay it off (decreasing for repayment; level for interest-only). After mortgage cleared, remaining outgoings = total outgoings MINUS mortgage payment. Check if surviving partner income covers remaining outgoings with £500 buffer. If shortfall, recommend FIB per person. No mortgage + renting = FIB on total outgoings. Single no dependants = NO standalone life insurance.
INCOME PROTECTION: Max = 60% gross (tax free). Amount = outgoings minus partner take-home. Never exceed 60% gross. Deferred as captured. Full-term own-occupation to SPA. Offer 2-year as budget option only.
CRITICAL ILLNESS: 12 months net income per person, level term. Always recommend.
FAMILY INCOME BENEFIT: Term = years until youngest reaches 21. Base = outgoings minus mortgage payment. FIB = shortfall after partner income + £500 buffer. Per person separately.
SINGLE NO DEPENDANTS: CIC and IP only — no standalone life.

OUTPUT:
1. RECOMMENDATION — products, amounts, terms, show IP and FIB working
2. EXISTING COVER ASSESSMENT
3. UNDERWRITING QUESTIONS
4. UNDERWRITING FLAGS

ENQUIRY TYPE: Income Protection (with potential Life upsell)
CLIENT: ${ff.firstName||""} ${ff.lastName||""} | DOB: ${ff.dob||"unknown"} (Age: ${age??"unknown"}) | SPA: ${spa}
Marital: ${ff.marital||"unknown"} | Occupation: ${ff.occupation||"unknown"} (${ff.empType||"employed"})
Gross: £${ff.grossIncome||0}/yr | Take-home: £${ff.takeHome||0}/month
Outgoings: £${ff.totalOutgoings||0}/month | Housing: ${ff.housing||"unknown"}
${hasMort?`Mortgage: £${ff.mortgageBalance} outstanding, ${ff.mortgageTerm} yrs, £${ff.mortgagePayment}/month, ${ff.mortgageType}`:""}
Sick pay: ${ff.sickPayType||"unknown"}${ff.sickPayDuration?` for ${ff.sickPayDuration}`:""}
Savings: ${ff.savingsLevel||"unknown"} | Health: ${ff.healthDetail||ff.healthFlag||"Nothing disclosed"}
Kids: ${hasKids?(ff.kidsAges||ff.hasKids):"None"}
${hasP?`PARTNER: ${ff.partnerFirstName||"Partner"} | DOB: ${ff.partnerDob||"unknown"} (Age: ${pAge??"unknown"}) | SPA: ${pSpa}
Partner take-home: £${ff.partnerIncome||0}/month | Contributes if off work: ${ff.partnerContrib||"unknown"}`:"PARTNER: None"}
CALCULATED IP BENEFIT: £${Math.round(ipBen)}/month | DEFERRED: ${def}
LIFE NEED: ${ff.lifeNeed||"Not assessed"} | LIFE UPSELL: ${ff.lifeUpsell||"Not discussed"}
${ff.hasLife==="Yes"?`EXISTING LIFE: ${ff.lifeProvider||"unknown"}, £${ff.lifeCoverAmount||0}, £${ff.lifePremium||0}/month`:"EXISTING LIFE: None"}`;
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  page:    {height:"100vh",background:`radial-gradient(ellipse at 20% 0%,#1a1f35 0%,${DARK} 60%)`,fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif",display:"flex",flexDirection:"column",overflow:"hidden"},
  header:  {padding:"12px 20px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:12,background:"rgba(10,15,30,0.9)",backdropFilter:"blur(10px)",flexShrink:0,zIndex:100},
  logoMk:  {width:32,height:32,background:`linear-gradient(135deg,${A},#d97706)`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:DARK,flexShrink:0},
  logoT:   {fontSize:16,fontWeight:800,color:TEXT,letterSpacing:"-0.5px"},
  logoS:   {fontSize:9,color:A,letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:700},
  modeTabs:{display:"flex",background:INNER,borderRadius:8,padding:3,gap:3},
  modeTab: (a)=>({padding:"6px 14px",fontSize:12,fontWeight:700,border:"none",borderRadius:6,cursor:"pointer",background:a?A:"transparent",color:a?DARK:TEXTD,letterSpacing:"0.04em",transition:"all 0.15s"}),
  prog:    {padding:"8px 20px",background:"rgba(17,24,39,0.7)",borderBottom:`1px solid ${BORDER}`,flexShrink:0},
  pBar:    {height:3,background:BORDERL,borderRadius:4,overflow:"hidden",marginTop:4},
  pFill:   (p)=>({height:"100%",width:`${p}%`,background:`linear-gradient(90deg,${A},${EMERALD})`,borderRadius:4,transition:"width 0.4s"}),
  tabs:    {display:"flex",borderBottom:`1px solid ${BORDER}`,background:CARD,flexShrink:0},
  tab:     (a)=>({flex:1,padding:"9px 0",fontSize:12,fontWeight:700,background:"transparent",border:"none",cursor:"pointer",color:a?A:TEXTD,borderBottom:a?`2px solid ${A}`:"2px solid transparent",letterSpacing:"0.08em",textTransform:"uppercase"}),
  body:    {display:"flex",flex:1,overflow:"hidden",minHeight:0},
  left:    {flex:1,overflowY:"auto",padding:"18px 16px 100px",minHeight:0},
  right:   {width:290,borderLeft:`1px solid ${BORDER}`,overflowY:"auto",padding:"16px 14px 80px",background:"rgba(10,15,30,0.5)",flexShrink:0,minHeight:0},
  pill:    {fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:A,background:"rgba(245,158,11,0.1)",border:`1px solid rgba(245,158,11,0.2)`,borderRadius:20,padding:"3px 10px",display:"inline-block",marginBottom:10},
  sBox:    {background:CARD,borderRadius:14,padding:"16px 18px",marginBottom:12,border:`1px solid ${BORDER}`},
  sLbl:    {fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:TEXTD,marginBottom:7},
  sTxt:    {fontSize:16,color:TEXT,lineHeight:1.75,fontWeight:500},
  sSub:    {fontSize:14,color:TEXTM,lineHeight:1.7,marginTop:10,paddingTop:10,borderTop:`1px solid ${BORDER}`},
  infoBox: {background:"rgba(245,158,11,0.07)",border:`1px solid rgba(245,158,11,0.2)`,borderRadius:10,padding:"11px 13px",marginBottom:12,fontSize:13,color:"#fcd34d",lineHeight:1.6},
  noteBox: {background:"rgba(59,130,246,0.07)",border:`1px solid rgba(59,130,246,0.2)`,borderRadius:10,padding:"11px 13px",marginBottom:12,fontSize:13,color:"#93c5fd",lineHeight:1.6},
  oGrid:   {display:"grid",gap:8,marginBottom:12},
  oBtn:    (a)=>({background:a?"rgba(245,158,11,0.12)":INNER,border:`1.5px solid ${a?A:BORDERL}`,borderRadius:10,padding:"12px 14px",fontSize:14,fontWeight:600,color:a?A:TEXTM,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:9,transition:"all 0.15s"}),
  oDot:    (a)=>({width:7,height:7,borderRadius:"50%",background:a?A:BORDERL,flexShrink:0}),
  iGroup:  {marginBottom:10},
  lbl:     {fontSize:12,fontWeight:600,color:TEXTD,marginBottom:5,display:"block",letterSpacing:"0.03em"},
  inp:     {background:INNER,border:`1.5px solid ${BORDERL}`,borderRadius:9,color:TEXT,padding:"10px 12px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit",WebkitAppearance:"none",appearance:"none"},
  sel:     {background:INNER,border:`1.5px solid ${BORDERL}`,borderRadius:9,color:TEXT,padding:"10px 12px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit",WebkitAppearance:"none",appearance:"none",cursor:"pointer"},
  nBtn:    {background:`linear-gradient(135deg,${A},#d97706)`,border:"none",borderRadius:10,color:DARK,fontSize:14,fontWeight:800,padding:"13px 20px",cursor:"pointer",width:"100%",letterSpacing:"0.02em",marginTop:4},
  gBtn:    {background:`linear-gradient(135deg,${A},#d97706)`,border:"none",borderRadius:11,color:DARK,fontSize:15,fontWeight:800,padding:"16px",cursor:"pointer",width:"100%",letterSpacing:"0.02em",boxShadow:`0 8px 24px rgba(245,158,11,0.2)`},
  bkBtn:   {background:"transparent",border:`1px solid ${BORDERL}`,borderRadius:7,color:TEXTD,fontSize:11,fontWeight:600,padding:"5px 10px",cursor:"pointer"},
  // FF panel
  ffT:     {fontSize:11,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:A,marginBottom:12},
  ffSec:   {marginBottom:14},
  ffSecT:  {fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:TEXTD,marginBottom:6,paddingBottom:4,borderBottom:`1px solid ${BORDER}`},
  ffRow:   {display:"flex",justifyContent:"space-between",gap:8,marginBottom:4},
  ffK:     {fontSize:12,color:TEXTD,fontWeight:500,flexShrink:0},
  ffV:     {fontSize:12,color:TEXT,fontWeight:600,textAlign:"right"},
  ffEmpty: {fontSize:12,color:BORDERL,fontStyle:"italic"},
  // Output
  outBox:  {background:CARD,borderRadius:14,padding:"18px 20px",border:`1px solid ${BORDER}`,marginTop:12},
  outH:    {fontSize:15,fontWeight:800,color:TEXT,margin:"0 0 2px 0"},
  outSub:  {fontSize:10,color:A,fontWeight:700,letterSpacing:"0.1em",margin:"0 0 12px 0"},
  pre:     {fontSize:13,lineHeight:1.85,color:TEXTM,whiteSpace:"pre-wrap",fontFamily:"inherit",margin:0},
  spin:    {display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:28,color:TEXTD,fontSize:14},
  err:     {background:"rgba(244,63,94,0.1)",border:`1px solid rgba(244,63,94,0.2)`,borderRadius:10,padding:12,color:ROSE,fontSize:13},
  // Editor
  edWrap:  {display:"flex",flex:1,overflow:"hidden",minHeight:0},
  edLeft:  {width:280,borderRight:`1px solid ${BORDER}`,overflowY:"auto",padding:"16px 12px",background:CARD,flexShrink:0,minHeight:0},
  edRight: {flex:1,overflowY:"auto",padding:"20px 24px 80px",minHeight:0},
  edStepBtn:(a,type)=>({width:"100%",textAlign:"left",background:a?`rgba(245,158,11,0.12)`:type==="generate"?"rgba(16,185,129,0.08)":type==="info"?"rgba(59,130,246,0.08)":INNER,border:`1px solid ${a?A:BORDER}`,borderRadius:10,padding:"10px 12px",marginBottom:6,cursor:"pointer",color:a?A:TEXTM,fontSize:13,fontWeight:600}),
  edCard:  {background:CARD,borderRadius:14,padding:"20px 22px",marginBottom:16,border:`1px solid ${BORDER}`},
  edH:     {fontSize:13,fontWeight:700,color:TEXT,marginBottom:14},
  edLbl:   {fontSize:11,fontWeight:600,color:TEXTD,marginBottom:5,display:"block",letterSpacing:"0.04em",textTransform:"uppercase"},
  edInp:   {background:INNER,border:`1px solid ${BORDERL}`,borderRadius:8,color:TEXT,padding:"9px 11px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit"},
  edTa:    {background:INNER,border:`1px solid ${BORDERL}`,borderRadius:8,color:TEXT,padding:"9px 11px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit",minHeight:72,resize:"vertical"},
  edSel:   {background:INNER,border:`1px solid ${BORDERL}`,borderRadius:8,color:TEXT,padding:"9px 11px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit",cursor:"pointer"},
  edOptRow:{display:"flex",gap:6,marginBottom:6,alignItems:"center"},
  addBtn:  {background:"transparent",border:`1px dashed ${BORDERL}`,borderRadius:8,color:TEXTD,fontSize:12,fontWeight:600,padding:"7px 12px",cursor:"pointer",width:"100%",marginTop:4},
  delBtn:  {background:"rgba(244,63,94,0.1)",border:`1px solid rgba(244,63,94,0.2)`,borderRadius:6,color:ROSE,fontSize:11,fontWeight:700,padding:"4px 8px",cursor:"pointer",flexShrink:0},
  saveBtn: {background:EMERALD,border:"none",borderRadius:9,color:DARK,fontSize:13,fontWeight:800,padding:"10px 20px",cursor:"pointer",letterSpacing:"0.02em"},
  resetBtn:{background:"rgba(244,63,94,0.1)",border:`1px solid rgba(244,63,94,0.2)`,borderRadius:9,color:ROSE,fontSize:12,fontWeight:700,padding:"10px 16px",cursor:"pointer"},
  badge:   (c)=>({fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",background:c+"15",border:`1px solid ${c}30`,color:c,borderRadius:20,padding:"2px 8px",flexShrink:0}),
};

// ── FF SUMMARY ────────────────────────────────────────────────────────────────
function FFSummary({ff}) {
  const rows=[
    {s:"Client",items:[{k:"Name",v:ff.firstName?`${ff.firstName} ${ff.lastName||""}`.trim():null},{k:"DOB",v:ff.dob},{k:"Marital",v:ff.marital}]},
    {s:"Work & Income",items:[{k:"Occupation",v:ff.occupation},{k:"Employment",v:ff.empType},{k:"Gross",v:ff.grossIncome?`£${Number(ff.grossIncome).toLocaleString()}/yr`:null},{k:"Take-home",v:ff.takeHome?fmtM(ff.takeHome):null}]},
    {s:"Finances",items:[{k:"Housing",v:ff.housing},{k:"Outgoings",v:ff.totalOutgoings?fmtM(ff.totalOutgoings):null},{k:"Mortgage",v:ff.mortgageBalance?fmt(ff.mortgageBalance):null},{k:"Mrt. pmt",v:ff.mortgagePayment?fmtM(ff.mortgagePayment):null}]},
    {s:"Partner",items:[{k:"Name",v:ff.partnerFirstName},{k:"Income",v:ff.partnerIncome?fmtM(ff.partnerIncome):null},{k:"Contributes?",v:ff.partnerContrib}]},
    {s:"Children",items:[{k:"Kids",v:ff.hasKids==="No children"?"None":ff.hasKids||null},{k:"Ages",v:ff.kidsAges}]},
    {s:"Health",items:[{k:"Health",v:ff.healthFlag},{k:"Detail",v:ff.healthDetail}]},
    {s:"IP Details",items:[{k:"Sick pay",v:ff.sickPayType},{k:"Duration",v:ff.sickPayDuration},{k:"Savings",v:ff.savingsLevel},{k:"Deferred",v:ff.deferredConfirm}]},
    {s:"Life Cover",items:[{k:"Life need",v:ff.lifeNeed},{k:"Has life?",v:ff.hasLife},{k:"Provider",v:ff.lifeProvider},{k:"Upsell",v:ff.lifeUpsell}]},
  ];
  const hasAny=Object.values(ff).some(Boolean);
  return (
    <div>
      <p style={S.ffT}>📋 Live Fact-Find</p>
      {!hasAny&&<p style={S.ffEmpty}>Populates as you go through the call…</p>}
      {rows.map(({s,items})=>{
        const filled=items.filter(i=>i.v);
        if(!filled.length)return null;
        return <div key={s} style={S.ffSec}><p style={S.ffSecT}>{s}</p>{filled.map(({k,v})=><div key={k} style={S.ffRow}><span style={S.ffK}>{k}</span><span style={S.ffV}>{String(v)}</span></div>)}</div>;
      })}
    </div>
  );
}

// ── STEP CONTROLS ─────────────────────────────────────────────────────────────
function StepControls({step,ff,onAnswer,onInputNext}) {
  const [sel,setSel]=useState(null);
  const [inputs,setInputs]=useState({});
  function enrich(text) {
    if(!text)return text;
    const def=ff.sickPayDuration||(ff.savingsLevel==="3+ months worth"?"3 months":"1 month");
    const out=parseFloat(ff.totalOutgoings)||0;
    const pInc=parseFloat(ff.partnerIncome)||0;
    const g=(parseFloat(ff.grossIncome)||0)*0.6/12;
    const ipBen=ff.partnerContrib==="Partner would contribute"?Math.min(Math.max(0,out-pInc),g):Math.min(out,g);
    const dReason=ff.sickPayDuration
      ?`that way the policy kicks in exactly when your sick pay runs out, keeping the premium as low as possible`
      :ff.savingsLevel==="3+ months worth"
        ?`your savings can cover you for the first 3 months, so a longer wait makes the premium considerably cheaper`
        :`as you don't have sick pay or significant savings, you want this to start as soon as possible`;
    return text
      .replace(/\[firstName\]/g,ff.firstName||"[name]")
      .replace(/\[housingLabel\]/g,ff.housing==="Mortgage"?"mortgage":"rent")
      .replace(/\[housingCost\]/g,ff.mortgagePayment?fmtM(ff.mortgagePayment):ff.totalOutgoings?fmtM(ff.totalOutgoings):"[amount]")
      .replace(/\[outgoings\]/g,ff.totalOutgoings?fmtM(ff.totalOutgoings):"[outgoings]")
      .replace(/\[benefit\]/g,ipBen?fmtM(ipBen):"[benefit]")
      .replace(/\[DEFERRED\]/g,def)
      .replace(/\[DEFERRED_REASON\]/g,dReason);
  }
  if(step.type==="info") return (
    <div>
      {step.note&&<div style={S.noteBox}>💡 {step.note}</div>}
      <button style={S.nBtn} onClick={()=>onAnswer(null,resolveNext(step.next,null,step,ff))}>Continue →</button>
    </div>
  );
  if(step.type==="generate") return (
    <div>
      <div style={S.infoBox}>✅ All information captured. Tap below to generate the full LifeLogic advice report.</div>
      <button style={S.gBtn} onClick={()=>onAnswer("generate",null)}>⚡ Generate Advice Report</button>
    </div>
  );
  if(step.type==="tap") return (
    <div>
      <div style={S.oGrid}>
        {step.options.map(opt=>(
          <button key={opt} style={S.oBtn(sel===opt)} onClick={()=>setSel(opt)}>
            <span style={S.oDot(sel===opt)}/>{opt}
          </button>
        ))}
      </div>
      {sel&&<button style={S.nBtn} onClick={()=>{const next=resolveNext(step.next,sel,step,ff);onAnswer(sel,next);setSel(null);}}>Continue →</button>}
    </div>
  );
  if(step.type==="input") return (
    <div>
      {step.inputs?.map(inp=>(
        <div key={inp.key} style={S.iGroup}>
          <label style={S.lbl}>{inp.label}</label>
          {inp.type==="select"
            ?<select style={S.sel} value={inputs[inp.key]||""} onChange={e=>setInputs(p=>({...p,[inp.key]:e.target.value}))}><option value="">Select…</option>{inp.options?.map(o=><option key={o}>{o}</option>)}</select>
            :<input style={S.inp} type={inp.inputType||"text"} placeholder={inp.placeholder||""} value={inputs[inp.key]||""} onChange={e=>setInputs(p=>({...p,[inp.key]:e.target.value}))} />
          }
        </div>
      ))}
      <button style={S.nBtn} onClick={()=>{onInputNext(inputs,resolveNext(step.next,null,step,ff));setInputs({});}}>Continue →</button>
    </div>
  );
  return null;
}

// ── NEXT STEP BUILDER ─────────────────────────────────────────────────────────
// Parses the next string into visual rules and back
function parseRules(nextStr) {
  if (!nextStr) return [{ type:"always", dest:"null" }];
  const parts = nextStr.split("|").map(p=>p.trim());
  return parts.map(part => {
    if (part.startsWith("ALWAYS:")) return { type:"always", dest:part.replace("ALWAYS:","") };
    if (part.startsWith("ELSE:")) return { type:"else", dest:part.replace("ELSE:","") };
    if (part.startsWith("IF:")) {
      const body = part.replace("IF:","");
      const firstColon = body.indexOf(":");
      const condition = body.slice(0, firstColon);
      const dest = body.slice(firstColon+1);
      if (condition.startsWith("options[")) {
        const idx = parseInt(condition.match(/\[(\d+)\]/)?.[1]??0);
        return { type:"if_option", optionIndex:idx, dest };
      }
      if (condition.includes("!=")) {
        const [key,val] = condition.split("!=");
        return { type:"if_ff_not", ffKey:key.trim(), ffVal:val.trim(), dest };
      }
      if (condition.includes("=")) {
        const [key,val] = condition.split("=");
        return { type:"if_ff", ffKey:key.trim(), ffVal:val.trim(), dest };
      }
    }
    return { type:"always", dest:"null" };
  });
}

function rulesToString(rules) {
  return rules.map(r => {
    if (r.type==="always") return `ALWAYS:${r.dest||"null"}`;
    if (r.type==="else") return `ELSE:${r.dest||"null"}`;
    if (r.type==="if_option") return `IF:options[${r.optionIndex??0}]:${r.dest||"null"}`;
    if (r.type==="if_ff") return `IF:${r.ffKey}=${r.ffVal}:${r.dest||"null"}`;
    if (r.type==="if_ff_not") return `IF:${r.ffKey}!=${r.ffVal}:${r.dest||"null"}`;
    return "";
  }).filter(Boolean).join("|");
}

// Known FF keys for dropdown
const FF_KEYS = ["marital","empType","housing","hasKids","healthFlag","sickPayType","sickPayDuration","savingsLevel","benefitConfirm","partnerContrib","deferredConfirm","lifeNeed","hasLife","lifeUpsell","affordability","quotePreference"];

function NextStepBuilder({ step, allSteps, update }) {
  const stepIds = allSteps.map(s=>s.id);
  const [rules, setRules] = useState(()=>parseRules(step.next));

  // Sync when step changes
  useState(()=>{ setRules(parseRules(step.next)); });

  function updateRules(newRules) {
    setRules(newRules);
    update("next", rulesToString(newRules));
  }

  function updateRule(i, field, val) {
    const r = [...rules];
    r[i] = { ...r[i], [field]:val };
    updateRules(r);
  }

  function addRule(type) {
    updateRules([...rules, type==="else"
      ? { type:"else", dest:"null" }
      : type==="if_option"
        ? { type:"if_option", optionIndex:0, dest:"null" }
        : { type:"if_ff", ffKey:"marital", ffVal:"", dest:"null" }
    ]);
  }

  function removeRule(i) { updateRules(rules.filter((_,idx)=>idx!==i)); }

  const ruleTypeLabels = { always:"Always go to", else:"Otherwise go to", if_option:"If customer picks option", if_ff:"If fact-find field equals", if_ff_not:"If fact-find field does NOT equal" };
  const ruleColors = { always:EMERALD, else:TEXTD, if_option:A, if_ff:BLUE, if_ff_not:ROSE };

  return (
    <div>
      <p style={{fontSize:12,color:TEXTD,marginBottom:12,lineHeight:1.5}}>
        Rules are checked top to bottom. First match wins. Add an <strong style={{color:TEXTD}}>"Otherwise"</strong> rule at the bottom as a fallback.
      </p>

      {rules.map((rule, i) => (
        <div key={i} style={{background:INNER,border:`1px solid ${ruleColors[rule.type]||BORDERL}22`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:11,fontWeight:700,color:ruleColors[rule.type]||TEXTD,letterSpacing:"0.08em",textTransform:"uppercase"}}>{ruleTypeLabels[rule.type]}</span>
            <button style={S.delBtn} onClick={()=>removeRule(i)}>✕</button>
          </div>

          {/* If option — pick which option number */}
          {rule.type==="if_option"&&(
            <div style={{marginBottom:10}}>
              <label style={S.edLbl}>Which option triggers this?</label>
              <select style={S.edSel} value={rule.optionIndex??0} onChange={e=>updateRule(i,"optionIndex",parseInt(e.target.value))}>
                {(step.options||[]).map((opt,idx)=>(
                  <option key={idx} value={idx}>Option {idx+1}: "{opt}"</option>
                ))}
                {(step.options||[]).length===0&&<option value={0}>No options defined yet</option>}
              </select>
            </div>
          )}

          {/* If FF field */}
          {(rule.type==="if_ff"||rule.type==="if_ff_not")&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <div>
                <label style={S.edLbl}>Fact-find field</label>
                <select style={S.edSel} value={rule.ffKey||""} onChange={e=>updateRule(i,"ffKey",e.target.value)}>
                  {FF_KEYS.map(k=><option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label style={S.edLbl}>{rule.type==="if_ff"?"Equals":"Does NOT equal"}</label>
                <input style={S.edInp} value={rule.ffVal||""} placeholder="value to check" onChange={e=>updateRule(i,"ffVal",e.target.value)} />
              </div>
            </div>
          )}

          {/* Destination */}
          <div>
            <label style={S.edLbl}>Go to step</label>
            <select style={{...S.edSel,borderColor:ruleColors[rule.type]+"40"}} value={rule.dest||"null"} onChange={e=>updateRule(i,"dest",e.target.value)}>
              <option value="null">— End the call flow —</option>
              {stepIds.map(id=><option key={id} value={id}>{id}</option>)}
            </select>
          </div>
        </div>
      ))}

      {/* Add rule buttons */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
        <button style={{...S.addBtn,fontSize:11}} onClick={()=>addRule("always")}>+ Always go to…</button>
        <button style={{...S.addBtn,fontSize:11,borderColor:TEXTD+"50",color:TEXTD}} onClick={()=>addRule("else")}>+ Otherwise go to…</button>
        <button style={{...S.addBtn,fontSize:11,borderColor:A+"50",color:A}} onClick={()=>addRule("if_option")}>+ If option selected…</button>
        <button style={{...S.addBtn,fontSize:11,borderColor:BLUE+"50",color:BLUE}} onClick={()=>addRule("if_ff")}>+ If fact-find equals…</button>
        <button style={{...S.addBtn,fontSize:11,borderColor:ROSE+"50",color:ROSE,gridColumn:"span 2"}} onClick={()=>addRule("if_ff_not")}>+ If fact-find does NOT equal…</button>
      </div>

      {/* Preview */}
      <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 12px",marginTop:12,fontSize:11,color:BORDERL,fontFamily:"monospace",wordBreak:"break-all"}}>
        {rulesToString(rules)||"No rules defined"}
      </div>
    </div>
  );
}

// ── EDITOR COMPONENT ──────────────────────────────────────────────────────────
function Editor({steps,onSave,onReset}) {
  const [selId,setSelId]=useState(steps[0]?.id||null);
  const [edited,setEdited]=useState(()=>JSON.parse(JSON.stringify(steps)));
  const [saved,setSaved]=useState(false);

  const step=edited.find(s=>s.id===selId);

  function update(field,val) {
    setEdited(p=>p.map(s=>s.id===selId?{...s,[field]:val}:s));
  }
  function updateOption(i,val) {
    const opts=[...(step.options||[])];
    opts[i]=val;
    update("options",opts);
  }
  function addOption() { update("options",[...(step.options||[]),"New option"]); }
  function removeOption(i) { update("options",(step.options||[]).filter((_,idx)=>idx!==i)); }
  function updateInput(i,field,val) {
    const inps=[...(step.inputs||[])];
    inps[i]={...inps[i],[field]:val};
    update("inputs",inps);
  }
  function addInput() { update("inputs",[...(step.inputs||[]),{key:`field_${Date.now()}`,label:"New Field",placeholder:""}]); }
  function removeInput(i) { update("inputs",(step.inputs||[]).filter((_,idx)=>idx!==i)); }

  function handleSave() {
    onSave(edited);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  }

  const typeColor={tap:A,input:BLUE,info:"#8b5cf6",generate:EMERALD};

  return (
    <div style={S.edWrap}>
      {/* Step list */}
      <div style={S.edLeft}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:A,margin:0}}>Steps ({edited.length})</p>
          <div style={{display:"flex",gap:6}}>
            <button style={{...S.saveBtn,fontSize:11,padding:"6px 10px"}} onClick={()=>{const newId=`step_${Date.now()}`;const newStep={id:newId,section:"Situation",script:"New step script",type:"tap",options:["Option 1","Option 2"],note:"",next:"ALWAYS:null"};setEdited(p=>[...p,newStep]);setSelId(newId);}}>+ Add</button>
            <button style={S.resetBtn} onClick={()=>{if(window.confirm("Reset all steps to defaults?"))onReset();}}>Reset</button>
          </div>
        </div>
        {edited.map((s,i)=>(
          <button key={s.id} style={S.edStepBtn(selId===s.id,s.type)} onClick={()=>setSelId(s.id)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6,marginBottom:2}}>
              <span style={{fontSize:11,color:TEXTD,fontWeight:500}}>{i+1}. {s.section}</span>
              <span style={S.badge(typeColor[s.type]||TEXTD)}>{s.type}</span>
            </div>
            <div style={{fontSize:13,color:selId===s.id?A:TEXT,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {s.id}
            </div>
          </button>
        ))}
      </div>

      {/* Step editor */}
      <div style={S.edRight}>
        {!step ? <p style={{color:TEXTD}}>Select a step to edit</p> : (
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <h2 style={{fontSize:18,fontWeight:800,color:TEXT,margin:"0 0 2px 0"}}>{step.id}</h2>
                <span style={S.badge(typeColor[step.type]||TEXTD)}>{step.type}</span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={S.resetBtn} onClick={()=>{if(window.confirm(`Delete step "${step.id}"? This cannot be undone.`)){const remaining=edited.filter(s=>s.id!==selId);setEdited(remaining);setSelId(remaining[0]?.id||null);}}}>🗑 Delete Step</button>
                <button style={S.saveBtn} onClick={handleSave}>{saved?"✓ Saved!":"Save Changes"}</button>
              </div>
            </div>

            {/* Basic fields */}
            <div style={S.edCard}>
              <p style={S.edH}>Basic Info</p>
              <div style={S.iGroup}>
                <label style={S.edLbl}>Step ID</label>
                <input style={S.edInp} value={step.id} onChange={e=>update("id",e.target.value)} />
              </div>
              <div style={S.iGroup}>
                <label style={S.edLbl}>Section</label>
                <select style={S.edSel} value={step.section} onChange={e=>update("section",e.target.value)}>
                  {SECTIONS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={S.iGroup}>
                <label style={S.edLbl}>Type</label>
                <select style={S.edSel} value={step.type} onChange={e=>update("type",e.target.value)}>
                  {["tap","input","info","generate"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={S.iGroup}>
                <label style={S.edLbl}>FF Key (what to store answer as)</label>
                <input style={S.edInp} value={step.ffKey||""} placeholder="e.g. marital, empType" onChange={e=>update("ffKey",e.target.value)} />
              </div>
            </div>

            {/* Script */}
            <div style={S.edCard}>
              <p style={S.edH}>Script</p>
              <div style={S.iGroup}>
                <label style={S.edLbl}>Main Script (what to say)</label>
                <textarea style={S.edTa} value={step.script||""} onChange={e=>update("script",e.target.value)} />
                <p style={{fontSize:11,color:TEXTD,marginTop:4}}>Variables: [firstName] [housingLabel] [housingCost] [outgoings] [benefit] [DEFERRED] [DEFERRED_REASON]</p>
              </div>
              <div style={S.iGroup}>
                <label style={S.edLbl}>Sub-script (shown below main, optional)</label>
                <textarea style={{...S.edTa,minHeight:52}} value={step.subScript||""} onChange={e=>update("subScript",e.target.value)} />
              </div>
              <div style={S.iGroup}>
                <label style={S.edLbl}>Adviser Note (shown in blue, not read aloud)</label>
                <input style={S.edInp} value={step.note||""} placeholder="e.g. Only ask if client has kids" onChange={e=>update("note",e.target.value)} />
              </div>
            </div>

            {/* Options (tap type) */}
            {step.type==="tap"&&(
              <div style={S.edCard}>
                <p style={S.edH}>Tap Options</p>
                {(step.options||[]).map((opt,i)=>(
                  <div key={i} style={S.edOptRow}>
                    <input style={S.edInp} value={opt} onChange={e=>updateOption(i,e.target.value)} />
                    <button style={S.delBtn} onClick={()=>removeOption(i)}>✕</button>
                  </div>
                ))}
                <button style={S.addBtn} onClick={addOption}>+ Add option</button>
              </div>
            )}

            {/* Input fields (input type) */}
            {step.type==="input"&&(
              <div style={S.edCard}>
                <p style={S.edH}>Input Fields</p>
                {(step.inputs||[]).map((inp,i)=>(
                  <div key={i} style={{background:INNER,borderRadius:10,padding:"12px 14px",marginBottom:10,border:`1px solid ${BORDER}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:TEXTM}}>Field {i+1}</span>
                      <button style={S.delBtn} onClick={()=>removeInput(i)}>✕</button>
                    </div>
                    <div style={S.iGroup}><label style={S.edLbl}>Key (FF field name)</label><input style={S.edInp} value={inp.key} onChange={e=>updateInput(i,"key",e.target.value)} /></div>
                    <div style={S.iGroup}><label style={S.edLbl}>Label</label><input style={S.edInp} value={inp.label} onChange={e=>updateInput(i,"label",e.target.value)} /></div>
                    <div style={S.iGroup}><label style={S.edLbl}>Placeholder</label><input style={S.edInp} value={inp.placeholder||""} onChange={e=>updateInput(i,"placeholder",e.target.value)} /></div>
                    <div style={S.iGroup}><label style={S.edLbl}>Input Type</label>
                      <select style={S.edSel} value={inp.inputType||inp.type||"text"} onChange={e=>updateInput(i,"inputType",e.target.value)}>
                        {["text","number","date","select"].map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                <button style={S.addBtn} onClick={addInput}>+ Add input field</button>
              </div>
            )}

            {/* Next step logic - visual builder */}
            <div style={S.edCard}>
              <p style={S.edH}>Next Step Logic</p>
              <NextStepBuilder step={step} allSteps={edited} update={update} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [mode,setMode]=useState("live"); // "live" | "editor"
  const [steps,setSteps]=useState(()=>{
    try { const s=localStorage.getItem("ll_steps"); return s?JSON.parse(s):DEFAULT_STEPS; } catch(e){return DEFAULT_STEPS;}
  });
  const [stepId,setStepId]=useState(steps[0]?.id||"intro");
  const [ff,setFF]=useState({});
  const [history,setHistory]=useState([steps[0]?.id||"intro"]);
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState(null);
  const [tab,setTab]=useState("script");

  const step=steps.find(s=>s.id===stepId);
  const secIdx=SECTIONS.indexOf(step?.section);
  const pct=step?.type==="generate"||result?100:Math.round((secIdx/(SECTIONS.length-1))*100);

  function saveSteps(newSteps) {
    setSteps(newSteps);
    try { localStorage.setItem("ll_steps",JSON.stringify(newSteps)); } catch(e){}
  }
  function resetSteps() {
    saveSteps(DEFAULT_STEPS);
    setStepId(DEFAULT_STEPS[0].id);
    setHistory([DEFAULT_STEPS[0].id]);
  }

  function go(nextId) { if(!nextId)return; setHistory(h=>[...h,nextId]); setStepId(nextId); }

  function onAnswer(answer,nextId) {
    if(answer==="generate"){generate();return;}
    if(step?.ffKey&&answer) setFF(p=>({...p,[step.ffKey]:answer}));
    if(nextId)go(nextId);
  }
  function onInputNext(inputs,nextId) { setFF(p=>({...p,...inputs})); if(nextId)go(nextId); }

  function goBack() {
    if(history.length<=1)return;
    setHistory(h=>h.slice(0,-1));
    setStepId(history[history.length-2]);
  }

  function resetCall() {
    setStepId(steps[0]?.id||"intro");
    setFF({});
    setHistory([steps[0]?.id||"intro"]);
    setResult(null);
    setError(null);
  }

  async function generate() {
    setLoading(true);setError(null);setResult(null);
    try {
      const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:MODEL,max_tokens:1800,messages:[{role:"user",content:buildPrompt(ff)}]})});
      const data=await res.json();
      if(data.error){setError(typeof data.error==="string"?data.error:JSON.stringify(data.error));return;}
      setResult(data.content?.find(b=>b.type==="text")?.text||"No response received.");
    } catch(e){setError("Failed to generate. Check your connection.");}
    finally{setLoading(false);}
  }

  function enrichScript(text) {
    if(!text)return text;
    const def=ff.sickPayDuration||(ff.savingsLevel==="3+ months worth"?"3 months":"1 month");
    const out=parseFloat(ff.totalOutgoings)||0,pInc=parseFloat(ff.partnerIncome)||0,g=(parseFloat(ff.grossIncome)||0)*0.6/12;
    const ipBen=ff.partnerContrib==="Partner would contribute"?Math.min(Math.max(0,out-pInc),g):Math.min(out,g);
    const dR=ff.sickPayDuration?`the policy kicks in when your sick pay runs out, keeping the premium as low as possible`:ff.savingsLevel==="3+ months worth"?`your savings cover the first 3 months, making the premium considerably cheaper`:`you don't have sick pay or savings to fall back on, so you need it to start as soon as possible`;
    return text
      .replace(/\[firstName\]/g,ff.firstName||"[name]")
      .replace(/\[housingLabel\]/g,ff.housing==="Mortgage"?"mortgage":"rent")
      .replace(/\[housingCost\]/g,ff.mortgagePayment?fmtM(ff.mortgagePayment):ff.totalOutgoings?fmtM(ff.totalOutgoings):"[amount]")
      .replace(/\[outgoings\]/g,ff.totalOutgoings?fmtM(ff.totalOutgoings):"[outgoings]")
      .replace(/\[benefit\]/g,ipBen?fmtM(ipBen):"[benefit]")
      .replace(/\[DEFERRED\]/g,def)
      .replace(/\[DEFERRED_REASON\]/g,dR);
  }

  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logoMk}>LL</div>
        <div><div style={S.logoT}>LifeLogic Live</div><div style={S.logoS}>Call Companion</div></div>
        <div style={{marginLeft:16}}>
          <div style={S.modeTabs}>
            <button style={S.modeTab(mode==="live")} onClick={()=>setMode("live")}>📞 Live</button>
            <button style={S.modeTab(mode==="editor")} onClick={()=>setMode("editor")}>✏️ Editor</button>
          </div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          {mode==="live"&&<>
            {history.length>1&&!result&&<button onClick={goBack} style={S.bkBtn}>← Back</button>}
            {result&&<button onClick={resetCall} style={{...S.bkBtn,color:EMERALD,borderColor:EMERALD}}>+ New Call</button>}
            <div style={{fontSize:11,color:TEXTD,background:INNER,padding:"4px 10px",borderRadius:6,border:`1px solid ${BORDER}`,fontWeight:600}}>{step?.section||"—"}</div>
          </>}
        </div>
      </div>

      {/* PROGRESS (live mode only) */}
      {mode==="live"&&(
        <div style={S.prog}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {SECTIONS.map((s,i)=>(
                <span key={s} style={{fontSize:9,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:i<secIdx?EMERALD:i===secIdx?A:BORDERL}}>{s}</span>
              ))}
            </div>
            <span style={{fontSize:11,color:A,fontWeight:700,flexShrink:0,marginLeft:8}}>{pct}%</span>
          </div>
          <div style={S.pBar}><div style={S.pFill(pct)}/></div>
        </div>
      )}

      {/* LIVE MODE */}
      {mode==="live"&&(
        <>
          <div style={S.tabs}>
            <button style={S.tab(tab==="script")} onClick={()=>setTab("script")}>📞 Script</button>
            <button style={S.tab(tab==="ff")} onClick={()=>setTab("ff")}>📋 Fact-Find</button>
          </div>
          <div style={S.body}>
            <div style={{...S.left,display:tab==="ff"?"none":"block"}}>
              {step&&<><div style={S.pill}>{step.section}</div>
                <div style={S.sBox}>
                  <div style={S.sLbl}>SAY THIS</div>
                  <div style={S.sTxt}>{enrichScript(step.script)}</div>
                  {step.subScript&&<div style={S.sSub}>{enrichScript(step.subScript)}</div>}
                </div>
              </>}
              {step&&!result&&!loading&&<StepControls step={step} ff={ff} onAnswer={onAnswer} onInputNext={onInputNext}/>}
              {loading&&<div style={S.spin}><span style={{animation:"spin 1s linear infinite",display:"inline-block",color:A,fontSize:20}}>◌</span> Generating advice report…</div>}
              {error&&<div style={S.err}>{error}</div>}
              {result&&<div style={S.outBox}><p style={S.outH}>Advice Report</p><p style={S.outSub}>GENERATED BY LIFELOGIC AI</p><hr style={{border:"none",borderTop:`1px solid ${BORDER}`,margin:"0 0 12px 0"}}/><pre style={S.pre}>{result}</pre></div>}
            </div>
            <div style={{...S.right,display:"block"}}><FFSummary ff={ff}/></div>
          </div>
        </>
      )}

      {/* EDITOR MODE */}
      {mode==="editor"&&(
        <Editor steps={steps} onSave={saveSteps} onReset={resetSteps}/>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${DARK}}
        html,body,#root{height:100%;overflow:hidden}
        select option{background:#1a2235;color:#f9fafb}
        input:focus,select:focus,textarea:focus{border-color:${A}!important;box-shadow:0 0 0 3px rgba(245,158,11,0.12)!important;outline:none}
        ::placeholder{color:#4b5563}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${BORDERL};border-radius:2px}
      `}</style>
    </div>
  );
}
