/* ---------- the Plan Optimizer, off the page ----------
   A few thousand plans through every historical market takes seconds, so the
   page hands the search to a worker and keeps drawing while it runs. The
   worker is the engine (math.js and plan.js) plus this: run the search it's
   sent, and post back its progress, a few times a second, then the answer.
   A newer request, or a stop, replaces an older one. */
var plJob = 0;
self.onmessage = function(e){
  var d = e.data || {};
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
