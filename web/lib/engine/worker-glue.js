/* ---------- the Plan Optimizer and the Drawdown Simulator, off the page ----------
   Moved unchanged from src/js/plan-worker.js. scripts/build-worker.mjs puts
   it after the engine in public/engine-worker.js, as build.py did.
   A few thousand plans through every historical market takes seconds, so the
   page hands the search to a worker and keeps drawing while it runs. The
   worker is the engine (math.js, drawdown.js and plan.js) plus this: run the
   search it's sent, and post back its progress, a few times a second, then
   the answer. A newer request, or a stop, replaces an older one. The
   Drawdown Simulator's Monte Carlo and searches run in a copy of its own. */
var plJob = 0;
self.onmessage = function(e){
  var d = e.data || {};
  // The Drawdown Simulator's jobs (a copy of this worker of its own): run it,
  // send back the answer, handing over the big number arrays, not copying them.
  if (d.type === "dd"){
    var res;
    try { res = ddJob(d.job, d.args); } catch (err) { res = {error: String(err)}; }
    var give = res && res.bal && res.bal.buffer ? [res.bal.buffer, res.spend.buffer] : [];
    self.postMessage({type: "dd", id: d.id, lane: d.lane, res: res}, give);
    return;
  }
  if (d.type === "stop"){ plJob++; return; }
  if (d.type !== "run") return;
  var job = ++plJob, g = plOptimize(d.P, d.goal), last = 0, s;
  var step = function(){
    var until = Date.now() + 120;
    while (Date.now() < until){
      if (job !== plJob) return;
      s = g.next();
      if (s.done) return;
      var v = s.value;
      if (v.type === "done"){ v.id = d.id; self.postMessage(v); return; }
      var now = Date.now();
      if (now - last > 50){ last = now; v.id = d.id; self.postMessage(v); }
    }
    // Let a newer request in between slices.
    setTimeout(step, 0);
  };
  step();
};
