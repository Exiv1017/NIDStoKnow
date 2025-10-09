import { Link } from 'react-router-dom';
import { FEATURES, STATS, FAQ, ROADMAP } from '../content/landingConfig';

const LandingPage = () => {
  return (
    <>
      <div className="min-h-screen bg-[#E3E3E3] relative overflow-hidden">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 lg:pt-32 pb-20 sm:pb-24 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 animate-fade-in">
            Defend Networks, Detect Threats,
            <br className="hidden sm:block" />
            Be Cyber-Ready!
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8 font-medium max-w-2xl mx-auto animate-slide-up">
            Hands-on NIDS simulations for future cybersecurity pros.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              to="/signup"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#1E5780] hover:bg-[#1a4b6e] transition-transform transform hover:scale-105 animate-bounce"
            >
              Start Learning Now
            </Link>
          </div>
        </main>
        <div className="absolute inset-x-0 bottom-0 h-24 sm:h-36 md:h-48 pointer-events-none">
          <img src="/diagonal.svg" alt="" className="w-full h-full object-cover" />
        </div>
      </div>
  {/* ==================== NEW DESIGN (Truthful Mode) ==================== */}
  {/* Features (truthful) */}
        <section className="relative bg-gradient-to-br from-[#f8fafc] via-[#edf1f4] to-[#e3e3e3] py-24 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <header className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1E5780] tracking-tight">Platform Capabilities</h2>
              <p className="mt-4 text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">Current implemented features available now (focused on core detection learning).</p>
            </header>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3" id="features">
              {FEATURES.map((f,i)=>(
                <div key={i} className="group relative bg-white/90 backdrop-blur rounded-2xl p-7 shadow-sm hover:shadow-xl border border-[#1E5780]/10 hover:border-[#1E5780]/30 transition-all overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1E5780]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-start space-x-5">
                    <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-[#1E5780]/10 ring-1 ring-[#1E5780]/20 group-hover:scale-105 transition-transform">
                      <img src={f.icon} alt="" className="w-8 h-8" loading="lazy" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#1E5780] tracking-tight mb-1">{f.title}</h3>
                      <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Learning Path Timeline */}
        <section className="relative bg-white py-24 sm:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1E5780] tracking-tight">Your Guided Path</h2>
              <p className="mt-4 text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">Learn core concepts, read focused theory modules, then reinforce through available simulations and quizzes.</p>
            </div>
            <div className="relative">
              <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#1E5780]/30 to-transparent" />
              <ol className="grid md:grid-cols-4 gap-10 md:gap-0">
                {[
                  {step:'01', title:'Foundations', text:'Core detection types & terminology via lessons.'},
                  {step:'02', title:'Theory Modules', text:'Signature / anomaly / hybrid markdown content.'},
                  {step:'03', title:'Simulation Practice', text:'Use current simulation modes (attack / defend / observer).'},
                  {step:'04', title:'Assess & Iterate', text:'Quizzes & basic tracking (expanded analytics planned).'}
                ].map((s,i)=>(
                  <li key={i} className="relative flex flex-col items-center text-center px-4">
                    <div className="relative mb-5">
                      <span className="flex items-center justify-center w-20 h-20 rounded-full bg-[#1E5780] text-white text-2xl font-bold shadow ring-4 ring-white">{s.step}</span>
                    </div>
                    <h3 className="font-semibold text-[#1E5780] mb-2 tracking-tight">{s.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed max-w-[220px]">{s.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Modules Preview */}
        <section className="relative bg-[#f6f9fb] py-24 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-12 gap-6">
              <div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1E5780] tracking-tight">Core Detection Tracks</h2>
                <p className="mt-4 text-gray-600 max-w-xl text-sm sm:text-base">Tracks provide overview, markdown theory, and related assessment pages. Hands-on depth will expand.</p>
              </div>
              <Link to="/signup" className="inline-flex items-center px-5 py-2.5 bg-[#1E5780] text-white text-sm font-medium rounded-md shadow hover:bg-[#184867] transition">Start Free</Link>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[
                {name:'Signature-Based', color:'from-[#1E5780] to-[#15425d]', points:['Rule writing basics','Pattern tuning','False-positive trimming','Snort-style labs']},
                {name:'Anomaly-Based', color:'from-[#1E5780] to-[#1c668f]', points:['Traffic baselining','Feature extraction','ML concept demos','Outlier investigation']},
                {name:'Hybrid Detection', color:'from-[#1E5780] to-[#2c6fa0]', points:['Correlation strategies','Multi-engine workflow','Signal fusion','Response prioritization']}
              ].map((m,i)=>(
                <div key={i} className="group relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl border border-[#1E5780]/10 hover:border-[#1E5780]/30 transition overflow-hidden">
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br ${m.color} mix-blend-multiply rounded-2xl`} />
                  <div className="relative">
                    <h3 className="font-semibold text-lg mb-4 text-[#1E5780] group-hover:text-white transition-colors">{m.name}</h3>
                    <ul className="space-y-2 mb-4">
                      {m.points.map((p,j)=>(
                        <li key={j} className="flex items-start text-sm text-gray-600 group-hover:text-white/90 transition-colors">
                          <span className="mt-1 mr-2 h-1.5 w-1.5 rounded-full bg-[#1E5780] group-hover:bg-white/90" />{p}
                        </li>
                      ))}
                    </ul>
                    <Link to="/signup" className="inline-flex items-center text-xs font-semibold tracking-wide uppercase text-[#1E5780] group-hover:text-white">Explore &rarr;</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="relative bg-white py-20 sm:py-24 border-t border-[#e4e9ec]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {STATS.map((s,i)=>(
                <div key={i} className="flex flex-col items-center">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#1E5780] tracking-tight">{s.n}</span>
                  <span className="mt-2 text-xs sm:text-sm font-medium tracking-wide text-gray-600 uppercase">{s.l}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roadmap (truthful replacement for testimonials) */}
        <section className="relative bg-[#f6f9fb] py-24 sm:py-28">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1E5780] tracking-tight">Roadmap</h2>
              <p className="mt-4 text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">Planned and in-progress enhancements (subject to change).</p>
            </div>
            <ul className="space-y-4">
              {ROADMAP.map((r,i)=>(
                <li key={i} className="flex items-start justify-between bg-white rounded-lg px-5 py-4 shadow-sm border border-[#1E5780]/10">
                  <span className="text-sm text-gray-700">{r.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wide font-medium ${r.status==='in-progress' ? 'bg-[#1E5780]/10 text-[#1E5780]' : 'bg-gray-200 text-gray-700'}`}>{r.status.replace('-', ' ')}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="relative bg-white py-24 sm:py-28">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1E5780] tracking-tight text-center mb-12">FAQ</h2>
            <div className="space-y-4">
              {FAQ.map((f,i)=>(
                <details key={i} className="group bg-[#f6f9fb] rounded-lg border border-[#1E5780]/10 open:shadow-sm">
                  <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between">
                    <span className="font-medium text-[#1E5780] text-sm sm:text-base">{f.q}</span>
                    <span className="ml-4 text-[#1E5780] transition-transform group-open:rotate-45 text-lg leading-none">+</span>
                  </summary>
                  <div className="px-5 pb-5 pt-0 text-gray-600 text-sm leading-relaxed">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative bg-gradient-to-br from-[#1E5780] to-[#184867] py-20 sm:py-24 text-center text-white overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_30%,#fff,transparent_60%)]" />
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Ready to Start Detecting?</h2>
              <p className="text-white/80 mb-8 text-sm sm:text-base max-w-2xl mx-auto">Build practical network defense intuition through layered practice — no setup, instant feedback.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/signup" className="inline-flex justify-center px-6 py-3 rounded-md bg-white text-[#1E5780] font-semibold text-sm shadow hover:shadow-md hover:bg-[#f1f5f8] transition">Create Free Account</Link>
                <a href="#features" className="inline-flex justify-center px-6 py-3 rounded-md border border-white/40 text-white font-medium text-sm hover:bg-white/10 transition">View Features</a>
              </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-[#0d2f45] text-white py-12 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 md:grid-cols-4">
            <div>
              <img src="/logo.svg" alt="NIDS To Know" className="h-8 w-auto mb-4" />
              <p className="text-sm text-white/70 leading-relaxed">Hands-on network intrusion detection learning platform blending theory and sandboxed simulation.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm tracking-wide uppercase">Platform</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link to="/signup" className="hover:text-white">Get Started</Link></li>
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Modules</a></li>
                <li><a href="#" className="hover:text-white">Assessments</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm tracking-wide uppercase">Resources</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#" className="hover:text-white">Docs (soon)</a></li>
                <li><a href="#" className="hover:text-white">Blog (soon)</a></li>
                <li><a href="#" className="hover:text-white">Changelog</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm tracking-wide uppercase">Contact</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="mailto:info@nidstoknow.local" className="hover:text-white">info@nidstoknow.local</a></li>
                <li><a href="#" className="hover:text-white">Community (soon)</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-white/10 text-center text-xs text-white/50">
            © {new Date().getFullYear()} NIDS To Know. All rights reserved.
          </div>
        </footer>
    </>
  );
};

export default LandingPage;