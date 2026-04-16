# Claude Code Rules

## Общие правила 

- Использовать TypeScript для всего кода
- Следовать функциональному подходу с React hooks
- Компоненты создавать как функциональные (FC)
- Использовать строгую типизацию, избегать `any`
- Максимум 600 строк на файл — иначе дели на части, компоненты и т.д.
- Общайся с пользователем на русском языке
- В общении с пользователем не писать код, только общую архитектуру и необходимость внесения изменений в БД, пиши кратко

## Структура src/

```
src/
├── components/
│   ├── admin/        # Управление пользователями и проектами
│   ├── auth/         # Страница авторизации
│   ├── bdds/         # БДДС (бюджет движения денежных средств)
│   │   └── income/   # Подмодуль доходов
│   ├── common/       # Переиспользуемые компоненты (ProtectedRoute, YearSelect)
│   └── layout/       # Каркас приложения (Header, Sider, Layout)
├── config/           # Конфигурация (supabase.ts)
├── contexts/         # React Context (AuthContext)
├── hooks/            # Кастомные хуки (useAuth, useBdds, useBddsIncome)
├── pages/            # Обёртки страниц (PageWrapper)
├── services/         # API-сервисы к Supabase (bddsService, usersService)
├── styles/           # CSS стили (index.css)
├── types/            # TypeScript типы (bdds, users, projects)
├── utils/            # Утилиты (formatters, constants, calculations)
└── assets/           # Статические ресурсы
```

## Стек технологий

- **Frontend:** React 19 + TypeScript + Vite 7
- **UI:** Ant Design 6 (antd) + русская локаль
- **Backend:** Supabase (serverless)
- **Excel:** XLSX для импорта/экспорта
- **Роутинг:** React Router DOM 7

## Именование

- Компоненты: `PascalCase` (например, `BddsTable.tsx`)
- Хуки: `camelCase` с префиксом `use` (например, `useBdds.ts`)
- Сервисы: `camelCase` с суффиксом `Service` (например, `bddsService.ts`)
- Типы/Интерфейсы: `PascalCase` с префиксом `I` для интерфейсов (например, `IButtonProps`, `BddsCategory`)
- Утилиты: `camelCase` (например, `formatters.ts`)
- Константы: `UPPER_SNAKE_CASE` (например, `SECTION_ORDER`)
- Роуты: `kebab-case` (например, `/bdds/income`, `/admin/users`)
- Поля БД: `snake_case` (например, `section_code`, `row_type`)

## Стиль кода

- Использовать arrow functions для компонентов
- Деструктуризация пропсов в параметрах функции
- Экспорт компонентов через `export const`
- Один компонент на файл
- Трёхуровневая архитектура: Pages/Components → Hooks → Services

## Пример компонента

```tsx
import { FC } from 'react';

interface IButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: FC<IButtonProps> = ({ label, onClick, disabled = false }) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};
```

## Стилизация

- Основная UI-библиотека — **Ant Design**
- Кастомные стили в `src/styles/index.css`
- CSS-классы по конвенции: `.bdds-section-header`, `.bdds-calculated-row`, `.bdds-auto-row`
- Цветовая индикация: зелёный (план), оранжевый (отклонения), красный (отрицательные)
- При добавлении новых стилей — использовать CSS-классы, **без хардкода цветов в коде**

## База данных (Supabase)

Основные таблицы:
- `bdds_categories` — категории БДДС (секция, тип строки)
- `bdds_entries` — записи план/факт по месяцам
- `bdds_income_entries` — доходы по видам работ
- `bdds_income_notes` — заметки к доходам
- `portal_users` — пользователи портала
- `projects` — проекты

## Миграции

- Все миграции сохранять в папке `sql/` для запуска пользователем на сайте Supabase в SQL Editor

## Запрещено

- Использовать `var` (только `const` и `let`)
- Игнорировать TypeScript ошибки через `@ts-ignore`
- Использовать inline стили (кроме динамических значений)
- Мутировать состояние напрямую
- Изменять `.env` файл
- Запускать локально приложение без явного разрешения пользователя
- Делать самостоятельно коммиты в GitHub — только по явному запросу пользователя
- Запускать самостоятельно портал для теста

## Адаптивность (обязательно)

Все UI компоненты ОБЯЗАНЫ быть адаптированы под:

- **iPhone 15 Pro Max** (430 × 932 px)
- **iPhone 12** (390 × 844 px)
- **iPad** (768 × 1024 px и больше)

Использовать CSS media queries для корректного отображения на всех целевых устройствах.

## MVP

- Всегда делай минимально работающую версию
- Не добавляй фичи "на будущее"
- Сначала работает — потом улучшаем

## КРАТКОСТЬ

- Отвечай максимально сжато. Без пояснений и предисловий.
- Если запрашивают код — выводи только рабочие фрагменты кода в блоках, без текста.
- Изменения выдавай как *минимальный diff/patch* или как *конкретные вставки*.
- Не перечисляй, «что было сделано», если прямо не попросили.
- Если нужен текст — не более 5 пунктов, каждый ≤ 12 слов.

## Структура проекта (корень)

```
finhub/
├── src/               # React 19 + TypeScript + Vite (порт 5173)
├── sql/               # SQL миграции для Supabase
├── public/            # Статика
├── dist/              # Сборка
├── vite.config.ts
├── tsconfig.json
├── package.json
├── index.html
└── CLAUDE.md
```

## Разработка

- Запуск: `npm run dev` (порт 5173)
- Сборка: `npm run build`
- Линтинг: `npm run lint`

## Git

- Коммиты на русском, кратко (1-2 предложения)
- Без приписок "Generated with Claude Code" и "Co-Authored-By"

---

## Working Style & Orchestration

### User profile
The user is a **beginner programmer** automating business processes. No jargon — use simple words and real-life analogies (like: "a hook is like a doorbell — it rings automatically when something happens"). Ask about every detail before starting. Offer your own suggestions, but make the user decide.

### Mentor rules
- **Ask first, code later.** Never assume requirements. Surface all ambiguities before touching the keyboard.
- **Explain each phase** in plain language: what was done, what comes next, ask for approval before moving on.
- **Push back wisely.** If you see a simpler solution, say so. You know more — act like a good senior who respects the student.

### Session length & handoff
Long sessions hurt quality. When you notice:
- many tool calls, heavy context, or a complex topic unfolding
- OR the user says "continue tomorrow" / "let's carry on later"

→ **Stop. Do not continue coding.** Instead:
1. Tell the user in plain words what was accomplished this session.
2. Ask to open a new session.
3. Dispatch a **Haiku subagent** to write a handoff entry to `memory.md` in the project root.
4. Output a **ready-to-paste starter prompt** so the user can copy-paste it into a fresh session.

Do not attempt to do long chains of work alone — high risk of drifting in the wrong direction. Consult the user at every phase checkpoint.

### Model strategy
| Model | Role |
|-------|------|
| **claude-opus-4-6** | Orchestrator only — reasoning (≥ 2 000 tokens), planning, directing subagents. Never writes code or searches files directly. |
| **claude-sonnet-4-6** | Implementation — all code writing, editing, code review. |
| **claude-haiku-4-5-20251001** | Research — web search, codebase exploration, file reading, memory.md writes. |

### Subagent rules
- Max **1–2 subagents** running at once.
- All research and search tasks → Haiku subagent. Never do them inline (wastes orchestrator context).
- Orchestrator context = reasoning + decisions only. Do not fill it with file contents or search results.

### Session memory (`memory.md`)
At the end of every session dispatch a **Haiku subagent** to append to `memory.md` in the project root:
```
## Session YYYY-MM-DD
**Done:** <bullet list of completed work>
**Decisions:** <key choices made and why>
**Open:** <questions or next steps>
**Handoff prompt:** <starter prompt for next session>
```

### Practical over perfect
**Make it work first. Beauty is a luxury.**

- A working ugly solution beats a beautiful broken one every time.
- Do not refactor code that is not causing a problem right now.
- Do not rename variables, reorganize files, or clean up style unless the user asked.
- Do not add comments, docstrings, or type hints to code you did not change.
- If something runs and passes — it is done. Stop touching it.

> Think of it like plumbing: the pipe works, water flows, job done. Do not repaint the bathroom while you are at it.

