use wasm_bindgen::prelude::*;
use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RollResult {
    pub rolls: Vec<u32>,
    pub total: u32,
    pub modifier: i32,
    pub grand_total: i32,
    pub dice_type: u32,
    pub count: u32,
}

/// Roll N dice of a given face count with an optional modifier.
/// Returns a JS value (object) with rolls, total, modifier, grand_total.
#[wasm_bindgen]
pub fn roll_dice(count: u32, faces: u32, modifier: i32) -> JsValue {
    let mut rng = rand::thread_rng();
    let count = count.max(1).min(100);
    let faces = faces.max(2).min(1000);

    let rolls: Vec<u32> = (0..count).map(|_| rng.gen_range(1..=faces)).collect();
    let total: u32 = rolls.iter().sum();
    let grand_total = total as i32 + modifier;

    let result = RollResult {
        rolls,
        total,
        modifier,
        grand_total,
        dice_type: faces,
        count,
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// Shorthand helpers for common dice
#[wasm_bindgen]
pub fn roll_d4(count: u32, modifier: i32) -> JsValue { roll_dice(count, 4, modifier) }

#[wasm_bindgen]
pub fn roll_d6(count: u32, modifier: i32) -> JsValue { roll_dice(count, 6, modifier) }

#[wasm_bindgen]
pub fn roll_d8(count: u32, modifier: i32) -> JsValue { roll_dice(count, 8, modifier) }

#[wasm_bindgen]
pub fn roll_d10(count: u32, modifier: i32) -> JsValue { roll_dice(count, 10, modifier) }

#[wasm_bindgen]
pub fn roll_d12(count: u32, modifier: i32) -> JsValue { roll_dice(count, 12, modifier) }

#[wasm_bindgen]
pub fn roll_d20(count: u32, modifier: i32) -> JsValue { roll_dice(count, 20, modifier) }

#[wasm_bindgen]
pub fn roll_d100(count: u32, modifier: i32) -> JsValue { roll_dice(count, 100, modifier) }

/// Returns seconds remaining until a Unix timestamp (ms).
#[wasm_bindgen]
pub fn seconds_until(target_unix_ms: f64, now_unix_ms: f64) -> f64 {
    let diff = target_unix_ms - now_unix_ms;
    if diff < 0.0 { 0.0 } else { diff / 1000.0 }
}

/// Format seconds as "Xd Xh Xm Xs"
#[wasm_bindgen]
pub fn format_countdown(total_seconds: f64) -> String {
    let secs = total_seconds as u64;
    let days = secs / 86400;
    let hours = (secs % 86400) / 3600;
    let mins = (secs % 3600) / 60;
    let s = secs % 60;

    if days > 0 {
        format!("{}d {}h {}m {}s", days, hours, mins, s)
    } else if hours > 0 {
        format!("{}h {}m {}s", hours, mins, s)
    } else if mins > 0 {
        format!("{}m {}s", mins, s)
    } else {
        format!("{}s", s)
    }
}
