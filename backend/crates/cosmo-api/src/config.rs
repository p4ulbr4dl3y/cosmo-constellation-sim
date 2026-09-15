use std::path::PathBuf;

/// Поиск каталога пресетов данных в рабочей директории и родительских папках.
pub fn find_data_dir() -> PathBuf {
    ["data", "../data", "../../data", "../../../data"]
        .into_iter()
        .map(PathBuf::from)
        .find(|p| p.exists() && p.is_dir())
        .unwrap_or_else(|| PathBuf::from("data"))
}

/// Поиск каталога документации и рекомендаций.
pub fn find_docs_dir() -> PathBuf {
    ["docs", "../docs", "../../docs", "../../../docs"]
        .into_iter()
        .map(PathBuf::from)
        .find(|p| p.exists() && p.is_dir())
        .unwrap_or_else(|| PathBuf::from("docs"))
}
