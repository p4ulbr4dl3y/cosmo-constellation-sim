use std::f64::consts::PI;

/// Средний радиус Земли в километрах.
pub const EARTH_RADIUS_KM: f64 = 6371.0;
/// Гравитационный параметр Земли mu, км^3 / с^2.
pub const EARTH_MU: f64 = 398600.435507;
/// Угловая скорость суточного вращения Земли, рад / с.
pub const EARTH_OMEGA: f64 = 2.0 * PI / 86164.09054;

pub const SCHEMA_VERSION_INPUT: &str = "cosmo-A-1.0";
pub const SCHEMA_VERSION_RESULT: &str = "cosmo-A-result-1.0";

pub const FAILURE_REASON_NO_CLIENT_SAT: &str = "no_client_satellite";
pub const FAILURE_REASON_GATEWAY_OFFLINE: &str = "gateway_offline";
pub const FAILURE_REASON_NO_GW_SAT: &str = "no_gateway_satellite";
pub const FAILURE_REASON_ISL_DISCONNECTED: &str = "isl_disconnected";

pub fn get_failure_description_ru(code: &str) -> &'static str {
    match code {
        FAILURE_REASON_NO_CLIENT_SAT => {
            "Нет активного спутника над клиентским пунктом (вне зоны видимости)"
        }
        FAILURE_REASON_GATEWAY_OFFLINE => {
            "Все наземные шлюзы на техобслуживании / отключены"
        }
        FAILURE_REASON_NO_GW_SAT => {
            "Нет активного спутника над наземным шлюзом (шлюз вне зоны видимости)"
        }
        FAILURE_REASON_ISL_DISCONNECTED => {
            "Разрыв межспутниковой сети (нет связного пути через ISL)"
        }
        _ => "Неизвестная причина отказа",
    }
}
