import math

EARTH_RADIUS_KM: float = 6371.0
EARTH_MU: float = 398600.435507
EARTH_OMEGA: float = 2.0 * math.pi / 86164.09054

SCHEMA_VERSION_INPUT: str = "cosmo-A-1.0"
SCHEMA_VERSION_RESULT: str = "cosmo-A-result-1.0"

FAILURE_REASON_NO_CLIENT_SAT: str = "no_client_satellite"
FAILURE_REASON_GATEWAY_OFFLINE: str = "gateway_offline"
FAILURE_REASON_NO_GW_SAT: str = "no_gateway_satellite"
FAILURE_REASON_ISL_DISCONNECTED: str = "isl_disconnected"

FAILURE_DESCRIPTIONS_RU: dict[str, str] = {
    FAILURE_REASON_NO_CLIENT_SAT: "Нет активного спутника над клиентским пунктом (вне зоны видимости)",
    FAILURE_REASON_GATEWAY_OFFLINE: "Все наземные шлюзы на техобслуживании / отключены",
    FAILURE_REASON_NO_GW_SAT: "Нет активного спутника над наземным шлюзом (шлюз вне зоны видимости)",
    FAILURE_REASON_ISL_DISCONNECTED: "Разрыв межспутниковой сети (нет связного пути через ISL)",
}
