import { useState } from "react";

const A = "#f59e0b";
const DARK = "#0a0f1e";
const CARD = "#111827";
const INNER = "#1a2235";
const BORDER = "#1f2937";
const BORDERL = "#374151";
const TEXT = "#f9fafb";
const TEXTM = "#d1d5db";
const TEXTD = "#9ca3af";
const EMERALD = "#10b981";
const ROSE = "#f43f5e";
const MODEL = "claude-sonnet-4-5";

function fmt(n) { return n ? `£${Number(n).toLocaleString()}` : "—"; }
function fmtM(n) { return n ? `£${Number(n).toLocaleString()}/mo` : "—"; }
function calcAge(dob) {
  if (!dob) return null;
  const b = new Date(dob), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() - b.getMonth() < 0 || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
}
function getSPA(dob) {
  if (!dob) return 68;
  const b = new Date(dob);
  if (b < new Date(1960, 3, 6)) return 66;
  if (b < new Date(1977, 3, 6)) return 67;
  return 68;
}

const STEPS = [
  { id:"intro", section:"Introduction", script:"Hi, is that [firstName]?", subScript:"Hi [firstName], it's [Your Name] calling from First Thought Financial. You made an enquiry online about Income Protection, so I just wanted to follow up and provide some quotes. I just need to confirm a few quick bits first — is that alright?", type:"tap", options:["Yes, go ahead","Not a good time"], next:(a)=>a==="Not a good time"?"bad_time":"data_protection" },
  { id:"bad_time", section:"Introduction", script:"No problem at all — when would be a better time to call you back?", type:"info", infoNote:"Note the callback time and end the call.", next:()=>"intro" },
  { id:"data_protection", section:"Introduction", script:"Before we start, can I just confirm the first line of your address and postcode for Data Protection?", type:"input", inputs:[{key:"address",label:"Address / Postcode",placeholder:"e.g. 12 High Street, SW1A 1AA"}], next:()=>"situation_intro" },
  { id:"situation_intro", section:"Situation", script:"There are a few different types of Income Protection out there, so to make sure I'm looking at the right one for you — could you give me a brief overview of your situation and what made you look into this?", type:"info", infoNote:"Listen carefully. Note any key points before moving on.", next:()=>"marital" },
  { id:"marital", section:"Situation", script:"Are you single, or do you have a partner or spouse?", type:"tap", options:["Single","Partner / Spouse"], ffKey:"marital", next:(a)=>a==="Single"?"occupation":"partner_name" },
  { id:"partner_name", section:"Situation", script:"What's your partner's first name and date of birth?", type:"input", inputs:[{key:"partnerFirstName",label:"Partner First Name",placeholder:"Jane"},{key:"partnerDob",label:"Partner Date of Birth",placeholder:"",inputType:"date"}], next:()=>"occupation" },
  { id:"occupation", section:"Situation", script:"And what do you do for work?", type:"input", inputs:[{key:"occupation",label:"Occupation",placeholder:"e.g. Carpenter, Teacher, Project Manager"}], next:()=>"emp_type" },
  { id:"emp_type", section:"Situation", script:"And are you employed by a company, or are you self-employed?", type:"tap", options:["Employed","Self-employed","Ltd Company Director","Contractor"], ffKey:"empType", next:()=>"income" },
  { id:"income", section:"Situation", script:"What's your annual salary or income roughly, and what does that work out to take-home each month?", type:"input", inputs:[{key:"grossIncome",label:"Gross Annual Income (£)",placeholder:"50000",inputType:"number"},{key:"takeHome",label:"Monthly Take-home (£)",placeholder:"3200",inputType:"number"}], next:()=>"housing" },
  { id:"housing", section:"Situation", script:"Are you renting, or do you have a mortgage?", type:"tap", options:["Mortgage","Renting","Own outright","Living with family"], ffKey:"housing", next:(a)=>a==="Mortgage"?"mortgage_details":"outgoings" },
  { id:"mortgage_details", section:"Situation", script:"What's the outstanding balance on the mortgage, the remaining term, and the monthly payment?", type:"input", inputs:[{key:"mortgageBalance",label:"Outstanding Balance (£)",placeholder:"250000",inputType:"number"},{key:"mortgageTerm",label:"Remaining Term (years)",placeholder:"22",inputType:"number"},{key:"mortgagePayment",label:"Monthly Payment (£)",placeholder:"1200",inputType:"number"},{key:"mortgageType",label:"Repayment Type",type:"select",options:["Repayment","Interest Only","Part & Part"]}], next:()=>"outgoings" },
  { id:"outgoings", section:"Monthly Benefit", script:"You mentioned your [housingLabel] is [housingCost]. What would you say your total monthly outgoings are — including all bills, food, council tax, transport, everything?", type:"input", inputs:[{key:"totalOutgoings",label:"Total Monthly Outgoings (£)",placeholder:"3500",inputType:"number"}], next:()=>"benefit_check" },
  { id:"benefit_check", section:"Monthly Benefit", script:"So if you weren't working, would £[outgoings] per month be enough to cover everything?", type:"tap", options:["Yes, that covers it","I'd need a bit more","I could manage on less"], ffKey:"benefitConfirm", next:(a,ff)=>ff.marital==="Partner / Spouse"?"partner_contribution":"kids" },
  { id:"partner_contribution", section:"Monthly Benefit", script:"Would your partner contribute to the bills if you weren't working, or would you need to cover the full amount yourself?", type:"tap", options:["Partner would contribute","I'd need to cover it all"], ffKey:"partnerContrib", next:(a)=>a==="Partner would contribute"?"partner_income":"kids" },
  { id:"partner_income", section:"Monthly Benefit", script:"What does your partner take home each month?", type:"input", inputs:[{key:"partnerIncome",label:"Partner Monthly Take-home (£)",placeholder:"2400",inputType:"number"}], next:()=>"kids" },
  { id:"kids", section:"Situation", script:"Do you have any dependent children?", type:"tap", options:["No children","Yes — 1","Yes — 2","Yes — 3 or more"], ffKey:"hasKids", next:(a)=>a==="No children"?"health":"kids_ages" },
  { id:"kids_ages", section:"Situation", script:"How old are your children?", type:"input", inputs:[{key:"kidsAges",label:"Ages (comma separated)",placeholder:"e.g. 4, 7, 11"}], next:()=>"health" },
  { id:"health", section:"Situation", script:"Any medical conditions or health issues I should be aware of — anything your GP knows about?", type:"tap", options:["No — all clear","Yes — minor / managed","Yes — significant condition"], ffKey:"healthFlag", next:(a)=>a==="No — all clear"?"confirm_need":"health_detail" },
  { id:"health_detail", section:"Situation", script:"Can you give me a brief overview?", type:"input", inputs:[{key:"healthDetail",label:"Health Details",placeholder:"e.g. Type 2 diabetes, well controlled. No other conditions."}], next:()=>"confirm_need" },
  { id:"confirm_need", section:"Confirm Need", script:"So just to confirm — you're looking to make sure that if you're signed off work due to illness or injury, your income is replaced so you can keep covering your bills. Is that right?", type:"tap", options:["Yes, exactly","Slightly different — let me explain"], next:(a)=>a.includes("different")?"clarify_need":"explain_ip" },
  { id:"clarify_need", section:"Confirm Need", script:"Of course — what are you specifically looking to achieve?", type:"input", inputs:[{key:"needDetail",label:"Their specific need",placeholder:"Note what they said..."}], next:()=>"explain_ip" },
  { id:"explain_ip", section:"Income Protection", script:"Great. So let me quickly explain how Income Protection works — it's very straightforward.", subScript:"If you're signed off work by your GP due to illness or injury, this policy replaces your income each month until you return to work. You can claim for both physical and mental health reasons — as long as you're signed off, you're covered. Does that make sense?", type:"tap", options:["Yes, makes sense","Can you clarify?"], next:(a)=>a==="Can you clarify?"?"explain_ip_more":"waiting_intro" },
  { id:"explain_ip_more", section:"Income Protection", script:"Think of it like this — if you broke your leg and couldn't work for 3 months, the policy would pay a set monthly amount directly into your bank account, like a salary replacement. It covers anything from a broken bone to cancer to depression. As long as your doctor signs you off, you get paid.", type:"tap", options:["Got it, thanks"], next:()=>"waiting_intro" },
  { id:"waiting_intro", section:"Waiting Period", script:"Now let's look at how quickly you'd want payments to start if you were off work. The longer you can wait, the cheaper the policy — this is called the waiting period or deferred period.", type:"info", next:()=>"sick_pay_check" },
  { id:"sick_pay_check", section:"Waiting Period", script:"Do you get sick pay from your employer?", type:"tap", options:["Yes — full pay","Yes — partial / reduced","No sick pay","Self-employed — no sick pay"], ffKey:"sickPayType", next:(a)=>["Yes — full pay","Yes — partial / reduced"].includes(a)?"sick_pay_duration":"savings_check" },
  { id:"sick_pay_duration", section:"Waiting Period", script:"How long does your sick pay last?", type:"tap", options:["1 month","2 months","3 months","4–6 months","6+ months"], ffKey:"sickPayDuration", next:()=>"deferred_rec" },
  { id:"savings_check", section:"Waiting Period", script:"Do you have any savings you could rely on to tide you over if you were off work?", type:"tap", options:["No / very little","1–2 months worth","3+ months worth"], ffKey:"savingsLevel", next:()=>"deferred_rec" },
  { id:"deferred_rec", section:"Waiting Period", script:"Based on what you've told me, I'd suggest a waiting period of [DEFERRED] — [DEFERRED_REASON]. Does that sound reasonable?", type:"tap", options:["Yes, that works","I'd prefer shorter","I'd prefer longer"], ffKey:"deferredConfirm", next:()=>"summary_quote" },
  { id:"summary_quote", section:"Summary", script:"So we're looking at a policy that will pay you £[benefit] per month after [DEFERRED] if you're signed off work for any reason — physical or mental, for as long as you need it right up to your retirement. There are a number of providers so let's see who's most competitive.", type:"info", next:()=>"life_check" },
  { id:"life_check", section:"Life Cover", script:"While that's loading — just one quick thing. We're looking at what happens if you can't work, but if you passed away, would your partner or family have enough money to manage everything?", type:"tap", options:["They'd really struggle","They'd manage OK","Not applicable / no dependants"], ffKey:"lifeNeed", next:(a)=>a==="Not applicable / no dependants"?"quote_type":"existing_life" },
  { id:"existing_life", section:"Life Cover", script:"Do you already have Life Insurance in place?", type:"tap", options:["Yes","No"], ffKey:"hasLife", next:(a)=>a==="Yes"?"existing_life_detail":"quote_type" },
  { id:"existing_life_detail", section:"Life Cover", script:"Great — who's it with, what's the cover amount, and the monthly premium?", type:"input", inputs:[{key:"lifeProvider",label:"Provider",placeholder:"e.g. Aviva"},{key:"lifeCoverAmount",label:"Cover Amount (£)",placeholder:"300000",inputType:"number"},{key:"lifePremium",label:"Monthly Premium (£)",placeholder:"45",inputType:"number"}], next:()=>"quote_type" },
  { id:"quote_type", section:"Quote", script:"You've got two types of Income Protection. Option 1 pays until your retirement — no cap. Option 2 is more cost-effective — pays for up to 2 years per claim, but you can claim unlimited times as long as you've returned to work for 6 months in between. I'll get quotes for both and you can decide.", type:"tap", options:["Show me both","Full term only","2-year option only"], ffKey:"quotePreference", next:()=>"affordability" },
  { id:"affordability", section:"Quote", script:"The most competitive provider is [PROVIDER]. Is the premium going to be comfortable for you monthly?", type:"tap", options:["Yes, that's comfortable","It's a bit much — can we adjust?","Need to think about it"], ffKey:"affordability", next:(a)=>a.includes("adjust")?"budget_adjust":"close" },
  { id:"budget_adjust", section:"Quote", script:"No problem — what monthly amount would work for you? We can adjust the cover level or deferred period to bring it down.", type:"input", inputs:[{key:"budget",label:"Monthly Budget (£)",placeholder:"40",inputType:"number"}], next:()=>"close" },
  { id:"close", section:"Close", script:"Just to confirm — this is a fixed premium. It won't increase with age or after a claim. You'll also get some great benefits included with [PROVIDER] such as [LIST BENEFITS].", subScript:"The next step is to run through some basic medical questions to make sure they're happy to cover you — based on what you've shared this should be straightforward.", type:"tap", options:["Great, let's proceed","I have one more question"], next:()=>"life_upsell" },
  { id:"life_upsell", section:"Close", script:"Before we get to those — would you like me to also show you what it would cost to add Life Insurance? A few providers give multi-product discounts so it can work out better value doing both together.", type:"tap", options:["Yes, show me","No thanks — just IP for now"], ffKey:"lifeUpsell", next:()=>"generate" },
  { id:"generate", section:"Advice", script:"All the information has been captured. Ready to generate the full LifeLogic advice report?", type:"generate", next:()=>null },
];

const SECTIONS = ["Introduction","Situation","Confirm Need","Income Protection","Monthly Benefit","Waiting Period","Summary","Life Cover","Quote","Close","Advice"];

function buildPrompt(ff) {
  const age = calcAge(ff.dob);
  const spa = getSPA(ff.dob);
  const partnerAge = calcAge(ff.partnerDob);
  const partnerSpa = getSPA(ff.partnerDob);
  const hasPartner = ff.marital === "Partner / Spouse";
  const hasMortgage = ff.housing === "Mortgage";
  const hasKids = ff.hasKids && ff.hasKids !== "No children";
  const gross60 = (parseFloat(ff.grossIncome)||0)*0.6/12;
  const outgoings = parseFloat(ff.totalOutgoings)||0;
  const partnerInc = parseFloat(ff.partnerIncome)||0;
  const ipBenefit = hasPartner && ff.partnerContrib==="Partner would contribute"
    ? Math.min(Math.max(0, outgoings-partnerInc), gross60)
    : Math.min(outgoings, gross60);
  const deferred = ff.sickPayDuration||( ff.savingsLevel==="3+ months worth"?"3 months":"1 month");

  return `You are an expert UK protection insurance adviser. Analyse this fact-find and give exactly four clearly labelled sections.

ADVICE RULES:
LIFE INSURANCE: If mortgage, primary goal = pay it off (decreasing for repayment; level for interest-only). After mortgage cleared, remaining outgoings = total outgoings MINUS mortgage payment. Check if surviving partner income covers remaining outgoings with £500/month buffer. If shortfall, recommend FIB per person. No mortgage + renting = FIB on total outgoings. Single no dependants = NO standalone life insurance.
INCOME PROTECTION: Max = 60% gross (tax free). Amount = outgoings minus partner take-home (shortfall if person can't work). Never exceed 60% gross. Deferred as captured. Full-term own-occupation to SPA. NEVER lead with 2-year IP.
CRITICAL ILLNESS: 12 months net income per person, level term. Always recommend.
FAMILY INCOME BENEFIT: Term = years until youngest reaches 21. Base = outgoings minus mortgage payment. FIB = shortfall after partner income + £500 buffer.
SINGLE NO DEPENDANTS: CIC and IP only.

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
${hasMortgage?`Mortgage: £${ff.mortgageBalance} outstanding, ${ff.mortgageTerm} yrs, £${ff.mortgagePayment}/month, ${ff.mortgageType}`:""}
Sick pay: ${ff.sickPayType||"unknown"}${ff.sickPayDuration?` for ${ff.sickPayDuration}`:""}
Savings: ${ff.savingsLevel||"unknown"}
Health: ${ff.healthDetail||ff.healthFlag||"Nothing disclosed"}
Kids: ${hasKids?(ff.kidsAges||ff.hasKids):"None"}
${hasPartner?`PARTNER: ${ff.partnerFirstName||"Partner"} | DOB: ${ff.partnerDob||"unknown"} (Age: ${partnerAge??"unknown"}) | SPA: ${partnerSpa}
Partner take-home: £${ff.partnerIncome||0}/month | Contributes if client off: ${ff.partnerContrib||"unknown"}`:"PARTNER: None"}
CALCULATED IP BENEFIT: £${Math.round(ipBenefit)}/month | DEFERRED: ${deferred}
LIFE NEED: ${ff.lifeNeed||"Not assessed"} | LIFE UPSELL: ${ff.lifeUpsell||"Not discussed"}
${ff.hasLife==="Yes"?`EXISTING LIFE: ${ff.lifeProvider||"unknown"}, £${ff.lifeCoverAmount||0}, £${ff.lifePremium||0}/month`:"EXISTING LIFE: None"}`;
}

const S = {
  page:    { height:"100vh", background:`radial-gradient(ellipse at 20% 0%, #1a1f35 0%, ${DARK} 60%)`, fontFamily:"'Plus Jakarta Sans', -apple-system, sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" },
  header:  { padding:"14px 20px", borderBottom:`1px solid ${BORDER}`, display:"flex", alignItems:"center", gap:12, background:"rgba(10,15,30,0.9)", backdropFilter:"blur(10px)", position:"sticky", top:0, zIndex:100, flexShrink:0 },
  logoMark:{ width:34, height:34, background:`linear-gradient(135deg,${A},#d97706)`, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:DARK, flexShrink:0 },
  logoText:{ fontSize:17, fontWeight:800, color:TEXT, letterSpacing:"-0.5px" },
  logoSub: { fontSize:9, color:A, letterSpacing:"0.15em", textTransform:"uppercase", fontWeight:700 },
  progress:{ padding:"10px 20px", background:"rgba(17,24,39,0.7)", borderBottom:`1px solid ${BORDER}`, flexShrink:0 },
  pBar:    { height:3, background:BORDERL, borderRadius:4, overflow:"hidden", marginTop:6 },
  pFill:   (p)=>({ height:"100%", width:`${p}%`, background:`linear-gradient(90deg,${A},${EMERALD})`, borderRadius:4, transition:"width 0.4s ease" }),
  tabs:    { display:"flex", borderBottom:`1px solid ${BORDER}`, background:CARD, flexShrink:0 },
  tab:     (a)=>({ flex:1, padding:"10px 0", fontSize:12, fontWeight:700, background:"transparent", border:"none", cursor:"pointer", color:a?A:TEXTD, borderBottom:a?`2px solid ${A}`:"2px solid transparent", letterSpacing:"0.08em", textTransform:"uppercase" }),
  body:    { display:"flex", flex:1, overflow:"hidden", minHeight:0 },
  left:    { flex:1, overflowY:"auto", padding:"20px 18px 120px", minHeight:0 },
  right:   { width:300, borderLeft:`1px solid ${BORDER}`, overflowY:"auto", padding:"18px 16px 80px", background:"rgba(10,15,30,0.5)", flexShrink:0, minHeight:0 },
  pill:    { fontSize:10, fontWeight:700, letterSpacing:"0.15em", textTransform:"uppercase", color:A, background:"rgba(245,158,11,0.1)", border:`1px solid rgba(245,158,11,0.2)`, borderRadius:20, padding:"4px 12px", display:"inline-block", marginBottom:12 },
  sBox:    { background:CARD, borderRadius:14, padding:"18px 20px", marginBottom:14, border:`1px solid ${BORDER}` },
  sLbl:    { fontSize:10, fontWeight:700, letterSpacing:"0.15em", textTransform:"uppercase", color:TEXTD, marginBottom:8 },
  sTxt:    { fontSize:16, color:TEXT, lineHeight:1.75, fontWeight:500 },
  sSub:    { fontSize:14, color:TEXTM, lineHeight:1.7, marginTop:10, paddingTop:10, borderTop:`1px solid ${BORDER}` },
  infoBox: { background:"rgba(245,158,11,0.07)", border:`1px solid rgba(245,158,11,0.2)`, borderRadius:10, padding:"12px 14px", marginBottom:14, fontSize:13, color:"#fcd34d", lineHeight:1.6 },
  oGrid:   { display:"grid", gap:9, marginBottom:14 },
  oBtn:    (a)=>({ background:a?"rgba(245,158,11,0.12)":INNER, border:`1.5px solid ${a?A:BORDERL}`, borderRadius:11, padding:"13px 16px", fontSize:14, fontWeight:600, color:a?A:TEXTM, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:10 }),
  oDot:    (a)=>({ width:8, height:8, borderRadius:"50%", background:a?A:BORDERL, flexShrink:0 }),
  iGroup:  { marginBottom:12 },
  lbl:     { fontSize:12, fontWeight:600, color:TEXTD, marginBottom:5, display:"block", letterSpacing:"0.03em" },
  inp:     { background:INNER, border:`1.5px solid ${BORDERL}`, borderRadius:10, color:TEXT, padding:"11px 13px", fontSize:15, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit", WebkitAppearance:"none", appearance:"none" },
  sel:     { background:INNER, border:`1.5px solid ${BORDERL}`, borderRadius:10, color:TEXT, padding:"11px 13px", fontSize:15, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit", WebkitAppearance:"none", appearance:"none", cursor:"pointer" },
  nBtn:    { background:`linear-gradient(135deg,${A},#d97706)`, border:"none", borderRadius:11, color:DARK, fontSize:15, fontWeight:800, padding:"14px 24px", cursor:"pointer", width:"100%", letterSpacing:"0.02em", marginTop:4 },
  gBtn:    { background:`linear-gradient(135deg,${A},#d97706)`, border:"none", borderRadius:12, color:DARK, fontSize:16, fontWeight:800, padding:"17px", cursor:"pointer", width:"100%", letterSpacing:"0.02em", boxShadow:`0 8px 24px rgba(245,158,11,0.2)` },
  bkBtn:   { background:"transparent", border:`1px solid ${BORDERL}`, borderRadius:8, color:TEXTD, fontSize:12, fontWeight:600, padding:"6px 12px", cursor:"pointer" },
  ffTitle: { fontSize:11, fontWeight:700, letterSpacing:"0.15em", textTransform:"uppercase", color:A, marginBottom:14 },
  ffSec:   { marginBottom:16 },
  ffSecT:  { fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:TEXTD, marginBottom:7, paddingBottom:5, borderBottom:`1px solid ${BORDER}` },
  ffRow:   { display:"flex", justifyContent:"space-between", gap:8, marginBottom:5 },
  ffK:     { fontSize:12, color:TEXTD, fontWeight:500, flexShrink:0 },
  ffV:     { fontSize:12, color:TEXT, fontWeight:600, textAlign:"right" },
  ffEmpty: { fontSize:12, color:BORDERL, fontStyle:"italic" },
  outBox:  { background:CARD, borderRadius:14, padding:"18px 20px", border:`1px solid ${BORDER}`, marginTop:14 },
  outH:    { fontSize:15, fontWeight:800, color:TEXT, margin:"0 0 3px 0" },
  outSub:  { fontSize:10, color:A, fontWeight:700, letterSpacing:"0.1em", margin:"0 0 14px 0" },
  pre:     { fontSize:13, lineHeight:1.85, color:TEXTM, whiteSpace:"pre-wrap", fontFamily:"inherit", margin:0 },
  spin:    { display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:30, color:TEXTD, fontSize:14 },
  err:     { background:"rgba(244,63,94,0.1)", border:`1px solid rgba(244,63,94,0.2)`, borderRadius:12, padding:14, color:ROSE, fontSize:13 },
};

function FFSummary({ ff }) {
  const rows = [
    { s:"Client", items:[{k:"Name",v:ff.firstName?`${ff.firstName} ${ff.lastName||""}`.trim():null},{k:"DOB",v:ff.dob},{k:"Marital",v:ff.marital}] },
    { s:"Work & Income", items:[{k:"Occupation",v:ff.occupation},{k:"Employment",v:ff.empType},{k:"Gross",v:ff.grossIncome?`£${Number(ff.grossIncome).toLocaleString()}/yr`:null},{k:"Take-home",v:ff.takeHome?fmtM(ff.takeHome):null}] },
    { s:"Finances", items:[{k:"Housing",v:ff.housing},{k:"Outgoings",v:ff.totalOutgoings?fmtM(ff.totalOutgoings):null},{k:"Mortgage bal.",v:ff.mortgageBalance?fmt(ff.mortgageBalance):null},{k:"Mortgage pmt",v:ff.mortgagePayment?fmtM(ff.mortgagePayment):null}] },
    { s:"Partner", items:[{k:"Name",v:ff.partnerFirstName},{k:"DOB",v:ff.partnerDob},{k:"Income",v:ff.partnerIncome?fmtM(ff.partnerIncome):null},{k:"Contributes?",v:ff.partnerContrib}] },
    { s:"Children", items:[{k:"Kids",v:ff.hasKids==="No children"?"None":ff.hasKids||null},{k:"Ages",v:ff.kidsAges}] },
    { s:"Health", items:[{k:"Health",v:ff.healthFlag},{k:"Detail",v:ff.healthDetail}] },
    { s:"IP Details", items:[{k:"Sick pay",v:ff.sickPayType},{k:"Duration",v:ff.sickPayDuration},{k:"Savings",v:ff.savingsLevel},{k:"Deferred",v:ff.deferredConfirm}] },
    { s:"Life Cover", items:[{k:"Life need",v:ff.lifeNeed},{k:"Has life",v:ff.hasLife},{k:"Provider",v:ff.lifeProvider},{k:"Life upsell",v:ff.lifeUpsell}] },
  ];
  const hasAny = Object.values(ff).some(Boolean);
  return (
    <div>
      <p style={S.ffTitle}>📋 Live Fact-Find</p>
      {!hasAny && <p style={S.ffEmpty}>Populates as you go through the call…</p>}
      {rows.map(({s,items})=>{
        const filled = items.filter(i=>i.v);
        if (!filled.length) return null;
        return (
          <div key={s} style={S.ffSec}>
            <p style={S.ffSecT}>{s}</p>
            {filled.map(({k,v})=>(
              <div key={k} style={S.ffRow}><span style={S.ffK}>{k}</span><span style={S.ffV}>{v}</span></div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function StepControls({ step, ff, onAnswer, onInputNext }) {
  const [sel, setSel] = useState(null);
  const [inputs, setInputs] = useState({});

  function enrich(text) {
    if (!text) return text;
    const deferred = ff.sickPayDuration||(ff.savingsLevel==="3+ months worth"?"3 months":"1 month");
    const deferredReason = ff.sickPayDuration
      ? `that way the policy kicks in exactly when your sick pay runs out, and it keeps the premium as low as possible`
      : ff.savingsLevel==="3+ months worth"
        ? `your savings can cover you for the first 3 months, so you don't need the policy to kick in straight away — which makes it considerably cheaper`
        : `as you don't have sick pay or significant savings, you want this to start paying out as quickly as possible`;
    const ipBen = (()=>{ const o=parseFloat(ff.totalOutgoings)||0; const p=parseFloat(ff.partnerIncome)||0; const g=(parseFloat(ff.grossIncome)||0)*0.6/12; return ff.partnerContrib==="Partner would contribute"?Math.min(Math.max(0,o-p),g):Math.min(o,g); })();
    return text
      .replace(/\[firstName\]/g, ff.firstName||"[name]")
      .replace(/\[housingLabel\]/g, ff.housing==="Mortgage"?"mortgage":"rent")
      .replace(/\[housingCost\]/g, ff.mortgagePayment?fmtM(ff.mortgagePayment):ff.totalOutgoings?fmtM(ff.totalOutgoings):"[amount]")
      .replace(/\[outgoings\]/g, ff.totalOutgoings?fmtM(ff.totalOutgoings):"[outgoings]")
      .replace(/\[benefit\]/g, ipBen?fmtM(ipBen):"[benefit]")
      .replace(/\[DEFERRED\]/g, deferred)
      .replace(/\[DEFERRED_REASON\]/g, deferredReason);
  }

  if (step.type==="info") return (
    <div>
      {step.infoNote && <div style={S.infoBox}>💡 {step.infoNote}</div>}
      <button style={S.nBtn} onClick={()=>onAnswer(null,step.next(null,ff))}>Continue →</button>
    </div>
  );

  if (step.type==="generate") return (
    <div>
      <div style={S.infoBox}>✅ All information captured. Tap below to generate the full LifeLogic advice report.</div>
      <button style={S.gBtn} onClick={()=>onAnswer("generate",null)}>⚡ Generate Advice Report</button>
    </div>
  );

  if (step.type==="tap") return (
    <div>
      <div style={S.oGrid}>
        {step.options.map(opt=>(
          <button key={opt} style={S.oBtn(sel===opt)} onClick={()=>setSel(opt)}>
            <span style={S.oDot(sel===opt)}/>{opt}
          </button>
        ))}
      </div>
      {sel && <button style={S.nBtn} onClick={()=>{onAnswer(sel,step.next(sel,ff));setSel(null);}}>Continue →</button>}
    </div>
  );

  if (step.type==="input") return (
    <div>
      {step.inputs.map(inp=>(
        <div key={inp.key} style={S.iGroup}>
          <label style={S.lbl}>{inp.label}</label>
          {inp.type==="select"
            ? <select style={S.sel} value={inputs[inp.key]||""} onChange={e=>setInputs(p=>({...p,[inp.key]:e.target.value}))}><option value="">Select…</option>{inp.options.map(o=><option key={o}>{o}</option>)}</select>
            : <input style={S.inp} type={inp.inputType||"text"} placeholder={inp.placeholder||""} value={inputs[inp.key]||""} onChange={e=>setInputs(p=>({...p,[inp.key]:e.target.value}))} />
          }
        </div>
      ))}
      <button style={S.nBtn} onClick={()=>{onInputNext(inputs,step.next(null,ff));setInputs({});}}>Continue →</button>
    </div>
  );

  return null;
}

export default function App() {
  const [stepId, setStepId] = useState("intro");
  const [ff, setFF] = useState({});
  const [history, setHistory] = useState(["intro"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("script");

  const step = STEPS.find(s=>s.id===stepId);
  const secIdx = SECTIONS.indexOf(step?.section);
  const pct = Math.min(100, Math.round((history.length/STEPS.length)*100));

  function go(nextId) { if (!nextId) return; setHistory(h=>[...h,nextId]); setStepId(nextId); }

  function onAnswer(answer, nextId) {
    if (answer==="generate") { generate(); return; }
    if (step.ffKey && answer) setFF(p=>({...p,[step.ffKey]:answer}));
    go(nextId);
  }

  function onInputNext(inputs, nextId) { setFF(p=>({...p,...inputs})); go(nextId); }

  function goBack() {
    if (history.length<=1) return;
    const prev = history[history.length-2];
    setHistory(h=>h.slice(0,-1));
    setStepId(prev);
  }

  async function generate() {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:MODEL,max_tokens:1800,messages:[{role:"user",content:buildPrompt(ff)}]})});
      const data = await res.json();
      if (data.error){setError(typeof data.error==="string"?data.error:JSON.stringify(data.error));return;}
      setResult(data.content?.find(b=>b.type==="text")?.text||"No response received.");
    } catch(e){setError("Failed to generate. Check your connection.");}
    finally{setLoading(false);}
  }

  function enrichScript(text) {
    if (!text) return text;
    const deferred = ff.sickPayDuration||(ff.savingsLevel==="3+ months worth"?"3 months":"1 month");
    const ipBen=(()=>{const o=parseFloat(ff.totalOutgoings)||0;const p=parseFloat(ff.partnerIncome)||0;const g=(parseFloat(ff.grossIncome)||0)*0.6/12;return ff.partnerContrib==="Partner would contribute"?Math.min(Math.max(0,o-p),g):Math.min(o,g);})();
    const dReason = ff.sickPayDuration?`the policy kicks in when your sick pay runs out, keeping the premium as low as possible`:ff.savingsLevel==="3+ months worth"?`your savings cover the first 3 months, so a longer wait makes the premium considerably cheaper`:`you don't have sick pay or savings to fall back on, so you want it to start paying out as soon as possible`;
    return text
      .replace(/\[firstName\]/g,ff.firstName||"[name]")
      .replace(/\[housingLabel\]/g,ff.housing==="Mortgage"?"mortgage":"rent")
      .replace(/\[housingCost\]/g,ff.mortgagePayment?fmtM(ff.mortgagePayment):ff.totalOutgoings?fmtM(ff.totalOutgoings):"[amount]")
      .replace(/\[outgoings\]/g,ff.totalOutgoings?fmtM(ff.totalOutgoings):"[outgoings]")
      .replace(/\[benefit\]/g,ipBen?fmtM(ipBen):"[benefit]")
      .replace(/\[DEFERRED\]/g,deferred)
      .replace(/\[DEFERRED_REASON\]/g,dReason);
  }

  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logoMark}>LL</div>
        <div><div style={S.logoText}>LifeLogic Live</div><div style={S.logoSub}>Live Call Companion</div></div>
        <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center"}}>
          {history.length>1&&<button onClick={goBack} style={S.bkBtn}>← Back</button>}
          <div style={{fontSize:11,color:TEXTD,background:INNER,padding:"5px 10px",borderRadius:7,border:`1px solid ${BORDER}`,fontWeight:600}}>{step?.section}</div>
        </div>
      </div>

      {/* PROGRESS */}
      <div style={S.progress}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {SECTIONS.map((s,i)=>(
              <span key={s} style={{fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:i<secIdx?EMERALD:i===secIdx?A:BORDERL}}>{s}</span>
            ))}
          </div>
          <span style={{fontSize:11,color:A,fontWeight:700,flexShrink:0}}>{pct}%</span>
        </div>
        <div style={S.pBar}><div style={S.pFill(pct)}/></div>
      </div>

      {/* MOBILE TABS */}
      <div style={S.tabs}>
        <button style={S.tab(tab==="script")} onClick={()=>setTab("script")}>📞 Script</button>
        <button style={S.tab(tab==="ff")} onClick={()=>setTab("ff")}>📋 Fact-Find</button>
      </div>

      {/* BODY */}
      <div style={S.body}>

        {/* LEFT */}
        <div style={{...S.left, display:tab==="ff"?"none":"block"}}>
          <div style={S.pill}>{step?.section}</div>
          {step&&(
            <div style={S.sBox}>
              <div style={S.sLbl}>SAY THIS</div>
              <div style={S.sTxt}>{enrichScript(step.script)}</div>
              {step.subScript&&<div style={S.sSub}>{enrichScript(step.subScript)}</div>}
            </div>
          )}
          {step&&!result&&!loading&&(
            <StepControls step={step} ff={ff} onAnswer={onAnswer} onInputNext={onInputNext} />
          )}
          {loading&&<div style={S.spin}><span style={{animation:"spin 1s linear infinite",display:"inline-block",color:A,fontSize:20}}>◌</span> Generating advice report…</div>}
          {error&&<div style={S.err}>{error}</div>}
          {result&&(
            <div style={S.outBox}>
              <p style={S.outH}>Advice Report</p>
              <p style={S.outSub}>GENERATED BY LIFELOGIC AI</p>
              <hr style={{border:"none",borderTop:`1px solid ${BORDER}`,margin:"0 0 14px 0"}}/>
              <pre style={S.pre}>{result}</pre>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{...S.right, display:tab==="script"?"block":"block"}}>
          <FFSummary ff={ff} />
        </div>

      </div>

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
        @media(min-width:768px){
          .tabs{display:none}
          [data-left]{display:block!important}
          [data-right]{display:block!important}
        }
      `}</style>
    </div>
  );
}
