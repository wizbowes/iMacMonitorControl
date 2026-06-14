use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorConfig {
    pub name:   String,
    pub ip:     String,
    pub labels: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HaConfig {
    pub url:   String,
    pub token: String,
    #[serde(rename = "entityId", default)]
    pub entity_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub version:  u32,
    #[serde(rename = "savedAt")]
    pub saved_at: String,
    pub theme:    String,
    pub monitors: Vec<MonitorConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ha: Option<HaConfig>,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            version:  1,
            saved_at: String::new(),
            theme:    "auto".to_string(),
            monitors: vec![MonitorConfig {
                name:   "iMac".to_string(),
                ip:     "192.168.1.21".to_string(),
                labels: HashMap::new(),
            }],
            ha: None,
        }
    }
}

pub fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("iMacMonitorControl")
        .join("config.json")
}

pub fn load() -> AppConfig {
    let path = config_path();
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(config: &AppConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}
