from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class ErrorDetailResponse(BaseModel):
    """Детальное описание ошибки валидации или обработки запроса."""

    message: str = Field(..., description="Краткое описание ошибки")
    errors: list[str] = Field(
        default_factory=list,
        description="Перечень выявленных нарушений схемы или ограничений",
    )


class ErrorResponse(BaseModel):
    """Стандартный ответ сервиса при ошибке 4xx/5xx."""

    detail: str | ErrorDetailResponse = Field(
        ...,
        description="Подробные сведения об ошибке",
    )


class HealthResponse(BaseModel):
    """Статус работоспособности сервиса."""

    status: str = Field(..., description="Текущее состояние службы (ok)")
    service: str = Field(..., description="Идентификатор сервиса")
    version: str = Field(..., description="Версия API")


class RootResponse(BaseModel):
    """Сведения о корневом эндпоинте и ссылки на документацию."""

    service: str = Field(..., description="Имя сервиса")
    docs: str = Field(..., description="Путь к интерактивной документации Swagger UI")
    health: str = Field(..., description="Путь к эндпоинту проверки состояния")


class ValidateResponse(BaseModel):
    """Результат валидации параметров сценария группировки."""

    valid: bool = Field(..., description="Признак корректности сценария")
    errors: list[str] = Field(
        default_factory=list,
        description="Список критических ошибок валидации",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Список предупреждений и некритических несоответствий",
    )


class SnapshotRequest(BaseModel):
    """Параметры запроса для расчета мгновенного снимка группировки в момент времени t_s."""

    scenario: dict[str, Any] = Field(
        ...,
        description="Конфигурация сценария моделирования по стандарту cosmo-A-1.0",
    )
    t_s: float = Field(
        default=0.0,
        ge=0.0,
        description="Момент времени от начала сценария (в секундах)",
    )
    routing_metric: Literal["hops", "distance"] = Field(
        default="hops",
        description="Критерий оптимизации маршрута Дейкстры: число переходов или геодезическая дальность",
    )


class SimulateRequest(BaseModel):
    """Параметры запроса для полного моделирования на интервале времени."""

    scenario: dict[str, Any] = Field(
        ...,
        description="Конфигурация сценария моделирования по стандарту cosmo-A-1.0",
    )
    routing_metric: Literal["hops", "distance"] = Field(
        default="hops",
        description="Критерий оптимизации маршрута Дейкстры: число переходов или геодезическая дальность",
    )
    include_timeline: bool = Field(
        default=True,
        description="Флаг включения подробного покадрового журнала состояний клиентов",
    )


class ExportRequest(BaseModel):
    """Параметры запроса экспорта результатов расчета в формат cosmo-A-result-1.0."""

    scenario: dict[str, Any] = Field(
        ...,
        description="Конфигурация сценария моделирования по стандарту cosmo-A-1.0",
    )
    routing_metric: Literal["hops", "distance"] = Field(
        default="hops",
        description="Критерий оптимизации маршрута Дейкстры: число переходов или геодезическая дальность",
    )


class CompareRequest(BaseModel):
    """Параметры запроса для сравнительного анализа двух сценариев."""

    scenario_a: dict[str, Any] = Field(
        ...,
        description="Конфигурация базового сценария A",
    )
    scenario_b: dict[str, Any] = Field(
        ...,
        description="Конфигурация сравниваемого сценария B",
    )
    routing_metric: Literal["hops", "distance"] = Field(
        default="hops",
        description="Критерий оптимизации маршрута Дейкстры: число переходов или дальность",
    )


class PresetSummary(BaseModel):
    """Краткая сводка предустановленного сценария орбитальной группировки."""

    id: str = Field(..., description="Уникальный идентификатор сценария")
    title: str = Field(..., description="Человекочитаемое наименование сценария")
    filename: str = Field(..., description="Имя исходного файла конфигурации")
    satellite_count: int = Field(..., description="Количество космических аппаратов в группировке")
    planes_count: int = Field(..., description="Количество орбитальных плоскостей")
    client_count: int = Field(..., description="Количество клиентских наземных терминалов")
    gateway_count: int = Field(..., description="Количество шлюзовых наземных станций")
    horizon_s: int = Field(..., description="Длительность горизонта моделирования в секундах")
    step_s: int = Field(..., description="Временной шаг расчета в секундах")
    launch_stage: int = Field(..., description="Очередь развертывания группировки (1, 2 или 3)")
    isl_range_km: float = Field(
        ..., description="Максимальная дальность межспутниковой связи в километрах"
    )


class ScenarioPlane(BaseModel):
    """Параметры орбитальной плоскости группировки."""

    id: str = Field(..., description="Идентификатор плоскости (например, P1)")
    raan_deg: float = Field(..., description="Долгота восходящего узла в градусах")
    phase_deg: float = Field(..., description="Фазовый сдвиг аномалии в плоскости в градусах")


class ScenarioSatellite(BaseModel):
    """Параметры космического аппарата в орбитальной плоскости."""

    id: str = Field(..., description="Идентификатор спутника (например, S101)")
    plane_id: str = Field(..., description="Идентификатор родительской орбитальной плоскости")
    slot_deg: float = Field(..., description="Начальная средняя аномалия в градусах")
    launch_batch: int = Field(..., description="Номер партии запуска КА")


class ScenarioGroundSite(BaseModel):
    """Параметры наземного пункта: клиентский терминал или шлюзовая станция."""

    id: str = Field(..., description="Идентификатор наземного пункта (например, C65, G_MUR)")
    name: str | None = Field(default=None, description="Описательное наименование пункта")
    role: Literal["client", "gateway"] = Field(..., description="Роль пункта в сети")
    lat_deg: float = Field(..., ge=-90.0, le=90.0, description="Географическая широта в градусах")
    lon_deg: float = Field(
        ..., ge=-180.0, le=180.0, description="Географическая долгота в градусах"
    )


class ScenarioFailure(BaseModel):
    """Интервал времени отказа космического аппарата."""

    satellite_id: str = Field(..., description="Идентификатор отказавшего спутника")
    start_s: float = Field(..., ge=0.0, description="Время начала сбоя в секундах")
    end_s: float = Field(..., ge=0.0, description="Время восстановления в секундах")


class ScenarioGatewayOutage(BaseModel):
    """Интервал времени отключения наземного шлюза."""

    gateway_id: str = Field(..., description="Идентификатор отключенного шлюза")
    start_s: float = Field(..., ge=0.0, description="Время начала перерыва в секундах")
    end_s: float = Field(..., ge=0.0, description="Время восстановления связи в секундах")


class ScenarioEnvironment(BaseModel):
    """Физические и орбитальные параметры моделирования."""

    altitude_km: float = Field(..., description="Высота круговой орбиты над экватором в километрах")
    inclination_deg: float = Field(..., description="Наклонение орбитальной плоскости в градусах")
    earth_angle0_deg: float = Field(..., description="Начальный угол поворота Гринвича в градусах")
    horizon_s: int = Field(..., gt=0, description="Горизонт расчета в секундах")
    step_s: int = Field(..., gt=0, description="Дискретность шага расчета в секундах")
    min_elevation_deg: float = Field(
        ..., description="Минимальный угол места видимости Земля-космос в градусах"
    )
    isl_range_km: float = Field(
        ..., description="Предельная дальность действия межспутниковых линий связи в километрах"
    )
    target_availability: float = Field(
        ..., ge=0.0, le=1.0, description="Целевой порог доступности сервиса (SLA)"
    )


class ScenarioDesign(BaseModel):
    """Конфигурация космического сегмента группировки."""

    launch_stage: int = Field(default=3, description="Этап развертывания орбитальной группировки")
    planes: list[ScenarioPlane] = Field(..., description="Список орбитальных плоскостей")
    satellites: list[ScenarioSatellite] = Field(..., description="Список космических аппаратов")


class Scenario(BaseModel):
    """Полная структура сценария орбитальной группировки по схеме cosmo-A-1.0."""

    schema_version: str = Field(default="cosmo-A-1.0", description="Версия формата спецификации")
    meta: dict[str, Any] = Field(
        default_factory=dict, description="Метаданные сценария и описание задачи"
    )
    environment: ScenarioEnvironment = Field(
        ..., description="Параметры окружающей среды и физические константы"
    )
    design: ScenarioDesign = Field(
        ..., description="Архитектура построения орбитальной группировки"
    )
    ground_sites: list[ScenarioGroundSite] = Field(
        ..., description="Перечень наземных станций и терминалов"
    )
    failures: list[ScenarioFailure] = Field(
        default_factory=list, description="Расписание моделируемых отказов спутников"
    )
    gateway_outages: list[ScenarioGatewayOutage] = Field(
        default_factory=list, description="Расписание регламентных перерывов шлюзов"
    )


class SatellitePosition(BaseModel):
    """Координаты и статус космического аппарата в заданный момент времени."""

    id: str = Field(..., description="Идентификатор космического аппарата")
    plane_id: str = Field(..., description="Идентификатор орбитальной плоскости")
    active: bool = Field(..., description="Признак штатного функционирования аппарата")
    failed: bool = Field(..., description="Признак нахождения в аварийном состоянии")
    lat_deg: float = Field(..., description="Подспутниковая географическая широта в градусах")
    lon_deg: float = Field(..., description="Подспутниковая географическая долгота в градусах")
    alt_km: float = Field(..., description="Высота орбиты над поверхностью Земли в километрах")
    x_km: float = Field(
        ..., description="Координата X во вращающейся геоцентрической системе ECEF в километрах"
    )
    y_km: float = Field(
        ..., description="Координата Y во вращающейся геоцентрической системе ECEF в километрах"
    )
    z_km: float = Field(
        ..., description="Координата Z во вращающейся геоцентрической системе ECEF в километрах"
    )


class GroundSitePosition(BaseModel):
    """Координаты и состояние наземного пункта."""

    id: str = Field(..., description="Идентификатор наземного пункта")
    name: str = Field(..., description="Наименование станции")
    role: str = Field(..., description="Роль: client или gateway")
    lat_deg: float = Field(..., description="Географическая широта в градусах")
    lon_deg: float = Field(..., description="Географическая долгота в градусах")
    x_km: float = Field(..., description="Координата X в системе ECEF в километрах")
    y_km: float = Field(..., description="Координата Y в системе ECEF в километрах")
    z_km: float = Field(..., description="Координата Z в системе ECEF в километрах")
    online: bool = Field(..., description="Признак доступности станции в текущий момент")


class GraphEdge(BaseModel):
    """Ребро топологического графа радиовидимости."""

    source: str = Field(..., description="Узел-источник (спутник или наземный пункт)")
    target: str = Field(..., description="Узел-приемник")
    distance_km: float = Field(..., description="Геодезическая дальность линии связи в километрах")
    type: Literal["isl", "ground"] = Field(
        ..., description="Тип канала: межспутниковый или Земля-космос"
    )


class ClientRouteStatus(BaseModel):
    """Статус маршрутизации трафика клиентского терминала."""

    client_id: str = Field(..., description="Идентификатор клиента")
    status: Literal["ok", "outage"] = Field(..., description="Состояние связности: норма или сбой")
    path: list[str] = Field(
        default_factory=list, description="Последовательность узлов кратчайшего пути"
    )
    hops: int = Field(..., description="Число транзитных узлов радиопередачи")
    distance_km: float = Field(..., description="Суммарная длина радиотрассы в километрах")
    failure_code: str | None = Field(
        default=None, description="Классификационный код причины отказа"
    )
    failure_reason: str | None = Field(
        default=None, description="Подробное техническое пояснение сбоя"
    )


class SnapshotSummary(BaseModel):
    """Сводные показатели мгновенного снимка группировки."""

    total_satellites: int = Field(..., description="Всего спутников в сценарии")
    active_satellites: int = Field(..., description="Количество активных исправных аппаратов")
    failed_satellites: int = Field(..., description="Количество аварийных аппаратов")
    isl_links_count: int = Field(..., description="Число активных межспутниковых линий связи")
    ground_links_count: int = Field(
        ..., description="Число установленных каналов с наземными пунктами"
    )
    clients_total: int = Field(..., description="Общее число клиентских терминалов")
    clients_connected: int = Field(
        ..., description="Число обслуженных клиентов с активным маршрутом"
    )
    clients_outage: int = Field(..., description="Число клиентов без доступа к шлюзам")


class SnapshotResponse(BaseModel):
    """Мгновенный снимок пространственного расположения и сетевой топологии."""

    t_s: float = Field(..., description="Момент времени расчета в секундах")
    satellites: list[SatellitePosition] = Field(..., description="Параметры космических аппаратов")
    ground_sites: list[GroundSitePosition] = Field(..., description="Параметры наземных станций")
    edges: list[GraphEdge] = Field(..., description="Ребра графа топологии сети")
    elevation_deg: dict[str, dict[str, float]] = Field(
        default_factory=dict,
        description="Матрица углов места между станциями и спутниками",
    )
    client_routes: dict[str, ClientRouteStatus] = Field(
        default_factory=dict,
        description="Маршруты и статусы связности клиентов",
    )
    summary: SnapshotSummary = Field(..., description="Сводная статистика мгновенного состояния")


class SimulationSummary(BaseModel):
    """Агрегированные результаты моделирования группировки по всему горизонту."""

    average_availability_pct: float = Field(
        ..., description="Средняя доступность по всем терминалам в процентах"
    )
    min_availability_pct: float = Field(
        ..., description="Минимальная доступность среди всех клиентов в процентах"
    )
    all_meet_target: bool = Field(
        ..., description="Выполнение целевого норматива SLA всеми клиентами"
    )


class ClientMetricItem(BaseModel):
    """Метрики надежности и качества связи для отдельного терминала."""

    client_id: str = Field(..., description="Идентификатор клиента")
    availability_pct: float = Field(..., description="Коэффициент готовности в процентах")
    availability_ratio: float = Field(..., description="Коэффициент готовности от 0 до 1")
    visibility_pct: float = Field(
        default=0.0, description="Коэффициент радиовидимости КА в процентах"
    )
    visibility_ratio: float = Field(
        default=0.0, description="Коэффициент радиовидимости КА от 0 до 1"
    )
    max_outage_s: float = Field(
        default=0.0, description="Максимальная длительность непрерывного сбоя в секундах"
    )
    total_outage_s: float = Field(
        default=0.0, description="Суммарная длительность перерывов связи в секундах"
    )
    mean_hops: float | None = Field(
        default=None, description="Среднее количество переходов по маршруту"
    )
    max_hops: int | None = Field(default=None, description="Максимальное количество переходов")
    min_hops: int | None = Field(default=None, description="Минимальное количество переходов")
    mean_distance_km: float | None = Field(
        default=None, description="Средняя длина трассы в километрах"
    )
    meets_target: bool = Field(..., description="Соответствие целевому уровню готовности")
    target_availability: float = Field(..., description="Целевое значение готовности")
    failure_breakdown: dict[str, int] = Field(
        default_factory=dict,
        description="Распределение перерывов по классификационным кодам",
    )
    outage_intervals: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Временные окна непрерывных сбоев",
    )
    timeline: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Покадровый лог состояния клиента",
    )


class SimulateResponse(BaseModel):
    """Результаты сквозного моделирования динамики орбитальной группировки."""

    scenario_meta: dict[str, Any] = Field(default_factory=dict, description="Метаданные сценария")
    total_steps: int = Field(..., description="Число шагов расчета")
    step_s: int = Field(..., description="Дискретность шага расчета в секундах")
    horizon_s: int = Field(..., description="Горизонт расчета в секундах")
    target_availability: float = Field(..., description="Целевая доступность по сценарию")
    summary: SimulationSummary = Field(..., description="Сводные системные показатели SLA")
    client_metrics: dict[str, ClientMetricItem] = Field(
        ..., description="Метрики надежности по клиентам"
    )
    routes: list[dict[str, Any]] = Field(default_factory=list, description="Хронология маршрутов")


class ExportResultResponse(BaseModel):
    """Итоговый документ результатов в спецификации cosmo-A-result-1.0."""

    schema_version: str = Field(default="cosmo-A-result-1.0", description="Версия схемы результата")
    effective_scenario: dict[str, Any] = Field(..., description="Фактическая конфигурация сценария")
    routes: list[dict[str, Any]] = Field(
        ..., description="Рассчитанные маршруты по временным шагам"
    )
    metrics: dict[str, Any] = Field(
        ..., description="Агрегированные поклиентские показатели качества связи"
    )
    summary: dict[str, Any] = Field(..., description="Сводные системные показатели надежности")


class CompareSummary(BaseModel):
    """Сводное сопоставление интегральных метрик сценариев."""

    scenario_a: dict[str, Any] = Field(..., description="Сводка базового сценария A")
    scenario_b: dict[str, Any] = Field(..., description="Сводка сравниваемого сценария B")
    delta_average_availability_pct: float = Field(
        ..., description="Разность средних доступностей в процентах"
    )
    delta_min_availability_pct: float = Field(
        ..., description="Разность минимальных доступностей в процентах"
    )
    recommendation: str = Field(..., description="Инженерное заключение по итогам сопоставления")


class CompareResponse(BaseModel):
    """Результаты сравнительного анализа двух сценариев группировки."""

    parameter_differences: list[dict[str, Any]] = Field(
        ...,
        description="Список расхождений в параметрах конфигурации",
    )
    summary: CompareSummary = Field(..., description="Сводка сравнения показателей надежности")
    client_comparison: dict[str, Any] = Field(
        ...,
        description="Поклиентское сопоставление показателей доступности",
    )


class StageAnalysis(BaseModel):
    """Оценка очереди развертывания группировки."""

    stage: int = Field(..., description="Номер очереди развертывания")
    name: str = Field(..., description="Наименование этапа")
    satellites: int = Field(..., description="Число космических аппаратов на орбите")
    planes: int = Field(..., description="Число развернутых плоскостей")
    sla: float = Field(..., description="Достигнутый коэффициент готовности")
    target_met: bool = Field(..., description="Достижение целевого порога надежности")
    max_outage_hours: float | None = Field(
        default=None, description="Максимальная длительность перерыва в часах"
    )
    max_outage_minutes: float | None = Field(
        default=None, description="Максимальная длительность перерыва в минутах"
    )
    issue: str = Field(..., description="Ключевое ограничение этапа развертывания")


class BottleneckAnalysis(BaseModel):
    """Узкое место сетевой архитектуры."""

    type: str = Field(..., description="Тип фактора риска")
    severity: str = Field(..., description="Уровень критичности: high, medium или low")
    impact: str = Field(..., description="Влияние на общую надежность системы")
    recommendation: str = Field(..., description="Инженерная мера по устранению проблемы")


class RecommendationItem(BaseModel):
    """Конкретная рекомендация по модернизации группировки."""

    id: str = Field(..., description="Код рекомендации")
    title: str = Field(..., description="Краткое название")
    description: str = Field(..., description="Подробное техническое решение")


class RecommendationsResponse(BaseModel):
    """Инженерный отчет по анализу устойчивости и рекомендациям."""

    status: str = Field(..., description="Статус формирования отчета")
    target_sla: float = Field(..., description="Требуемый уровень доступности SLA")
    achieved_sla: float = Field(
        ..., description="Фактически достигнутый уровень SLA для полной группировки"
    )
    stages: list[StageAnalysis] = Field(..., description="Анализ очередей развертывания системы")
    bottlenecks: list[BottleneckAnalysis] = Field(..., description="Анализ узких мест архитектуры")
    recommendations: list[RecommendationItem] = Field(..., description="Инженерные рекомендации")


class ReportExportResponse(BaseModel):
    """Структурированный ответ с текстом инженерного отчета."""

    format: str = Field(..., description="Формат разметки документа")
    title: str = Field(..., description="Название документа")
    markdown: str = Field(..., description="Текстовое содержание отчета в формате Markdown")
