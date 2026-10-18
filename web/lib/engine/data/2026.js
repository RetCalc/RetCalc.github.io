/* Tax year 2026: every figure the site uses that changes from one year to
   the next. Federal income tax, FICA and Social Security, the states' taxes
   and retirement rules, Medicare and the ACA, each as the 2026 rules have
   it. The engine reads them through yearData() (years.js), never by name.

   A new year is a new file beside this one, made by copying it and changing
   the figures, then added in years.js; this one stays as it is, so the
   Income Tax tool can still show 2026. The states usually publish later
   than the IRS: until they do, a new year can keep this year's state
   figures (`states: YEAR_2026.states`), and their own `year` says so. */
export var YEAR_2026 = {
  year: 2026,

  /* ---------- 2026 tax data ----------
     Federal brackets, standard deduction and FICA limits are tax year 2026
     (IRS Rev. Proc. 2025-32). State brackets, standard deductions and personal
     exemptions are as of January 1, 2026 per the Tax Foundation's annual survey.
     Brackets are [threshold, rate] pairs; the rate applies to income above the
     threshold. Local income taxes are not included. Retirement-specific rules --
     exclusions, senior deductions, state capital-gain treatment -- are separate,
     in states.retire below. */
  fed: {
    s: [[0,.10],[12400,.12],[50400,.22],[105700,.24],[201775,.32],[256225,.35],[640600,.37]],
    m: [[0,.10],[24800,.12],[100800,.22],[211400,.24],[403550,.32],[512450,.35],[768700,.37]]
  },
  fedStd: {s:16100, m:32200},
  fica: {ssRate:.062, ssCap:184500, medRate:.0145, addlRate:.009,
         addlThreshold:{s:200000, m:250000}},

  /* Contribution limits, per person (IRS Notice 2025-67 for the 401(k) and
     IRA; Rev. Proc. 2025-19 for the HSA, whose family limit is one per
     household). catch50 is the extra from 50, catch60 the larger one at
     60 to 63 that replaces it; the HSA's catch-up starts at 55.
     iraPhase: the traditional IRA deduction phases out across these MAGI
     ranges when you're covered by a plan at work (cov), or on a joint
     return when only your spouse is (spouse). rothPhase: direct Roth IRA
     contributions phase out across these MAGI ranges (the same notice). */
  limits: {
    k401: {base:24500, catch50:8000, catch60:11250},
    ira: {base:7500, catch50:1100},
    hsa: {self:4400, family:8750, catch55:1000},
    iraPhase: {cov:{s:[81000, 91000], m:[129000, 149000]}, spouse:[242000, 252000]},
    rothPhase: {s:[153000, 168000], m:[242000, 252000]}
  },

  /* ---------- retirement-specific 2026 data ----------
     Long-term capital gain / qualified dividend breakpoints are the maximum
     zero-rate and maximum 15% amounts from IRS Rev. Proc. 2025-32 sec. 3.03,
     stated as taxable income including the gain. Above the second figure the
     rate is 20%. */
  ltcg: {s:[49450, 545500], m:[98900, 613700]},

  /* Two separate age-65 benefits stack in 2026:
     - the long-standing additional standard deduction (Rev. Proc. 2025-32),
       $2,050 for a single filer, $1,650 per qualifying spouse on a joint
       return. Standard-deduction filers only.
     - the OBBBA sec. 70103 "senior deduction", $6,000 per qualifying person for
       tax years 2025-2028, available to itemizers too, reduced by 6% of MAGI
       above $75,000 single / $150,000 joint. */
  seniorAddl: {s:2050, m:1650},
  seniorBonus: {amount:6000, rate:.06, start:{s:75000, m:150000}},

  /* Social Security's 2026 bend points: average indexed monthly earnings
     run through them make the benefit at full retirement age. Earnings
     count up to the FICA wage base above (fica.ssCap). */
  ss: {bend1:1286, bend2:7749},

  /* The states, as of 1 January 2026. Their own year, since a new tax year
     can run on the last year's state figures until the states publish. */
  states: {
    year: 2026,
    /* sd/pe: [single, married]. pec = exemption delivered as a credit instead.
       sdc = standard deduction delivered as a credit. */
    tax: {
      AL:{n:"Alabama",sd:[3000,8500],pe:[1500,3000],b:{s:[[0,.02],[500,.04],[3000,.05]],m:[[0,.02],[1000,.04],[6000,.05]]}},
      AK:{n:"Alaska",none:1},
      AZ:{n:"Arizona",sd:[8350,16700],b:{s:[[0,.025]],m:[[0,.025]]}},
      AR:{n:"Arkansas",sd:[2470,4940],pec:[29,58],b:{s:[[0,.02],[4600,.039]],m:[[0,.02],[4600,.039]]}},
      CA:{n:"California",sd:[5540,11080],pec:[153,306],b:{s:[[0,.01],[11079,.02],[26264,.04],[41452,.06],[57542,.08],[72724,.093],[371479,.103],[445771,.113],[742953,.123],[1000000,.133]],m:[[0,.01],[22158,.02],[52528,.04],[82904,.06],[115084,.08],[145448,.093],[742958,.103],[891542,.113],[1000000,.123],[1485906,.133]]}},
      CO:{n:"Colorado",sd:[16100,32200],b:{s:[[0,.044]],m:[[0,.044]]}},
      CT:{n:"Connecticut",pe:[15000,24000],b:{s:[[0,.02],[10000,.045],[50000,.055],[100000,.06],[200000,.065],[250000,.069],[500000,.0699]],m:[[0,.02],[20000,.045],[100000,.055],[200000,.06],[400000,.065],[500000,.069],[1000000,.0699]]}},
      DE:{n:"Delaware",sd:[3250,6500],pec:[110,220],b:{s:[[0,0],[2000,.022],[5000,.039],[10000,.048],[20000,.052],[25000,.0555],[60000,.066]],m:[[0,0],[2000,.022],[5000,.039],[10000,.048],[20000,.052],[25000,.0555],[60000,.066]]}},
      FL:{n:"Florida",none:1},
      GA:{n:"Georgia",sd:[12000,24000],b:{s:[[0,.0519]],m:[[0,.0519]]}},
      HI:{n:"Hawaii",sd:[4400,8800],pe:[1144,2288],b:{s:[[0,.014],[9600,.032],[14400,.055],[19200,.064],[24000,.068],[36000,.072],[48000,.076],[125000,.079],[175000,.0825],[225000,.09],[275000,.10],[325000,.11]],m:[[0,.014],[19200,.032],[28800,.055],[38400,.064],[48000,.068],[72000,.072],[96000,.076],[250000,.079],[350000,.0825],[450000,.09],[550000,.10],[650000,.11]]}},
      ID:{n:"Idaho",sd:[16100,32200],b:{s:[[0,0],[4811,.053]],m:[[0,0],[9622,.053]]}},
      /* Illinois is modeled precisely rather than through the generic state
         machinery, since it is the tool's default state. Flat 4.95% rate, applied
         to federal AGI rather than federal taxable income (the federal std/item
         deduction never reduces the Illinois base, which the generic afterPre
         figure already respects). $2,925 personal exemption per person for 2026,
         +$1,000 per person 65 or older, and the exemption disappears entirely
         -- a cliff, not a phase-out -- once federal AGI exceeds $250,000 single
         or $500,000 joint (35 ILCS 5/204). What Illinois does to retirement
         income specifically now lives with every other state's rules, in
         `retire` below. */
      IL:{n:"Illinois",pe:[2925,5850],peAge:1000,agiCap:[250000,500000],
          b:{s:[[0,.0495]],m:[[0,.0495]]}},
      IN:{n:"Indiana",pe:[1000,2000],b:{s:[[0,.0295]],m:[[0,.0295]]}},
      IA:{n:"Iowa",sd:[16100,32200],pec:[40,80],b:{s:[[0,.038]],m:[[0,.038]]}},
      KS:{n:"Kansas",sd:[3605,8240],pe:[9160,18320],b:{s:[[0,.052],[23000,.0558]],m:[[0,.052],[46000,.0558]]}},
      KY:{n:"Kentucky",sd:[3360,3360],b:{s:[[0,.035]],m:[[0,.035]]}},
      LA:{n:"Louisiana",sd:[12875,25750],b:{s:[[0,.03]],m:[[0,.03]]}},
      ME:{n:"Maine",sd:[8350,16700],pe:[5300,10600],b:{s:[[0,.058],[27399,.0675],[64849,.0715]],m:[[0,.058],[54849,.0675],[129749,.0715]]}},
      MD:{n:"Maryland",sd:[3350,6700],pe:[3200,6400],b:{s:[[0,.02],[1000,.03],[2000,.04],[3000,.0475],[100000,.05],[125000,.0525],[150000,.055],[250000,.0575],[500000,.0625],[1000000,.065]],m:[[0,.02],[1000,.03],[2000,.04],[3000,.0475],[150000,.05],[175000,.0525],[225000,.055],[300000,.0575],[600000,.0625],[1200000,.065]]}},
      MA:{n:"Massachusetts",pe:[4400,8800],b:{s:[[0,.05],[1083150,.09]],m:[[0,.05],[1083150,.09]]}},
      MI:{n:"Michigan",pe:[5900,11800],b:{s:[[0,.0425]],m:[[0,.0425]]}},
      MN:{n:"Minnesota",sd:[15300,30600],b:{s:[[0,.0535],[33310,.068],[109430,.0785],[203150,.0985]],m:[[0,.0535],[48700,.068],[193480,.0785],[337930,.0985]]}},
      MS:{n:"Mississippi",sd:[2300,4600],pe:[6000,12000],b:{s:[[0,0],[10000,.04]],m:[[0,0],[10000,.04]]}},
      MO:{n:"Missouri",sd:[16100,32200],b:{s:[[0,0],[1348,.02],[2696,.025],[4044,.03],[5392,.035],[6740,.04],[8088,.045],[9436,.047]],m:[[0,0],[1348,.02],[2696,.025],[4044,.03],[5392,.035],[6740,.04],[8088,.045],[9436,.047]]}},
      MT:{n:"Montana",sd:[16100,32200],b:{s:[[0,.047],[47500,.0565]],m:[[0,.047],[95000,.0565]]}},
      NE:{n:"Nebraska",sd:[8850,17700],pec:[176,352],b:{s:[[0,.0246],[4130,.0351],[24760,.0455]],m:[[0,.0246],[8250,.0351],[49530,.0455]]}},
      NV:{n:"Nevada",none:1},
      NH:{n:"New Hampshire",none:1},
      NJ:{n:"New Jersey",pe:[1000,2000],b:{s:[[0,.014],[20000,.0175],[35000,.035],[40000,.0553],[75000,.0637],[500000,.0897],[1000000,.1075]],m:[[0,.014],[20000,.0175],[50000,.0245],[70000,.035],[80000,.0553],[150000,.0637],[500000,.0897],[1000000,.1075]]}},
      NM:{n:"New Mexico",sd:[16100,32200],b:{s:[[0,.015],[5500,.032],[16500,.043],[33500,.047],[66500,.049],[210000,.059]],m:[[0,.015],[8000,.032],[25000,.043],[50000,.047],[100000,.049],[315000,.059]]}},
      NY:{n:"New York",sd:[8000,16050],b:{s:[[0,.039],[8500,.044],[11700,.0515],[13900,.054],[80650,.059],[215400,.0685],[1077550,.0965],[5000000,.103],[25000000,.109]],m:[[0,.039],[17150,.044],[23600,.0515],[27900,.054],[161550,.059],[323200,.0685],[2155350,.0965],[5000000,.103],[25000000,.109]]}},
      NC:{n:"North Carolina",sd:[12750,25500],b:{s:[[0,.0399]],m:[[0,.0399]]}},
      ND:{n:"North Dakota",sd:[16100,32200],b:{s:[[0,0],[48475,.0195],[244825,.025]],m:[[0,0],[80975,.0195],[298075,.025]]}},
      OH:{n:"Ohio",pe:[2400,4800],b:{s:[[0,0],[26050,.0275]],m:[[0,0],[26050,.0275]]}},
      OK:{n:"Oklahoma",sd:[6350,12700],pe:[1000,2000],b:{s:[[0,0],[3750,.025],[4900,.035],[7200,.045]],m:[[0,0],[7500,.025],[9800,.035],[14400,.045]]}},
      OR:{n:"Oregon",sd:[2910,5820],pec:[256,512],b:{s:[[0,.0475],[4550,.0675],[11400,.0875],[125000,.099]],m:[[0,.0475],[9100,.0675],[22800,.0875],[250000,.099]]}},
      PA:{n:"Pennsylvania",b:{s:[[0,.0307]],m:[[0,.0307]]}},
      RI:{n:"Rhode Island",sd:[11200,22400],pe:[5250,10500],b:{s:[[0,.0375],[82050,.0475],[186450,.0599]],m:[[0,.0375],[82050,.0475],[186450,.0599]]}},
      SC:{n:"South Carolina",sd:[8350,16700],b:{s:[[0,0],[3640,.03],[18230,.06]],m:[[0,0],[3640,.03],[18230,.06]]}},
      SD:{n:"South Dakota",none:1},
      TN:{n:"Tennessee",none:1},
      TX:{n:"Texas",none:1},
      UT:{n:"Utah",sdc:[966,1932],b:{s:[[0,.045]],m:[[0,.045]]}},
      VT:{n:"Vermont",sd:[7650,15300],pe:[5300,10600],b:{s:[[0,.0335],[49400,.066],[119700,.076],[249700,.0875]],m:[[0,.0335],[82500,.066],[199450,.076],[304000,.0875]]}},
      VA:{n:"Virginia",sd:[8750,17500],pe:[930,1860],b:{s:[[0,.02],[3000,.03],[5000,.05],[17000,.0575]],m:[[0,.02],[3000,.03],[5000,.05],[17000,.0575]]}},
      WA:{n:"Washington",none:1},
      WV:{n:"West Virginia",pe:[2000,4000],b:{s:[[0,.0222],[10000,.0296],[25000,.0333],[40000,.0444],[60000,.0482]],m:[[0,.0222],[10000,.0296],[25000,.0333],[40000,.0444],[60000,.0482]]}},
      WI:{n:"Wisconsin",sd:[13960,25840],pe:[700,1400],b:{s:[[0,.035],[15110,.044],[51950,.053],[332720,.0765]],m:[[0,.035],[20150,.044],[69260,.053],[443630,.0765]]}},
      WY:{n:"Wyoming",none:1},
      DC:{n:"Washington DC",sd:[16100,32200],b:{s:[[0,.04],[10000,.06],[40000,.065],[60000,.085],[250000,.0925],[500000,.0975],[1000000,.1075]],m:[[0,.04],[10000,.06],[40000,.065],[60000,.085],[250000,.0925],[500000,.0975],[1000000,.1075]]}}
    },

    /* ---------- state retirement rules, tax year 2026 ----------
       The bracket tables in `tax` above describe how a state taxes a dollar of
       ordinary income. They say nothing about the three things that actually
       decide a retiree's state bill: whether Social Security is in the base,
       whether pension and traditional-account withdrawals are excluded from it,
       and what extra deduction, exemption or credit arrives at 65. That is what
       this table adds. Rules are stated as of 1 January 2026 and reflect the
       phase-ins that complete for this tax year.

       Every key is optional. Amounts are [single, married filing jointly].

         penFull   all pension and annuity income is exempt
         tradFull  all traditional 401(k)/IRA withdrawals are exempt
         pubFull   government / public-employer pensions are exempt
         exAmt     retirement-income exclusion ceiling
         exPer     1 = exAmt applies per person rather than per return
         exAge     1 = the exclusion requires a person marked 65 or older
         exSrc     what the exclusion may be applied against, in order:
                     "tp"  traditional, then pension            (default)
                     "t"   traditional only
                     "p"   pension only
                     "pub" public pension only
                     "all" traditional, pension, other income, then gain
         exLessSS  "gross" or "taxable" -- the exclusion is reduced dollar for
                   dollar by Social Security received on that basis
         exCap     AGI above which the exclusion is lost
         exPhase   "cliff" (default), "lin" over exRange, or "nj" (New Jersey's
                   own schedule: a share of retirement income by income band)
         exRange   dollars over which a linear phase-out runs
         sdAge     extra deduction per person 65 or older
         peAge     extra personal exemption per person 65 or older
         credAge   credit per person 65 or older
         agePh     {amt, cap, rate} deduction per senior with a dollar-for-dollar
                   (or rate-scaled) phase-out above cap
         ssFullAge 1 = benefits are fully exempt once a person is 65 or older
         ssCap     AGI below which Social Security is fully exempt
         ssRange   dollars over which that exemption phases out linearly
         ssStep    the subtraction instead falls 10% per this many dollars of
                   AGI (or part) over ssCap -- Minnesota's step phase-out
         ssPct     share of federally taxable benefits still taxed above the cap
         ssCredit  {rate, cap, phase} credit offsetting the tax on benefits
         cgPct     share of long-term gain excluded from the state base
         cgFlat    flat long-term gain exclusion
         cgMax     maximum rate on long-term gain (alternative-tax computation)
         cgB       separate bracket table applied to long-term gain
         ohRet     Ohio's retirement income credit table
         note      one line shown under the per-source table

       What is deliberately not modeled: narrow occupational carve-outs (military,
       police, fire, railroad, federal Civil Service), rules that turn on a birth
       year rather than an age, per-spouse ownership of the excluded income, and
       local income taxes. */
    retire: {
      AL:{penFull:1, exAmt:[6000,6000], exPer:1, exAge:1, exSrc:"t",
          note:"Alabama exempts defined-benefit pension income in full, public or private, and exempts the first $6,000 of 401(k) and IRA withdrawals per person aged 65 or over."},
      AZ:{exAmt:[2500,2500], exPer:1, exSrc:"pub",
          note:"Arizona exempts $2,500 per person of federal, state and local government pension income. Private pensions and retirement-account withdrawals are fully taxable at the flat 2.5% rate."},
      AR:{exAmt:[6000,6000], exPer:1, exSrc:"tp", cgPct:.50,
          note:"Arkansas exempts $6,000 per person of pension and retirement-account income, and excludes 50% of net long-term capital gain from the state base."},
      CA:{credAge:[153,153],
          note:"California taxes pension and retirement-account withdrawals in full at ordinary rates, with no retirement exclusion. Social Security is exempt, and there is an extra exemption credit at 65."},
      CO:{exAmt:[24000,24000], exPer:1, exAge:1, exSrc:"tp", exLessSS:"taxable", ssFullAge:1,
          note:"Colorado gives each person 65 or older a subtraction of up to $24,000 of pension and annuity income. Taxable Social Security comes out of that ceiling first, which in practice exempts benefits in full and leaves whatever is left for the rest."},
      CT:{exAmt:[1e12,1e12], exSrc:"tp", exCap:[75000,100000], exPhase:"lin", exRange:25000,
          ssCap:[75000,100000], ssPct:.25,
          note:"Connecticut exempts pension, annuity and IRA income in full below $75,000 of AGI single or $100,000 joint, phasing the exemption out over the next $25,000. Social Security is exempt below the same thresholds; above them a quarter of the federally taxable benefit stays in the base."},
      DE:{exAmt:[12500,12500], exPer:1, exAge:1, exSrc:"tp", sdAge:[2500,2500], credAge:[110,110],
          note:"Delaware excludes $12,500 per person of pension and retirement-account income from age 60, and adds a $2,500 standard deduction and a $110 credit at 65."},
      GA:{exAmt:[65000,65000], exPer:1, exAge:1, exSrc:"all",
          note:"Georgia's retirement income exclusion is $65,000 per person at 65 and over -- $35,000 from 62 -- and it covers pensions, retirement-account withdrawals, interest, dividends, capital gain and rent alike."},
      HI:{penFull:1, peAge:1144, cgMax:.0725,
          note:"Hawaii exempts employer-funded pension income in full, public or private, but taxes the part of a 401(k) or IRA that came from your own contributions. Long-term gain is capped at 7.25%."},
      ID:{note:"Idaho taxes pension and retirement-account income at ordinary rates. Its retirement benefits deduction is limited to specific federal, military and public-safety retirees and is not modeled here."},
      IL:{penFull:1, tradFull:1,
          note:"Illinois excludes qualified retirement income from its base entirely -- pensions, annuities, 401(k) and IRA withdrawals and Social Security alike. Only the taxable gain on a brokerage withdrawal and other ordinary income are actually subject to the 4.95% rate."},
      IN:{peAge:1000,
          note:"Indiana taxes pension and retirement-account income at the flat rate, with an extra $1,000 exemption per person at 65."},
      IA:{exAmt:[1e12,1e12], exAge:1, exSrc:"tp",
          note:"Iowa has exempted all retirement income -- pensions, annuities, 401(k) and IRA withdrawals -- for taxpayers 55 and over since 2023."},
      KS:{pubFull:1, sdAge:[850,700],
          note:"Kansas exempts federal, state and local government pensions in full, taxes private pensions and retirement-account withdrawals, and adds an extra standard deduction at 65: $850 single, $700 per spouse (K.S.A. 79-32,119)."},
      KY:{exAmt:[31110,31110], exPer:1, exSrc:"tp",
          note:"Kentucky excludes $31,110 per person of pension and retirement-account income, at any age."},
      LA:{pubFull:1, exAmt:[12000,12000], exPer:1, exAge:1, exSrc:"tp",
          note:"Louisiana exempts federal and state government pensions in full, and exempts $12,000 per person of other retirement income at 65 and over."},
      ME:{exAmt:[49824,49824], exPer:1, exSrc:"tp", exLessSS:"gross",
          exCap:[125000,250000], exPhase:"lin", exRange:100000, sdAge:[2050,1650],
          note:"Maine's pension income deduction is up to $49,824 per person for 2026 (pegged to the maximum annual Social Security benefit) and covers retirement-account withdrawals, but it is reduced dollar for dollar by the Social Security you receive, and it phases out above $125,000 of AGI single or $250,000 joint."},
      MD:{exAmt:[40600,40600], exPer:1, exAge:1, exSrc:"p", exLessSS:"gross", peAge:1000,
          note:"Maryland's $40,600 pension exclusion at 65 (2026) covers employer plans but not IRAs, and is reduced by the Social Security you receive. Maryland's county income taxes -- roughly 2.25% to 3.2% on top of the state rate -- are not included here."},
      MA:{pubFull:1, peAge:700,
          note:"Massachusetts exempts Massachusetts and federal government pensions in full, taxes private pensions and retirement-account withdrawals at 5%, and adds a $700 exemption per person at 65."},
      MI:{exAmt:[65987,131794], exSrc:"tp",
          note:"Michigan's retirement and pension deduction is fully restored for tax year 2026, the last step of the 2023 phase-in: $65,987 single and $131,794 joint of pension and retirement-account income comes out of the base."},
      MN:{ssCap:[86410,110780], ssStep:4000,
          note:"Minnesota exempts Social Security in full below $86,410 of AGI single or $110,780 joint (2026), and the subtraction falls 10% for each $4,000 over -- gone $40,000 above the line. Pension and retirement-account income is taxed at ordinary rates."},
      MS:{penFull:1, tradFull:1,
          note:"Mississippi exempts all qualified retirement income -- pensions, annuities, 401(k) and IRA withdrawals -- once you have reached the plan's retirement age."},
      MO:{exAmt:[49824,49824], exPer:1, exSrc:"pub",
          note:"Missouri exempts public pension income up to the maximum Social Security benefit (about $49,800 per person for 2026), with no income limit since 2024 (SB 190). Its separate $6,000 private pension exemption cuts off at $25,000 / $32,000 and is not modeled."},
      MT:{sdAge:[5800,5800], cgB:{s:[[0,.03],[20500,.041]], m:[[0,.03],[41000,.041]]},
          note:"Montana is one of the states that still taxes Social Security, on the federal taxable amount. It gives an extra $5,800 subtraction per person at 65 and taxes long-term gain at reduced rates of 3.0% and 4.1%."},
      NE:{note:"Nebraska finished exempting Social Security in 2024. Pension and retirement-account income is taxed at ordinary rates."},
      NJ:{exAmt:[75000,100000], exAge:1, exSrc:"tp", exCap:[100000,100000], exPhase:"nj", peAge:1000,
          note:"New Jersey's pension and retirement income exclusion is $75,000 single or $100,000 joint from age 62, under a hard income test: the full exclusion below $100,000 of gross income, then a share of retirement income itself -- 50% joint (37.5% single) to $125,000, half that to $150,000 -- and nothing at all above $150,000."},
      NM:{ssCap:[100000,150000], exAmt:[8000,8000], exPer:1, exAge:1, exSrc:"all",
          exCap:[28500,51000], cgPct:.40,
          note:"New Mexico exempts Social Security below $100,000 of AGI single or $150,000 joint and taxes it above. It excludes 40% of net capital gain, and gives an $8,000 exemption at 65 that only survives at quite low incomes."},
      NY:{pubFull:1, exAmt:[20000,20000], exPer:1, exSrc:"tp",
          note:"New York exempts New York and federal government pensions in full, and excludes $20,000 per person of private pension and retirement-account income from age 59 and a half. New York City and Yonkers resident taxes are not included here."},
      NC:{note:"North Carolina taxes pension and retirement-account income at its flat rate. The Bailey exemption for certain long-vested government retirees is too narrow to model."},
      ND:{cgPct:.40,
          note:"North Dakota taxes pension and retirement-account income at ordinary rates, but excludes 40% of net long-term capital gain."},
      OH:{credAge:[50,50], ohRet:1, exCap:[100000,100000],
          note:"Ohio taxes pension and retirement-account income at ordinary rates, offset only by a small retirement income credit of up to $200 and a $50 senior credit, both lost above $100,000 of Ohio income."},
      OK:{exAmt:[10000,10000], exPer:1, exSrc:"tp",
          note:"Oklahoma excludes $10,000 per person of pension and retirement-account income."},
      OR:{sdAge:[1200,1000],
          note:"Oregon taxes pension and retirement-account income at ordinary rates. Its retirement income credit applies only at low household incomes and is not modeled, nor are Portland-area local taxes."},
      PA:{penFull:1, tradFull:1,
          note:"Pennsylvania does not tax retirement income at all once you have retired -- pensions, annuities, 401(k) and IRA distributions are all outside the base. Interest, dividends and capital gain are still taxed at 3.07%."},
      RI:{ssCap:[107000,133500], exAmt:[50000,50000], exPer:1, exAge:1, exSrc:"tp",
          exCap:[107000,133500],
          note:"Rhode Island exempts Social Security and up to $50,000 per person of pension, 401(k) and annuity income (raised from $20,000 for 2025), but both require Social Security's full retirement age and both cut off above $107,000 of AGI single or $133,500 joint. IRA withdrawals don't qualify for the pension exclusion, which this tool doesn't separate from other traditional withdrawals."},
      SC:{sdAge:[15000,15000], cgPct:.44,
          note:"South Carolina's age-65 deduction is $15,000 per person against any income, which absorbs its separate $10,000 retirement deduction. It also excludes 44% of net long-term capital gain."},
      UT:{ssCredit:{rate:.045, cap:[54000,90000], phase:.025},
          note:"Utah taxes Social Security but then hands back a credit for the tax on it, withdrawn at 2.5 cents per dollar of income above $54,000 single or $90,000 joint. Pension and retirement-account income is taxed at the flat 4.5% rate."},
      VT:{ssCap:[50000,65000], ssRange:10000, cgFlat:[5000,5000],
          note:"Vermont exempts Social Security below $50,000 of AGI single or $65,000 joint, phasing out over the next $10,000. It excludes $5,000 of long-term gain and otherwise taxes retirement income at ordinary rates."},
      VA:{agePh:{amt:12000, cap:[50000,75000], rate:1},
          note:"Virginia's age deduction is $12,000 per person at 65, but it is withdrawn dollar for dollar above $50,000 of income single or $75,000 joint, so it disappears entirely by $62,000 / $87,000."},
      WV:{sdAge:[8000,8000],
          note:"West Virginia completed its Social Security phase-out this year. It gives an $8,000 exemption per person at 65, applied against any income."},
      WI:{exAmt:[24000,24000], exPer:1, exAge:1, exSrc:"tp", cgPct:.30,
          note:"Wisconsin's 2025 retirement income exclusion is $24,000 per person from age 67, covering pensions and retirement-account withdrawals. It also excludes 30% of net long-term capital gain."},
      DC:{note:"The District taxes pension and retirement-account income at ordinary rates. Its $3,000 government-pension exclusion at 62 is too narrow to model."}
    },

    /* States that still include any Social Security in taxable income for 2026.
       Every other state, plus DC, fully exempts benefits. West Virginia completed
       its phase-out effective tax year 2026; Missouri, Kansas and Nebraska
       dropped off in earlier years. Each of these eight has its own income-based
       exemption that this does not model — see the About tab. Colorado is the one
       exception handled here, because its subtraction is a clean full exemption
       at 65 and over. */
    ssTaxed: {CO:1, CT:1, MN:1, MT:1, NM:1, RI:1, UT:1, VT:1},

    /* Pre-tax deductions a state does not let off its own tax: listed here,
       the money stays in the state base even though it comes off federally.
       Every state not listed, and every deduction not named, follows the
       federal treatment. The keys are the Income Tax tool's buckets:
         k401    elective deferrals to a 401(k), 403(b) or 457
         ira     a deductible traditional IRA contribution
         hsa     HSA contributions, through payroll or not
         health  health, dental and vision premiums through a Section 125 plan
       Sources: PA Personal Income Tax Guide, Gross Compensation (deferrals
       to retirement plans are compensation; qualified Section 125 health
       premiums are not); NJ Division of Taxation TB-39(R) (no Section 125
       exclusion for salary reduction) and NJ-1040 instructions (IRA and HSA
       contributions not deductible; only 401(k) deferrals excluded, so
       403(b) and 457 deferrals are taxed: the rules row says so); California
       FTB Pub 1001 (no HSA deduction); Massachusetts DOR (no IRA deduction). */
    preTaxed: {
      PA: {k401:1, ira:1},
      NJ: {ira:1, hsa:1, health:1},
      CA: {hsa:1},
      MA: {ira:1}
    },

    /* States that have not expanded Medicaid to 138% of the poverty line:
       below 100% in these there is no ACA subsidy and no Medicaid for most
       adults (the plan engine and the Early Retirement Bridge). */
    noExpansion: {AL:1, FL:1, GA:1, KS:1, MS:1, SC:1, TN:1, TX:1, WI:1, WY:1}
  },

  medicare: {
    /* 2026 Medicare IRMAA. Standard Part B is $202.90/month; higher brackets pay a
       multiple of it, plus a flat Part D surcharge. Source: CMS 2026 Parts A & B
       premiums fact sheet. The brackets are cliffs, not phase-ins -- one dollar
       over a line costs the whole tier -- and they run on a two-year lookback, so
       a conversion today sets the premium two years out. */
    irmaa: {
      partB: 202.90,
      // b is the total monthly Part B premium CMS publishes for the tier (the
      // multiple of the standard premium, rounded as CMS rounds it)
      tiers: [
        {s:109000,   m:218000,   mult:1.0, b:202.90, partD:0},
        {s:137000,   m:274000,   mult:1.4, b:284.10, partD:14.50},
        {s:171000,   m:342000,   mult:2.0, b:405.80, partD:37.50},
        {s:205000,   m:410000,   mult:2.6, b:527.50, partD:60.40},
        {s:499999.99, m:749999.99, mult:3.2, b:649.20, partD:83.30},
        {s:Infinity, m:Infinity, mult:3.4, b:689.90, partD:91.00}
      ]
    },
    /* Average standalone Part D premium, 2026, a month (CMS estimate, before
       IRMAA). With standard Part B, what a year of Medicare costs each person
       65+ when the plan engine prices health coverage. */
    partD: 35,
    /* Medigap Plan G at 65, a month: a rough national range. */
    medigap: {low:120, high:200}
  },

  /* ACA marketplace premiums: the Healthcare Cost Planner's tables, which
     the Early Retirement Bridge and the plan engine use too. */
  aca: {
    // Federal poverty level for 2026 coverage. Premium tax credits run a year
    // behind, so 2026 plans are priced against the 2025 HHS poverty guidelines:
    // $15,650 for one person plus $5,500 for each additional person, contiguous
    // 48 states and DC. Alaska and Hawaii are higher; this uses the 48-state line.
    fplBase: [0,15650,21150,26650,32150,37650,43150,48650,54150],
    fplPerAddl: 5500,
    // 2026 average benchmark premium (second-lowest-cost Silver) for a 40-year-old,
    // monthly, by state. Source: KFF, Marketplace Average Benchmark Premiums, 2026
    // (US average $625, up from $497 in 2025). Averages across each state's rating
    // areas; a county quote can differ a lot. Scaled by the HHS age multiplier.
    premium40: {
      AL:645,AK:1032,AZ:532,AR:774,CA:570,CO:557,CT:870,DC:610,
      DE:691,FL:683,GA:615,HI:541,ID:490,IL:646,IN:474,IA:501,
      KS:670,KY:590,LA:646,ME:709,MD:414,MA:494,MI:523,MN:448,
      MS:662,MO:605,MT:692,NE:710,NV:497,NH:401,NJ:545,NM:623,
      NY:817,NC:638,ND:570,OH:513,OK:604,OR:543,PA:572,RI:506,
      SC:564,SD:655,TN:711,TX:661,UT:640,VT:1299,VA:455,WA:612,
      WV:1073,WI:611,WY:1090
    },
    // Standard ACA contribution % of income for 2026: the applicable percentage
    // table in Rev. Proc. 2025-25, with the 400% FPL cliff. These are the rules in
    // force for 2026, since the enhanced credits expired at the end of 2025.
    // Each row is [from, width, % at from, % at from + width], income as a
    // multiple of the poverty line; the share runs straight between the two.
    // Below the first row nothing is owed; above the cliff there's no credit.
    cliff: 4.0,
    contrib: [
      [1.00, 0.33, 0.0210, 0.0210],
      [1.33, 0.17, 0.0314, 0.0419],
      [1.50, 0.50, 0.0419, 0.0660],
      [2.00, 0.50, 0.0660, 0.0844],
      [2.50, 0.50, 0.0844, 0.0996],
      [3.00, 1.00, 0.0996, 0.0996]
    ]
  }
};
