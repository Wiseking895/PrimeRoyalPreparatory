import { Printer } from 'lucide-react'
import type { TerminalReportView } from '@/types/portal'

const gradeTone = (grade: string): string => {
  if (grade === 'A') return 'bg-emerald-100 text-emerald-700 ring-emerald-600/20'
  if (grade === 'B') return 'bg-sky-100 text-sky-700 ring-sky-600/20'
  if (grade === 'C') return 'bg-amber-100 text-amber-700 ring-amber-600/20'
  if (grade === 'D') return 'bg-orange-100 text-orange-700 ring-orange-600/20'
  if (grade === 'E') return 'bg-rose-100 text-rose-700 ring-rose-600/20'
  return 'bg-red-100 text-red-700 ring-red-600/20'
}

/**
 * Printable terminal report sheet. Used identically by the staff Reports pages
 * and the Parent Portal so a printed report has one consistent look. Print
 * styling hides the controls and leaves a clean A4-style sheet.
 */
export function ReportSheet({
  report,
  onPrint,
}: {
  report: TerminalReportView
  onPrint?: () => void
}) {
  return (
    <div>
      <div className="mb-4 hidden justify-end print:hidden sm:flex">
        {onPrint ? (
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 rounded-full bg-royal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-700"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print / Save as PDF
          </button>
        ) : null}
      </div>

      <div className="report-sheet-print overflow-hidden rounded-2xl border border-cream-300/70 bg-white shadow-[0_4px_24px_-12px_rgba(11,20,48,0.14)]">
        <div className="border-b border-cream-200 bg-royal-800 px-6 py-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold-400">
                Terminal Report
              </p>
              <h2 className="mt-1 text-lg font-extrabold">{report.pupil.fullName}</h2>
              <p className="text-sm text-cream-200/80">
                {report.pupil.pupilId} &middot; {report.class?.name ?? 'Class not assigned'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{report.session.name}</p>
              <p className="text-sm text-cream-200/80">{report.term.name}</p>
              <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-400">
                Overall: {report.overallGrade} — {report.overallGradeLabel}
              </p>
            </div>
          </div>
        </div>

        {!report.complete ? (
          <div className="px-6 py-10 text-center text-sm text-ink-500">
            No School-Based Assessment records have been recorded for this pupil in this term yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-cream-200 bg-cream-50 text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="px-6 py-3 font-bold">Subject</th>
                  <th className="px-4 py-3 text-right font-bold">Score</th>
                  <th className="px-4 py-3 text-right font-bold">Max</th>
                  <th className="px-4 py-3 text-right font-bold">%</th>
                  <th className="px-4 py-3 text-center font-bold">Grade</th>
                  <th className="px-6 py-3 font-bold">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {report.subjects.map((subject) => (
                  <tr key={subject.subjectId}>
                    <td className="px-6 py-3 font-semibold text-ink-900">
                      {subject.subjectName}
                      <span className="ml-2 text-xs font-normal text-ink-400">{subject.subjectCode}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-700">{subject.score}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-500">{subject.maxScore}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-ink-900">
                      {subject.percentage}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${gradeTone(subject.grade)}`}
                      >
                        {subject.grade}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-ink-600">{subject.remark ?? subject.gradeLabel}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-cream-200 bg-cream-50 text-sm font-bold text-ink-900">
                  <td className="px-6 py-3">Totals</td>
                  <td className="px-4 py-3 text-right tabular-nums">{report.totalScore}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{report.totalMaxScore}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {report.averagePercentage}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${gradeTone(report.overallGrade)}`}
                    >
                      {report.overallGrade}
                    </span>
                  </td>
                  <td className="px-6 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-200 bg-cream-50 px-6 py-4 text-xs text-ink-500">
          <span>Prime Royal Preparatory School</span>
          <span>Generated {new Date(report.generatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}