import preset1 from './presets/01_full_constellation.json'
import preset2 from './presets/02_first_launch.json'
import preset3 from './presets/03_satellite_outages.json'
import preset4 from './presets/04_link_range.json'
import type { Scenario } from '../types/scenario'

export const PRESET_SCENARIOS: { id: string; label: string; description: string; data: Scenario }[] = [
  {
    id: '01_full_constellation',
    label: '01. Полная группировка',
    description: '48 аппаратов, 3 плоскости, 3 клиента, 1 шлюз (Murmansk)',
    data: preset1 as unknown as Scenario,
  },
  {
    id: '02_first_launch',
    label: '02. Первая очередь запуска',
    description: '16 аппаратов (launch_stage = 1)',
    data: preset2 as unknown as Scenario,
  },
  {
    id: '03_satellite_outages',
    label: '03. Отказы аппаратов',
    description: '10 аппаратов отключены с 6-го часа (t=21600s)',
    data: preset3 as unknown as Scenario,
  },
  {
    id: '04_link_range',
    label: '04. Дальность ISL 2000 км',
    description: 'Ограниченная дальность межспутниковых линков (2000 км вместо 3000 км)',
    data: preset4 as unknown as Scenario,
  },
]
