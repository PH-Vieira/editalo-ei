//! Comandos Tauri reais — usam o FFmpeg/FFprobe empacotados como *sidecar*.
//!
//! Fluxo do MVP (trim + concat de 1 trilha de vídeo):
//!   probe_media  → metadados via ffprobe
//!   export_video → corta cada clipe (in/duração) e concatena num único .mp4
//!
//! O progresso é emitido ao frontend pelo evento `export://progress`.

use serde::{Deserialize, Serialize};
use tauri::api::process::{Command, CommandEvent};

#[derive(Debug, Serialize)]
pub struct MediaProbe {
    pub path: String,
    pub kind: String, // "video" | "audio" | "image"
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
}

/// Um trecho a ser exportado: arquivo de origem + ponto de entrada + duração.
#[derive(Debug, Deserialize, Clone)]
pub struct Segment {
    pub path: String,
    #[serde(rename = "inPoint")]
    pub in_point: f64,
    pub duration: f64,
}

#[derive(Debug, Deserialize)]
pub struct ExportRequest {
    pub segments: Vec<Segment>,
    #[serde(rename = "outputPath")]
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
}

#[derive(Debug, Clone, Serialize)]
struct ExportProgress {
    progress: f64, // 0.0 – 1.0
    done: bool,
    output: Option<String>,
}

/* ------------------------------------------------------------------ */
/* ffprobe                                                            */
/* ------------------------------------------------------------------ */

fn run_ffprobe(args: &[&str]) -> Result<String, String> {
    let output = Command::new_sidecar("ffprobe")
        .map_err(|e| format!("ffprobe sidecar indisponível: {e}"))?
        .args(args)
        .output()
        .map_err(|e| format!("falha ao executar ffprobe: {e}"))?;
    if !output.status.success() {
        return Err(format!("ffprobe falhou: {}", output.stderr));
    }
    Ok(output.stdout)
}

fn eval_rate(rate: &str) -> f64 {
    // "30000/1001" → 29.97
    if let Some((n, d)) = rate.split_once('/') {
        let n: f64 = n.parse().unwrap_or(0.0);
        let d: f64 = d.parse().unwrap_or(1.0);
        if d != 0.0 {
            return n / d;
        }
    }
    rate.parse().unwrap_or(0.0)
}

fn is_image_ext(path: &str) -> bool {
    let lower = path.to_lowercase();
    [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tiff"]
        .iter()
        .any(|ext| lower.ends_with(ext))
}

/// Verdadeiro se o arquivo possui ao menos uma trilha de áudio.
fn has_audio(path: &str) -> bool {
    run_ffprobe(&[
        "-v", "quiet", "-select_streams", "a", "-show_entries", "stream=index",
        "-of", "csv=p=0", path,
    ])
    .map(|out| !out.trim().is_empty())
    .unwrap_or(false)
}

#[tauri::command]
pub async fn probe_media(path: String) -> Result<MediaProbe, String> {
    let json = run_ffprobe(&[
        "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", &path,
    ])?;
    let v: serde_json::Value =
        serde_json::from_str(&json).map_err(|e| format!("JSON inválido do ffprobe: {e}"))?;

    let streams = v["streams"].as_array().cloned().unwrap_or_default();
    let video = streams.iter().find(|s| s["codec_type"] == "video");
    let audio = streams.iter().find(|s| s["codec_type"] == "audio");

    let duration = v["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let (width, height, fps) = match video {
        Some(vs) => (
            vs["width"].as_u64().unwrap_or(0) as u32,
            vs["height"].as_u64().unwrap_or(0) as u32,
            eval_rate(vs["avg_frame_rate"].as_str().unwrap_or("0/1")),
        ),
        None => (0, 0, 0.0),
    };

    let kind = if is_image_ext(&path) {
        "image"
    } else if video.is_some() {
        "video"
    } else if audio.is_some() {
        "audio"
    } else {
        "video"
    };

    Ok(MediaProbe {
        path,
        kind: kind.into(),
        duration,
        width,
        height,
        fps,
    })
}

/* ------------------------------------------------------------------ */
/* export (trim + concat)                                             */
/* ------------------------------------------------------------------ */

/// Monta os argumentos do ffmpeg para cortar e concatenar os segmentos.
fn build_ffmpeg_args(req: &ExportRequest) -> Vec<String> {
    let (w, h, fps) = (req.width, req.height, req.fps);
    let mut args: Vec<String> = Vec::new();

    // 1) Inputs reais com seek preciso (-ss/-t antes de -i).
    for seg in &req.segments {
        args.push("-ss".into());
        args.push(format!("{:.3}", seg.in_point));
        args.push("-t".into());
        args.push(format!("{:.3}", seg.duration));
        args.push("-i".into());
        args.push(seg.path.clone());
    }

    // 2) Inputs de silêncio (lavfi) para segmentos sem áudio.
    let audio_flags: Vec<bool> = req.segments.iter().map(|s| has_audio(&s.path)).collect();
    let mut silence_input_for: Vec<Option<usize>> = vec![None; req.segments.len()];
    let mut next_input = req.segments.len();
    for (i, seg) in req.segments.iter().enumerate() {
        if !audio_flags[i] {
            args.push("-f".into());
            args.push("lavfi".into());
            args.push("-t".into());
            args.push(format!("{:.3}", seg.duration));
            args.push("-i".into());
            args.push("anullsrc=channel_layout=stereo:sample_rate=48000".into());
            silence_input_for[i] = Some(next_input);
            next_input += 1;
        }
    }

    // 3) filter_complex: normaliza cada segmento e concatena.
    let mut filter = String::new();
    let mut concat_labels = String::new();
    for (i, _seg) in req.segments.iter().enumerate() {
        filter.push_str(&format!(
            "[{i}:v]scale={w}:{h}:force_original_aspect_ratio=decrease,\
             pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps={fps},format=yuv420p[v{i}];",
        ));
        let a_idx = if audio_flags[i] {
            i
        } else {
            silence_input_for[i].unwrap()
        };
        filter.push_str(&format!(
            "[{a_idx}:a]aresample=async=1:first_pts=0,\
             aformat=sample_rates=48000:channel_layouts=stereo[a{i}];",
        ));
        concat_labels.push_str(&format!("[v{i}][a{i}]"));
    }
    filter.push_str(&format!(
        "{concat_labels}concat=n={n}:v=1:a=1[outv][outa]",
        n = req.segments.len()
    ));

    args.push("-filter_complex".into());
    args.push(filter);
    args.extend([
        "-map", "[outv]", "-map", "[outa]",
        "-r", &fps.to_string(),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        "-y", &req.output_path,
    ].map(String::from));

    args
}

/// Lê `time=HH:MM:SS.xx` do stderr do ffmpeg → segundos.
fn parse_time(line: &str) -> Option<f64> {
    let idx = line.find("time=")?;
    let raw = line[idx + 5..].split_whitespace().next()?;
    let mut parts = raw.split(':');
    let h: f64 = parts.next()?.parse().ok()?;
    let m: f64 = parts.next()?.parse().ok()?;
    let s: f64 = parts.next()?.parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}

#[tauri::command]
pub async fn export_video(window: tauri::Window, request: ExportRequest) -> Result<String, String> {
    if request.segments.is_empty() {
        return Err("Nenhum clipe de vídeo na timeline para exportar.".into());
    }

    let total: f64 = request.segments.iter().map(|s| s.duration).sum();
    let args = build_ffmpeg_args(&request);

    let (mut rx, _child) = Command::new_sidecar("ffmpeg")
        .map_err(|e| format!("ffmpeg sidecar indisponível: {e}"))?
        .args(args)
        .spawn()
        .map_err(|e| format!("falha ao iniciar ffmpeg: {e}"))?;

    let mut err_tail = String::new();
    let mut ok = false;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                if let Some(t) = parse_time(&line) {
                    let progress = if total > 0.0 { (t / total).min(0.99) } else { 0.0 };
                    let _ = window.emit(
                        "export://progress",
                        ExportProgress { progress, done: false, output: None },
                    );
                }
                err_tail.push_str(&line);
                err_tail.push('\n');
                if err_tail.len() > 4000 {
                    err_tail = err_tail.split_off(err_tail.len() - 4000);
                }
            }
            CommandEvent::Terminated(payload) => {
                ok = payload.code == Some(0);
            }
            _ => {}
        }
    }

    if !ok {
        return Err(format!("ffmpeg falhou:\n{err_tail}"));
    }

    let _ = window.emit(
        "export://progress",
        ExportProgress { progress: 1.0, done: true, output: Some(request.output_path.clone()) },
    );
    Ok(request.output_path)
}
