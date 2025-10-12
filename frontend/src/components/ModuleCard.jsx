import { Link } from 'react-router-dom';
import { canAccessSection } from '../utils/moduleAccess';
import { toSlug as _toSlug, loadCompletedLessonIds } from '../pages/student/theoretical/logic/ids';

// serverSummary (optional) shape: { units_completed, units_total, percent, lessons_completed, total_lessons, overview_completed, practical_completed, assessment_completed, quizzes_passed, total_quizzes }
export default function ModuleCard({ module, progress, isAssigned, assignedOnly, onCompleteSection, getTheoryUrl, userId=null, serverSummary=null, onOverviewPersist, onServerRefresh }) {
  const slug = module.title.toLowerCase().replace(/\s+/g,'-');
  const base = `module-${slug}`;
  const prefix = userId ? `${base}-u${userId}` : base;
  // Local storage keys deprecated for gating; server is authoritative now.

  // --- Progress breakdown tooltip calculation (mirrors unified model) ---
  let overviewCompleted = false;
  let lessonTotal = 0; let lessonsCompleted = 0;
  let quizTotal = 0; let quizzesPassed = 0;
  let practicalCompleted = false; let assessmentCompleted = false;
  // Server-first overrides (A + C implementation): if serverSummary exists, trust its flags & counts.
  try {
    // Derive from snapshot; final overrides come from serverSummary below.
    // Lesson totals: from module snapshot (no cached fallback for gating now)
    const cachedLessons = 0;
    if (cachedLessons > 0) lessonTotal = cachedLessons; else {
      if (Array.isArray(module.theoryModules)) {
        lessonTotal = module.theoryModules.reduce((t, tm)=> t + ((tm.lessons||[]).length), 0);
      }
    }
    // Enforce expected lesson count for hybrid/anomaly if snapshot incomplete
    if (slug === 'anomaly-based-detection' && lessonTotal < 13) lessonTotal = 13;
    if (slug === 'hybrid-detection' && lessonTotal < 13) lessonTotal = 13;
    // Clamp to expected for anomaly
    if (slug === 'anomaly-based-detection' && lessonTotal < 13) lessonTotal = 13;
    // Completed lessons (ids excluding *overview)
    const lessonIds = loadCompletedLessonIds(slug, userId) || [];
    lessonsCompleted = Array.isArray(lessonIds) ? lessonIds.filter(id=>!/overview$/i.test(id)).length : 0;
    if (lessonsCompleted > lessonTotal && lessonTotal>0) lessonsCompleted = lessonTotal; // clamp
    // Quizzes total: anomaly and signature both 5
    // Use expected quiz counts (hard-coded until curriculum metadata endpoint added)
    if (slug === 'anomaly-based-detection' || slug === 'hybrid-detection' || slug === 'signature-based-detection') quizTotal = 5;
    // Count passed quizzes
    const track = slug.startsWith('signature') ? 'signature' : slug.startsWith('anomaly') ? 'anomaly' : slug.startsWith('hybrid') ? 'hybrid' : 'signature';
    const quizCodes = ['m1','m2','m3','m4','summary'];
    quizCodes.forEach(code => {
      const pkNamespaced = `${track}Quiz:${code}:u${userId}:passed`;
      const pkLegacyTrackParent = `${track}Quiz:${slug}:${code}:u${userId}:passed`;
      const pkLegacyNoUser = `${track}Quiz:${code}:passed`;
      if (localStorage.getItem(pkNamespaced)==='true' || localStorage.getItem(pkLegacyTrackParent)==='true' || localStorage.getItem(pkLegacyNoUser)==='true') {
        quizzesPassed += 1;
      }
    });
    if (quizzesPassed > quizTotal) quizzesPassed = quizTotal;
    practicalCompleted = false;
    assessmentCompleted = false;
  } catch { /* ignore */ }

  let numeratorUnits = (overviewCompleted ? 1:0) + lessonsCompleted + quizzesPassed + (practicalCompleted?1:0) + (assessmentCompleted?1:0);
  let denominatorUnits = slug === 'anomaly-based-detection' ? 21 : (1 + lessonTotal + quizTotal + 2);
  let canonicalPercent = denominatorUnits > 0 ? Math.round((numeratorUnits/denominatorUnits)*100) : 0;
  if (serverSummary) {
    // Override local counts with authoritative server data
    if (typeof serverSummary.lessons_completed === 'number') lessonsCompleted = serverSummary.lessons_completed;
    if (typeof serverSummary.total_lessons === 'number') lessonTotal = serverSummary.total_lessons;
    if (typeof serverSummary.quizzes_passed === 'number') quizzesPassed = serverSummary.quizzes_passed;
    if (typeof serverSummary.total_quizzes === 'number') quizTotal = serverSummary.total_quizzes;
    if (serverSummary.overview_completed !== undefined) overviewCompleted = !!serverSummary.overview_completed;
    if (serverSummary.practical_completed !== undefined) practicalCompleted = !!serverSummary.practical_completed;
    if (serverSummary.assessment_completed !== undefined) assessmentCompleted = !!serverSummary.assessment_completed;
    // Recompute numerator / denominator from server units
    if (typeof serverSummary.units_completed === 'number') numeratorUnits = serverSummary.units_completed;
    if (typeof serverSummary.units_total === 'number') denominatorUnits = serverSummary.units_total || denominatorUnits;
    if (typeof serverSummary.percent === 'number') canonicalPercent = serverSummary.percent;
  }

  const plural = (n, word) => `${n} ${word}${n===1?'':'s'}`;
  const tooltip = `Completed ${numeratorUnits} of ${denominatorUnits} units (${plural(overviewCompleted?1:0,'overview')}, ${plural(lessonsCompleted,'lesson')}, ${plural(quizzesPassed,'quiz')}, ${plural(practicalCompleted?1:0,'practical')}, ${plural(assessmentCompleted?1:0,'assessment')})`;

  const triggerServerRefresh = () => {
    if (typeof onServerRefresh === 'function') onServerRefresh();
  };

  const handleOverviewClick = () => {
    if (typeof onCompleteSection === 'function') onCompleteSection(module.id, 'Overview');
    if (typeof onOverviewPersist === 'function') onOverviewPersist();
    triggerServerRefresh();
  };

  return (
    <div className={`bg-white rounded-lg p-6 shadow hover:shadow-md transition-shadow duration-200 border ${isAssigned? 'border-blue-300':'border-transparent'}`}> 
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-medium">{module.title}</h2>
            {isAssigned && <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200">Assigned</span>}
          </div>
          <p className="text-gray-600 mt-1">{module.description}</p>
        </div>
        <div className="text-right" title={tooltip} aria-label={tooltip}>
          <span className="text-sm text-gray-600">{canonicalPercent > 0 ? `${canonicalPercent}%` : 'Not Started'}</span>
          <div className="w-32 bg-gray-200 rounded-full h-2.5 mt-1 relative group">
            <div className="bg-[#206EA6] h-2.5 rounded-full" style={{ width: `${canonicalPercent}%` }} />
            {/* Optional custom tooltip bubble (CSS only, appears on hover) */}
            <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 -top-7 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow" role="tooltip">{tooltip}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        {module.sections.map((section, i) => {
          const accessible = canAccessSection({ moduleObj: module, sectionName: section.name, progress: canonicalPercent, assignedOnly, isAssigned, userId, serverSummary });
          const baseClasses = 'px-6 py-2 rounded-md transition-colors text-sm font-medium';
          // Compute completion status from authoritative flags and counts
          const computedCompleted = (() => {
            switch (section.name) {
              case 'Overview':
                return !!overviewCompleted;
              case 'Theory':
                return (lessonTotal > 0 && lessonsCompleted >= lessonTotal) || (serverSummary && serverSummary.theory_completed === true);
              case 'Practical Exercise':
                return !!practicalCompleted;
              case 'Assessment':
                return !!assessmentCompleted;
              default:
                return !!section.completed;
            }
          })();
          const style = !accessible
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : computedCompleted
              ? 'bg-green-100 text-green-800 hover:bg-green-200'
              : section.name==='Overview'
                ? 'bg-[#206EA6] hover:bg-[#185785] text-white cursor-pointer'
                : 'bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200';
          const targetUrl = section.name === 'Theory' ? getTheoryUrl(module.title) : `/student/theoretical/${slug}/${section.name === 'Practical Exercise' ? 'practical' : section.name.toLowerCase()}`;
          return (
            <div key={i} className="flex flex-col gap-2">
              <Link
                to={targetUrl}
                className={`${baseClasses} ${style}`}
                onClick={(e)=> {
                  if (!accessible) { e.preventDefault(); return; }
                  if (section.name === 'Overview') handleOverviewClick();
                  // Trigger refresh after entering other sections that might conclude units later
                  if (['Practical Exercise','Assessment'].includes(section.name)) {
                    triggerServerRefresh();
                  }
                }}
                title={!accessible ? 'Complete previous sections to unlock' : ''}
              >
                {section.name}
                {!accessible && <span className="ml-2 text-xs">🔒</span>}
                {computedCompleted && <span className="ml-2 text-green-600">✔</span>}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
