# Cosmo Constellation Simulator 🛰️

> Веб-сервис для проектирования устойчивой спутниковой группировки и оценки доступности связи в северных районах (КосмоХакатон 2026, Кейс 2).
> 
> 🌐 **Live Demo (VPS)**: [https://state3407.space/cosmo/](https://state3407.space/cosmo/) (зеркало: [https://state3407.space/cosmo-constellation-sim/](https://state3407.space/cosmo-constellation-sim/))

![Mission Control Dashboard](docs/assets/frontend_verified.png)

## 📌 Возможности
- **Физико-геометрическое ядро**: точный расчет положений КА на круговой орбите $h=550$ км, наклонение $i=87^\circ$, вращение Земли, ISL-линки (видимость и дальность), углы возвышения наземных станций ($\ge 10^\circ$).
- **Маршрутизация и анализ отказов**: динамический поиск путей (Dijkstra / BFS: клиент $\to$ спутники $\to$ шлюз), автоматическая классификация причин разрыва (`no_client_satellite`, `gateway_offline`, `no_gateway_satellite`, `isl_disconnected`).
- **Интерактивный Mission Control**:
  - 2D равнопромежуточная проекция и 3D ортографический глобус.
  - Таймлайн плеер (00:00:00 - 24:00:00, шаг 120 с, 1x/5x/20x/60x).
  - Gantt-диаграмма доступности по клиентам (C65, C70, C72) с тултипами причин разрыва.
  - Редактор сценария: переключение очередей запуска (1, 2, 3), поворот плоскостей (RAAN, Phase), кнопка отключения спутника на маршруте в 1 клик.
  - Модуль A/B сравнения с расчетом дельты параметров и метрик SLA.
- **Инженерный анализ и рекомендации**:
  - Интерактивная вкладка в UI «Аналитика & Рекомендации» с матрицей рисков и обоснованием проектных решений.
  - Подробный аналитический отчет: [`docs/RECOMMENDATIONS.md`](docs/RECOMMENDATIONS.md) (соответствие критериям 1–3, до 35 баллов).
- **Стандарты данных и CLI**:
  - Полная поддержка формата сценариев `cosmo-A-1.0`.
  - Выгрузка результатов в формате `cosmo-A-result-1.0`.
  - Консольная утилита расчета и валидации сценариев без запуска браузера (`app.cli`).

---

## 🚀 Быстрый запуск

### Вариант A. В 1 команду через Docker Compose (Рекомендуемый)
```bash
docker compose up --build -d
```
- Веб-интерфейс: `http://localhost:3000`
- API документация (Swagger): `http://localhost:3000/docs`
- Прямой порт бэкенда: `http://localhost:8000/api/health`

---

### Вариант B. Консольный расчет сценариев (CLI)
Быстрый расчет SLA в терминале без браузера (NumPy ядро):
```bash
# Расчет всех эталонных сценариев из 'Данные/'
cd backend && uv run python -m app.cli --all

# Расчет конкретного сценария с экспортом в cosmo-A-result-1.0
cd backend && uv run python -m app.cli --scenario ../Данные/01_full_constellation.json --export ../result.json
```

---

### Вариант C. Локальная разработка

#### 1. Бэкенд (FastAPI + uv)
Требуется Python 3.12+ и [`uv`](https://github.com/astral-sh/uv).
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```
API доступен по адресу: `http://127.0.0.1:8000` (документация Swagger: `http://127.0.0.1:8000/docs`).

Запуск тестов бэкенда (33 теста):
```bash
cd backend
uv run pytest
```

#### 2. Фронтенд (React + Vite + Tailwind)
Требуется Node.js 20+ или [Bun](https://bun.sh).
```bash
cd frontend
npm ci        # или bun install
npm run dev   # или bun run dev
```
Интерфейс доступен по адресу: `http://localhost:5173`.

---

## 📊 Результаты бенчмарков (24 часа, 720 шагов)

| Сценарий | Описание | Доступность связи (средняя) | C65 (65°N) | C70 (70°N) | C72 (72°N) |
|---|---|---|---|---|---|
| `01_full_constellation` | 48 КА, 3 очереди, ISL 3000 км | **98.10%** (цель $\ge 90\%$ достигнута) | 96.67% | 98.75% | 98.89% |
| `02_first_launch` | 1-я очередь (16 КА) | **18.56%** | 27.22% | 15.83% | 12.64% |
| `03_satellite_outages` | Отказ 10 КА с 6-го часа | **80.88%** | 79.31% | 80.83% | 82.50% |
| `04_link_range` | ISL ограничен до 2000 км | **68.29%** | 77.50% | 62.22% | 65.14% |

---

## 🛠️ Стек технологий
- **Backend**: Python, FastAPI, NumPy, Pydantic, Pytest, Uvicorn, UV.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide-react, Canvas 2D/3D Globe, Bun.
