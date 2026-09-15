use std::path::PathBuf;

/// Поиск каталога пресетов данных в рабочей директории и родительских папках.
pub fn find_data_dir() -> PathBuf {
    let candidates = vec![
        PathBuf::from("data"),
        PathBuf::from("../data"),
        PathBuf::from("../../data"),
        PathBuf::from("Данные"),
        PathBuf::from("../Данные"),
    ];
    for c in candidates {
        if c.exists() && c.is_dir() {
            return c;
        }
    }
    PathBuf::from("data")
}

/// Поиск каталога документации и рекомендаций.
pub fn find_docs_dir() -> PathBuf {
    let candidates = vec![
        PathBuf::from("docs"),
        PathBuf::from("../docs"),
        PathBuf::from("../../docs"),
    ];
    for c in candidates {
        if c.exists() && c.is_dir() {
            return c;
        }
    }
    PathBuf::from("docs")
}
