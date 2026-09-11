# AGENTS.md

Симулятор LEO созвездия (48 спутников, 3 плоскости), ISL меш, Арктика. Стек: FastAPI + NumPy бэкенд, React 19 + Vite + Tailwind фронтенд.

## Команды

### Бэкенд (Python >=3.13, только `uv`):
- все тесты: `cd backend && uv run pytest` (порог coverage >=95%);
- один тест: `cd backend && uv run pytest tests/test_simulation.py -k <имя> --no-cov` (без `--no-cov` упадет по coverage);
- линт: `cd backend && uv run ruff check && uv run ruff format --check`.

### Фронтенд (React 19, `npm` / `bun`):
- дев сервер: `cd frontend && npm run dev`;
- все тесты: `cd frontend && npm test`;
- один тест: `cd frontend && npm test -- src/lib/orbit.test.ts -t "<имя>"`;
- линт и билд: `cd frontend && npm run lint && npm run build`.

## Архитектура и паритет:

- **два движка (паритет обязателен)**: физика, геометрия ISL, Дейкстра и диагностика сбоев дублированы в Python (`backend/app/core/`) и TypeScript (`frontend/src/lib/orbit.ts`);
- **Offline First**: фронт работает автономно на GitHub Pages без бэкенда;
- **эталон**: `reference/geometry.py`. Проверка: `test_geometry.py` и `parity.test.ts`.

## Инженерные правила

### 1. Сначала повторный юз, потом рефактор:
- не писать с нуля. Искать в `backend/app/core/` (`geometry.py`, `routing.py`, `validator.py`, `compare.py`) и `frontend/src/lib/` (`orbit.ts`, `formatters.ts`);
- расширять существующие типы и утилиты. Не плодить дубли.

### 2. Регрессионные тесты:
- любой `fix` -> обязательный минимальный тест в `backend/tests/` или `frontend/src/**/*.test.ts`;
- трог орбит/маршрутов -> синхронный апдейт Python + TS + `parity.test.ts`;
- coverage бэкенда >= 95%.

### 3. Физика и координаты:
- `R_EARTH = 6371.0` км. Время строго `t_s` (сек);
- не путать ECI (инерциальная) и ECEF (земная вращающаяся);
- углы: в схемах/UI градусы, в расчетах радианы;
- отрисовка: только чистый Canvas 2D/3D. Никаких Three.js, Cesium.

### 4. Зависимости:
- бэкенд: строго `uv` (`uv run`, `uv add`, `uv sync`). Запрещены голые `pip`/`python`. Без тяжелых либ;
- фронтенд: React 19, Tailwind v4, Lucide.

### 5. Стиль ассистента:
- режим `caveman`: ультра-кратко, технично, без воды.

## Коммиты:
- 1 строка: `<type>(<scope>): <описание>` (макс 72 символа, строчные, без точки в конце, без body/footer);
- типы: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `ci`, `test`.
