import type {
  Scenario,
  Snapshot,
  SatelliteSnapshot,
  ClientTimeline,
  ClientMetrics,
  ResultExport,
  RouteRecord,
} from '../types/scenario'

/** Средний радиус Земли, км. */
export const R_EARTH = 6371.0

/** Гравитационный параметр Земли mu = G * M, км^3/с^2. */
export const MU = 398600.435507

/** Угловая скорость вращения Земли вокруг оси Z, рад/с (период сидерических суток 86164.09054 с). */
export const OMEGA = (2 * Math.PI) / 86164.09054

export const FAILURE_REASON_NO_CLIENT_SAT = 'no_client_satellite'
export const FAILURE_REASON_GATEWAY_OFFLINE = 'gateway_offline'
export const FAILURE_REASON_NO_GW_SAT = 'no_gateway_satellite'
export const FAILURE_REASON_ISL_DISCONNECTED = 'isl_disconnected'

export const FAILURE_DESCRIPTIONS_RU: Record<string, string> = {
  [FAILURE_REASON_NO_CLIENT_SAT]: 'Нет активного спутника над клиентским пунктом (вне зоны видимости)',
  [FAILURE_REASON_GATEWAY_OFFLINE]: 'Все наземные шлюзы на техобслуживании / отключены',
  [FAILURE_REASON_NO_GW_SAT]: 'Нет активного спутника над наземным шлюзом (шлюз вне зоны видимости)',
  [FAILURE_REASON_ISL_DISCONNECTED]: 'Разрыв межспутниковой сети (нет связного пути через ISL)',
}

/** Проверка, является ли значение конечным числом (не булевым и не NaN/Infinity). */
function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

/**
 * Валидация сценария на соответствие спецификации cosmo-A-1.0.
 * Полный паритет с backend/app/core/validator.py.
 */
export function validateScenario(s: unknown): string[] {
  const errors: string[] = []
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    return ['Сценарий должен быть объектом JSON.']
  }

  const sc = s as Record<string, any>

  // 1. Проверка версии схемы
  if (sc.schema_version !== 'cosmo-A-1.0') {
    errors.push(`Неподдерживаемая версия схемы: '${sc.schema_version}'. Ожидается 'cosmo-A-1.0'.`)
  }

  // 2. Параметры среды и временной сетки
  const env = sc.environment
  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    errors.push("Отсутствует обязательный раздел 'environment' (параметры среды и расчета).")
  } else {
    const envKeys = [
      'altitude_km',
      'inclination_deg',
      'earth_angle0_deg',
      'horizon_s',
      'step_s',
      'min_elevation_deg',
      'isl_range_km',
      'target_availability',
    ]
    for (const key of envKeys) {
      if (!(key in env)) {
        errors.push(`В разделе 'environment' отсутствует обязательное поле '${key}'.`)
      } else if (!isFiniteNumber(env[key])) {
        errors.push(`Поле '${key}' в 'environment' должно быть конечным числом.`)
      }
    }

    if ('altitude_km' in env && isFiniteNumber(env.altitude_km)) {
      if (env.altitude_km < 200.0 || env.altitude_km > 1200.0) {
        errors.push(`Недопустимая высота орбиты altitude_km=${env.altitude_km} км. Допустимый диапазон: [200, 1200].`)
      }
    }

    if ('inclination_deg' in env && isFiniteNumber(env.inclination_deg)) {
      if (env.inclination_deg <= 0.0 || env.inclination_deg > 180.0) {
        errors.push(`Недопустимое наклонение орбиты inclination_deg=${env.inclination_deg}°. Допустимый диапазон: (0, 180].`)
      }
    }

    const step_s = env.step_s
    const horizon_s = env.horizon_s
    let validTimeTypes = true

    if (step_s !== undefined && (!Number.isInteger(step_s) || typeof step_s === 'boolean')) {
      errors.push('Шаг расчета step_s должен быть целым положительным числом секунд.')
      validTimeTypes = false
    }

    if (horizon_s !== undefined && (!Number.isInteger(horizon_s) || typeof horizon_s === 'boolean')) {
      errors.push('Горизонт расчета horizon_s должен быть целым положительным числом секунд.')
      validTimeTypes = false
    }

    if (validTimeTypes && step_s !== undefined && horizon_s !== undefined) {
      if (!(step_s > 0 && step_s <= horizon_s && horizon_s <= 172800)) {
        errors.push(
          `Недопустимая временная сетка: step_s=${step_s}, horizon_s=${horizon_s}. Должно выполняться 0 < step_s <= horizon_s <= 172800 (до 48 часов).`
        )
      } else if (horizon_s % step_s !== 0) {
        errors.push(`Горизонт расчета horizon_s (${horizon_s} с) должен быть нацело кратен шагу step_s (${step_s} с).`)
      }
    }

    if ('min_elevation_deg' in env && isFiniteNumber(env.min_elevation_deg)) {
      if (env.min_elevation_deg < 0.0 || env.min_elevation_deg >= 90.0) {
        errors.push(`Недопустимый минимальный угол возвышения min_elevation_deg=${env.min_elevation_deg}°. Допустимо: [0, 90).`)
      }
    }

    if ('isl_range_km' in env && isFiniteNumber(env.isl_range_km)) {
      if (env.isl_range_km <= 0.0 || env.isl_range_km > 10000.0) {
        errors.push(`Недопустимая дальность ISL isl_range_km=${env.isl_range_km} км. Допустимо: (0, 10000].`)
      }
    }

    if ('target_availability' in env && isFiniteNumber(env.target_availability)) {
      if (env.target_availability < 0.0 || env.target_availability > 1.0) {
        errors.push(`Целевая доступность target_availability=${env.target_availability} должна быть в диапазоне [0.0, 1.0].`)
      }
    }
  }

  // 3. Конфигурация орбитальной группировки
  const design = sc.design
  const planeIds = new Set<string>()
  const satIds = new Set<string>()

  if (!design || typeof design !== 'object' || Array.isArray(design)) {
    errors.push("Отсутствует обязательный раздел 'design' (конфигурация группировки).")
  } else {
    const stage = design.launch_stage
    if (!Number.isInteger(stage) || typeof stage === 'boolean' || ![1, 2, 3].includes(stage)) {
      errors.push(`Параметр launch_stage должен быть целым числом 1, 2 или 3. Получено: ${stage}`)
    }

    const planes = design.planes
    if (!Array.isArray(planes) || planes.length === 0) {
      errors.push("Список орбитальных плоскостей 'planes' пуст или отсутствует.")
    } else {
      planes.forEach((p, idx) => {
        if (!p || typeof p !== 'object') {
          errors.push(`Элемент #${idx} в 'planes' должен быть объектом.`)
          return
        }
        const pid = p.id
        if (!pid || typeof pid !== 'string') {
          errors.push(`Плоскость #${idx} имеет некорректный id: ${pid}`)
        } else if (planeIds.has(pid)) {
          errors.push(`Дублирующийся идентификатор плоскости: '${pid}'.`)
        } else {
          planeIds.add(pid)
        }

        for (const angleKey of ['raan_deg', 'phase_deg'] as const) {
          const val = p[angleKey]
          if (!isFiniteNumber(val) || val < 0.0 || val >= 360.0) {
            errors.push(`Недопустимый угол ${angleKey}=${val} для плоскости '${pid}'. Допустимо: [0, 360).`)
          }
        }
      })
    }

    const sats = design.satellites
    if (!Array.isArray(sats) || sats.length === 0) {
      errors.push("Список спутников 'satellites' пуст или отсутствует.")
    } else {
      sats.forEach((sat, idx) => {
        if (!sat || typeof sat !== 'object') {
          errors.push(`Элемент #${idx} в 'satellites' должен быть объектом.`)
          return
        }
        const sid = sat.id
        if (!sid || typeof sid !== 'string') {
          errors.push(`Спутник #${idx} имеет некорректный id: ${sid}`)
        } else if (satIds.has(sid)) {
          errors.push(`Дублирующийся идентификатор спутника: '${sid}'.`)
        } else {
          satIds.add(sid)
        }

        const pid = sat.plane_id
        if (!planeIds.has(pid)) {
          errors.push(`Спутник '${sid}' ссылается на несуществующую плоскость plane_id='${pid}'.`)
        }

        const batch = sat.launch_batch
        if (!Number.isInteger(batch) || typeof batch === 'boolean' || ![1, 2, 3].includes(batch)) {
          errors.push(`Спутник '${sid}' имеет недопустимый launch_batch=${batch}. Допустимо: 1, 2 или 3.`)
        }

        const slot = sat.slot_deg
        if (!isFiniteNumber(slot)) {
          errors.push(`Спутник '${sid}' имеет некорректный slot_deg=${slot}. Ожидается число.`)
        }
      })
    }
  }

  // 4. Наземные пункты
  const ground = sc.ground_sites
  const groundIds = new Set<string>()
  let hasClient = false
  let hasGateway = false
  const gatewayIds = new Set<string>()

  if (!Array.isArray(ground) || ground.length === 0) {
    errors.push("Список наземных пунктов 'ground_sites' пуст или отсутствует.")
  } else {
    ground.forEach((g, idx) => {
      if (!g || typeof g !== 'object') {
        errors.push(`Элемент #${idx} в 'ground_sites' должен быть объектом.`)
        return
      }
      const gid = g.id
      if (!gid || typeof gid !== 'string') {
        errors.push(`Наземный пункт #${idx} имеет некорректный id: ${gid}`)
      } else if (groundIds.has(gid)) {
        errors.push(`Дублирующийся идентификатор наземного пункта: '${gid}'.`)
      } else if (satIds.has(gid)) {
        errors.push(`Идентификатор наземного пункта '${gid}' совпадает с идентификатором спутника!`)
      } else {
        groundIds.add(gid)
      }

      const role = g.role
      if (role === 'client') {
        hasClient = true
      } else if (role === 'gateway') {
        hasGateway = true
        if (gid) gatewayIds.add(gid)
      } else {
        errors.push(`Пункт '${gid}' имеет недопустимую роль role='${role}'. Допустимо: 'client' или 'gateway'.`)
      }

      const lat = g.lat_deg
      const lon = g.lon_deg
      if (!isFiniteNumber(lat) || lat < -90.0 || lat > 90.0) {
        errors.push(`Пункт '${gid}' имеет недопустимую широту lat_deg=${lat}. Допустимо: [-90, 90].`)
      }
      if (!isFiniteNumber(lon) || lon < -180.0 || lon > 180.0) {
        errors.push(`Пункт '${gid}' имеет недопустимую долготу lon_deg=${lon}. Допустимо: [-180, 180].`)
      }
    })

    if (!hasClient) {
      errors.push("В сценарии должен присутствовать хотя бы один клиентский пункт (role='client').")
    }
    if (!hasGateway) {
      errors.push("В сценарии должен присутствовать хотя бы один шлюз (role='gateway').")
    }
  }

  // 5. Отказы спутников и периоды недоступности шлюзов
  const maxH = Number.isInteger(env?.horizon_s) && typeof env.horizon_s !== 'boolean' ? env.horizon_s : 172800

  const failures = sc.failures ?? []
  if (!Array.isArray(failures)) {
    errors.push("Поле 'failures' должно быть списком.")
  } else {
    failures.forEach((f, idx) => {
      if (!f || typeof f !== 'object') {
        errors.push(`Элемент #${idx} в 'failures' должен быть объектом.`)
        return
      }
      const sid = f.satellite_id
      if (!satIds.has(sid)) {
        errors.push(`Отказ #${idx} ссылается на неизвестный satellite_id='${sid}'.`)
      }
      const start_s = f.start_s
      const end_s = f.end_s
      if (!isFiniteNumber(start_s) || !isFiniteNumber(end_s)) {
        errors.push(`Интервал отказа #${idx} должен содержать числовые start_s и end_s.`)
      } else if (!(start_s >= 0 && start_s < end_s && end_s <= maxH)) {
        errors.push(
          `Отказ #${idx} для спутника '${sid}' имеет некорректный интервал [${start_s}, ${end_s}). Должно выполняться: 0 <= start_s < end_s <= horizon_s (${maxH}).`
        )
      }
    })
  }

  const gwOutages = sc.gateway_outages ?? []
  if (!Array.isArray(gwOutages)) {
    errors.push("Поле 'gateway_outages' должно быть списком.")
  } else {
    gwOutages.forEach((f, idx) => {
      if (!f || typeof f !== 'object') {
        errors.push(`Элемент #${idx} в 'gateway_outages' должен быть объектом.`)
        return
      }
      const gid = f.gateway_id
      if (!gatewayIds.has(gid)) {
        errors.push(`Период недоступности шлюза #${idx} ссылается на неизвестный gateway_id='${gid}'.`)
      }
      const start_s = f.start_s
      const end_s = f.end_s
      if (!isFiniteNumber(start_s) || !isFiniteNumber(end_s)) {
        errors.push(`Интервал недоступности шлюза #${idx} должен содержать числовые start_s и end_s.`)
      } else if (!(start_s >= 0 && start_s < end_s && end_s <= maxH)) {
        errors.push(
          `Период недоступности #${idx} для шлюза '${gid}' имеет некорректный интервал [${start_s}, ${end_s}). Должно выполняться: 0 <= start_s < end_s <= horizon_s (${maxH}).`
        )
      }
    })
  }

  return errors
}

/**
 * Классифицирует причину отсутствия сетевого маршрута.
 *
 * Приоритет проверки:
 * - отсутствие спутника над клиентом;
 * - отключение всех наземных шлюзов;
 * - отсутствие спутника над наземным шлюзом;
 * - разрыв связности межспутниковых линий связи ISL.
 */
export function classifyFailure(
  hasClientSatellite: boolean,
  onlineGatewaysCount: number,
  hasGatewaySatellite: boolean
): { code: string; description: string } {
  let code: string
  if (!hasClientSatellite) {
    code = FAILURE_REASON_NO_CLIENT_SAT
  } else if (onlineGatewaysCount === 0) {
    code = FAILURE_REASON_GATEWAY_OFFLINE
  } else if (!hasGatewaySatellite) {
    code = FAILURE_REASON_NO_GW_SAT
  } else {
    code = FAILURE_REASON_ISL_DISCONNECTED
  }
  return { code, description: FAILURE_DESCRIPTIONS_RU[code] }
}

/**
 * Координаты наземного пункта связи в геоцентрической системе ECEF.
 */
export interface GroundPos {
  id: string
  name: string
  role: 'client' | 'gateway'
  lat_deg: number
  lon_deg: number
  x: number
  y: number
  z: number
}

/**
 * Вычисляет декартовы координаты ECEF (км) для всех наземных пунктов сценария.
 */
export function getGroundPositions(scenario: Scenario): GroundPos[] {
  const sites = Array.isArray(scenario?.ground_sites) ? scenario.ground_sites : []
  return sites.map((g) => {
    const lat = (g.lat_deg * Math.PI) / 180
    const lon = (g.lon_deg * Math.PI) / 180
    return {
      ...g,
      x: R_EARTH * Math.cos(lat) * Math.cos(lon),
      y: R_EARTH * Math.cos(lat) * Math.sin(lon),
      z: R_EARTH * Math.sin(lat),
    }
  })
}

/**
 * Элемент очереди с приоритетом для поиска маршрута Дейкстры.
 */
export interface PQItem {
  pri: number
  sec: number
  curr: string
  path: string[]
  totalDist: number
}

/**
 * Двоичная куча минимального приоритета.
 * Используется для извлечения вершин с наименьшей стоимостью пути.
 */
export class MinHeap {
  private data: PQItem[] = []

  push(item: PQItem) {
    this.data.push(item)
    this.bubbleUp(this.data.length - 1)
  }

  pop(): PQItem | undefined {
    if (this.data.length === 0) return undefined
    const top = this.data[0]
    const bottom = this.data.pop()!
    if (this.data.length > 0) {
      this.data[0] = bottom
      this.sinkDown(0)
    }
    return top
  }

  get length(): number {
    return this.data.length
  }

  private compare(a: PQItem, b: PQItem): number {
    if (a.pri !== b.pri) return a.pri - b.pri
    return a.sec - b.sec
  }

  private bubbleUp(idx: number) {
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1
      if (this.compare(this.data[idx], this.data[parentIdx]) < 0) {
        const tmp = this.data[idx]
        this.data[idx] = this.data[parentIdx]
        this.data[parentIdx] = tmp
        idx = parentIdx
      } else {
        break
      }
    }
  }

  private sinkDown(idx: number) {
    const len = this.data.length
    while (true) {
      let smallest = idx
      const left = (idx << 1) + 1
      const right = left + 1

      if (left < len && this.compare(this.data[left], this.data[smallest]) < 0) {
        smallest = left
      }
      if (right < len && this.compare(this.data[right], this.data[smallest]) < 0) {
        smallest = right
      }
      if (smallest !== idx) {
        const tmp = this.data[idx]
        this.data[idx] = this.data[smallest]
        this.data[smallest] = tmp
        idx = smallest
      } else {
        break
      }
    }
  }
}

/**
 * Находит кратчайший путь от клиентского узла к любому активному наземному шлюзу по алгоритму Дейкстры.
 *
 * Ограничения и правила обхода:
 * - транзитные узлы могут быть только спутниками;
 * - заход в другие клиентские пункты запрещен;
 * - наземный шлюз может быть только конечным узлом маршрута (минимум 2 ребра: клиент -> спутник... -> шлюз);
 * - критерий оптимизации: минимум переходов либо минимальная евклидова дистанция;
 */
export function findRouteDijkstra(
  adj: Map<string, Array<[string, number]>>,
  clientId: string,
  onlineGateways: Set<string>,
  allClients: Set<string>,
  metric: 'hops' | 'distance' = 'hops'
): { path: string[]; distance: number } {
  if (onlineGateways.size === 0 || !adj.has(clientId)) {
    return { path: [], distance: 0 }
  }

  const bestCost = new Map<string, [number, number]>()
  const pq = new MinHeap()

  pq.push({ pri: 0, sec: 0, curr: clientId, path: [clientId], totalDist: 0 })
  bestCost.set(clientId, [0, 0])

  while (pq.length > 0) {
    const item = pq.pop()!
    const { pri, sec, curr, path, totalDist } = item

    if (onlineGateways.has(curr) && curr !== clientId) {
      if (path.length >= 3) {
        return { path, distance: totalDist }
      }
    }

    const recorded = bestCost.get(curr)
    if (recorded) {
      if (pri > recorded[0] || (pri === recorded[0] && sec > recorded[1])) {
        continue
      }
    }

    const neighbors = adj.get(curr) || []
    for (const [nxt, d] of neighbors) {
      if (allClients.has(nxt) && nxt !== clientId) continue
      if (onlineGateways.has(nxt) && path.length < 2) continue
      if (path.includes(nxt)) continue

      const newHops = path.length
      const newDist = totalDist + d

      const newPri = metric === 'hops' ? newHops : newDist
      const newSec = metric === 'hops' ? newDist : newHops

      const curBest = bestCost.get(nxt)
      if (!curBest || newPri < curBest[0] || (newPri === curBest[0] && newSec < curBest[1])) {
        bestCost.set(nxt, [newPri, newSec])
        pq.push({
          pri: newPri,
          sec: newSec,
          curr: nxt,
          path: [...path, nxt],
          totalDist: newDist,
        })
      }
    }
  }

  return { path: [], distance: 0 }
}

/**
 * Рассчитывает мгновенный снимок состояния созвездия и сетевой топологии на расчетный момент времени t_s (в секундах).
 *
 * Физические основы расчета:
 * - радиус круговой орбиты r = R_EARTH + h, среднее движение n = sqrt(mu / r^3);
 * - фазирование спутника: аргумент широты u = (slot_deg + phase_deg) + n * t_s;
 * - ориентация плоскости: долгота восходящего узла raan_deg, наклонение inc;
 * - координаты спутника в ECI: пересчет по матрице ориентации плоскости;
 * - координаты спутника в ECEF: поворот ECI вокруг оси Z на угол вращения Земли th = earth_angle0 + OMEGA * t_s;
 * - межспутниковые линии ISL: дальность <= isl_range_km с контролем затенения Землей (радиус сферы R_EARTH);
 * - радиолинии «земля - борт»: угол места >= min_elevation_deg с учетом статуса шлюза.
 */
export function calculateSnapshot(scenario: Scenario, t_s: number): Snapshot {
  if (!scenario || typeof scenario !== 'object') {
    return { t_s, satellites: [], edges: [], elevations: {}, routes: {}, outageReasons: {} }
  }
  const environment = scenario.environment || {
    altitude_km: 550,
    inclination_deg: 87,
    earth_angle0_deg: 0,
    horizon_s: 86400,
    step_s: 120,
    min_elevation_deg: 10,
    isl_range_km: 3000,
    target_availability: 0.9,
  }
  const design = scenario.design || { launch_stage: 3, planes: [], satellites: [] }
  const ground_sites = Array.isArray(scenario.ground_sites) ? scenario.ground_sites : []
  const failures = Array.isArray(scenario.failures) ? scenario.failures : []
  const gateway_outages = Array.isArray(scenario.gateway_outages) ? scenario.gateway_outages : []

  // Радиус орбиты и среднее движение на высоте altitude_km
  const r = R_EARTH + (environment.altitude_km || 550)
  const n = Math.sqrt(MU / Math.pow(r, 3))
  const inc = ((environment.inclination_deg ?? 87) * Math.PI) / 180
  // Угол собственного вращения Земли вокруг оси Z на расчетную секунду t_s
  const th = ((environment.earth_angle0_deg ?? 0) * Math.PI) / 180 + OMEGA * t_s
  const cosTh = Math.cos(th)
  const sinTh = Math.sin(th)

  const planes = Array.isArray(design.planes) ? design.planes : []
  const planeMap = new Map(planes.map((p) => [p.id, p]))

  // Проверка интервалов отказа космических аппаратов
  const activeFailures = new Set<string>()
  for (const f of failures) {
    if (f.start_s <= t_s && t_s < f.end_s) {
      activeFailures.add(f.satellite_id)
    }
  }

  // Проверка интервалов отключения наземных шлюзов
  const activeGateways = new Set<string>()
  for (const g of ground_sites) {
    if (g.role === 'gateway') {
      const isOut = gateway_outages.some(
        (o) => o.gateway_id === g.id && o.start_s <= t_s && t_s < o.end_s
      )
      if (!isOut) {
        activeGateways.add(g.id)
      }
    }
  }

  // Расчет баллистических положений спутников в системах ECI и ECEF
  const satSnapshots: SatelliteSnapshot[] = []
  const satIndexMap = new Map<string, number>()
  const satellites = Array.isArray(design.satellites) ? design.satellites : []

  for (let i = 0; i < satellites.length; i++) {
    const sat = satellites[i]
    const p = planeMap.get(sat.plane_id) || { raan_deg: 0, phase_deg: 0 }
    // Аргумент широты с учетом начальной фазы и среднего движения
    const u = ((sat.slot_deg + p.phase_deg) * Math.PI) / 180 + n * t_s
    const om = (p.raan_deg * Math.PI) / 180

    const cu = Math.cos(u)
    const su = Math.sin(u)
    const co = Math.cos(om)
    const so = Math.sin(om)
    const cosInc = Math.cos(inc)
    const sinInc = Math.sin(inc)

    // Декартовы координаты в инерциальной геоцентрической системе ECI
    const xi = r * (co * cu - so * su * cosInc)
    const yi = r * (so * cu + co * su * cosInc)
    const zi = r * su * sinInc

    // Преобразование во вращающуюся гринвичскую систему ECEF на момент t_s
    const x = cosTh * xi + sinTh * yi
    const y = -sinTh * xi + cosTh * yi
    const z = zi

    const isFailed = activeFailures.has(sat.id)
    const isLaunched = sat.launch_batch <= design.launch_stage
    const isActive = isLaunched && !isFailed

    const lat_deg = (Math.asin(Math.max(-1, Math.min(1, z / r))) * 180) / Math.PI
    const lon_deg = (Math.atan2(y, x) * 180) / Math.PI

    satSnapshots.push({
      id: sat.id,
      plane_id: sat.plane_id,
      x_km: x,
      y_km: y,
      z_km: z,
      lat_deg,
      lon_deg,
      active: isActive,
      failed: isFailed,
      launch_batch: sat.launch_batch,
    })
    satIndexMap.set(sat.id, i)
  }

  // Формирование межспутниковых линий связи с проверкой затенения Землей
  const edges: [string, string, number][] = []
  const islRange = environment.isl_range_km
  const islRangeSq = islRange * islRange
  const rEarthSq = R_EARTH * R_EARTH

  // Список смежности графа сети: узел -> массив пар [соседний_узел, расстояние]
  const adj = new Map<string, Array<[string, number]>>()
  const addEdge = (u: string, v: string, dist: number) => {
    let listU = adj.get(u)
    if (!listU) {
      listU = []
      adj.set(u, listU)
    }
    listU.push([v, dist])

    let listV = adj.get(v)
    if (!listV) {
      listV = []
      adj.set(v, listV)
    }
    listV.push([u, dist])
  }

  const numSats = satSnapshots.length
  for (let i = 0; i < numSats; i++) {
    const s1 = satSnapshots[i]
    if (!s1.active) continue

    for (let j = i + 1; j < numSats; j++) {
      const s2 = satSnapshots[j]
      if (!s2.active) continue

      const dx = s2.x_km - s1.x_km
      const dy = s2.y_km - s1.y_km
      const dz = s2.z_km - s1.z_km
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq < islRangeSq) {
        // Контроль геометрической видимости прямой связи: минимальное расстояние от центра Земли до луча
        const denom = distSq
        const num = -(s1.x_km * dx + s1.y_km * dy + s1.z_km * dz)
        const lam = Math.max(0, Math.min(1, denom > 1e-12 ? num / denom : 0))

        const cx = s1.x_km + lam * dx
        const cy = s1.y_km + lam * dy
        const cz = s1.z_km + lam * dz
        const closestSq = cx * cx + cy * cy + cz * cz

        if (closestSq > rEarthSq) {
          const dist = Math.sqrt(distSq)
          edges.push([s1.id, s2.id, dist])
          addEdge(s1.id, s2.id, dist)
        }
      }
    }
  }

  // Расчет углов места и радиолиний для наземных станций
  const groundPositions = getGroundPositions(scenario)
  const elevations: Record<string, Record<string, number>> = {}
  const minEl = environment.min_elevation_deg

  for (const g of groundPositions) {
    elevations[g.id] = {}
    const isGatewayActive = g.role === 'client' || activeGateways.has(g.id)

    for (let i = 0; i < numSats; i++) {
      const s = satSnapshots[i]
      if (!s.active) continue

      const difX = s.x_km - g.x
      const difY = s.y_km - g.y
      const difZ = s.z_km - g.z
      const dl = Math.sqrt(difX * difX + difY * difY + difZ * difZ)

      const dot = difX * (g.x / R_EARTH) + difY * (g.y / R_EARTH) + difZ * (g.z / R_EARTH)
      const cosZen = Math.max(-1, Math.min(1, dot / dl))
      const elDeg = (Math.asin(cosZen) * 180) / Math.PI

      elevations[g.id][s.id] = elDeg

      if (elDeg >= minEl && isGatewayActive) {
        edges.push([g.id, s.id, dl])
        addEdge(g.id, s.id, dl)
      }
    }
  }

  // Поиск кратчайшего пути от каждого клиента до доступных шлюзов по алгоритму Дейкстры
  const allClients = new Set<string>(groundPositions.filter((g) => g.role === 'client').map((g) => g.id))
  const onlineGateways = new Set<string>(
    groundPositions.filter((gw) => gw.role === 'gateway' && activeGateways.has(gw.id)).map((gw) => gw.id)
  )

  const routes: Record<string, string[]> = {}
  const outageReasons: Record<string, string> = {}
  const outageCodes: Record<string, string> = {}

  for (const g of groundPositions) {
    if (g.role !== 'client') continue

    const visibleSats = Object.entries(elevations[g.id] || {}).filter(
      ([, el]) => el >= minEl
    )
    const clientHasVisible = visibleSats.length > 0

    const anyGatewayActive = onlineGateways.size > 0
    let anyGatewayVisible = false
    for (const gwId of onlineGateways) {
      const gwVisible = Object.entries(elevations[gwId] || {}).some(
        ([, el]) => el >= minEl
      )
      if (gwVisible) {
        anyGatewayVisible = true
        break
      }
    }

    const { path } = findRouteDijkstra(adj, g.id, onlineGateways, allClients, 'hops')

    if (path.length > 0) {
      routes[g.id] = path
    } else {
      routes[g.id] = []
      const { code } = classifyFailure(clientHasVisible, onlineGateways.size, anyGatewayVisible)
      outageCodes[g.id] = code
      // Иерархия причин: 1 - нет спутника над клиентом, 2 - шлюз отключен, 3 - нет спутника над шлюзом, 4 - разрыв ISL
      if (!clientHasVisible) {
        outageReasons[g.id] = `Нет спутников над ${g.id} (уг. места < ${minEl}°)`
      } else if (!anyGatewayActive) {
        outageReasons[g.id] = 'Шлюз отключен (Gateway outage)'
      } else if (!anyGatewayVisible) {
        outageReasons[g.id] = `Нет спутников над шлюзом (уг. места < ${minEl}°)`
      } else {
        outageReasons[g.id] = 'Разрыв ISL связности в созвездии'
      }
    }
  }

  return {
    t_s,
    satellites: satSnapshots,
    edges,
    elevations,
    routes,
    outageReasons,
    outageCodes,
  }
}

/**
 * Рассчитывает функционирование созвездия спутников на протяжении всего горизонта моделирования.
 * Возвращает временные интервалы (слоты) и сводные метрики надежности для каждого клиента.
 */
export function calculateFullTimeline(scenario: Scenario): {
  timelines: Record<string, ClientTimeline>
  allSnapshots?: Map<number, Snapshot>
} {
  if (!scenario || typeof scenario !== 'object') {
    return { timelines: {} }
  }
  const environment = scenario.environment || {
    altitude_km: 550,
    inclination_deg: 87,
    earth_angle0_deg: 0,
    horizon_s: 86400,
    step_s: 120,
    min_elevation_deg: 10,
    isl_range_km: 3000,
    target_availability: 0.9,
  }
  const ground_sites = Array.isArray(scenario.ground_sites) ? scenario.ground_sites : []
  const step_s = Math.max(1, environment.step_s || 120)
  const horizon_s = Math.max(step_s, environment.horizon_s || 86400)
  const totalSlots = Math.floor(horizon_s / step_s)

  const clients = ground_sites.filter((g) => g.role === 'client')
  const clientTimelines: Record<string, ClientTimeline> = {}

  for (const c of clients) {
    clientTimelines[c.id] = {
      clientId: c.id,
      name: c.name,
      slots: [],
      metrics: {
        client_id: c.id,
        name: c.name,
        visibility_ratio: 0,
        availability_ratio: 0,
        max_gap_s: 0,
        avg_hops: 0,
        total_slots: totalSlots,
        available_slots: 0,
        visible_slots: 0,
      },
    }
  }

  for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
    const t_s = slotIdx * step_s
    const snap = calculateSnapshot(scenario, t_s)

    for (const c of clients) {
      const path = snap.routes[c.id] || []
      const hasPath = path.length > 0
      const visibleSats = Object.values(snap.elevations[c.id] || {}).some(
        (el) => el >= environment.min_elevation_deg
      )
      const hops = hasPath ? path.length - 1 : 0
      const reason = !hasPath ? snap.outageReasons[c.id] : undefined
      const failureCode = !hasPath ? snap.outageCodes?.[c.id] : undefined

      clientTimelines[c.id].slots.push({
        t_s,
        hasPath,
        isVisible: visibleSats,
        hops,
        path,
        reason,
        failureCode,
      })
    }
  }

  // Расчет итоговых статистических метрик для каждого клиента
  for (const c of clients) {
    const tl = clientTimelines[c.id]
    let availCount = 0
    let visCount = 0
    let totalHops = 0
    let currentGapSlots = 0
    let maxGapSlots = 0

    for (const slot of tl.slots) {
      if (slot.isVisible) visCount++
      if (slot.hasPath) {
        availCount++
        totalHops += slot.hops
        currentGapSlots = 0
      } else {
        currentGapSlots++
        if (currentGapSlots > maxGapSlots) {
          maxGapSlots = currentGapSlots
        }
      }
    }

    tl.metrics.total_slots = totalSlots
    tl.metrics.available_slots = availCount
    tl.metrics.visible_slots = visCount
    tl.metrics.availability_ratio = totalSlots > 0 ? availCount / totalSlots : 0
    tl.metrics.visibility_ratio = totalSlots > 0 ? visCount / totalSlots : 0
    tl.metrics.max_gap_s = maxGapSlots * step_s
    tl.metrics.avg_hops = availCount > 0 ? totalHops / availCount : 0
  }

  return { timelines: clientTimelines }
}

/**
 * Формирует итоговый объект результатов моделирования в формате схемы cosmo-A-result-1.0.
 */
export function exportResultFile(
  scenario: Scenario,
  timelines: Record<string, ClientTimeline>
): ResultExport {
  const routes: RouteRecord[] = []
  const { environment, ground_sites } = scenario
  const step_s = Math.max(1, environment.step_s || 120)
  const horizon_s = Math.max(step_s, environment.horizon_s || 86400)
  const totalSlots = Math.floor(horizon_s / step_s)
  const clients = ground_sites.filter((g) => g.role === 'client')

  // Использование кэшированных маршрутов из таймлайна, если они уже рассчитаны
  const hasCachedRoutes = clients.every(
    (c) => timelines[c.id] && timelines[c.id].slots.length >= totalSlots && timelines[c.id].slots[0]?.path !== undefined
  )

  if (hasCachedRoutes) {
    for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
      const t_s = slotIdx * step_s
      for (const c of clients) {
        routes.push({
          t_s,
          client_id: c.id,
          path: timelines[c.id].slots[slotIdx]?.path || [],
        })
      }
    }
  } else {
    for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
      const t_s = slotIdx * step_s
      const snap = calculateSnapshot(scenario, t_s)

      for (const c of clients) {
        routes.push({
          t_s,
          client_id: c.id,
          path: snap.routes[c.id] || [],
        })
      }
    }
  }

  const summary_metrics: Record<string, ClientMetrics> = {}
  for (const [id, tl] of Object.entries(timelines)) {
    summary_metrics[id] = tl.metrics
  }

  const clientVals = Object.values(summary_metrics)
  const meanAvail =
    clientVals.length > 0
      ? clientVals.reduce((acc, m) => acc + m.availability_ratio, 0) / clientVals.length
      : 0
  const meanHops =
    clientVals.length > 0
      ? clientVals.reduce((acc, m) => acc + m.avg_hops, 0) / clientVals.length
      : 0
  const targetAvail = scenario.environment.target_availability ?? 0.9
  const allMeetSla =
    clientVals.length > 0 && clientVals.every((m) => m.availability_ratio >= targetAvail)

  return {
    schema_version: 'cosmo-A-result-1.0',
    meta: {
      generator: 'CosmoConstellation Studio v1.0',
      calculated_at: new Date().toISOString(),
    },
    effective_scenario: scenario,
    routes,
    metrics: summary_metrics,
    summary_metrics,
    summary: {
      average_availability_pct: +(meanAvail * 100).toFixed(2),
      min_availability_pct:
        clientVals.length > 0
          ? +(Math.min(...clientVals.map((m) => m.availability_ratio)) * 100).toFixed(2)
          : 0,
      all_meet_target: allMeetSla,
      mean_availability: meanAvail,
      mean_hops: meanHops,
      all_clients_meet_sla: allMeetSla,
    },
  }
}

export const exportResults = exportResultFile
