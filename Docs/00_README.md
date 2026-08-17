# Business Discovery Voice Agent --- MVP

## 1. Что мы строим

Это внутренний **Customer Discovery Engine** для исследования
бизнес-процессов армянских компаний.

Система должна:

1.  хранить компании и decision makers;
2.  выдавать каждому контакту уникальную ссылку на интервью;
3.  открывать персонализированную landing page;
4.  проводить 10--25-минутное интервью голосом, преимущественно на
    армянском;
5.  динамически выбирать следующий вопрос, а не читать анкету;
6.  находить повторяющиеся ручные процессы;
7.  количественно оценивать volume, time, FTE, errors, bottlenecks и
    business impact;
8.  сохранять transcript и факты;
9.  отдельным аналитическим шагом превращать разговор в строгий JSON;
10. вычислять opportunity scores;
11. показывать результаты в admin dashboard;
12. позднее генерировать бесплатный Automation Opportunity Report для
    респондента.

**MVP не является универсальной платформой автоматизации.** Его цель ---
получить качественные данные из первых 20--30 интервью и проверить, где
в армянских компаниях есть повторяемая automation opportunity.

## 2. Главная продуктовая гипотеза

Если дать CEO/COO/CFO/Operations Director короткую персонализированную
ссылку и предложить бесплатный AI-аудит процессов, часть респондентов
пройдет голосовое интервью без участия исследователя.

Система должна ответить на три бизнес-вопроса:

-   Есть ли процессы с \>=500 repetitive transactions/month или \>=0.5
    FTE ручной нагрузки?
-   Повторяются ли одинаковые workflows между разными компаниями?
-   Готовы ли компании дать historical data для пилота и потенциально
    платить за решение?

## 3. Что считать успехом MVP

После 20--30 completed interviews:

-   =8--10 компаний имеют \>=500 операций/месяц или \>=0.5 FTE ручной
    > нагрузки хотя бы в одном процессе;

-   =3 компании готовы предоставить обезличенные historical samples;

-   =2 компании готовы обсуждать pilot;

-   обнаружены \>=1--2 workflow-кластера, повторяющиеся минимум у 3
    компаний;

-   =70% критических числовых полей в completed interview подтверждены
    > самим респондентом, а не выведены моделью.

## 4. Архитектурное решение

Для browser voice используем **OpenAI Agents SDK + Realtime API +
WebRTC**. Официальная документация рекомендует WebRTC как самый простой
browser-first transport: SDK управляет microphone capture, playback,
interruptions и realtime connection. Браузер получает только
короткоживущий ephemeral token; постоянный OpenAI API key остается на
сервере.

Для realtime-интервью: `gpt-realtime-2.1`.

Для post-interview extraction/analysis: отдельный text model со
Structured Outputs, предпочтительно `gpt-5.6-terra` для
production-quality анализа; для дешевых экспериментов можно
benchmark'нуть `gpt-5.4-mini`/`gpt-5.4-nano`.

Почему два этапа: RealtimeAgent не поддерживает Structured Outputs, а
интервьюеру важнее natural conversation. Аналитик после разговора должен
работать детерминированнее и возвращать JSON schema.

## 5. High-level flow

``` text
Admin creates/imports Company + Contact
        ↓
Create Interview Invitation
        ↓
Generate random opaque token
        ↓
/i/{token}
        ↓
Load safe public interview context
        ↓
Respondent accepts microphone + interview notice
        ↓
Backend mints OpenAI ephemeral realtime token
        ↓
Browser ↔ OpenAI Realtime via WebRTC
        ↓
Realtime Interview Agent
        ↓
history/transcript events → backend persistence
        ↓
Interview ends
        ↓
Server queues Analysis Job
        ↓
Text reasoning model + strict JSON schema
        ↓
Processes + evidence + metrics + opportunity scores
        ↓
Dashboard
        ↓
Optional human review
        ↓
Automation Opportunity Report / follow-up
```

## 6. MVP scope

### Must have

-   Admin auth
-   Companies CRUD
-   Contacts CRUD
-   Interview invitation + opaque token
-   Public interview page
-   Armenian voice conversation
-   Text fallback
-   Realtime session
-   transcript persistence
-   interview status
-   post-interview structured analysis
-   process/opportunity tables
-   dashboard list/detail
-   export JSON/CSV
-   consent/notice before microphone starts

### Not required in V1

-   automated email campaigns
-   email open tracking
-   LinkedIn automation
-   PDF generation
-   CRM integrations
-   telephony
-   multi-tenant SaaS
-   billing
-   complex RBAC
-   vector database/RAG
-   automatic company web research

Сначала доказываем качество интервью.

## 7. Рекомендуемый стек

-   Next.js + TypeScript
-   PostgreSQL
-   Prisma или Drizzle (выбрать то, что быстрее для команды)
-   `@openai/agents` + `zod`
-   OpenAI Realtime API
-   Responses API для analysis
-   background job: сначала DB-backed jobs/cron; позже BullMQ/Temporal
    при необходимости
-   object storage только если позже решим хранить audio; для MVP лучше
    не хранить raw audio
-   Vercel/аналог для web + managed Postgres

## 8. Репозиторий

``` text
src/
  app/
    (admin)/
      dashboard/
      companies/
      contacts/
      interviews/
    i/[token]/
    api/
      realtime/token/
      interviews/[id]/events/
      interviews/[id]/complete/
      analysis/
  components/
    interview/
    dashboard/
  lib/
    db/
    openai/
      realtime.ts
      analyzer.ts
      schemas.ts
    interview/
      context.ts
      metrics.ts
      scoring.ts
  prompts/
    interviewer.system.md
    analyzer.system.md
```

## 9. Ссылки на актуальную документацию

-   OpenAI Voice Agents:
    https://openai.github.io/openai-agents-js/guides/voice-agents/
-   Voice quickstart:
    https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/
-   Building Voice Agents:
    https://openai.github.io/openai-agents-js/guides/voice-agents/build/
-   Transport choice:
    https://openai.github.io/openai-agents-js/guides/voice-agents/transport/
-   Realtime model:
    https://developers.openai.com/api/docs/models/gpt-realtime-2.1
-   Model catalog: https://developers.openai.com/api/docs/models
-   API key help:
    https://help.openai.com/en/articles/4936850-where-do-i-find-my-secret-api-key
