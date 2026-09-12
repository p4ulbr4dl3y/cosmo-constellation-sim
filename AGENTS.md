# AGENTS.md

Симулятор LEO созвездия (48 спутников, 3 плоскости), ISL меш, Арктика.
Стек: FastAPI + NumPy бэкенд, React 19 + Vite + Tailwind фронтенд.

## Команды

### Бэкенд (Python >=3.13, только `uv`):
- все тесты: `cd backend && uv run pytest` (порог coverage >=95%);
- один тест: `cd backend && uv run pytest tests/test_simulation.py -k <имя> --no-cov`;
- линт: `cd backend && uv run ruff check && uv run ruff format --check`.

### Фронтенд (React 19, `npm` / `bun`):
- дев сервер: `cd frontend && npm run dev`;
- все тесты: `cd frontend && npm test`;
- один тест: `cd frontend && npm test -- src/lib/orbit.test.ts -t "<имя>"`;
- линт и билд: `cd frontend && npm run lint && npm run build`.

## Архитектура и паритет:
- два движка (паритет обязателен): физика, геометрия ISL, Дейкстра и диагностика сбоев дублированы в Python (`backend/app/core/`) и TypeScript (`frontend/src/lib/orbit.ts`);
- бэкенд: `core/` - чистая математика (NumPy, без FastAPI и I/O); `api/` - тонкие роуты и Pydantic валидация; CLI вызывает только `core/`;
- фронтенд: `lib/orbit.ts` - чистый движок без React/DOM (паритет с `core/`); `components/` - только UI и Canvas-рендер;
- Offline First: фронтенд и пресеты (`data/presets/`) работают автономно на GitHub/GitVerse Pages без бэкенда;
- эталон: `reference/geometry.py`. Проверка: `test_geometry.py` и `parity.test.ts`.

## Синхронизация и деплой (GitHub и GitVerse):
- репозитории: GitHub (`origin`) `p4ulbr4dl3y/cosmo-constellation-sim`, GitVerse (`gitverse`) `hackrus.experts/kosmo-nizni_dreamteam_40_52`;
- автосинхронизация: `.github/workflows/sync-gitverse.yml` зеркалит ветки `main`/`master` и теги в GitVerse;
- деплой на GitVerse Pages: `.gitverse/workflows/deploy.yml` собирает и публикует фронтенд;
- ручной пуш в GitVerse: `git push gitverse main` и `git push gitverse main:master`.

## Инженерные правила:
- повторный юз: не писать с нуля, расширять модули в `backend/app/core/` и `frontend/src/lib/`;
- регрессия: любой fix требует теста в `backend/tests/` или `frontend/src/**/*.test.ts`, coverage бэкенда >=95%;
- трог орбит или маршрутов: синхронный апдейт Python + TS + `parity.test.ts`;
- физика: `R_EARTH = 6371.0` км, время строго `t_s` (сек), углы в расчетах в радианах, не путать ECI и ECEF;
- отрисовка: только чистый Canvas 2D/3D (без Three.js, Cesium);
- зависимости: бэкенд строго `uv` (`uv run`, `uv add`), фронтенд React 19, Tailwind v4, Lucide;
- комментарии в коде: русский язык, стиль `text-stylist` (только дефис `-`, без эмодзи, списки через `;`), пояснять только физику, алгоритмы и краевые случаи.

## Скиллы (.agents/skills/):
- `agent-browser`: визуальный QA, снятие скриншотов и E2E тесты UI;
- `caveman`: всегда активен для всех ответов ассистента;
- `frontend-design`: открывать при создании или переработке UI/UX и компонентов;
- `review`: запускать только по прямому вызову пользователя (`/review`);
- `text-stylist`: применять при правке любой документации и комментариев в коде.

## Коммиты:
- 1 строка: `<type>(<scope>): <описание>` (макс 72 символа, строчные, без точки в конце, без body/footer);
- типы: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `ci`, `test`.
