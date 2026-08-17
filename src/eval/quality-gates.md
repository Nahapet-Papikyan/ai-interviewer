# Quality gates before outreach

Prompt versions live in `src/lib/versions.ts` and are stored on every interview/analysis.

## Analyzer gold set (after 10 labeled interviews)

- 100% no fabricated numeric values
- >=95% exact capture of explicit critical numbers
- >=90% correct process boundaries
- All derived metrics traceable to inputs (22 working days, 4.33 weeks, 176 FTE hours)

Mark analysis LOW quality when the interview is very short, the respondent does not know operations, recognition fails, numbers contradict, or process boundaries cannot be reconstructed. Exclude LOW-quality interviews from aggregate stats.

## Realtime acceptance

- Respondent rarely repeats themselves
- Numerical facts captured correctly
- Armenian replies sound natural for a business interview
- No unsolicited switch to Russian/English
- Interruptions work
- Names/terms can be corrected naturally

## Funnel to track in outreach V1

invited → opened → consented → started → 5+ min → completed → report requested → pilot interested → human follow-up
