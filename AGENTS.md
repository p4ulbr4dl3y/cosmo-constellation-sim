# AGENTS.md

Симулятор LEO созвездия (48 спутников, 3 плоскости), ISL меш, Арктика. Стек: FastAPI + NumPy бэкенд, React 19 + Vite + Tailwind фронтенд.

## Команды

### Бэкенд (Python >=3.13, только `uv`)
- Все тесты: `cd backend && uv run pytest` (порог coverage >=95%).
- Один тест: `cd backend && uv run pytest tests/test_simulation.py -k <имя> --no-cov` (без `--no-cov` упадет по coverage).
- Линт: `cd backend && uv run ruff check && uv run ruff format --check`.

### Фронтенд (React 19, `npm` / `bun`)
- Дев сервер: `cd frontend && npm run dev`.
- Все тесты: `cd frontend && npm test`.
- Один тест: `cd frontend && npm test -- src/lib/orbit.test.ts -t "<имя>"`.
- Линт и билд: `cd frontend && npm run lint && npm run build`.

## Архитектура и паритет

- **Два движка (паритет обязателен)**: Физика, геометрия ISL, Дейкстра и диагностика сбоев дублированы в Python (`backend/app/core/`) и TypeScript (`frontend/src/lib/orbit.ts`).
- **Offline First**: Фронт работает автономно на GitHub Pages без бэкенда.
- **Эталон**: `reference/geometry.py`. Проверка: `test_geometry.py` и `parity.test.ts`.

## Инженерные правила

### 1. Сначала повторный юз, потом рефактор
- Не писать с нуля. Искать в `backend/app/core/` (`geometry.py`, `routing.py`, `validator.py`, `compare.py`) и `frontend/src/lib/` (`orbit.ts`, `formatters.ts`).
- Расширять существующие типы и утилиты. Не плодить дубли.

### 2. Регрессионные тесты
- Любой `fix` -> обязательный минимальный тест в `backend/tests/` или `frontend/src/**/*.test.ts`.
- Трог орбит/маршрутов -> синхронный апдейт Python + TS + `parity.test.ts`.
- Coverage бэкенда >= 95%.

### 3. Физика и координаты
- `R_EARTH = 6371.0` км. Время строго `t_s` (сек).
- Не путать ECI (инерциальная) и ECEF (земная вращающаяся).
- Углы: в схемах/UI градусы, в расчетах радианы.
- Отрисовка: только чистый Canvas 2D/3D. Никаких Three.js, Cesium.

### 4. Зависимости
- Бэкенд: строго `uv` (`uv run`, `uv add`, `uv sync`). Запрещены голые `pip`/`python`. Без тяжелых либ.
- Фронтенд: React 19, Tailwind v4, Lucide.

### 5. Стиль ассистента
- Режим `caveman`: ультра-кратко, технично, без воды.

## Коммиты
- 1 строка: `<type>(<scope>): <описание>` (макс 72 символа, строчные, без точки в конце, без body/footer).
- Типы: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `ci`, `test`.
