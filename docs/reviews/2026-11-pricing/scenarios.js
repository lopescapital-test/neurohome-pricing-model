// Pricing review, November 2026: the scenarios behind index.html. Run: node docs/reviews/2026-11-pricing/scenarios.js
// "Realistic" adds costs model.js does not carry yet (assumptions, not data):
//   25% employment cost on PT, coordinator and coach hours (if clinicians become W-2); $75 kit shipping;
//   8% of kit cost lost to early exits; card fees 3% plus 1.5% average financing fees.
// Commission is the amended Plan A: 15% of price net of pass-through costs (labs, physician, supplements).
const M=require(process.argv[2] || require("path").join(__dirname, "../../../model.js"));
const get=(s,n)=>M.PRODUCTS.find(p=>p.sec===s&&p.name===n);
const KIT=["panel","gHand","rHand","glasses","oils","vib","saebo","pads"], HW=["panel","gHand","rHand","saebo"];
const PASS=["gut","oat","tox","neural","myco","md","intrakid","gutFeel","bena","adrena","suppCr"];
function run(p,o={}){
  const r=M.calc(p), part=k=>(r.parts[k]||{cost:0}).cost;
  const price=o.price??p.price;
  let labor=r.labor-part("md")-part("kyle"), md=part("md");
  let kit=KIT.reduce((a,k)=>a+part(k),0), hw=HW.reduce((a,k)=>a+part(k),0);
  let labs=["gut","oat","tox","neural","myco"].reduce((a,k)=>a+part(k),0);
  let supp=["intrakid","gutFeel","bena","adrena","suppCr"].reduce((a,k)=>a+part(k),0);
  labor+= (o.dLabor||0); labs-= (o.dropLabs||0);
  if(o.hwDisc) kit-=hw*o.hwDisc;
  const burden=labor*0.25, ship=kit?75:0, loss=kit*(o.loss??0.08);
  const cogs=labor+burden+md+kit+ship+loss+labs+supp;
  const fees=price*(0.03+(o.fin??0.015));
  const pass=labs+md+supp;
  const comm=(o.comm??0.15)*(price-pass);
  const gp=price-cogs;
  return {price,cogs:Math.round(cogs),gm:gp/price,comm:Math.round(comm),fees:Math.round(fees),contrib:Math.round(gp-comm-fees),cp:(gp-comm-fees)/price,
    gmExPass:(price-pass-(cogs-pass))/(price-pass)};
}
const f=x=>(x*100).toFixed(1)+"%";
const show=(lbl,r)=>console.log(lbl.padEnd(46),String(r.price).padStart(6),"cogs",String(r.cogs).padStart(5),"GM",f(r.gm),"GMexPass",f(r.gmExPass),"comm",r.comm,"fees",r.fees,"contrib",r.contrib,f(r.cp));
const C60=get("v2c","60-minute sessions"),C90=get("v2c","90-minute sessions"),G4=get("v2g","4 days a week, 60-minute sessions"),G5=get("v2g","5 days a week, 90-minute sessions"),W=get("v2w","2× a week, 60 min"),PRE=get("pre","Pre-Intensive");
console.log("== single levers, Clinical 60 ==");
show("baseline realistic",run(C60));
show("price +6% (15,400)",run(C60,{price:15400}));
show("kit ships after refund window (loss 2%)",run(C60,{loss:0.02}));
show("device supplier -10%",run(C60,{hwDisc:0.10}));
show("PTA on 2 of 5 days wk5-8 (8 sess)",run(C60,{dLabor:-8*30}));
show("taper wk7-8 to 3 days (-4 PT sess)",run(C60,{dLabor:-4*70}));
show("financing: patient pays interest (fin 0.5%)",run(C60,{fin:0.005}));
show("labs billed separately (price -950)",run(C60,{price:13550,dropLabs:950}));
console.log("== package ==");
const pkg={loss:0.02,hwDisc:0.10,fin:0.005};
for(const [n,p,np,dl] of [["Clinical 60",C60,15400,-240],["Clinical 90",C90,19500,-360],["Guided 4d 60",G4,11500,0],["Guided 5d 90",G5,14250,0],["Wellness 2x60 qtr",W,6900,0]]){
  show(n+" base",run(p)); show(n+" pkg",run(p,{...pkg,price:np,dLabor:dl}));}
show("Pre base",run(PRE));
show("Pre: drop Tox+Neural to add-ons",run(PRE,{dropLabs:1150}));
show("Pre: $6,900 all labs",run(PRE,{price:6900}));
show("Pre: $5,900 core labs + pkg",run(PRE,{price:5900,dropLabs:1150,...pkg}));
// break-even volume loss for price moves
for(const [n,p,np] of [["C60",C60,15400],["G4",G4,11500],["W",W,6900]]){const a=run(p),b=run(p,{price:np});
 for(const cac of [0,2000]) console.log(n,"CAC",cac,"breakeven volume loss",f(1-(a.contrib-cac)/(b.contrib-cac)));}
// CC
for(const [lbl,rate] of [["CC 12+1 @ $100/hr",100],["CC 12+1 @ $120/hr",120]]){const price=12*rate+240, cogs=12*40*1.25+70*1.25; console.log(lbl,price,"GM",f((price-cogs)/price),"contrib@10%+3%",Math.round(price*0.87-cogs));}
