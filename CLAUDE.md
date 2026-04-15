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
